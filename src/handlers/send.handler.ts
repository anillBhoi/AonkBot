import { Context } from 'grammy'
import { acquireLock } from '../core/locks.js'
import { createConfirmation } from '../core/confirmations/confirmation.service.js'
import { validateSolanaAddress } from '../core/validators/solanaAddress.validator.js'

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

  try {
    //  THIS IS THE KEY FIX
    validateSolanaAddress(address)
  } catch (err: any) {
    await ctx.reply(err.message)
    return
  }

  const locked = await acquireLock(userId, 'send-draft')
  if (!locked) return

  await createConfirmation(userId, { amount, address })

  await ctx.reply(
    `⚠️ *Confirm Transaction*\n\n` +
    `Send *${amount} SOL*\n` +
    `To:\n\`${address}\`\n\n` +
    `Type /confirm to proceed or /cancel`,
    { parse_mode: 'Markdown' }
  )
}
