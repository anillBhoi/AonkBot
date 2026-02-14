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
import { walletRefreshHandler } from '../handlers/wallet.handler.js'
import { redis } from '../config/redis.js'
import { clearWithdrawState } from './state/withdraw.state.js'
import { redisKeys } from '../utils/redisKeys.js'
import { executeSwap } from '../services/swap.service.js'

/**
 * ✅ FIX: Clear ALL conversational states to prevent input conflicts
 * This is called whenever a user clicks a button (wallet select, create, etc.)
 */
async function clearAllConversationalStates(userId: number): Promise<void> {
  try {
    // Clear in-memory withdraw state
    clearWithdrawState(userId)
    
    // Clear all Redis-based conversational states
    await Promise.all([
      // Clear wallet naming state
      redis.del(`wallet:naming:${userId}`),
      
      // Clear export states
      redis.del(redisKeys.exportAwaitTotp(userId)),
      redis.del(redisKeys.exportStage(userId)),
      redis.del(redisKeys.exportChoosingQuestion(userId)),
      redis.del(redisKeys.totpRegenAwait(userId)),
      
      // Clear 2FA verification state
      redis.del(redisKeys.verifying2FA(userId)),
      redis.del(redisKeys.settingUp2FA(userId)),
    ])
  } catch (err) {
    console.error('[Clear states error]', err)
  }
}

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

  /* Silently ack all other callbacks */
  await ctx.answerCallbackQuery().catch(() => {})

  /* ─── Close ─── */
  if (data === 'close') {
    await ctx.deleteMessage().catch(() => {})
    return
  }

  /* ─── Wallet select / create ─── */
  if (data.startsWith('wallet_select:')) {
    // Clear all conversational states
    await clearAllConversationalStates(userId)
    return walletSelectHandler(ctx)
  }
  if (data === 'wallet_create') {
    // Clear all conversational states before creating new wallet
    await clearAllConversationalStates(userId)
    return createWalletHandler(ctx)
  }

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

if (data.startsWith("trade:buy:")) {
  const [, , token, amountStr] = data.split(":")
  const amount = Number(amountStr)

  try {
    await ctx.editMessageText("⏳ Executing swap...")

    const txid = await executeSwap({
      userId: ctx.from!.id,
      inputMint: "So11111111111111111111111111111111111111112", // SOL
      outputMint: token,
      amountSol: amount
    })

    await ctx.editMessageText(
      `✅ Swap Successful!\n\nTX:\nhttps://solscan.io/tx/${txid}`
    )

  } catch (err: any) {
    await ctx.reply(`❌ Swap Failed: ${err.message}`)
  }
}

}