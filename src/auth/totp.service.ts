import { authenticator } from 'otplib'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import { encrypt, decrypt } from './encryption.js'
import crypto from 'crypto'

// Allow 2 time windows before/after (±60 seconds) for clock skew tolerance
authenticator.options = { window: 2 }

const MAX_ATTEMPTS = 5
const ATTEMPT_TTL = 60 * 5  // 5 minutes
const LOCK_TTL = 60 * 30    // 30 minutes

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function generateAndSaveSecret(userId: number) {
  const secret = authenticator.generateSecret()
  const service = 'AonkBot'
  const label = String(userId)
  const otpAuth = authenticator.keyuri(label, service, secret)

  // Encrypt and store the secret
  const payload = encrypt(secret)
  await redis.set(redisKeys.totpSecret(userId), payload)

  // Generate 8 one-time backup codes
  const backupPlain: string[] = []
  const backupHashes: string[] = []
  for (let i = 0; i < 8; i++) {
    // Produce an 8-char alphanumeric code
    const code = crypto.randomBytes(8)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 8)
      .padEnd(8, '0')
    backupPlain.push(code)
    backupHashes.push(hashCode(code))
  }
  await redis.set(redisKeys.totpBackupCodes(userId), JSON.stringify(backupHashes))

  return { secret, otpAuth, backupCodes: backupPlain }
}

export async function getSecret(userId: number): Promise<string | null> {
  const payload = await redis.get(redisKeys.totpSecret(userId))
  if (!payload) return null

  const secret = decrypt(payload)
  if (!secret) {
    console.warn(`[TOTP] Decryption failed for user ${userId}, clearing corrupt secret`)
    await redis.del(redisKeys.totpSecret(userId))
    await redis.del(redisKeys.totpBackupCodes(userId))
    return null
  }
  return secret
}

export async function isLocked(userId: number): Promise<boolean> {
  const v = await redis.get(redisKeys.totpLock(userId))
  return !!v
}

export async function verifyToken(userId: number, token: string): Promise<boolean> {
  // Check global TOTP lock
  const locked = await isLocked(userId)
  if (locked) {
    console.warn(`[TOTP] User ${userId} is locked`)
    return false
  }

  const secret = await getSecret(userId)
  if (!secret) {
    console.error(`[TOTP] No secret found for user ${userId}`)
    return false
  }

  console.log(`[TOTP] Verifying token for user ${userId}, secret length: ${secret.length}`)

  try {
    const ok = authenticator.check(token, secret)

    if (ok) {
      console.log(`[TOTP] Token verified successfully for user ${userId}`)
      // Clear failed attempts on success
      await redis.del(redisKeys.totpAttempts(userId))
      return true
    }

    // Failed attempt — increment counter
    console.warn(`[TOTP] Token verification failed for user ${userId}`)
    const attempts = await redis.incr(redisKeys.totpAttempts(userId))
    if (attempts === 1) {
      await redis.expire(redisKeys.totpAttempts(userId), ATTEMPT_TTL)
    }
    if (attempts >= MAX_ATTEMPTS) {
      console.warn(`[TOTP] Max attempts reached for user ${userId}, locking for ${LOCK_TTL}s`)
      await redis.set(redisKeys.totpLock(userId), '1', 'EX', LOCK_TTL)
      await redis.del(redisKeys.totpAttempts(userId))
    }
    return false
  } catch (e) {
    console.error(`[TOTP] Exception during verification for user ${userId}:`, e)
    return false
  }
}

export async function verifyBackupCode(userId: number, code: string): Promise<boolean> {
  const raw = await redis.get(redisKeys.totpBackupCodes(userId))
  if (!raw) return false

  let hashes: string[] = []
  try {
    hashes = JSON.parse(raw)
  } catch {
    hashes = []
  }

  const h = hashCode(code)
  const idx = hashes.indexOf(h)
  if (idx === -1) return false

  // Consume the code (single-use)
  hashes.splice(idx, 1)
  await redis.set(redisKeys.totpBackupCodes(userId), JSON.stringify(hashes))

  // Backup codes bypass the lock — clear attempts and lock on success
  console.log(`[TOTP] Backup code verified for user ${userId}, clearing lock/attempts`)
  await redis.del(redisKeys.totpAttempts(userId))
  await redis.del(redisKeys.totpLock(userId))
  return true
}