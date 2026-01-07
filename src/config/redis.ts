// src/config/redis.ts
import { Redis } from 'ioredis';
import { config } from '../utils/config.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('connect', () => {
  console.log('[Redis] connected');
});

redis.on('ready', () => {
  console.log('[Redis] ready');
});

redis.on('error', (err: Error) => {
  console.error('[Redis] error', err);
});
