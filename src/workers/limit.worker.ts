import { getActiveOrderIds, getOrderById, saveOrder } from "../services/orders.store.js"
import { executeSwap } from "../services/swap.service.js"
import { fetchTokenInfo } from "../services/token.service.js"

const SOL_MINT = "So11111111111111111111111111111111111111112"

export async function startLimitWorker() {
  setInterval(async () => {
    try {
      const ids = await getActiveOrderIds("LIMIT")
      const now = Date.now()

      for (const id of ids) {
        const order = await getOrderById(id)
        if (!order || order.type !== "LIMIT" || !order.active) continue

        const info = await fetchTokenInfo(order.tokenMint)
        if (!info?.price) continue

        const price = Number(info.price)
        const shouldTrigger =
          order.condition === "LTE" ? price <= order.targetPriceUsd : price >= order.targetPriceUsd

        order.lastCheckedAt = now

        if (!shouldTrigger) {
          await saveOrder(order)
          continue
        }

        // Trigger: execute swap
        await executeSwap({
          userId: order.userId,
          inputMint: SOL_MINT,
          outputMint: order.tokenMint,
          amountSol: order.amountSol
        })

        order.active = false
        order.triggeredAt = now
        await saveOrder(order)
      }
    } catch (e) {
      console.error("[LIMIT Worker]", e)
    }
  }, 12_000)
}
