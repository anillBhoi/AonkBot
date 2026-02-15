import { Context } from 'grammy'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'

export async function referHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return

  const botUsername = (await ctx.api.getMe()).username
  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`

  const referredCount = await redis.scard(redisKeys.refReferredSet(userId))
  const inviterId = await redis.get(redisKeys.refInviter(userId))

  let msg =
    '👥 *Refer Friends*\n\n' +
    'Share your link; when friends join and trade, you can earn rewards.\n\n' +
    `🔗 \`${refLink}\`\n\n` +
    `👤 *Referred:* ${referredCount} user${referredCount !== 1 ? 's' : ''}`

  if (inviterId) {
    msg += `\n\nYou were referred by another user.`
  }

  msg += '\n\n_Tap Wallet to see your balance._'

  await ctx.reply(msg, { parse_mode: 'Markdown' })
}
