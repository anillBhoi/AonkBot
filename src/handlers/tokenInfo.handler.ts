import { Context, InlineKeyboard } from "grammy"
// import { fetchTokenInfo } from "../services/token.service.js"
import { getTradeMessage } from "../core/state/tradeMessage.state.js"
import { formatSmallPrice } from "../utils/tokenDetector.js"
import { fetchTokenInfo } from "../services/token.service.js"


export async function tokenInfoHandler(ctx: Context, token: string) {

  const userId = ctx.from!.id
  const messageId = getTradeMessage(userId)
  if (!messageId) return

  const info = await fetchTokenInfo(token)
  if (!info) {
    await ctx.reply("❌ Token not found.")
    return
  }

  const keyboard = new InlineKeyboard()
    .text("Cancel", "close")
    .row()
    .text("✅ W1 (Master)", "cmd:selectedwallet")
    .text("Change Wallet", "cmd:changewallet")
    .row()
    .text("DCA", "cmd:dca")
    .text("✅ Swap", "cmd:swap")
    .text("Limit", "cmd:limit")
    .row()
    .text("Buy 1.0 SOL", `trade:buy:${token}:1`)
    .text("Buy 5.0 SOL", `trade:buy:${token}:5`)
    .row()
    .text("Buy X SOL", `trade:buyx:${token}`)
    .row()
    .url("Open in Telemetry 📊", `https://dexscreener.com/solana/${token}`)
    .row()
    .text("Refresh", `trade:refresh:${token}`)

  const text =
`*${info.name} | ${info.symbol} |*
\`${token}\`
[Explorer](https://solscan.io/account/${token}) | [Chart](https://dexscreener.com/solana/${token}) | [Scan](https://t.me/RickBurpBot?start=${token})

Price: $${formatSmallPrice(Number(info.price))}
5m: ${info.priceChange5m}%, 1h: ${info.priceChange1h}%, 6h: ${info.priceChange6h}%, 24h: ${info.priceChange24h}%
Market Cap: $${info.mcap}


Wallet Balance: 0.0000 SOL

[Share with Ref](https://t.me/aonkbot?start=st_${token})
To buy press one of the buttons below.
`

  await ctx.api.editMessageText(
    ctx.chat!.id,
    messageId,
    text,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,
      link_preview_options: { is_disabled: false }
    }
  )
}
