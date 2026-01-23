import { Context } from 'grammy'
import { getOrCreateWallet } from '../blockchain/wallet.service.js'
import { getRecentTransactions } from '../blockchain/tx.service.js'
import { redis } from '../config/redis.js'

export async function txsHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const wallet = await getOrCreateWallet(userId)
    const page = 0
    const pageSize = 10

    // Try to get from user's trade history first
    const tradeHistory = await redis.lrange(
      `user:${userId}:trade-history`,
      page * pageSize,
      page * pageSize + pageSize - 1
    )

    if (tradeHistory.length > 0) {
      const trades = await Promise.all(
        tradeHistory.map(async (sig) => {
          const tradeData = await redis.get(`user:${userId}:trades:${sig}`)
          return tradeData ? JSON.parse(tradeData) : null
        })
      )

      const validTrades = trades.filter(t => t !== null)

      if (validTrades.length > 0) {
        const lines = validTrades.map((trade, i) => {
          const quote = trade.quote
          const shortSig = trade.signature.slice(0, 8) + '...' + trade.signature.slice(-8)
          const explorerUrl = `https://explorer.solana.com/tx/${trade.signature}?cluster=mainnet-beta`

          return (
            `${i + 1}. ✅ Swapped\n` +
            `   Output: ${quote.outAmount.toFixed(6)}\n` +
            `   Impact: ${quote.priceImpactPct.toFixed(2)}%\n` +
            `   [${shortSig}](${explorerUrl})`
          )
        })

        await ctx.reply(
          `📜 *Recent Trades*\n\n${lines.join('\n\n')}`,
          { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } }
        )
        return
      }
    }

    // Fallback to blockchain transactions
    const txs = await getRecentTransactions(wallet.publicKey, 10)

    if (txs.length === 0) {
      await ctx.reply('📭 No recent transactions found')
      return
    }

    const lines = txs.map((tx, i) => {
      const status = tx.err ? '❌ Failed' : '✅ Success'
      const shortSig = tx.signature.slice(0, 8) + '...' + tx.signature.slice(-8)
      const explorerUrl = `https://explorer.solana.com/tx/${tx.signature}?cluster=mainnet-beta`

      return (
        `${i + 1}. ${status}\n` +
        `   Slot: ${tx.slot}\n` +
        `   [${shortSig}](${explorerUrl})`
      )
    })

    await ctx.reply(
      `📜 *Recent Transactions*\n\n${lines.join('\n\n')}`,
      { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } }
    )
  } catch (err: any) {
    console.error('[Txs Handler Error]', err)
    await ctx.reply(
      `❌ Failed to fetch transactions\n\n` +
      `Error: ${err.message}`,
      { parse_mode: 'Markdown' }
    )
  }
}
