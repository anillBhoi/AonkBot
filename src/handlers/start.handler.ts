import { Context } from "grammy";
import { getOrCreateWallet } from "../blockchain/wallet.service.js";
import { mainMenuKeyboard } from "../ui/mainMenu.keyboard.js";
import { checkAndInitiateOnboarding } from "./onboarding.handler.js";
import { buildMoonpayUrl } from "../utils/moonpay.js";
import { redis } from "../config/redis.js";
import { redisKeys } from "../utils/redisKeys.js";

export async function startHandler(ctx: Context) {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    // ✅ Record referral if /start ref_<inviterId>
    const startPayload = ctx.message?.text?.trim().split(/\s+/)[1];
    if (startPayload?.startsWith("ref_")) {
      const inviterId = Number(startPayload.slice(4));
      if (Number.isInteger(inviterId) && inviterId !== userId) {
        const existing = await redis.get(redisKeys.refInviter(userId));
        if (!existing) {
          await redis.set(redisKeys.refInviter(userId), String(inviterId));
          await redis.sadd(redisKeys.refReferredSet(inviterId), String(userId));
        }
      }
    }

    // ✅ Create or fetch wallet
    const wallet = await getOrCreateWallet(userId);

    // ✅ Check onboarding / 2FA flow
    const needsOnboarding = await checkAndInitiateOnboarding(ctx);
    if (needsOnboarding) return;

    // ✅ Generate MoonPay URL
    const moonpayUrl = buildMoonpayUrl(wallet.publicKey);

    // ✅ BONK-style welcome dashboard
    const message =
      `🚀 *Welcome to AonkBot*\n\n` +
      `The fastest and most secure bot for trading tokens on Solana.\n\n` +
      `You currently have no SOL in your wallet.\n\n` +
      `💳 *Deposit SOL to start trading:*\n` +
      `\`${wallet.publicKey}\`\n\n` +
      `Or buy SOL using Apple / Google Pay via [MoonPay](${moonpayUrl}).\n\n` +
      `Once funded, tap *Refresh* and your balance will appear.\n\n` +
      `📊 *To buy a token:* Enter a ticker, token address, or URL from pump.fun, Birdeye, DEX Screener, or Meteora.\n\n` +
      `🔐 For wallet details or to export your seed phrase, tap *Wallet* below.`;

    // ✅ Reply or Edit depending on trigger
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard,
      });
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard,
      });
    }

  } catch (error) {
    console.error("[Start Handler Error]", error);

    await ctx.reply(
      "❌ Failed to initialize bot. Please try again."
    );
  }
}
