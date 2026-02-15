import { redis } from "../config/redis.js"
import { redisKeys } from "../utils/redisKeys.js"

export interface PriceAlert {
  id: string
  userId: number
  tokenMint: string
  targetPriceUsd: number
  condition: "LTE" | "GTE"
  active: boolean
  createdAt: number
}

export async function saveAlert(alert: PriceAlert): Promise<void> {
  await redis.set(redisKeys.alert(alert.id), JSON.stringify(alert))
  await redis.sadd(redisKeys.userAlerts(alert.userId), alert.id)
  if (alert.active) await redis.sadd(redisKeys.activeAlerts(), alert.id)
}

export async function getUserAlerts(userId: number): Promise<PriceAlert[]> {
  const ids = await redis.smembers(redisKeys.userAlerts(userId))
  const alerts: PriceAlert[] = []
  for (const id of ids) {
    const raw = await redis.get(redisKeys.alert(id))
    if (raw) alerts.push(JSON.parse(raw))
  }
  return alerts.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getAlertById(alertId: string): Promise<PriceAlert | null> {
  const raw = await redis.get(redisKeys.alert(alertId))
  return raw ? JSON.parse(raw) : null
}

export async function setAlertInactive(alertId: string): Promise<void> {
  const alert = await getAlertById(alertId)
  if (!alert) return
  alert.active = false
  await redis.set(redisKeys.alert(alertId), JSON.stringify(alert))
  await redis.srem(redisKeys.activeAlerts(), alertId)
}

export async function getActiveAlertIds(): Promise<string[]> {
  return redis.smembers(redisKeys.activeAlerts())
}
