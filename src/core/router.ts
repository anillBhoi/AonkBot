import { Context } from 'grammy'
import { cancelHandler } from '../handlers/cancel.handler.js'
import { confirmHandler } from '../handlers/confirm.handler.js'
import { helpHandler } from '../handlers/help.handler.js'
import { sendHandler } from '../handlers/send.handler.js'
import { startHandler } from '../handlers/start.handler.js'
import { transferHandler } from '../handlers/transfer.handler.js'
import { txsHandler } from '../handlers/txs.handler.js'
import { walletHandler } from '../handlers/wallet.handler.js'
import { createRateLimiter, RATE_LIMITS } from './rateLimit/rateLimit.service.js'
import { acquireLock } from './locks.js'
import { unknownHandler } from '../handlers/unknown.handler.js'
import { asBotError } from './errors/botError.js'
import { deposit } from '../handlers/deposit.handler.js'
import { buySolHandler } from '../handlers/buySol.handler.js'
import { withdrawMenuHandler } from '../handlers/withdrawMenuHandler.js'
import { manageToken } from '../handlers/manageTokens.handler.js'
import { resetAllWalletsHandler } from '../handlers/resetAllWallets.handler.js'
import { exportSeedPhraseHandler } from '../handlers/exportSeedPhrase.handler.js'
import { exportSeedPhraseSecureHandler } from '../handlers/exportSeedPhraseSecure.handler.js'
import { regenerateTOTPHandler } from '../handlers/onboarding.handler.js'
import { buyToken } from '../handlers/buyToken.handler.js'
import { extractSolanaMint } from '../utils/tokenDetector.js'
import { tokenPreviewHandler } from '../handlers/tokenPreview.handler.js'
import { tokenInfoHandler } from '../handlers/tokenInfo.handler.js'

/* ===== ROUTES ===== */

export const routes: Record<string, (ctx: Context) => Promise<void>> = {

  start: startHandler,
  wallet: walletHandler,
  swap: sendHandler,
  trade: sendHandler,
  send: transferHandler,
  confirm: confirmHandler,
  cancel: cancelHandler,
  buysol: buySolHandler,
  buytoken: buyToken,
  deposit: deposit,
  txs: txsHandler,
  withdraw: withdrawMenuHandler,
  help: helpHandler,
  managetkn: manageToken,

  /* ===== Withdraw Flow ===== */

  withdrawall: (ctx) =>
    import('../handlers/withdrawAll.handler.js')
      .then(m => m.withdrawAllHandler(ctx)),

  withdrawx: (ctx) =>
    import('../handlers/withdrawX.handler.js')
      .then(m => m.withdrawXHandler(ctx)),

  confirmwithdraw: (ctx) =>
    import('../handlers/confirmWithdraw.handler.js')
      .then(m => m.confirmWithdrawHandler(ctx)),

  cancelwithdraw: (ctx) =>
    import('../handlers/cancel.handler.js')
      .then(m => m.cancelHandler(ctx)),

  /* ===== Manage Wallets ===== */

  managewallets: (ctx) =>
    import('../handlers/manageWallets.handler.js')
      .then(m => m.manageWalletsHandler(ctx)),

  resetwallets: resetAllWalletsHandler,

  exportphrase: exportSeedPhraseHandler,
  exportphrasesecure: exportSeedPhraseSecureHandler,
  totpsetup: regenerateTOTPHandler,
}

/* ===== COMMAND ROUTER ===== */
export async function routeCommand(ctx: Context): Promise<void> {
  const message = ctx.message?.text
  if (!message) return

    const mint = extractSolanaMint(message);

  if (mint) {
    return tokenPreviewHandler(ctx, mint);
  }

  const commandMatch = message.match(/^\/([a-z]+)/)
  const command = commandMatch ? commandMatch[1].toLowerCase() : message.split(' ')[0].toLowerCase()

  const handler = routes[command]
  if (handler) {
    try {
      await handler(ctx)
    } catch (error) {
      const botError = asBotError(error)
      console.error(`[Route Error: ${command}]`, botError.message)
      await ctx.reply(`❌ ${botError.message}`).catch(() => {})
    }
  } else {
    await unknownHandler(ctx)
  }

}

const tokenRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export async function interceptTokenInput(ctx: Context) {

  const text = ctx.message?.text
  if (!text) return false

  if (!tokenRegex.test(text)) return false

  await tokenInfoHandler(ctx, text)
  return true
}
