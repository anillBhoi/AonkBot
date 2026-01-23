import { Context } from 'grammy'
import { getConfirmation, clearConfirmation } from '../core/confirmations/confirmation.service.js'
import { releaseLock } from '../core/locks.js'
import { redisKeys } from '../utils/redisKeys.js'
import { redis } from '../config/redis.js'

export async function cancelHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const confirmation = await getConfirmation(userId)

    if (!confirmation) {
      await ctx.reply('❌ No pending transaction to cancel')
      return
    }

    // Clear confirmation
    await clearConfirmation(userId)

    // Release any locks
    const lockKey = redisKeys.lock(userId, 'send-draft')
    await releaseLock(lockKey)

    // Also clear any trade intent
    if (confirmation.tradeIntent) {
      await redis.del(`trade:${confirmation.tradeIntent.tradeId}:intent`)
    }

    await ctx.reply(
      `🚫 *Transaction Cancelled*\n\n` +
      `Your SOL remains safe in your wallet.`,
      { parse_mode: 'Markdown' }
    )
  } catch (err: any) {
    console.error('[Cancel Handler Error]', err)
    await ctx.reply(
      `⚠️ Error cancelling transaction\n\n` +
      `Error: ${err.message}`,
      { parse_mode: 'Markdown' }
    )
  }
}
