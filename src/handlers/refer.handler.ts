import { Context } from 'grammy'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import { getReferralStats } from '../services/referral.service.js'

const REF_REWARD_PCT = 0.25 // 0.25% of referral volume as reward (BonkBot-style cashback)

export async function referHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return

  const botUsername = (await ctx.api.getMe()).username
  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`

  const stats = await getReferralStats(userId)
  const inviterId = await redis.get(redisKeys.refInviter(userId))

  const earnedSol = stats.volumeSol * (REF_REWARD_PCT / 100)
  const earnedLine =
    stats.tradeCount > 0
      ? `\n💰 *Volume from referrals:* ${stats.volumeSol.toFixed(4)} SOL\n🎁 *Earned (${REF_REWARD_PCT}%):* ~${earnedSol.toFixed(4)} SOL`
      : ''

  let msg =
    '👥 *Refer Friends*\n\n' +
    'Share your link; when friends join and trade, you earn a % of their volume.\n\n' +
    `🔗 \`${refLink}\`\n\n` +
    `👤 *Referred:* ${stats.referredCount} user${stats.referredCount !== 1 ? 's' : ''}` +
    (stats.tradeCount > 0 ? `\n📊 *Trades from referrals:* ${stats.tradeCount}` : '') +
    earnedLine

  if (inviterId) {
    msg += '\n\n_You were referred by another user._'
  }

  msg += '\n\n_Tap Wallet to see your balance._'

  await ctx.reply(msg, { parse_mode: 'Markdown' })
}
