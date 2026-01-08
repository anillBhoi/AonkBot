import { Context } from 'grammy'
import { acquireLock } from './locks.js'

import { startHandler } from '../handlers/start.handler.js'
import { helpHandler } from '../handlers/help.handler.js'
import { walletHandler } from '../handlers/wallet.handler.js'
import { sendHandler } from '../handlers/send.handler.js'
import { confirmHandler } from '../handlers/confirm.handler.js'
// import { cancelHandler } from '../handlers/cancel.handler.js'
import { unknownHandler } from '../handlers/unknown.handler.js'
import { cancelHandler } from '../handlers/cancel.handler.js'

const routes: Record<string, (ctx: Context) => Promise<void>> = {
  start: startHandler,
  wallet: walletHandler,
  send: sendHandler,
  confirm: confirmHandler,
  cancel: cancelHandler,
  help: helpHandler
}

const MUTATING_COMMANDS = new Set(['send', 'confirm', 'cancel'])

export async function routeCommand(ctx: Context) {
  const text = ctx.message?.text
  if (!text) return

  const command = text
    .trim()
    .split(' ')[0]
    .replace('/', '')
    .split('@')[0]

  const userId = ctx.from?.id
  if (!userId) return

  // lock non-mutating commands only
  if (!MUTATING_COMMANDS.has(command)) {
    const locked = await acquireLock(userId, command)
    if (!locked) return
  }

  const handler = routes[command] ?? unknownHandler
  await handler(ctx)
}
