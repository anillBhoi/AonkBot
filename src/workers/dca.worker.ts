import { getActiveOrderIds, getOrderById, saveOrder } from "../services/orders.store.js"
import { executeSwap } from "../services/swap.service.js"

const SOL_MINT = "So11111111111111111111111111111111111111112"

export async function startDcaWorker() {
  setInterval(async () => {
    try {
      const ids = await getActiveOrderIds("DCA")
      const now = Date.now()

      for (const id of ids) {
        const order = await getOrderById(id)
        if (!order || order.type !== "DCA" || !order.active) continue
        if (order.nextRunAt > now) continue

        // Execute swap (SOL -> token)
        await executeSwap({
          userId: order.userId,
          inputMint: SOL_MINT,
          outputMint: order.tokenMint,
          amountSol: order.amountSol
        })

        order.runs += 1
        order.nextRunAt = now + order.intervalMinutes * 60_000
        await saveOrder(order)
      }
    } catch (e) {
      console.error("[DCA Worker]", e)
    }
  }, 10_000) // tick every 10s
}
