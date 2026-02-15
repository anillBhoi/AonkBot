import { Context, InlineKeyboard } from "grammy"
import { getUserAlerts, saveAlert, setAlertInactive } from "../services/alerts.store.js"
import { redis } from "../config/redis.js"
import { redisKeys } from "../utils/redisKeys.js"

const DRAFT_TTL = 300

export async function alertsHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return

  const alerts = await getUserAlerts(userId)
  const active = alerts.filter((a) => a.active)
  const lines =
    active.length > 0
      ? active
          .map(
            (a) =>
              `• ${a.condition === "LTE" ? "↓" : "↑"} \`${a.tokenMint.slice(0, 8)}…\` ${a.condition === "LTE" ? "≤" : "≥"} $${a.targetPriceUsd}\n  \`${a.id}\``
          )
          .join("\n\n")
      : "_No active alerts._"

  const kb = new InlineKeyboard()
  active.forEach((a) => kb.text(`🛑 ${a.tokenMint.slice(0, 6)}…`, `alert:cancel:${a.id}`).row())
  kb.text("➕ Create alert", "alert:create").row().text("Close", "close")

  await ctx.reply(
    `🔔 *Price alerts*\n\nGet notified when a token reaches a target price.\n\n*Your alerts:*\n${lines}`,
    { parse_mode: "Markdown", reply_markup: kb }
  )
}

export async function alertCreateStartHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return
  await redis.set(redisKeys.alertDraft(userId), JSON.stringify({}), "EX", DRAFT_TTL)
  await ctx.reply("Send token mint or paste token address for the alert.")
}

export async function alertCancelHandler(ctx: Context, alertId: string) {
  const userId = ctx.from?.id
  if (!userId) return
  await setAlertInactive(alertId)
  await ctx.reply("✅ Alert cancelled.")
}

export async function handleAlertDraftMessage(
  userId: number,
  text: string
): Promise<{ done: boolean; reply: string }> {
  const raw = await redis.get(redisKeys.alertDraft(userId))
  if (!raw) return { done: false, reply: "" }

  const draft = JSON.parse(raw) as { tokenMint?: string; targetPriceUsd?: number }

  if (!draft.tokenMint) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text.trim())) {
      return { done: false, reply: "❌ Invalid mint. Send a valid Solana token address." }
    }
    draft.tokenMint = text.trim()
    await redis.set(redisKeys.alertDraft(userId), JSON.stringify(draft), "EX", DRAFT_TTL)
    return { done: false, reply: "✅ Send target price in USD (e.g. 0.00005)." }
  }

  const p = Number(text)
  if (Number.isNaN(p) || p <= 0) {
    return { done: false, reply: "❌ Invalid price. Send a number (e.g. 0.00005)." }
  }
  draft.targetPriceUsd = p

  const alertId = `alert_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  const alert = {
    id: alertId,
    userId,
    tokenMint: draft.tokenMint,
    targetPriceUsd: draft.targetPriceUsd,
    condition: "GTE" as const,
    active: true,
    createdAt: Date.now(),
  }
  await saveAlert(alert)
  await redis.del(redisKeys.alertDraft(userId))

  return {
    done: true,
    reply: `✅ Alert created!\n\n• \`${draft.tokenMint.slice(0, 8)}…\` notify when price ≥ $${p}\n• ID: \`${alertId}\``,
  }
}
