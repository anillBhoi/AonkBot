import { Context, InlineKeyboard } from "grammy";
import { getOrCreateWallet } from "../blockchain/wallet.service.js";

export async function buyToken(ctx: Context): Promise<void> {
  try {
    // ✅ If triggered by button → remove loading spinner
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }

    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.reply("Unable to identify user.");
      return;
    }

    // ✅ Ensure wallet exists (even if not used visually yet)
    await getOrCreateWallet(userId);

    const keyboard = new InlineKeyboard()
      .text("Close", "close"); // keep consistent with rest of bot

    await ctx.reply(
      "*Buy Token:*\n\n" +
        "To buy a token enter a ticker, token address, or a URL from pump.fun, Birdeye, DEX Screener or Meteora.\n\n" +
        "Plz enter the correct token address.",
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  } catch (err) {
    console.error("[Buy Token Handler Error]", err);
    await ctx.reply("❌ Failed to open Buy Token panel.");
  }
}
