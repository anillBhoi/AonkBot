import { redis } from '../../config/redis.js'

const TTL = 60 // seconds

export async function createConfirmation(userId: number, payload: any) {
  await redis.set(
    `confirm:${userId}`,
    JSON.stringify(payload),
    'EX',
    TTL
  )
}

export async function getConfirmation(userId: number) {
  const data = await redis.get(`confirm:${userId}`)
  return data ? JSON.parse(data) : null
}

export async function clearConfirmation(userId: number) {
  await redis.del(`confirm:${userId}`)
}
