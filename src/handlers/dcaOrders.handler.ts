import { Context, InlineKeyboard } from "grammy"
import { getUserOrders } from "../services/orders.store.js"
import { setCreateDraft } from "../core/state/orderCreate.state.js"

export async function dcaOrdersHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return

  const orders = (await getUserOrders(userId)).filter(o => o.type === "DCA")

  const lines = orders.length
    ? orders.map(o => {
        const d = o as any
        return `• ${d.active ? "🟢" : "⚪"} *${d.amountSol} SOL* → \`${d.tokenMint}\` every *${d.intervalMinutes}m* (runs: ${d.runs})\n  ID: \`${d.id}\``
      }).join("\n\n")
    : "_No DCA orders yet._"

  const kb = new InlineKeyboard()
    .text("➕ Create DCA", "dca:create")
    .row()
    .text("🛑 Cancel DCA", "dca:cancel_prompt")
    .row()
    .text("Close", "close")

  await ctx.reply(`📆 *DCA Orders*\n\n${lines}`, { parse_mode: "Markdown", reply_markup: kb })
}
