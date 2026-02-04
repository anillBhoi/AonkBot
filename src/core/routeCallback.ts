import { Context } from 'grammy'
import { routes } from './router.js'
import { unknownHandler } from '../handlers/unknown.handler.js'
import { acquireLock } from './locks.js'

export async function routeCallback(ctx: Context) {

  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('cmd:')) return

  const command = data.replace('cmd:', '')

  const userId = ctx.from?.id
  if (!userId) return

  /* ===== Acknowledge Button ===== */
  await ctx.answerCallbackQuery().catch(() => {})

  /* ===== Lock Protection ===== */
  const locked = await acquireLock(userId, command, 30000)

  if (!locked) {
    await ctx.reply('⏳ Please wait a moment.')
    return
  }

  const handler = routes[command] ?? unknownHandler
  await handler(ctx)
}
