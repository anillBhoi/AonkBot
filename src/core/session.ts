//Session Lifecycle (Redis-Backed)
//  Bot restart safe
//  Redis is system of record

import { redisKeys } from '../utils/redisKeys.js';
import { UserSession } from '../types/session.types.js';
import { redis } from '../config/redis.js';

export async function getOrCreateSession(
  telegramId: number,  
  username?: string
): Promise<UserSession> {
  const key = redisKeys.session(telegramId);
  const existing = await redis.get(key);
//   const existing = await config.redisUrl;

  if (existing) {
    const session = JSON.parse(existing) as UserSession;
    session.lastActiveAt = Date.now();
    await redis.set(key, JSON.stringify(session));
    return session;
  }

  const session: UserSession = {
    telegramId,
    username,
    state: 'IDLE',
    createdAt: Date.now(),
    lastActiveAt: Date.now()
  };

  await redis.set(key, JSON.stringify(session));
  return session;
}
