import { Context } from 'grammy'
import { getOrCreateWallet } from '../blockchain/wallet.service.js'
import { getSolBalance } from '../blockchain/balance.service.js'

export async function walletHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const wallet = await getOrCreateWallet(userId)
    const balance = await getSolBalance(wallet.publicKey)

    await ctx.reply(
      `💼 *Your Wallet*\n\n` +
      `Address:\n\`${wallet.publicKey}\`\n\n` +
      `Balance: *${balance.toFixed(4)} SOL*`,
      { parse_mode: 'Markdown' }
    )

  } catch (err) {
    console.error('[Wallet Error]', err)
    await ctx.reply(
      '⚠️ Unable to fetch balance right now. Try again shortly.'
    )
  }
}
