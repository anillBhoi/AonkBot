import { redis } from "../config/redis.js"
import {
  getActiveAlertIds,
  getAlertById,
  setAlertInactive,
} from "../services/alerts.store.js"
import { fetchTokenInfo } from "../services/token.service.js"

const ALERT_CHECK_MS = 15_000

export async function startAlertsWorker() {
  setInterval(async () => {
    try {
      const ids = await getActiveAlertIds()
      for (const id of ids) {
        const lockKey = `lock:alert:${id}`
        const locked = await redis.set(lockKey, "1", "EX", 25, "NX")
        if (!locked) continue

        const alert = await getAlertById(id)
        if (!alert || !alert.active) continue

        const info = await fetchTokenInfo(alert.tokenMint)
        if (!info?.price) continue

        const price = Number(info.price)
        const hit =
          alert.condition === "LTE" ? price <= alert.targetPriceUsd : price >= alert.targetPriceUsd
        if (!hit) continue

        await setAlertInactive(id)
        const cond = alert.condition === "LTE" ? "≤" : "≥"
        const { bot } = await import("../bot.js")
        await bot.api.sendMessage(
          alert.userId,
          `🔔 *Price alert*\n\n\`${alert.tokenMint.slice(0, 8)}…\` reached $${price.toFixed(8)} (${cond} $${alert.targetPriceUsd})`,
          { parse_mode: "Markdown" }
        )
      }
    } catch (e) {
      console.error("[Alerts Worker]", e)
    }
  }, ALERT_CHECK_MS)
}
