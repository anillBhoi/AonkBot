import { redis } from '../config/redis.js';
import { redisKeys } from '../utils/redisKeys.js';

export async function acquireLock(
  telegramId: number,
  action: string,
  ttlMs = 10_000
): Promise<boolean> {
  const key = redisKeys.lock(telegramId, action);
  const result = await redis.set(key, '1', 'PX', ttlMs, 'NX');
  return result === 'OK';
}
export async function releaseLock(key: string) {
  await redis.del(key)
}
