import { redis } from "../config/redis.js"
import { getActiveOrderIds, getOrderById, saveOrder } from "../services/orders.store.js"
import { executeSwap } from "../services/swap.service.js"
import { executeSell } from "../services/swap.service.js"
import { fetchTokenInfo } from "../services/token.service.js"

const SOL_MINT = "So11111111111111111111111111111111111111112"
const MIN_LIQ_USD = 5000
const REQUIRED_HITS = 2

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
        const shouldTrigger =
          order.condition === "LTE" ? price <= order.targetPriceUsd : price >= order.targetPriceUsd

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

        const isSellOrder = order.limitSubType === "take_profit" || order.limitSubType === "stop_loss"

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
