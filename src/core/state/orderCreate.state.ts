import { redis } from "../../config/redis.js"

type CreateMode = "DCA" | "LIMIT"

export interface CreateDraft {
  mode: CreateMode
  tokenMint?: string
  amountSol?: number
  intervalMinutes?: number // DCA
  targetPriceUsd?: number  // LIMIT
  condition?: "LTE" | "GTE"
}

const key = (userId: number) => `order:create:${userId}`

export async function setCreateDraft(userId: number, draft: CreateDraft) {
  await redis.set(key(userId), JSON.stringify(draft), "EX", 600) // 10 min
}

export async function getCreateDraft(userId: number): Promise<CreateDraft | null> {
  const raw = await redis.get(key(userId))
  return raw ? JSON.parse(raw) : null
}

export async function clearCreateDraft(userId: number) {
  await redis.del(key(userId))
}
