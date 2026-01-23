import { Context } from 'grammy'
import { acquireLock } from './locks.js'
import { createRateLimiter, RATE_LIMITS } from './rateLimit/rateLimit.service.js'
import { asBotError } from './errors/botError.js'

import { startHandler } from '../handlers/start.handler.js'
import { helpHandler } from '../handlers/help.handler.js'
import { walletHandler } from '../handlers/wallet.handler.js'
import { sendHandler } from '../handlers/send.handler.js'
import { transferHandler } from '../handlers/transfer.handler.js'
import { confirmHandler } from '../handlers/confirm.handler.js'
import { cancelHandler } from '../handlers/cancel.handler.js'
import { unknownHandler } from '../handlers/unknown.handler.js'
import { txsHandler } from '../handlers/txs.handler.js'

const routes: Record<string, (ctx: Context) => Promise<void>> = {
  start: startHandler,
  wallet: walletHandler,
  swap: sendHandler,
  trade: sendHandler,
  send: transferHandler,
  confirm: confirmHandler,
  cancel: cancelHandler,
  txs: txsHandler,
  help: helpHandler,
  devnetcredit: (ctx) => import('../handlers/devnetCredit.handler.js').then(m => m.devnetCreditHandler(ctx)),
  'devnet-credit': (ctx) => import('../handlers/devnetCredit.handler.js').then(m => m.devnetCreditHandler(ctx))
}

const MUTATING_COMMANDS = new Set(['swap', 'send', 'confirm', 'cancel'])

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

  try {
    // Check rate limit first (RATE_LIMITS keys are uppercase)
    const rateKey = command.toUpperCase()
    if (RATE_LIMITS[rateKey as keyof typeof RATE_LIMITS]) {
      const limiter = createRateLimiter(userId, rateKey)
      const allowed = await limiter.isAllowed()

      if (!allowed) {
        await ctx.reply(limiter.getMessage())
        return
      }
    }

    // Apply lock for non-mutating commands
    if (!MUTATING_COMMANDS.has(command)) {
      const locked = await acquireLock(userId, command, 30000)
      if (!locked) {
        await ctx.reply('⏳ Please wait a moment before trying again.')
        return
      }
    }

    const handler = routes[command] ?? unknownHandler
    await handler(ctx)
  } catch (err) {
    const botErr = asBotError(err)
    console.error('[Router Error]', botErr.toJSON())

    await ctx.reply(botErr.getUserMessage())
  }
}