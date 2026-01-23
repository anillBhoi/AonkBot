import { redis } from '../../config/redis.js'

export interface RateLimitConfig {
  limit: number // Number of requests allowed
  windowMs: number // Time window in milliseconds
  message?: string // Custom error message
}

/**
 * Token bucket rate limiter
 */
export class RateLimiter {
  private key: string
  private limit: number
  private windowMs: number
  private message: string

  constructor(userId: number, commandName: string, config: RateLimitConfig) {
    this.key = `ratelimit:${userId}:${commandName}`
    this.limit = config.limit
    this.windowMs = config.windowMs
    this.message = config.message || `Rate limited. Try again in ${Math.ceil(config.windowMs / 1000)}s`
  }

  /**
   * Check if request is allowed
   */
  async isAllowed(): Promise<boolean> {
    const count = await redis.incr(this.key)

    if (count === 1) {
      // First request in this window, set expiry
      await redis.expire(this.key, Math.ceil(this.windowMs / 1000))
    }

    return count <= this.limit
  }

  /**
   * Get remaining requests
   */
  async getRemaining(): Promise<number> {
    const count = await redis.get(this.key)
    const current = count ? Number(count) : 0
    return Math.max(0, this.limit - current)
  }

  /**
   * Get time until next reset (in seconds)
   */
  async getResetTime(): Promise<number> {
    const ttl = await redis.ttl(this.key)
    return Math.max(0, ttl)
  }

  /**
   * Get error message
   */
  getMessage(): string {
    return this.message
  }
}

/**
 * Pre-configured rate limiters
 */
export const RATE_LIMITS = {
  SEND: { limit: 3, windowMs: 60000 }, // 3 per minute
  CONFIRM: { limit: 5, windowMs: 60000 }, // 5 per minute
  WALLET: { limit: 10, windowMs: 60000 }, // 10 per minute
  TXS: { limit: 10, windowMs: 60000 }, // 10 per minute
  HELP: { limit: 20, windowMs: 60000 }, // 20 per minute (unlimited basically)
  CANCEL: { limit: 10, windowMs: 60000 } // 10 per minute
}

/**
 * Create a rate limiter for a command
 */
export function createRateLimiter(
  userId: number,
  commandName: string,
  config: RateLimitConfig = RATE_LIMITS[commandName as keyof typeof RATE_LIMITS]
): RateLimiter {
  if (!config) {
    throw new Error(`No rate limit config for ${commandName}`)
  }
  return new RateLimiter(userId, commandName, config)
}
