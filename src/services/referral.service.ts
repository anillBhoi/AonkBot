import { redis } from "../config/redis.js"
import { redisKeys } from "../utils/redisKeys.js"

/**
 * Record trade volume for referral rewards. Call after a successful swap/sell by userId.
 * If userId was referred, we credit the inviter's volume and trade count.
 */
export async function recordReferralTrade(userId: number, amountSol: number): Promise<void> {
  if (amountSol <= 0) return
  try {
    const inviterRaw = await redis.get(redisKeys.refInviter(userId))
    if (!inviterRaw) return
    const inviterId = Number(inviterRaw)
    if (!Number.isInteger(inviterId)) return

    await redis.incr(redisKeys.refTradeCount(inviterId))
    const volKey = redisKeys.refVolumeSol(inviterId)
    const prev = await redis.get(volKey)
    const prevVal = prev ? Number(prev) : 0
    await redis.set(volKey, String(prevVal + amountSol))
  } catch (e) {
    console.error("[Referral] recordReferralTrade", e)
  }
}

export async function getReferralStats(inviterId: number): Promise<{
  referredCount: number
  tradeCount: number
  volumeSol: number
}> {
  const [referredCount, tradeCountRaw, volumeRaw] = await Promise.all([
    redis.scard(redisKeys.refReferredSet(inviterId)),
    redis.get(redisKeys.refTradeCount(inviterId)),
    redis.get(redisKeys.refVolumeSol(inviterId)),
  ])
  return {
    referredCount,
    tradeCount: tradeCountRaw ? Number(tradeCountRaw) : 0,
    volumeSol: volumeRaw ? Number(volumeRaw) : 0,
  }
}
