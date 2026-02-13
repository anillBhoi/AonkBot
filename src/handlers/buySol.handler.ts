import { Context, InlineKeyboard } from "grammy";
import { getOrCreateWallet } from "../blockchain/wallet.service.js";
import { buildMoonpayUrl } from "../utils/moonpay.js";
export async function buySolHandler(ctx: Context): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("Unable to identify user.");
      return;
    }

    const wallet = await getOrCreateWallet(userId);

    const moonpayUrl = buildMoonpayUrl(wallet.publicKey);

    const keyboard = new InlineKeyboard()
      .url("🚀 Buy SOL via MoonPay", moonpayUrl)
      .row()
      .text("⬅ Back to Wallet", "cmd:wallet");

    await ctx.reply(
      "💳 *Buy SOL*\n\n" +
      "You’ll be redirected to MoonPay to purchase SOL.\n\n" +
      "🔐 Funds will be credited directly to your wallet.",
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );

  } catch (err) {
    console.error("[Buy SOL Handler Error]", err);
    await ctx.reply("❌ Failed to generate Buy SOL link.");
  }
}
