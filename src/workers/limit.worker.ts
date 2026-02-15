import { redis } from "../config/redis.js"
import { getActiveOrderIds, getOrderById, saveOrder } from "../services/orders.store.js"
import { executeSwap } from "../services/swap.service.js"
import { executeSell } from "../services/swap.service.js"
import { fetchTokenInfo } from "../services/token.service.js"

const SOL_MINT = "So11111111111111111111111111111111111111112"
const MIN_LIQ_USD = 5000
const REQUIRED_HITS = 2

function resolveTriggerPrice(order: any, price: number, mcap: number): number {
  const triggerType = order.triggerType ?? "price"
  if (triggerType === "price") return order.targetPriceUsd
  if (triggerType === "mcap" && order.targetMcapUsd != null) return order.targetMcapUsd
  if (triggerType === "multiple" && order.referencePrice != null && order.targetMultiple != null)
    return order.referencePrice * order.targetMultiple
  if (triggerType === "percent" && order.referencePrice != null && order.targetPercentChange != null)
    return order.referencePrice * (1 + order.targetPercentChange / 100)
  return order.targetPriceUsd
}

function shouldTriggerOrder(order: any, price: number, mcap: number): boolean {
  const subType = order.limitSubType ?? "buy"

  if (subType === "trailing_stop") {
    const trail = order.trailPercentPct ?? 10
    let peak = order.peakPrice ?? price
    if (price > peak) peak = price
    order.peakPrice = peak
    const threshold = peak * (1 - trail / 100)
    return price <= threshold
  }

  const triggerType = order.triggerType ?? "price"
  let target: number
  let current: number
  if (triggerType === "mcap") {
    target = order.targetMcapUsd ?? order.targetPriceUsd
    current = mcap
  } else {
    target = resolveTriggerPrice(order, price, mcap)
    current = price
  }
  return order.condition === "LTE" ? current <= target : current >= target
}

export async function startLimitWorker() {
  setInterval(async () => {
    try {
      const ids = await getActiveOrderIds("LIMIT")
      const now = Date.now()

      for (const id of ids) {
        const lockKey = `lock:order:${id}`
        const locked = await redis.set(lockKey, "1", "EX", 30, "NX")

        if (!locked) continue

        const order: any = await getOrderById(id)
        if (!order || order.type !== "LIMIT" || !order.active) continue

        const info = await fetchTokenInfo(order.tokenMint)
        if (!info?.price) continue

        const liq = Number(info.liquidityUsd ?? 0)
        if (!liq || liq < MIN_LIQ_USD) {
          order.lastCheckedAt = now
          order.consecutiveHits = 0
          await saveOrder(order)
          continue
        }

        const price = Number(info.price)
        const mcap = Number(info.mcap ?? 0)

        if (order.limitSubType === "trailing_stop") {
          const trail = order.trailPercentPct ?? 10
          let peak = order.peakPrice ?? price
          if (price > peak) peak = price
          order.peakPrice = peak
          order.lastCheckedAt = now
          const threshold = peak * (1 - trail / 100)
          if (price > threshold) {
            order.consecutiveHits = 0
            await saveOrder(order)
            continue
          }
          order.consecutiveHits = (order.consecutiveHits ?? 0) + 1
          if (order.consecutiveHits < REQUIRED_HITS) {
            await saveOrder(order)
            continue
          }
        } else {
          const shouldTrigger = shouldTriggerOrder(order, price, mcap)
          order.lastCheckedAt = now
          order.consecutiveHits = order.consecutiveHits ?? 0
          if (!shouldTrigger) {
            order.consecutiveHits = 0
            await saveOrder(order)
            continue
          }
          order.consecutiveHits += 1
          if (order.consecutiveHits < REQUIRED_HITS) {
            await saveOrder(order)
            continue
          }
        }

        const isSellOrder =
          order.limitSubType === "take_profit" ||
          order.limitSubType === "stop_loss" ||
          order.limitSubType === "trailing_stop"

        try {
          if (isSellOrder) {
            await executeSell({
              userId: order.userId,
              tokenMint: order.tokenMint,
              amountTokenPortion: order.sellAmountPortion ?? 1,
            })
          } else {
            await executeSwap({
              userId: order.userId,
              inputMint: SOL_MINT,
              outputMint: order.tokenMint,
              amountSol: order.amountSol,
            })
          }
          order.active = false
          order.triggeredAt = now
          await saveOrder(order)
        } catch (err) {
          console.error(`[LIMIT Execute Error] ${id}`, err)
        }
      }
    } catch (e) {
      console.error("[LIMIT Worker]", e)
    }
  }, 12_000)
}
