import { Context } from 'grammy'

/**
 * Price / alert preferences placeholder.
 * TODO: Implement price alerts (e.g. notify when token hits $X).
 */
export async function alertsHandler(ctx: Context) {
  await ctx.reply(
    '🔔 *Alerts*\n\n' +
    'Price alerts and notifications are coming soon.\n\n' +
    'You will be able to get notified when a token reaches a target price.',
    { parse_mode: 'Markdown' }
  )
}
