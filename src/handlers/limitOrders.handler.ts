import { Context, InlineKeyboard } from "grammy"
import { getUserOrders } from "../services/orders.store.js"

function formatLimitOrder(o: any): string {
  const sub = o.limitSubType ?? "buy"
  const cond = o.condition === "LTE" ? "≤" : "≥"
  const priceStr = `when price *${cond} $${o.targetPriceUsd}*`
  if (sub === "take_profit") {
    return `• ${o.active ? "🟢" : "⚪"} *Take Profit* sell \`${o.tokenMint.slice(0, 8)}…\` ${priceStr}\n  ID: \`${o.id}\``
  }
  if (sub === "stop_loss") {
    return `• ${o.active ? "🟢" : "⚪"} *Stop Loss* sell \`${o.tokenMint.slice(0, 8)}…\` ${priceStr}\n  ID: \`${o.id}\``
  }
  return `• ${o.active ? "🟢" : "⚪"} *${o.amountSol} SOL* → \`${o.tokenMint.slice(0, 8)}…\` ${priceStr}\n  ID: \`${o.id}\``
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
