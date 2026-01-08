import { Context } from 'grammy'
import { getConfirmation, clearConfirmation } from '../core/confirmations/confirmation.service.js'
import { getOrCreateWallet } from '../blockchain/wallet.service.js'
import { sendSol } from '../blockchain/transfer.service.js'
import { acquireLock } from '../core/locks.js'

export async function confirmHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  const locked = await acquireLock(userId, 'confirm')
  if (!locked) return

  const draft = await getConfirmation(userId)
  if (!draft) {
    await ctx.reply('❌ No pending transaction')
    return
  }

  try {
    const wallet = await getOrCreateWallet(userId)

    const sig = await sendSol(
      wallet.encryptedPrivateKey,
      draft.address,
      draft.amount
    )

    await clearConfirmation(userId)

    await ctx.reply(
      `✅ *Transaction Sent Successfully*\n\n` +
      `Amount: ${draft.amount} SOL\n` +
      `Tx:\n\`${sig}\``,
      { parse_mode: 'Markdown' }
    )

  } catch (err: any) {
    console.error('[Confirm Error]', err)

    // 🔥 USER MUST KNOW WHAT HAPPENED
    await ctx.reply(
      `❌ Transaction failed\n\nReason:\n${err.message}`
    )
  }
}

