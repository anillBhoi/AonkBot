import { Context } from 'grammy'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import { isLocked, verifyToken, verifyBackupCode } from '../auth/totp.service.js'
import { exportPerformHandler } from './exportSeedPhrase.handler.js'

/**
 * Handles incoming text messages when user is in the simple TOTP export flow.
 * Accepts a 6-digit TOTP code OR an 8-char backup code.
 */
export async function totpMessageHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  // Check if the global TOTP lock is active
  if (await isLocked(userId)) {
    const ttl = await redis.ttl(redisKeys.totpLock(userId))
    await ctx.reply(`⛔ Too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minute(s).`)
    return
  }

  const code = ctx.message?.text?.trim()
  if (!code) return

  // Accept either a 6-digit TOTP code or an 8-char alphanumeric backup code
  let isValid = false

  if (/^[0-9]{6}$/.test(code)) {
    isValid = await verifyToken(userId, code)
  } else if (/^[a-zA-Z0-9]{8}$/.test(code)) {
    isValid = await verifyBackupCode(userId, code)
  } else {
    await ctx.reply('❌ Please enter your 6-digit authenticator code or an 8-character backup code.')
    return
  }

  if (!isValid) {
    // Check if we just got locked after this failure
    if (await isLocked(userId)) {
      await ctx.reply('⛔ Too many failed attempts. Export locked for 30 minutes.')
    } else {
      await ctx.reply('❌ Invalid code. Please try again.')
    }
    return
  }

  // ✅ Code verified — clear the awaiting flag and perform export
  await redis.del(redisKeys.exportAwaitTotp(userId))
  await ctx.reply('✅ Authentication successful! Revealing your private key now...')
  await exportPerformHandler(ctx)
}