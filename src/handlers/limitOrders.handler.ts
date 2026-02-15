import { Context, InlineKeyboard } from "grammy"
import { getUserOrders } from "../services/orders.store.js"

export async function limitOrdersHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return

  const orders = (await getUserOrders(userId)).filter(o => o.type === "LIMIT")

  const lines = orders.length
    ? orders.map(o => {
        const d = o as any
        return `• ${d.active ? "🟢" : "⚪"} *${d.amountSol} SOL* → \`${d.tokenMint}\` when price *${d.condition === "LTE" ? "≤" : "≥"} $${d.targetPriceUsd}*\n  ID: \`${d.id}\``
      }).join("\n\n")
    : "_No limit orders yet._"

  const kb = new InlineKeyboard()
    .text("➕ Create Limit", "limit:create")
    .row()
    .text("🛑 Cancel Limit", "limit:cancel_prompt")
    .row()
    .text("Close", "close")

  await ctx.reply(`📌 *Limit Orders*\n\n${lines}`, { parse_mode: "Markdown", reply_markup: kb })
}
