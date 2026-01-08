import { Context } from 'grammy'
import { clearConfirmation } from '../core/confirmations/confirmation.service.js'

export async function cancelHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  await clearConfirmation(userId)
  await ctx.reply('🚫 Transaction cancelled')
}
