import { Context } from 'grammy'
import { getOrCreateWallet } from "../blockchain/wallet.service.js";
import { getRecentTransactions } from '../blockchain/tx.service.js'
import { redis } from '../config/redis.js'
import { config } from '../utils/config.js'

export async function txsHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const wallet = await getOrCreateWallet(userId)
    const pageSize = 10

    const cluster =
      config.solanaCluster === 'devnet' ? 'devnet' : 'mainnet-beta'

    const explorerUrl = (sig: string) =>
      cluster === 'mainnet-beta'
        ? `https://solscan.io/tx/${sig}`
        : `https://explorer.solana.com/tx/${sig}?cluster=devnet`

    // ── REDIS TRADE HISTORY ──
    const tradeHistory = await redis.lrange(
      `user:${userId}:trade-history`,
      0,
      pageSize - 1
    )

    if (tradeHistory.length > 0) {
      const trades = await Promise.all(
        tradeHistory.map(async (sig) => {
          const data = await redis.get(`user:${userId}:trades:${sig}`)
          return data ? JSON.parse(data) : null
        })
      )

      const validTrades = trades.filter(Boolean)

      if (validTrades.length > 0) {
        const lines = validTrades.map((trade: any, i: number) => {
          const sig = trade.signature
          const quote = trade.quote ?? {}

          const output =
            typeof quote.outAmount === 'number'
              ? quote.outAmount.toFixed(6)
              : 'N/A'

          const impact =
            typeof quote.priceImpactPct === 'number'
              ? `${quote.priceImpactPct.toFixed(2)}%`
              : 'N/A'

          const shortSig =
            sig.slice(0, 8) + '...' + sig.slice(-8)

          return (
            `${i + 1}. ✅ Swap\n` +
            `   Output: ${output}\n` +
            `   Impact: ${impact}\n` +
            `   [${shortSig}](${explorerUrl(sig)})`
          )
        })

        await ctx.reply(`📜 *Recent Trades*\n\n${lines.join('\n\n')}`, {
          parse_mode: 'Markdown',
          link_preview_options: { is_disabled: true }
        })
        return
      }
    }

    // ── FALLBACK: ON-CHAIN TXS ──
    const txs = await getRecentTransactions(wallet.publicKey, pageSize)

    if (txs.length === 0) {
      await ctx.reply('📭 No recent transactions found')
      return
    }

    const lines = txs.map((tx, i) => {
      const status = tx.err ? '❌ Failed' : '✅ Success'
      const sig = tx.signature
      const shortSig = sig.slice(0, 8) + '...' + sig.slice(-8)

      return (
        `${i + 1}. ${status}\n` +
        `   Slot: ${tx.slot}\n` +
        `   [${shortSig}](${explorerUrl(sig)})`
      )
    })

    await ctx.reply(`📜 *Recent Transactions*\n\n${lines.join('\n\n')}`, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true }
    })
  } catch (err: any) {
    console.error('[Txs Handler Error]', err)
    await ctx.reply(`❌ Failed to fetch transactions\n\n${err.message}`)
  }
}
