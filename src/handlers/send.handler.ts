import { Context } from 'grammy'
import { getOrCreateWallet } from '../blockchain/wallet.service.js'
import { sendSol } from '../blockchain/transfer.service.js'
import { acquireLock } from '../core/locks.js'

export async function sendHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  const text = ctx.message?.text || ''
  const [, amountStr, address] = text.split(' ')

  if (!amountStr || !address) {
    await ctx.reply('Usage: /send <amount> <solana_address>')
    return
  }

  const amount = Number(amountStr)
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('Invalid amount')
    return
  }

  // 🔒 Prevent double-send
  const locked = await acquireLock(userId, 'send')
  if (!locked) return

  try {
    const wallet = await getOrCreateWallet(userId)

    const sig = await sendSol(
      wallet.encryptedPrivateKey,
      address,
      amount
    )

    await ctx.reply(
      `✅ Sent *${amount} SOL*\n\nTx:\n\`${sig}\``,
      { parse_mode: 'Markdown' }
    )
  } catch (err: any) {
    console.error('[Send Error]', err)
    await ctx.reply(`❌ ${err.message}`)
  }
}
