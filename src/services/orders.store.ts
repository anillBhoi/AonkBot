import { redis } from "../config/redis.js"

export type OrderType = "DCA" | "LIMIT"

export interface DcaOrder {
  id: string
  type: "DCA"
  userId: number
  walletPubkey?: string
  tokenMint: string
  amountSol: number
  intervalMinutes: number
  nextRunAt: number // epoch ms
  active: boolean
  createdAt: number
  runs: number
}

export type LimitSubType = "buy" | "take_profit" | "stop_loss"

export interface LimitOrder {
  id: string
  type: "LIMIT"
  userId: number
  walletPubkey?: string
  tokenMint: string
  amountSol: number
  targetPriceUsd: number
  condition: "LTE" | "GTE"
  active: boolean
  createdAt: number
  lastCheckedAt?: number
  triggeredAt?: number
  /** buy = limit buy (SOL→token); take_profit = sell when price ≥ target; stop_loss = sell when price ≤ target */
  limitSubType?: LimitSubType
  /** For take_profit/stop_loss: fraction of token balance to sell (0–1). Default 1 */
  sellAmountPortion?: number
}

const keyUserOrders = (userId: number) => `orders:${userId}` // hash: orderId -> json
const keyAllActive = (type: OrderType) => `orders:active:${type}` // set of order IDs
const keyOrder = (orderId: string) => `order:${orderId}` // json copy (optional)

export async function saveOrder(order: DcaOrder | LimitOrder) {
  await redis.hset(keyUserOrders(order.userId), order.id, JSON.stringify(order))
  await redis.set(keyOrder(order.id), JSON.stringify(order))
  if (order.active) await redis.sadd(keyAllActive(order.type), order.id)
  else await redis.srem(keyAllActive(order.type), order.id)
}

export async function getUserOrders(userId: number): Promise<(DcaOrder | LimitOrder)[]> {
  const data = await redis.hgetall(keyUserOrders(userId))
  return Object.values(data).map(v => JSON.parse(v))
}

export async function getOrderById(orderId: string): Promise<DcaOrder | LimitOrder | null> {
  const raw = await redis.get(keyOrder(orderId))
  return raw ? JSON.parse(raw) : null
}

export async function setOrderInactive(orderId: string) {
  const order = await getOrderById(orderId)
  if (!order) return
  order.active = false
  await saveOrder(order)
}

export async function getActiveOrderIds(type: OrderType): Promise<string[]> {
  return await redis.smembers(keyAllActive(type))
}
