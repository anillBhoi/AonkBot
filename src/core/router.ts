import { Context } from 'grammy'
import { acquireLock } from './locks.js'
import { startHandler } from '../handlers/start.handler.js'
import { helpHandler } from '../handlers/help.handler.js'
import { unknownHandler } from '../handlers/unknown.handler.js'
import { walletHandler } from '../handlers/wallet.handler.js'
import { sendHandler } from '../handlers/send.handler.js'

const routes: Record<string, (ctx: Context) => Promise<void>> = {
  start: startHandler,
  wallet: walletHandler,
  send: sendHandler,
  help: helpHandler
}

const MUTATING_COMMANDS = new Set(['send'])

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

  // Lock ONLY non-mutating commands here
  if (!MUTATING_COMMANDS.has(command)) {
    const locked = await acquireLock(userId, command)
    if (!locked) return
  }

  const handler = routes[command] ?? unknownHandler
  await handler(ctx)
}
