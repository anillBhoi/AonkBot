import { Context } from 'grammy'
import { getOrCreateWallet } from '../blockchain/wallet.service.js'
import { getRecentTransactions } from '../blockchain/tx.service.js'

export async function txsHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const wallet = await getOrCreateWallet(userId)

    const txs = await getRecentTransactions(
      wallet.publicKey,
      5
    )

    if (txs.length === 0) {
      await ctx.reply('📭 No recent transactions found')
      return
    }

    const lines = txs.map((tx, i) => {
      const status = tx.err ? '❌ Failed' : '✅ Success'
      const explorer = `https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`

      return (
        `${i + 1}. ${status}\n` +
        `🔗 ${explorer}`
      )
    })

    await ctx.reply(
      `📜 *Recent Transactions*\n\n${lines.join('\n\n')}`,
      { parse_mode: 'Markdown' }
    )
  } catch (err: any) {
    console.error('[Txs Handler Error]', err)
    await ctx.reply('❌ Failed to fetch transactions')
  }
}
