import { Context } from 'grammy'
import { routes } from './router.js'
import { unknownHandler } from '../handlers/unknown.handler.js'
import { acquireLock } from './locks.js'
import { walletSelectHandler } from '../handlers/walletSelect.handler.js'
import { createWalletHandler } from '../handlers/createWallet.handler.js'
import { resetConfirmHandler, resetCancelHandler } from '../handlers/resetAllWallets.handler.js'
import {
  exportConfirmHandler,
  exportCancelHandler,
  exportRegenHandler,
  exportEnterCodeHandler,
} from '../handlers/exportSeedPhrase.handler.js'
import {
  exportSecureConfirmHandler,
  exportSecureCancelHandler,
  setupSecurityQuestionHandler,
  setupTOTPHandler,
} from '../handlers/exportSeedPhraseSecure.handler.js'
import {
  showSecurityGuide,
  initiate2FASetup,
  skipOnboarding,
  regenerateTOTPHandler,
  confirmRegenerateTOTP,
} from '../handlers/onboarding.handler.js'
import { walletRefreshHandler, walletSolscanHandler } from '../handlers/wallet.handler.js'

export async function routeCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data) return

  const userId = ctx.from?.id
  if (!userId) return

  /* ────────────────────────────────────────────────────────────
     wallet:refresh and wallet:solscan handle their own
     answerCallbackQuery calls internally (they need custom text).
     All other routes get a silent ack here.
  ──────────────────────────────────────────────────────────── */
  if (data === 'wallet:refresh') return walletRefreshHandler(ctx)
  if (data === 'wallet:solscan') return walletSolscanHandler(ctx)

  /* Silently ack all other callbacks */
  await ctx.answerCallbackQuery().catch(() => {})

  /* ─── Close ─── */
  if (data === 'close') {
    await ctx.deleteMessage().catch(() => {})
    return
  }

  /* ─── Wallet select / create ─── */
  if (data.startsWith('wallet_select:')) return walletSelectHandler(ctx)
  if (data === 'wallet_create') return createWalletHandler(ctx)

  /* ─── Reset ─── */
  if (data === 'reset:confirm') return resetConfirmHandler(ctx)
  if (data === 'reset:cancel') return resetCancelHandler(ctx)

  /* ─── Simple Export (TOTP-only) ─── */
  if (data === 'export:confirm') return exportConfirmHandler(ctx)
  if (data === 'export:cancel') return exportCancelHandler(ctx)
  if (data === 'export:regen') return exportRegenHandler(ctx)
  if (data === 'export:enter_code') return exportEnterCodeHandler(ctx)

  /* ─── Secure 3-Layer Export ─── */
  if (data === 'exportsecure:confirm') return exportSecureConfirmHandler(ctx)
  if (data === 'exportsecure:cancel') return exportSecureCancelHandler(ctx)
  if (data.startsWith('setup_sq:')) return setupSecurityQuestionHandler(ctx)
  if (data === 'exportsecure:setup_totp') return setupTOTPHandler(ctx)

  /* ─── Onboarding ─── */
  if (data === 'onboarding:guide') return showSecurityGuide(ctx)
  if (data === 'onboarding:setup_2fa' || data === 'onboarding:start_2fa') return initiate2FASetup(ctx)
  if (data === 'onboarding:skip') return skipOnboarding(ctx)
  if (data === 'onboarding:regenerate') return regenerateTOTPHandler(ctx)
  if (data === 'onboarding:confirm_regenerate') return confirmRegenerateTOTP(ctx)
  if (data === 'onboarding:cancel') {
    await ctx.deleteMessage().catch(() => {})
    return
  }

  /* ─── Generic command callbacks ─── */
  if (!data.startsWith('cmd:')) return

  const command = data.replace('cmd:', '')

  const locked = await acquireLock(userId, command, 30000)
  if (!locked) {
    await ctx.reply('⏳ Please wait a moment.')
    return
  }

  const handler = routes[command] ?? unknownHandler
  await handler(ctx)
}