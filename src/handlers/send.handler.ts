import { Context } from 'grammy'
import { acquireLock } from '../core/locks.js'
import { createConfirmation } from '../core/confirmations/confirmation.service.js'
import { validateAmount } from '../core/validators/amount.validator.js'
import { getQuote } from '../blockchain/jupiter.service.js'
import { getSolBalance, ensureSolBalance } from '../blockchain/balance.service.js'
import { getOrCreateWallet } from '../blockchain/wallet.service.js'
import { createTradeIntent, TradeIntent } from '../core/trades/trade.intent.js'
import { redis } from '../config/redis.js'
import { TOKENS } from '../utils/tokens.js'

export async function sendHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const text = ctx.message?.text || ''
    const args = text.split(' ')

    // Parse flexible forms:
    // /swap <amount> <token> [slippage]
    // /swap <amount> <fromToken> to <toToken> [slippage]
    // /swap 1 USDC            => swap 1 SOL -> USDC (default base SOL)
    // /swap 120 USDC to SOL   => swap 120 USDC -> SOL

    const amountStr = args[1]
    const tokenA = args[2]?.toUpperCase()
    const maybeTo = args[3]?.toLowerCase()
    const tokenB = args[4]?.toUpperCase()
    const slippageStr = (maybeTo === 'to') ? args[5] : args[3]

    // Determine which form user used
    let inputSymbol = 'SOL'
    let outputSymbol: string | undefined = undefined

    if (tokenA && maybeTo === 'to' && tokenB) {
      // Form: /swap <amount> <fromToken> to <toToken>
      inputSymbol = tokenA
      outputSymbol = tokenB
    } else if (tokenA) {
      // Short form: /swap <amount> <token> (assume SOL -> token)
      outputSymbol = tokenA
    }

    if (!amountStr || !outputSymbol) {
      await ctx.reply(
        `📤 *Swap tokens*\n\n` +
        `Usage: /swap <amount> <token> [slippage]\n` +
        `Alias: /trade\n\n` +
        `Examples:\n` +
        `  /swap 1 USDC           (swap 1 SOL -> USDC)\n` +
        `  /swap 120 USDC to SOL  (swap 120 USDC -> SOL)\n\n` +
        `Default: amount is measured in *SOL* when no source token is provided.\n` +
        `Available tokens: ${Object.keys(TOKENS).join(', ')}`,
        { parse_mode: 'Markdown' }
      )
      return
    }

    // Validate token symbols (inputSymbol -> outputSymbol)
    // Use TOKENS map to check supported tokens
    if (!TOKENS[inputSymbol]) throw new Error(`Unsupported token: ${inputSymbol}`)
    if (!TOKENS[outputSymbol!]) throw new Error(`Unsupported token: ${outputSymbol}`)

    const slippageBps = slippageStr ? Math.max(1, Math.min(500, Number(slippageStr))) : 50

    // If input is SOL, check SOL balance; if input is some token, we currently only support SOL as source in UI
    const wallet = await getOrCreateWallet(userId)

    if (inputSymbol === 'SOL') {
      const amount = validateAmount(amountStr)

      const hasBalance = await ensureSolBalance(wallet.publicKey, amount, 0.05)

      if (!hasBalance) {
        const balance = await getSolBalance(wallet.publicKey)
        await ctx.reply(
          `❌ Insufficient balance\n\n` +
          `You have: ${balance.toFixed(4)} SOL\n` +
          `You need: ${amount} SOL + ~0.01 SOL fee`
        )
        return
      }

      // Fetch quote (SOL -> outputSymbol)
      await ctx.reply('🔄 Getting quote...')
      const quote = await getQuote('SOL', outputSymbol!, amount, slippageBps)

      // Acquire lock for this user
      const locked = await acquireLock(userId, 'send-draft', 60000)
      if (!locked) {
        await ctx.reply('⚠️ Another transaction is pending. Please try again.')
        return
      }

      // Create trade intent
      const tradeIntent: TradeIntent = createTradeIntent({
        userId: userId.toString(),
        side: 'BUY',
        inputMint: TOKENS.SOL.mint,
        outputMint: TOKENS[outputSymbol!].mint,
        amountLamports: BigInt(Math.floor(amount * 1_000_000_000)),
        slippageBps
      })

      // Store confirmation with quote (convert BigInt to string)
      const confirmationPayload = {
        tradeIntent: {
          ...tradeIntent,
          amountLamports: tradeIntent.amountLamports.toString()
        },
        quote,
        timestamp: Date.now()
      }
      
      await createConfirmation(userId, confirmationPayload)

      // Store trade intent in Redis (convert BigInt to string for serialization)
      await redis.set(
        `trade:${tradeIntent.tradeId}:intent`,
        JSON.stringify({
          ...tradeIntent,
          amountLamports: tradeIntent.amountLamports.toString()
        }),
        'EX',
        300 // 5 minutes
      )

      // Format output
      const minOutput = quote.outAmount * (1 - slippageBps / 10000)
      const priceImpact = quote.priceImpactPct.toFixed(2)

      await ctx.reply(
        `📊 *Swap Quote*\n\n` +
        `*From:* ${amount} SOL\n` +
        `*To:* ~${quote.outAmount.toFixed(6)} ${outputSymbol}\n\n` +
        `*Min Output:* ${minOutput.toFixed(6)} ${outputSymbol}\n` +
        `*Price Impact:* ${priceImpact}%\n` +
        `*Fee:* ~0.005 SOL\n\n` +
        `Use /confirm to execute or /cancel to abort`,
        { parse_mode: 'Markdown' }
      )

      return
    }

    // For now, only SOL -> token is supported via the UI quick command. Show guidance for reverse trades
    await ctx.reply('⚠️ Reverse swaps (token -> SOL) are not yet supported via the quick CLI. Use the app or try /trade for advanced flow.')

  } catch (err: any) {
    console.error('[Send Handler Error]', err)
    await ctx.reply(
      `❌ Error: ${err.message}\n\n` +
      `Try again with: /send <amount> <token>`
    )
  }
}
