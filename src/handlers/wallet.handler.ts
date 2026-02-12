import { Context } from 'grammy'
import { getSelectedWallet } from '../blockchain/wallet.service.js'
import { getSolBalance, getTokenBalances } from '../blockchain/balance.service.js'
import { walletMenu } from '../ui/walletMenu.js'

export async function walletHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  let loadingMsg: any | undefined
  try {
    // Show loading state and keep reference so we can remove it later
    loadingMsg = await ctx.reply('💼 *Loading wallet...*', { parse_mode: 'Markdown' })

    const wallet = await getSelectedWallet(userId)
    if (!wallet) {
      // remove loading indicator before returning
      try { if (loadingMsg?.chat && loadingMsg?.message_id) await ctx.api.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id) } catch {}
      await ctx.reply('❌ No wallet selected. Use /wallet to select one.').catch(() => {})
      return
    }

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
      `*${wallet.name}*\n\n` +
      `📍 Address: \`${shortAddress}\`\n\n` +
      `⭐ SOL Balance: *${solBalance.toFixed(4)} SOL*` +
      tokenBalancesText +
      `\n\n` +
      `Use /send to swap tokens\n` +
      `Use /txs to view transaction history`,
      // { parse_mode: 'Markdown' }
       { reply_markup: walletMenu }
    )
    // remove loading indicator now that final message is sent
    try { if (loadingMsg?.chat && loadingMsg?.message_id) await ctx.api.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id) } catch {}
  } catch (err: any) {
    console.error('[Wallet Handler Error]', err)
    // remove loading indicator on error if present
    try { if (loadingMsg?.chat && loadingMsg?.message_id) await ctx.api.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id) } catch {}

    await ctx.reply(
      `⚠️ Unable to fetch wallet details\n\n` +
      `Error: ${err.message}\n` +
      `Please try again shortly.`,
      // { parse_mode: 'Markdown' }
       { reply_markup: walletMenu }
    )
  }
}
