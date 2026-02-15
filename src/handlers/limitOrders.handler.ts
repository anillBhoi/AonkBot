import { Context, InlineKeyboard } from "grammy"
import { getUserOrders } from "../services/orders.store.js"

function formatLimitOrder(o: any): string {
  const sub = o.limitSubType ?? "buy"
  const shortMint = o.tokenMint?.slice(0, 8) ? `${o.tokenMint.slice(0, 8)}…` : "token"
  if (sub === "trailing_stop") {
    return `• ${o.active ? "🟢" : "⚪"} *Trailing Stop* sell \`${shortMint}\` when price drops *${o.trailPercentPct ?? 10}%* from peak\n  ID: \`${o.id}\``
  }
  const cond = o.condition === "LTE" ? "≤" : "≥"
  const priceStr = o.triggerType === "multiple"
    ? `when price ${cond} *${o.targetMultiple}x* ref`
    : o.triggerType === "percent"
      ? `when price ${cond} *${o.targetPercentChange}%* ref`
      : `when price *${cond} $${o.targetPriceUsd}*`
  if (sub === "take_profit") {
    return `• ${o.active ? "🟢" : "⚪"} *Take Profit* sell \`${shortMint}\` ${priceStr}\n  ID: \`${o.id}\``
  }
  if (sub === "stop_loss") {
    return `• ${o.active ? "🟢" : "⚪"} *Stop Loss* sell \`${shortMint}\` ${priceStr}\n  ID: \`${o.id}\``
  }
  return `• ${o.active ? "🟢" : "⚪"} *${o.amountSol} SOL* → \`${shortMint}\` ${priceStr}\n  ID: \`${o.id}\``
}

export async function limitOrdersHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return

  const orders = (await getUserOrders(userId)).filter(o => o.type === "LIMIT")

  const lines = orders.length ? orders.map(formatLimitOrder).join("\n\n") : "_No limit orders yet._"

  const kb = new InlineKeyboard()
    .text("➕ Create Limit", "limit:create")
    .row()
    .text("🛑 Cancel Limit", "limit:cancel_prompt")
    .row()
    .text("Close", "close")

  await ctx.reply(`📌 *Limit Orders*\n\n${lines}`, { parse_mode: "Markdown", reply_markup: kb })
}
