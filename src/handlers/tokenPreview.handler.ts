import { Context, InlineKeyboard } from "grammy"
import { getTokenData } from "../services/token.service.js"

export async function tokenPreviewHandler(ctx: Context, mint: string) {

  const pair = await getTokenData(mint)

  if (!pair) {
    await ctx.reply("❌ Token not found.")
    return
  }

  const keyboard = new InlineKeyboard()
    .text("Buy 1 SOL", `buy:1:${mint}`)
    .text("Buy 5 SOL", `buy:5:${mint}`)
    .row()
    .text("Buy X SOL", `buy:x:${mint}`)
    .row()
    .text("Cancel", "close")

  await ctx.reply(
`*${pair.baseToken.name} | ${pair.baseToken.symbol}*

Price: $${pair.priceUsd}
Liquidity: $${pair.liquidity?.usd}
FDV: $${pair.fdv}

[Chart](${pair.url})
`,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard
    }
  )
}
