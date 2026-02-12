import { Context } from 'grammy'
import { createWallet, selectWallet } from '../blockchain/wallet.service.js'
import { manageWalletsHandler } from './manageWallets.handler.js'
import { redis } from '../config/redis.js'

export async function createWalletHandler(ctx: Context) {

  const userId = ctx.from?.id
  if (!userId) return

  // Ask user for wallet name
  await ctx.reply(
    '📝 *What would you like to name this wallet?*\n\n' +
    'Example: "Trading", "Savings", "Main", etc.\n\n' +
    '_Reply with the wallet name or send /cancel_',
    { parse_mode: 'Markdown' }
  )

  // Store state that we're waiting for wallet name
  await redis.set(`wallet:naming:${userId}`, 'pending', 'EX', 300) // 5 min timeout
}

export async function handleWalletNaming(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId || !ctx.message?.text) return

  const walletName = ctx.message.text.trim()

  // Validate name length
  if (walletName.length < 1 || walletName.length > 20) {
    await ctx.reply('❌ Wallet name must be 1-20 characters long.')
    return
  }

  try {
    // Create wallet with the given name
    const wallet = await createWallet(userId, walletName)
    await selectWallet(userId, wallet.walletId)

    // Clear the naming state
    await redis.del(`wallet:naming:${userId}`)

    await ctx.reply(`✅ Wallet "${walletName}" created successfully!`)

    // Show wallet menu
    await manageWalletsHandler(ctx)
  } catch (err) {
    console.error('[Create Wallet Error]', err)
    await ctx.reply('❌ Failed to create wallet.')
  }
}
