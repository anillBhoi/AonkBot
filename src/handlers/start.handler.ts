import { Context } from 'grammy'
import { getOrCreateWallet } from '../blockchain/wallet.service.js'

export async function startHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return

  const wallet = await getOrCreateWallet(userId)

  await ctx.reply(
    `👋 Welcome\n\n` +
    `Your Solana wallet is ready:\n` +
    `\`${wallet.publicKey}\`\n\n` +
    `Use /wallet to view balance`,
    { parse_mode: 'Markdown' }
  )
}
