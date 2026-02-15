import { Context, InlineKeyboard } from 'grammy'
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
import { setSellXState } from './state/sellX.state.js'
import { setOrderInactive } from '../services/orders.store.js'
import { setCreateDraft } from './state/orderCreate.state.js'
import { executeSell } from '../services/swap.service.js'

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
     SELL (token → SOL)
  ───────────────────────────────────────── */
  if (data.startsWith('trade:sell:')) {
    const parts = data.split(':')
    const tokenMint = parts[2]
    const portionStr = parts[3]
    const portion = portionStr ? Number(portionStr) : undefined
    if (!tokenMint) return
    try {
      await ctx.editMessageText('⏳ Executing sell...')
      const txid = await executeSell({
        userId,
        tokenMint,
        amountTokenPortion: portion,
      })
      await ctx.editMessageText(
        `✅ Sold!\n\nToken: \`${tokenMint}\`\n` +
        `Portion: ${portion != null ? (portion * 100) + '%' : 'custom'}\n\n` +
        `🔗 https://solscan.io/tx/${txid}`,
        { parse_mode: 'Markdown' }
      )
    } catch (err: any) {
      await ctx.editMessageText(`❌ Sell failed: ${err.message}`)
    }
    return
  }

  if (data.startsWith('trade:sellx:')) {
    const tokenMint = data.split(':')[2]
    if (tokenMint) {
      setSellXState(userId, tokenMint)
      await ctx.editMessageText(
        '💰 Enter amount of tokens to sell, or a portion between 0 and 1 (e.g. 0.5 for 50%).'
      )
    }
    return
  }

  /* ─────────────────────────────────────────
     TOKEN CARD REFRESH (re-show token info)
  ───────────────────────────────────────── */
  if (data.startsWith('trade:refresh:')) {
    const tokenMint = data.split(':')[2]
    if (tokenMint) {
      const { tokenInfoHandler } = await import('../handlers/tokenInfo.handler.js')
      return tokenInfoHandler(ctx, tokenMint)
    }
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
 // ─── DCA create flow ───
if (data === "dca:create") {
  await setCreateDraft(userId, { mode: "DCA" })
  await ctx.reply("🧩 Send token mint for DCA (pump.fun / Solana mint).")
  return
}

if (data === "limit:create") {
  const kb = new InlineKeyboard()
    .text("Limit Buy", "limit:create_buy")
    .text("Take Profit", "limit:create_tp")
    .text("Stop Loss", "limit:create_sl")
    .text("Trailing Stop", "limit:create_trailing")
    .row()
    .text("Close", "close")
  await ctx.reply("Choose limit order type:", { reply_markup: kb })
  return
}
if (data === "limit:create_buy") {
  await setCreateDraft(userId, { mode: "LIMIT", limitSubType: "buy", condition: "LTE" })
  await ctx.reply("🧩 Send token mint for Limit Buy (buy when price ≤ target).")
  return
}
if (data === "limit:create_tp") {
  await setCreateDraft(userId, { mode: "LIMIT", limitSubType: "take_profit", condition: "GTE" })
  await ctx.reply("🧩 Send token mint for Take Profit (sell when price ≥ target).")
  return
}
if (data === "limit:create_sl") {
  await setCreateDraft(userId, { mode: "LIMIT", limitSubType: "stop_loss", condition: "LTE" })
  await ctx.reply("🧩 Send token mint for Stop Loss (sell when price ≤ target).")
  return
}
if (data === "limit:create_trailing") {
  await setCreateDraft(userId, { mode: "LIMIT", limitSubType: "trailing_stop" })
  await ctx.reply("🧩 Send token mint for Trailing Stop (sell when price drops % from peak).")
  return
}

// Cancel order by ID prompt
if (data === "dca:cancel_prompt") {
  await ctx.reply("Send DCA order ID to cancel (example: dca_...)")
  await setCreateDraft(userId, { mode: "DCA" }) // reuse draft for prompt context
  return
}
if (data === "limit:cancel_prompt") {
  await ctx.reply("Send Limit order ID to cancel (example: limit_...)")
  await setCreateDraft(userId, { mode: "LIMIT" })
  return
}

// Cancel by clicking
if (data.startsWith("order:cancel:")) {
  const orderId = data.split(":")[2]
  await setOrderInactive(orderId)
  await ctx.reply("✅ Order cancelled.")
  return
}

// Alerts
if (data === "alert:create") {
  const { alertCreateStartHandler } = await import("../handlers/alerts.handler.js")
  return alertCreateStartHandler(ctx)
}
if (data.startsWith("alert:cancel:")) {
  const alertId = data.split(":")[2]
  const { alertCancelHandler } = await import("../handlers/alerts.handler.js")
  return alertCancelHandler(ctx, alertId)
}

// Settings slippage
if (data.startsWith("settings:slippage:")) {
  const bpsStr = data.split(":")[2]
  const { settingsSlippageCallback } = await import("../handlers/settings.handler.js")
  return settingsSlippageCallback(ctx, bpsStr)
}

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

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}