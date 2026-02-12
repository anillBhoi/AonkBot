import { Context } from 'grammy'
import { routes } from './router.js'
import { unknownHandler } from '../handlers/unknown.handler.js'
import { acquireLock } from './locks.js'
import { walletSelectHandler } from '../handlers/walletSelect.handler.js'
import { createWalletHandler } from '../handlers/createWallet.handler.js'


export async function routeCallback(ctx: Context) {

  const data = ctx.callbackQuery?.data
  if (!data) return

  const userId = ctx.from?.id
  if (!userId) return

  /* ===== Always acknowledge button ===== */
  await ctx.answerCallbackQuery().catch(() => {})

  /* ==================================================
     CLOSE CALLBACK (Handle BEFORE other routes)
  =================================================== */

  if (data === 'close') {
    // Delete the message smoothly
    await ctx.deleteMessage().catch(() => {})
    return
  }

  /* ==================================================
     WALLET CALLBACKS (Handle BEFORE cmd routing)
  =================================================== */

  if (data.startsWith('wallet_select:')) {
    return walletSelectHandler(ctx)
  }

    if (data === 'wallet_create') {
    return createWalletHandler(ctx)
  }

  /* ==================================================
     GENERIC COMMAND CALLBACKS
  =================================================== */

  if (!data.startsWith('cmd:')) return

  const command = data.replace('cmd:', '')

  /* ===== Lock Protection ===== */

  const locked = await acquireLock(userId, command, 30000)

  if (!locked) {
    await ctx.reply('⏳ Please wait a moment.')
    return
  }

  const handler = routes[command] ?? unknownHandler
  await handler(ctx)
}
