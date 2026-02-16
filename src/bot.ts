// src/bot.ts
import { Bot } from "grammy";
import { config } from "./utils/config.js";
import { getOrCreateSession } from "./core/session.js";
import { initRpcHealth, startRpcHealthCheck } from "./blockchain/solana.client.js";
import { routeCallback } from "./core/routeCallback.js";
import { routeCommand } from "./core/router.js";
import { withdrawConversationHandler } from "./handlers/withdrawConversation.handler.js";
import { getWithdrawState } from "./core/state/withdraw.state.js";
import { handleWalletNaming } from "./handlers/createWallet.handler.js";
import { totpMessageHandler } from "./handlers/totp.handler.js";
import {
  verifySecurityQuestionHandler,
  verifyTOTPForExportHandler
} from "./handlers/exportSeedPhraseSecure.handler.js";
import {
  verify2FACode,
  verifyAndRegenTOTP
} from "./handlers/onboarding.handler.js";
import { redis } from "./config/redis.js";
import { redisKeys } from "./utils/redisKeys.js";

import { clearBuyXState, getBuyXState } from "./core/state/buyX.state.js";
import { clearSellXState, getSellXState } from "./core/state/sellX.state.js";
import { executeSwap } from "./services/swap.service.js";
import { saveOrder } from "./services/orders.store.js";
import { clearCreateDraft, getCreateDraft, setCreateDraft } from "./core/state/orderCreate.state.js";

// Workers (IMPORTANT: do NOT run on Vercel)
import { startDcaWorker } from "./workers/dca.worker.js";
import { startLimitWorker } from "./workers/limit.worker.js";
import { startAlertsWorker } from "./workers/alerts.worker.js";

// ✅ Create bot instance (safe to import from Vercel function)
export function createBot() {
  return new Bot(config.botToken);
}

export const bot = createBot();

// ✅ Avoid re-registering handlers on warm starts
let initialized = false;

