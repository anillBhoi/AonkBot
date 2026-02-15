import { Context } from 'grammy'
import { config } from '../utils/config.js'

/**
 * Open telemetry / stats placeholder.
 * TODO: Link to dashboard or show in-chat stats.
 */
export async function openTelemetryHandler(ctx: Context) {
  const cluster = config.solanaCluster === 'devnet' ? 'Devnet' : 'Mainnet'
  await ctx.reply(
    '📊 *Telemetry*\n\n' +
    `Network: *${cluster}*\n\n` +
    'Detailed stats and dashboard coming soon.',
    { parse_mode: 'Markdown' }
  )
}
