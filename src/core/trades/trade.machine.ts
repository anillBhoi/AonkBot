import { redis } from '../../config/redis.js'
import { TradeIntent } from './trade.intent.js'
import { TradeState } from './trade.state.js'
import { acquireLock, releaseLock } from '../locks.js'
import { redisKeys } from '../../utils/redisKeys.js'
import { validateToken } from '../validators/token.validator.js'
import { getSolBalance } from '../../blockchain/balance.service.js'
import { getSwapRoute, buildSwapTx } from '../../blockchain/jupiter.service.js'
import { simulateTx, sendTxAndConfirm } from '../../blockchain/tx.service.js'
import { getOrCreateWallet, loadWalletSigner } from '../../blockchain/wallet.service.js'

export class TradeMachine {
  static async execute(tradeId: string) {
    const rawIntent = await redis.get(`trade:${tradeId}:intent`)
    if (!rawIntent) return

    const intent: TradeIntent = JSON.parse(rawIntent)

    /** 🔒 Canonical numeric ID (single source of truth) */
    const telegramId = Number(intent.userId)
    if (Number.isNaN(telegramId)) return

    /** Lock — unchanged contract */
    const lockAcquired = await acquireLock(telegramId, 'trade', 90_000)
    if (!lockAcquired) return

    const lockKey = redisKeys.lock(telegramId, 'trade')

    try {
      await this.transition(tradeId, TradeState.INIT, TradeState.VALIDATED)

      await validateToken(intent.outputMint)
      const wallet = await getOrCreateWallet(telegramId)
      await getSolBalance(wallet.publicKey)

      const route = await getSwapRoute(intent)
      await redis.set(`trade:${tradeId}:route`, JSON.stringify(route))

      await this.transition(tradeId, TradeState.VALIDATED, TradeState.QUOTED)

      const tx = await buildSwapTx(route, wallet.publicKey)

      await simulateTx(tx)
      await this.transition(tradeId, TradeState.QUOTED, TradeState.SIMULATED)

      /** 🔑 Load keypair with decryption */
      const keypair = await loadWalletSigner(telegramId)

      tx.sign([keypair])

      const sig = await sendTxAndConfirm(tx)
      await redis.set(`trade:${tradeId}:signature`, sig)

      await this.transition(tradeId, TradeState.SIMULATED, TradeState.CONFIRMED)
    } catch (err: any) {
      await redis.set(`trade:${tradeId}:error`, err?.message ?? 'Unknown error')
      await redis.set(`trade:${tradeId}:state`, TradeState.FAILED)
    } finally {
      await releaseLock(lockKey)
    }
  }

  private static async transition(
    tradeId: string,
    from: TradeState,
    to: TradeState
  ) {
    const key = `trade:${tradeId}:state`

    await redis.watch(key)
    const current = await redis.get(key)

    if (current && current !== from) {
      await redis.unwatch()
      return
    }

    const tx = redis.multi()
    tx.set(key, to)
    await tx.exec()
  }
}
