import { Context, InlineKeyboard } from "grammy";
import { getWithdrawState, setWithdrawState } from "../core/state/withdraw.state.js";

export async function withdrawConversationHandler(ctx: Context) {

  const userId = ctx.from?.id;
  if (!userId) return;

  const state = getWithdrawState(userId);
  if (!state) return;

  const text = ctx.message?.text;
  if (!text) return;

  /* ===== Step 1: Amount ===== */
  if (state.step === "awaiting_amount") {

    const amount = Number(text);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply("❌ Invalid amount. Enter valid SOL amount.");
      return;
    }

    setWithdrawState(userId, {
      step: "awaiting_address",
      amount
    });

    await ctx.reply("📩 Enter destination wallet address:");
    return;
  }

  /* ===== Step 2: Destination ===== */
  if (state.step === "awaiting_address") {

    setWithdrawState(userId, {
      ...state,
      destination: text,
      step: "confirming"
    });

    const amountText =
      state.amount === -1
        ? "ALL SOL"
        : `${state.amount} SOL`;

    const keyboard = new InlineKeyboard()
      .text("✅ Confirm Withdraw", "cmd:confirmwithdraw")
      .row()
      .text("❌ Cancel", "cmd:cancelwithdraw");

    await ctx.reply(
`⚠ Withdrawal Preview

Amount: ${amountText}
Destination: ${text}

Confirm transaction?`,
      { reply_markup: keyboard }
    );
  }
}
