import { Context, InlineKeyboard } from "grammy"
import { redis } from "../config/redis.js"
import { redisKeys } from "../utils/redisKeys.js"

const DEFAULT_SLIPPAGE_BPS = 100
const SLIPPAGE_DRAFT_KEY = (userId: number) => `settings:slippage_draft:${userId}`

export async function settingsHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return

  const raw = await redis.get(redisKeys.userSlippageBps(userId))
  const slippageBps = raw ? Number(raw) : DEFAULT_SLIPPAGE_BPS
  const pct = (slippageBps / 100).toFixed(1)

  const kb = new InlineKeyboard()
    .text("0.5%", "settings:slippage:50")
    .text("1%", "settings:slippage:100")
    .text("1.5%", "settings:slippage:150")
    .row()
    .text("2%", "settings:slippage:200")
    .text("Custom", "settings:slippage:custom")
    .row()
    .text("Close", "close")

  await ctx.reply(
    `⚙️ *Settings*\n\n*Slippage:* ${pct}%\n\nLower = less slippage, higher chance of failed swaps. 1% is typical.`,
    { parse_mode: "Markdown", reply_markup: kb }
  )
}

export async function settingsSlippageCallback(ctx: Context, bpsStr: string) {
  const userId = ctx.from?.id
  if (!userId) return
  if (bpsStr === "custom") {
    await redis.set(SLIPPAGE_DRAFT_KEY(userId), "1", "EX", 120)
    await ctx.reply("Send slippage % (e.g. 1.5 for 1.5%). Min 0.1, max 50.")
    return
  }
  const bps = Number(bpsStr)
  if (!Number.isNaN(bps) && bps >= 10 && bps <= 5000) {
    await redis.set(redisKeys.userSlippageBps(userId), String(bps))
    await ctx.reply(`✅ Slippage set to ${(bps / 100).toFixed(1)}%`)
  }
}

export async function handleSlippageDraftMessage(
  userId: number,
  text: string
): Promise<{ done: boolean; reply: string }> {
  const key = SLIPPAGE_DRAFT_KEY(userId)
  const exists = await redis.get(key)
  if (!exists) return { done: false, reply: "" }

  const pct = Number(text)
  if (Number.isNaN(pct) || pct < 0.1 || pct > 50) {
    return { done: false, reply: "❌ Send a number between 0.1 and 50 (e.g. 1.5)." }
  }
  const bps = Math.round(pct * 100)
  await redis.set(redisKeys.userSlippageBps(userId), String(bps))
  await redis.del(key)
  return { done: true, reply: `✅ Slippage set to ${pct}%` }
}
