import { Context, InlineKeyboard } from "grammy"
import { fetchTokenInfo } from "../services/token.service.js"
import { getTradeMessage } from "../core/state/tradeMessage.state.js"

export async function tokenInfoHandler(ctx: Context, token: string) {

  const userId = ctx.from!.id
  const messageId = getTradeMessage(userId)

  if (!messageId) return

  const info = await fetchTokenInfo(token)

  // ⭐ NULL SAFETY
  if (!info) {
    await ctx.reply("❌ Token data unavailable.")
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
    .text("Buy 1 SOL", `trade:buy:${token}:1`)
    .text("Buy 5 SOL", `trade:buy:${token}:5`)
    .row()
    .text("Buy X SOL", `trade:buyx:${token}`)
    .row()
    .url("Open in Telemetry 📊", `https://dexscreener.com/solana/${token}`)
    .row()
    .text("Refresh", `trade:refresh:${token}`)

  const text =
`*${info.name} | ${info.symbol}*
\`${token}\`

[Explorer](https://solscan.io/account/${token}) | [Chart](https://dexscreener.com/solana/${token})

Price: $${info.price}
Market Cap: $${info.mcap}

Wallet Balance: 0 SOL
`

  await ctx.api.editMessageText(
    ctx.chat!.id,
    messageId,
    text,
    {
      parse_mode: "Markdown",
      reply_markup: keyboard,

      // ⭐ CORRECT GRAMMY FORMAT
      link_preview_options: {
        is_disabled: false
      }
    }
  )
}
