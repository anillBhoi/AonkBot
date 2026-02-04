import { Context, InlineKeyboard } from "grammy";
import { getSolBalance } from "../blockchain/balance.service.js";
import { getOrCreateWallet } from "../blockchain/wallet.service.js";

export async function withdrawMenuHandler(ctx: Context) {

  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("Unable to identify user.");
      return;
    }

    // ✅ Loading Message
    const loadingMsg = await ctx.reply("Fetching wallet details...");

    const wallet = await getOrCreateWallet(userId);
    const balance = await getSolBalance(wallet.publicKey);

    const keyboard = new InlineKeyboard()
      .text("Withdraw All SOL", "withdraw_all_sol")
      .row()
      .text("Withdraw X SOL", "withdraw_x_sol")
      .row()
      .text("Cancel", "cancel_withdraw");

    // ✅ Edit instead of sending new message (better UX)
    await ctx.api.editMessageText(
      ctx.chat!.id,
      loadingMsg.message_id,
      `💰 Wallet Balance: ${balance.toFixed(4)} SOL\n\nSelect withdrawal option:`,
      { reply_markup: keyboard }
    );

  } catch (error) {
    console.error("Withdraw menu error:", error);
    await ctx.reply("Failed to load withdraw menu. Please try again.");
  }
}
