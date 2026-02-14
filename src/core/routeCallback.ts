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
import { setBuyXState } from './state/buyX.state.js'

/* ─────────────────────────────────────────────
   Clear All Conversational States
───────────────────────────────────────────── */
async function clearAllConversationalStates(userId: number): Promise<void> {
  try {
    clearWithdrawState(userId)

    await Promise.all([
      redis.del(`wallet:naming:${userId}`),
      redis.del(redisKeys.exportAwaitTotp(userId)),
      redis.del(redisKeys.exportStage(userId)),
      redis.del(redisKeys.exportChoosingQuestion(userId)),
      redis.del(redisKeys.totpRegenAwait(userId)),
      redis.del(redisKeys.verifying2FA(userId)),
      redis.del(redisKeys.settingUp2FA(userId)),
    ])
  } catch (err) {
    console.error('[Clear states error]', err)
  }
}

/* ─────────────────────────────────────────────
   Main Callback Router
───────────────────────────────────────────── */
export async function routeCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data) return

  const userId = ctx.from?.id
  if (!userId) return

  /* ─── Wallet Refresh (self-handled ack) ─── */
  if (data === 'wallet:refresh') {
    return walletRefreshHandler(ctx)
  }

  /* Silent ACK for everything else */
  await ctx.answerCallbackQuery().catch(() => {})

  /* ─────────────────────────────────────────
     CLOSE MESSAGE
  ───────────────────────────────────────── */
  if (data === 'close') {
    await ctx.deleteMessage().catch(() => {})
    return
  }

  /* ─────────────────────────────────────────
     TRADE BUY (🔥 IMPORTANT: BEFORE cmd:)
  ───────────────────────────────────────── */
  if (data.startsWith('trade:buy:')) {
    const [, , tokenMint, amountStr] = data.split(':')
    const amountSol = Number(amountStr)

    try {
      await ctx.editMessageText('⏳ Executing swap...')

      const txid = await executeSwap({
        userId,
        inputMint: 'So11111111111111111111111111111111111111112', // Wrapped SOL
        outputMint: tokenMint,
        amountSol
      })

      await ctx.editMessageText(
        `✅ Swap Successful!\n\n` +
        `Token: \`${tokenMint}\`\n` +
        `Amount: ${amountSol} SOL\n\n` +
        `🔗 https://solscan.io/tx/${txid}`,
        { parse_mode: 'Markdown' }
      )

    } catch (err: any) {
      await ctx.editMessageText(
        `❌ Swap Failed:\n${err.message}`
      )
    }

    return
  }

  if (data.startsWith("trade:buyx:")) {
  const [, , mint] = data.split(":")
  
  setBuyXState(userId, mint)

  await ctx.editMessageText(
    "💰 Enter the amount of SOL you want to buy.\n\nExample: 0.5"
  )

  return
}


  /* ─────────────────────────────────────────
     WALLET SELECT / CREATE
  ───────────────────────────────────────── */
  if (data.startsWith('wallet_select:')) {
    await clearAllConversationalStates(userId)
    return walletSelectHandler(ctx)
  }

  if (data === 'wallet_create') {
    await clearAllConversationalStates(userId)
    return createWalletHandler(ctx)
  }

  /* ─────────────────────────────────────────
     RESET
  ───────────────────────────────────────── */
  if (data === 'reset:confirm') return resetConfirmHandler(ctx)
  if (data === 'reset:cancel') return resetCancelHandler(ctx)

  /* ─────────────────────────────────────────
     SIMPLE EXPORT (TOTP)
  ───────────────────────────────────────── */
  if (data === 'export:confirm') return exportConfirmHandler(ctx)
  if (data === 'export:cancel') return exportCancelHandler(ctx)
  if (data === 'export:regen') return exportRegenHandler(ctx)
  if (data === 'export:enter_code') return exportEnterCodeHandler(ctx)

  /* ─────────────────────────────────────────
     SECURE EXPORT (3-LAYER)
  ───────────────────────────────────────── */
  if (data === 'exportsecure:confirm') return exportSecureConfirmHandler(ctx)
  if (data === 'exportsecure:cancel') return exportSecureCancelHandler(ctx)
  if (data.startsWith('setup_sq:')) return setupSecurityQuestionHandler(ctx)
  if (data === 'exportsecure:setup_totp') return setupTOTPHandler(ctx)

  /* ─────────────────────────────────────────
     ONBOARDING
  ───────────────────────────────────────── */
  if (data === 'onboarding:guide') return showSecurityGuide(ctx)
  if (data === 'onboarding:setup_2fa' || data === 'onboarding:start_2fa')
    return initiate2FASetup(ctx)
  if (data === 'onboarding:skip') return skipOnboarding(ctx)
  if (data === 'onboarding:regenerate') return regenerateTOTPHandler(ctx)
  if (data === 'onboarding:confirm_regenerate') return confirmRegenerateTOTP(ctx)
  if (data === 'onboarding:cancel') {
    await ctx.deleteMessage().catch(() => {})
    return
  }

  /* ─────────────────────────────────────────
     GENERIC COMMAND CALLBACKS
  ───────────────────────────────────────── */
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
