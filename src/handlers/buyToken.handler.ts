import { Context, InlineKeyboard } from "grammy"
import { setTradeMessage } from "../core/state/tradeMessage.state.js"


export async function buyToken(ctx: Context) {

  const keyboard = new InlineKeyboard()
    .text("Close", "close")

  const msg = await ctx.reply(
    `*Buy Token:*\n\n` +
    `To buy a token enter a ticker, token address, or URL from pump.fun, Birdeye, DEX Screener or Meteora.`,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard
    }
  )

  const userId = ctx.from!.id
  setTradeMessage(userId, msg.message_id)
}
