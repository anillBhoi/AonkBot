import { Context, InlineKeyboard } from "grammy"
import { formatSmallPrice } from "../utils/tokenDetector.js"
import { fetchTokenInfo } from "../services/token.service.js"

export async function tokenInfoHandler(ctx: Context, token: string) {

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
    .text("✅ Swap", "cmd:swap")
    .row()
    .text("Buy 1.0 SOL", `trade:buy:${token}:1`)
    .text("Buy 5.0 SOL", `trade:buy:${token}:5`)
    .row()
    .text("Buy X SOL", `trade:buyx:${token}`)
    .row()
    .url("Open in DexScreener 📊", `https://dexscreener.com/solana/${token}`)
    .row()
    .text("Refresh", `trade:refresh:${token}`)

  const text =
`*${info.name} | ${info.symbol} |*
\`${token}\`
[Explorer](https://solscan.io/account/${token}) | [Chart](https://dexscreener.com/solana/${token}) | [Scan](https://t.me/RickBurpBot?start=${token})

Price: $${formatSmallPrice(Number(info.price))}
5m: ${info.priceChange5m ?? "0.00"}%, 1h: ${info.priceChange1h ?? "0.00"}%, 6h: ${info.priceChange6h ?? "0.00"}%, 24h: ${info.priceChange24h ?? "0.00"}%
Market Cap: $${info.mcap ?? "0"}

Wallet Balance: 0.0000 SOL

[Share with Ref](https://t.me/aonkbot?start=st_${token})
To buy press one of the buttons below.
`

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
    reply_to_message_id: ctx.message?.message_id
  })
}