// ✅ This registers all handlers/routes ONCE
export async function initBot() {
  if (initialized) return;
  initialized = true;

  console.log("[Bot] Initializing RPC...");
  await initRpcHealth();
  startRpcHealthCheck();

  /* ═══════════════════════════════════════════
     MESSAGE ROUTER (ONLY ONE)
  ═══════════════════════════════════════════ */
  bot.on("message:text", async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;

      await getOrCreateSession(from.id, from.username).catch(() => null);

      // ───── BUY X FLOW ─────
      const buyXMint = getBuyXState(from.id);
      if (buyXMint) {
        const amountSol = Number(ctx.message.text);
        if (isNaN(amountSol) || amountSol <= 0) {
          await ctx.reply("❌ Invalid amount. Please enter a valid SOL amount.");
          return;
        }

        clearBuyXState(from.id);
        await ctx.reply("⚡ Executing swap...");

        try {
          const txid = await executeSwap({
            userId: from.id,
            inputMint: "So11111111111111111111111111111111111111112",
            outputMint: buyXMint,
            amountSol
          });

          await ctx.reply(`✅ Swap Successful!\n\nTX:\nhttps://solscan.io/tx/${txid}`);
        } catch (err: any) {
          await ctx.reply(`❌ Swap Failed: ${err.message}`);
        }
        return;
      }

      // ───── SELL X FLOW ─────
      const sellXMint = getSellXState(from.id);
      if (sellXMint) {
        const raw = ctx.message.text.trim();
        const num = Number(raw);
        if (Number.isNaN(num) || num <= 0) {
          await ctx.reply("❌ Enter a valid amount or portion (e.g. 0.5 for 50%).");
          return;
        }
        clearSellXState(from.id);
        await ctx.reply("⚡ Executing sell...");
        try {
          const { executeSell } = await import("./services/swap.service.js");
          const txid = await executeSell({
            userId: from.id,
            tokenMint: sellXMint,
            amountTokenPortion: num <= 1 ? num : undefined,
            amountToken: num > 1 ? num : undefined
          });
          await ctx.reply(`✅ Sold!\n\nTX: https://solscan.io/tx/${txid}`);
        } catch (err: any) {
          await ctx.reply(`❌ Sell failed: ${err.message}`);
        }
        return;
      }

      // ───── DRAFT FLOW (your existing block) ─────
      const draft = await getCreateDraft(from.id);

      // ✅ Keep your entire draft handling block exactly as you had it
      // (I’m not re-pasting the whole middle section again to reduce noise)
      // Make sure it stays inside this handler.

      // ───── TOTP EXPORT FLOW ─────
      const awaitingExportTotp = await redis.get(redisKeys.exportAwaitTotp(from.id));
      if (awaitingExportTotp) {
        await totpMessageHandler(ctx);
        return;
      }

      const awaitingRegenVerify = await redis.get(redisKeys.totpRegenAwait(from.id));
      if (awaitingRegenVerify) {
        await verifyAndRegenTOTP(ctx);
        return;
      }

      const verifying2FA = await redis.get(redisKeys.verifying2FA(from.id));
      if (verifying2FA) {
        await verify2FACode(ctx);
        return;
      }

      const exportStage = await redis.get(redisKeys.exportStage(from.id));
      if (
        exportStage === "answering_question" ||
        exportStage === "entering_sq_answer" ||
        exportStage === "answering_password"
      ) {
        await verifySecurityQuestionHandler(ctx);
        return;
      }
      if (exportStage === "awaiting_totp") {
        await verifyTOTPForExportHandler(ctx);
        return;
      }

      // ───── WITHDRAW FLOW ─────
      const withdrawState = getWithdrawState(from.id);
      if (withdrawState) {
        await withdrawConversationHandler(ctx);
        return;
      }

      // ───── WALLET NAMING ─────
      const isNamingWallet = await redis.get(`wallet:naming:${from.id}`);
      if (isNamingWallet) {
        await handleWalletNaming(ctx);
        return;
      }

      // ───── SLIPPAGE DRAFT ─────
      const { handleSlippageDraftMessage } = await import("./handlers/settings.handler.js");
      const slippageResult = await handleSlippageDraftMessage(from.id, ctx.message.text);
      if (slippageResult.reply) {
        await ctx.reply(slippageResult.reply);
        return;
      }

      // ───── ALERT DRAFT FLOW ─────
      const { handleAlertDraftMessage } = await import("./handlers/alerts.handler.js");
      const alertResult = await handleAlertDraftMessage(from.id, ctx.message.text);
      if (alertResult.reply) {
        await ctx.reply(alertResult.reply, { parse_mode: "Markdown" });
        return;
      }

      // ───── DEFAULT ROUTING ─────
      await routeCommand(ctx);
    } catch (err) {
      console.error("[Bot Error]", err);
      await ctx.reply("❌ Unexpected error occurred.").catch(() => {});
    }
  });

  /* ═══════════════════════════════════════════
     CALLBACK ROUTER (ONLY ONE)
  ═══════════════════════════════════════════ */
  bot.on("callback_query:data", async (ctx) => {
    try {
      await routeCallback(ctx);
    } catch (err) {
      console.error("[Callback Error]", err);
      await ctx.answerCallbackQuery({
        text: "Something went wrong",
        show_alert: true
      }).catch(() => {});
    }
  });

  console.log("[Bot] Handlers registered ✅");
}

// ✅ Local dev only: starts workers + long polling
export async function startBotPolling() {
  await initBot();

  // Run workers only when explicitly allowed (NOT on Vercel)
  const runWorkers = process.env.RUN_WORKERS === "true";
  if (runWorkers) {
    startDcaWorker();
    startLimitWorker();
    startAlertsWorker();
    console.log("[Bot] Workers started ✅");
  } else {
    console.log("[Bot] Workers disabled (set RUN_WORKERS=true to enable) 💤");
  }

  await bot.start();
  console.log("[Bot] 🚀 Running (long polling)");
}
