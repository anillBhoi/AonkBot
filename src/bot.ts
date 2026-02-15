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
import { saveOrder } from "./services/orders.store.js"
import { clearCreateDraft, getCreateDraft, setCreateDraft } from "./core/state/orderCreate.state.js"
import { startDcaWorker } from "./workers/dca.worker.js"
import { startLimitWorker } from "./workers/limit.worker.js"

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


      const draft = await getCreateDraft(from.id)

if (draft) {
  const text = ctx.message.text.trim()

  // If user pasted an orderId to cancel
  if ((draft.mode === "DCA" || draft.mode === "LIMIT") && text.startsWith("dca_") || text.startsWith("limit_")) {
    // optional: handle cancel by text
  }

  // Step 1: token mint
  if (!draft.tokenMint) {
    // very light validation
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) {
      await ctx.reply("❌ Invalid mint. Send a valid Solana mint address.")
      return
    }
    draft.tokenMint = text
    await setCreateDraft(from.id, draft)

    await ctx.reply(draft.mode === "DCA"
      ? "✅ Now send DCA amount in SOL (example: 0.2)"
      : "✅ Now send buy amount in SOL (example: 0.2)"
    )
    return
  }

  // Step 2: amount SOL
  if (!draft.amountSol) {
    const amountSol = Number(text)
    if (Number.isNaN(amountSol) || amountSol <= 0) {
      await ctx.reply("❌ Invalid amount. Example: 0.2")
      return
    }
    draft.amountSol = amountSol
    await setCreateDraft(from.id, draft)

    if (draft.mode === "DCA") {
      await ctx.reply("✅ Now send interval in minutes (example: 30)")
    } else {
      await ctx.reply("✅ Now send target price in USD (example: 0.00005)")
    }
    return
  }

  // Step 3a: DCA interval
  if (draft.mode === "DCA" && !draft.intervalMinutes) {
    const m = Number(text)
    if (Number.isNaN(m) || m < 1) {
      await ctx.reply("❌ Invalid interval. Example: 30")
      return
    }
    draft.intervalMinutes = Math.floor(m)

    const order = {
      id: `dca_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      type: "DCA" as const,
      userId: from.id,
      tokenMint: draft.tokenMint!,
      amountSol: draft.amountSol!,
      intervalMinutes: draft.intervalMinutes!,
      nextRunAt: Date.now() + draft.intervalMinutes! * 60_000,
      active: true,
      createdAt: Date.now(),
      runs: 0
    }

    await saveOrder(order)
    await clearCreateDraft(from.id)

    await ctx.reply(
      `✅ DCA created!\n\n• ${order.amountSol} SOL → \`${order.tokenMint}\`\n• Every ${order.intervalMinutes} min\n• ID: \`${order.id}\``,
      { parse_mode: "Markdown" }
    )
    return
  }

  // Step 3b: Limit target price
  if (draft.mode === "LIMIT" && !draft.targetPriceUsd) {
    const p = Number(text)
    if (Number.isNaN(p) || p <= 0) {
      await ctx.reply("❌ Invalid price. Example: 0.00005")
      return
    }
    draft.targetPriceUsd = p

    const order = {
      id: `limit_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      type: "LIMIT" as const,
      userId: from.id,
      tokenMint: draft.tokenMint!,
      amountSol: draft.amountSol!,
      targetPriceUsd: draft.targetPriceUsd!,
      condition: draft.condition ?? "LTE",
      active: true,
      createdAt: Date.now()
    }

    await saveOrder(order)
    await clearCreateDraft(from.id)

    await ctx.reply(
      `✅ Limit order created!\n\n• ${order.amountSol} SOL → \`${order.tokenMint}\`\n• Trigger when price ≤ $${order.targetPriceUsd}\n• ID: \`${order.id}\``,
      { parse_mode: "Markdown" }
    )
    return
  }
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
startDcaWorker()
startLimitWorker()
  await bot.start()
  console.log("[Bot] 🚀 Running")
}
