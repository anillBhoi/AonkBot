import { Bot } from "grammy"
import { config } from "./utils/config.js"
import { getOrCreateSession } from "./core/session.js"
import { initRpcHealth, startRpcHealthCheck } from "./blockchain/solana.client.js"
import { routeCallback } from "./core/routeCallback.js"
import { routeCommand } from "./core/router.js"
import { withdrawConversationHandler } from "./handlers/withdrawConversation.handler.js"
import { getWithdrawState } from "./core/state/withdraw.state.js"
import { handleWalletNaming } from "./handlers/createWallet.handler.js"
import { totpMessageHandler } from "./handlers/totp.handler.js"
import {
  verifySecurityQuestionHandler,
  verifyTOTPForExportHandler
} from "./handlers/exportSeedPhraseSecure.handler.js"
import {
  verify2FACode,
  verifyAndRegenTOTP
} from "./handlers/onboarding.handler.js"
import { redis } from "./config/redis.js"
import { redisKeys } from "./utils/redisKeys.js"

import { clearBuyXState, getBuyXState } from "./core/state/buyX.state.js"
import { executeSwap } from "./services/swap.service.js"

export const bot = new Bot(config.botToken)

export async function startBot() {
  console.log("[Bot] Initializing RPC...")
  await initRpcHealth()
  startRpcHealthCheck()

  /* ═══════════════════════════════════════════
     MESSAGE ROUTER (ONLY ONE)
  ═══════════════════════════════════════════ */

  bot.on("message:text", async (ctx) => {
    try {
      const from = ctx.from
      if (!from) return

      await getOrCreateSession(from.id, from.username).catch(() => null)

      /* ───────────────────────────────
         BUY X FLOW INTERCEPT
      ─────────────────────────────── */

      const buyXMint = getBuyXState(from.id)

      if (buyXMint) {
        const amountSol = Number(ctx.message.text)

        if (isNaN(amountSol) || amountSol <= 0) {
          await ctx.reply("❌ Invalid amount. Please enter a valid SOL amount.")
          return
        }

        clearBuyXState(from.id)

        await ctx.reply("⚡ Executing swap...")

        try {
          const txid = await executeSwap({
            userId: from.id,
            inputMint: "So11111111111111111111111111111111111111112", // SOL
            outputMint: buyXMint,
            amountSol
          })

          await ctx.reply(
            `✅ Swap Successful!\n\nTX:\nhttps://solscan.io/tx/${txid}`
          )

        } catch (err: any) {
          await ctx.reply(`❌ Swap Failed: ${err.message}`)
        }

        return
      }

      /* ───────────────────────────────
         TOTP EXPORT FLOW
      ─────────────────────────────── */

      const awaitingExportTotp = await redis.get(
        redisKeys.exportAwaitTotp(from.id)
      )
      if (awaitingExportTotp) {
        await totpMessageHandler(ctx)
        return
      }

      const awaitingRegenVerify = await redis.get(
        redisKeys.totpRegenAwait(from.id)
      )
      if (awaitingRegenVerify) {
        await verifyAndRegenTOTP(ctx)
        return
      }

      const verifying2FA = await redis.get(
        redisKeys.verifying2FA(from.id)
      )
      if (verifying2FA) {
        await verify2FACode(ctx)
        return
      }

      const exportStage = await redis.get(
        redisKeys.exportStage(from.id)
      )

      if (
        exportStage === "answering_question" ||
        exportStage === "entering_sq_answer" ||
        exportStage === "answering_password"
      ) {
        await verifySecurityQuestionHandler(ctx)
        return
      }

      if (exportStage === "awaiting_totp") {
        await verifyTOTPForExportHandler(ctx)
        return
      }

      /* ───────────────────────────────
         WITHDRAW FLOW
      ─────────────────────────────── */

      const withdrawState = getWithdrawState(from.id)
      if (withdrawState) {
        await withdrawConversationHandler(ctx)
        return
      }

      /* ───────────────────────────────
         WALLET NAMING
      ─────────────────────────────── */

      const isNamingWallet = await redis.get(`wallet:naming:${from.id}`)
      if (isNamingWallet) {
        await handleWalletNaming(ctx)
        return
      }

      /* ───────────────────────────────
         DEFAULT COMMAND ROUTING
      ─────────────────────────────── */

      await routeCommand(ctx)

    } catch (err) {
      console.error("[Bot Error]", err)
      await ctx.reply("❌ Unexpected error occurred.").catch(() => {})
    }
  })

  /* ═══════════════════════════════════════════
     CALLBACK ROUTER (ONLY ONE)
  ═══════════════════════════════════════════ */

  bot.on("callback_query:data", async (ctx) => {
    try {
      await routeCallback(ctx)
    } catch (err) {
      console.error("[Callback Error]", err)
      await ctx.answerCallbackQuery({
        text: "Something went wrong",
        show_alert: true
      }).catch(() => {})
    }
  })

  /* ═══════════════════════════════════════════
     START BOT
  ═══════════════════════════════════════════ */

  await bot.start()
  console.log("[Bot] 🚀 Running")
}
