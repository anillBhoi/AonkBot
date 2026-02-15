import { redis } from "../config/redis.js"
import { getActiveOrderIds, getOrderById, saveOrder } from "../services/orders.store.js"
import { executeSwap } from "../services/swap.service.js"

const SOL_MINT = "So11111111111111111111111111111111111111112"

export async function startDcaWorker() {
  setInterval(async () => {
    try {
      const ids = await getActiveOrderIds("DCA")
      const now = Date.now()

      for (const id of ids) {
        const lockKey = `lock:order:${id}`
        const locked = await redis.set(lockKey, "1", "EX", 30, "NX")

        if (!locked) continue

        const order = await getOrderById(id)
        if (!order || order.type !== "DCA" || !order.active) continue
        if (order.nextRunAt > now) continue

        try {
          await executeSwap({
            userId: order.userId,
            inputMint: SOL_MINT,
            outputMint: order.tokenMint,
            amountSol: order.amountSol,
          })

          order.runs += 1
          order.nextRunAt = now + order.intervalMinutes * 60_000
          await saveOrder(order)
        } catch (err) {
          console.error(`[DCA Execute Error] ${id}`, err)
          // Optional: store lastError on order and save
        }
      }
    } catch (e) {
      console.error("[DCA Worker]", e)
    }
  }, 10_000)
}
