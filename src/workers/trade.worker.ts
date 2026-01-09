import { TradeMachine } from "../core/trades/trade.machine.js"
import { tradeQueue } from "../queue/trade.queue.js"

tradeQueue.process(async (job) => {
    const { tradeID } = job.data
    await TradeMachine.execute(tradeID)
})