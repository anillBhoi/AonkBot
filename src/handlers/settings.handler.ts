import { Context } from 'grammy'

/**
 * User settings placeholder.
 * TODO: Implement slippage, notifications, theme, etc.
 */
export async function settingsHandler(ctx: Context) {
  await ctx.reply(
    '⚙️ *Settings*\n\n' +
    'Settings (slippage, notifications, etc.) are coming soon.\n\n' +
    'Use *Wallet* to manage your wallets and *Help* for commands.',
    { parse_mode: 'Markdown' }
  )
}
