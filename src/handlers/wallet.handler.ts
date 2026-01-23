import { Context } from 'grammy'
import { getOrCreateWallet } from '../blockchain/wallet.service.js'
import { getSolBalance, getTokenBalances } from '../blockchain/balance.service.js'

export async function walletHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    // Show loading state
    await ctx.reply('💼 *Loading wallet...*', { parse_mode: 'Markdown' })

    const wallet = await getOrCreateWallet(userId)
    const solBalance = await getSolBalance(wallet.publicKey)

    // Try to fetch token balances
    let tokenBalancesText = ''
    try {
      const tokenBalances = await getTokenBalances(wallet.publicKey)

      if (tokenBalances.length > 0) {
        tokenBalancesText = '\n\n*Token Balances:*\n'
        tokenBalancesText += tokenBalances
          .slice(0, 5) // Show top 5 tokens
          .map(t => `• ${t.symbol}: ${t.balance.toFixed(6)}`)
          .join('\n')

        if (tokenBalances.length > 5) {
          tokenBalancesText += `\n... and ${tokenBalances.length - 5} more`
        }
      }
    } catch (err) {
      console.log('[Token Balances Fetch Error]', err)
      // Continue without token balances
    }

    const shortAddress = wallet.publicKey.slice(0, 8) + '...' + wallet.publicKey.slice(-8)

    await ctx.reply(
      `💼 *Your Wallet*\n\n` +
      `📍 Address: \`${shortAddress}\`\n\n` +
      `⭐ SOL Balance: *${solBalance.toFixed(4)} SOL*` +
      tokenBalancesText +
      `\n\n` +
      `Use /send to swap tokens\n` +
      `Use /txs to view transaction history`,
      { parse_mode: 'Markdown' }
    )
  } catch (err: any) {
    console.error('[Wallet Handler Error]', err)
    await ctx.reply(
      `⚠️ Unable to fetch wallet details\n\n` +
      `Error: ${err.message}\n` +
      `Please try again shortly.`,
      { parse_mode: 'Markdown' }
    )
  }
}
