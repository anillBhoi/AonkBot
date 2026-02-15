import { Context } from 'grammy'

/**
 * Referral program placeholder.
 * TODO: Implement referral tracking, rewards, and /referrals stats.
 */
export async function referHandler(ctx: Context) {
  const botUsername = (await ctx.api.getMe()).username
  const refLink = `https://t.me/${botUsername}?start=ref_${ctx.from?.id ?? 0}`

  await ctx.reply(
    '👥 *Refer Friends*\n\n' +
    'Share your link and earn when friends trade:\n\n' +
    `🔗 ${refLink}\n\n` +
    'Referral rewards coming soon. Tap *Wallet* to see your balance.',
    { parse_mode: 'Markdown' }
  )
}
