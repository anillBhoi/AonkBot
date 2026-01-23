import { Context } from 'grammy'
import { getConfirmation, clearConfirmation } from '../core/confirmations/confirmation.service.js'
import { getOrCreateWallet, loadWalletSigner } from '../blockchain/wallet.service.js'
import { acquireLock, releaseLock } from '../core/locks.js'
import { getSwapRoute, buildSwapTx } from '../blockchain/jupiter.service.js'
import { simulateTx, sendTxAndConfirm } from '../blockchain/tx.service.js'
import { invalidateBalanceCache } from '../blockchain/balance.service.js'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import { tradeQueue } from '../queue/trade.queue.js'
import { config } from '../utils/config.js'
import { getTxLink } from '../blockchain/explorer.js'

export async function confirmHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const confirmation = await getConfirmation(userId)

    if (!confirmation || (!confirmation.tradeIntent && !confirmation.transfer)) {
      await ctx.reply('❌ No pending transaction. Use /swap to create one or /send to transfer SOL')
      return
    }

    const telegramId = Number(userId)

    // Transfer flow
    if (confirmation.transfer) {
      const { transfer } = confirmation

      // Acquire execution lock
      const locked = await acquireLock(telegramId, 'transfer', 120000)
      if (!locked) {
        await ctx.reply('⏳ Another operation is being processed. Please wait...')
        return
      }

      const lockKey = redisKeys.lock(telegramId, 'transfer')

      try {
        await ctx.reply('⏳ *Processing transfer...*\n\nSimulating transaction...', { parse_mode: 'Markdown' })

        // Load signer and wallet
        const wallet = await getOrCreateWallet(userId)
        const signer = await loadWalletSigner(userId)

        // Perform transfer using sendSol helper
        const { sendSol } = await import('../blockchain/transfer.service.js')

        const signature = await sendSol(
          wallet.encryptedPrivateKey,
          transfer.toAddress,
          transfer.amount
        )

        // Store result
        const result = {
          signature,
          transfer,
          status: 'confirmed',
          confirmedAt: Date.now()
        }

        await redis.set(
          `user:${telegramId}:trades:${signature}`,
          JSON.stringify(result),
          'EX',
          2592000
        )

        await redis.lpush(
          `user:${telegramId}:trade-history`,
          signature
        )

        await redis.ltrim(
          `user:${telegramId}:trade-history`,
          0,
          99
        )

        await clearConfirmation(userId)

        // Invalidate SOL balance cache after transfer
        try {
          await invalidateBalanceCache(wallet.publicKey)
        } catch (err) {
          console.warn('[Balance Cache] Failed to invalidate cache after transfer', err)
        }

        const explorerUrl = getTxLink(signature)

        await ctx.reply(
          `✅ *Transfer Sent Successfully!*\n\n` +
          `Amount: ${transfer.amount} SOL\n` +
          `[View on Explorer](${explorerUrl})`,
          { parse_mode: 'Markdown' }
        )
      } catch (err: any) {
        console.error('[Transfer Execution Error]', err)
        await clearConfirmation(userId)
        await ctx.reply(`❌ *Transfer Failed*\n\nReason: ${err.message}`, { parse_mode: 'Markdown' })
      } finally {
        await releaseLock(lockKey)
      }

      return
    }

    // Otherwise, trade flow
    const { tradeIntent, quote } = confirmation

    // Acquire execution lock
    const locked = await acquireLock(telegramId, 'trade', 120000)
    if (!locked) {
      await ctx.reply('⏳ Another trade is being processed. Please wait...')
      return
    }

    const lockKey = redisKeys.lock(telegramId, 'trade')

    try {
      // Show processing message
      await ctx.reply('⏳ *Processing trade...*\n\nFetching route...', {
        parse_mode: 'Markdown'
      })

      // Get wallet
      const wallet = await getOrCreateWallet(userId)
      const signer = await loadWalletSigner(userId)

      // Reconstruct tradeIntent with proper types (amountLamports comes back as string from Redis)
      const reconstructedIntent = {
        ...tradeIntent,
        amountLamports: typeof tradeIntent.amountLamports === 'string' 
          ? BigInt(tradeIntent.amountLamports)
          : tradeIntent.amountLamports
      }

      // Fetch fresh route (or use stored quote if route fetch fails)
      let route: any
      try {
        console.log('[Confirm] Fetching swap route with intent:', {
          inputMint: reconstructedIntent.inputMint,
          outputMint: reconstructedIntent.outputMint,
          amountLamports: reconstructedIntent.amountLamports.toString()
        })
        
        route = await getSwapRoute(reconstructedIntent)
        console.log('[Confirm] Got route:', route)
      } catch (routeError: any) {
        console.warn('[Confirm] Failed to get fresh route, attempting to use stored quote:', routeError.message)
        
        // On devnet, try to convert the stored quote into a route format
        if (config.solanaCluster === 'devnet' && config.useDevnetDex && quote) {
          try {
            // Try to find the pool to get poolAddress for the route
            const { ensurePoolExistsOrSetup } = await import('../blockchain/devnetDex.service.js')
            const pool = await ensurePoolExistsOrSetup(reconstructedIntent.inputMint, reconstructedIntent.outputMint)
            
            if (pool) {
              // Convert quote to route format for devnet
              route = {
                inAmount: quote.inAmount,
                outAmount: quote.outAmount,
                priceImpactPct: quote.priceImpactPct || 0,
                poolAddress: pool.poolAddress
              }
              console.log('[Confirm] Created route from stored quote:', route)
            } else {
              throw new Error('No pool found on Devnet. Please run devnet-setup.')
            }
          } catch (quoteError: any) {
            console.error('[Confirm] Failed to create route from quote:', quoteError)
            throw new Error(`Failed to get swap route: ${routeError.message}. Quote conversion also failed: ${quoteError.message}`)
          }
        } else {
          // Not on devnet or no devnet DEX, rethrow original error
          throw routeError
        }
      }

      // Build swap transaction
      const tx = await buildSwapTx(route, wallet.publicKey)

      // Simulate
      await ctx.reply('⏳ *Processing trade...*\n\nSimulating transaction...', {
        parse_mode: 'Markdown'
      })

      const simSuccess = await simulateTx(tx)
      if (!simSuccess) {
        await ctx.reply('❌ Transaction simulation failed. Please try again with different parameters.')
        await clearConfirmation(userId)
        return
      }

      // Send transaction
      await ctx.reply('⏳ *Processing trade...*\n\nSending transaction...', {
        parse_mode: 'Markdown'
      })

      const signature = await sendTxAndConfirm(tx, signer, 3)

      // Invalidate balance cache for both input and output tokens to force refresh
      try {
        await invalidateBalanceCache(wallet.publicKey, reconstructedIntent.inputMint)
        await invalidateBalanceCache(wallet.publicKey, reconstructedIntent.outputMint)
        console.log(`[Balance Cache] Invalidated balances for swap: ${reconstructedIntent.inputMint} -> ${reconstructedIntent.outputMint}`)
      } catch (err) {
        console.warn('[Balance Cache] Failed to invalidate cache after swap', err)
        // Don't fail the trade if cache invalidation fails
      }

      // Store trade result
      const tradeResult = {
        signature,
        tradeIntent,
        quote,
        status: 'confirmed',
        confirmedAt: Date.now()
      }

      await redis.set(
        `user:${telegramId}:trades:${signature}`,
        JSON.stringify(tradeResult),
        'EX',
        2592000 // 30 days
      )

      // Add to user's trade history list
      await redis.lpush(
        `user:${telegramId}:trade-history`,
        signature
      )

      await redis.ltrim(
        `user:${telegramId}:trade-history`,
        0,
        99 // Keep last 100 trades
      )

      // Clear confirmation
      await clearConfirmation(userId)

      // Success message with explorer link (use correct cluster)
      const explorerUrl = getTxLink(signature)

      await ctx.reply(
        `✅ *Trade Executed Successfully!*\n\n` +
        `Amount: ${quote.outAmount.toFixed(6)}\n` +
        `Impact: ${quote.priceImpactPct.toFixed(2)}%\n\n` +
        `[View on Explorer](${explorerUrl})`,
        { parse_mode: 'Markdown' }
      )
    } catch (err: any) {
      console.error('[Confirm Execution Error]', err)

      await clearConfirmation(userId)

      await ctx.reply(
        `❌ *Trade Failed*\n\n` +
        `Reason: ${err.message}\n\n` +
        `Your SOL is safe. Please try again or contact support.`,
        { parse_mode: 'Markdown' }
      )
    } finally {
      await releaseLock(lockKey)
    }
  } catch (err: any) {
    console.error('[Confirm Handler Error]', err)
    await ctx.reply(
      `❌ Error: ${err.message}\n\n` +
      `Please try again with /send`
    )
  }
}

