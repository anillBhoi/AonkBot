import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import { encrypt } from '../utils/crypto.js'

interface UserWallet {
  telegramId: number
  publicKey: string
  encryptedPrivateKey: string
  createdAt: number
}

export async function getOrCreateWallet(
  telegramId: number
): Promise<UserWallet> {

  const key = redisKeys.wallet(telegramId)

  // 🔒 Idempotency gate
  const existing = await redis.get(key)
  if (existing) {
    return JSON.parse(existing) as UserWallet
  }

  // 🔐 Create wallet ONCE
  const keypair = Keypair.generate()

  const wallet: UserWallet = {
    telegramId,
    publicKey: keypair.publicKey.toBase58(),
    encryptedPrivateKey: encrypt(
      bs58.encode(keypair.secretKey)
    ),
    createdAt: Date.now()
  }

  // 🔒 Atomic write (single source of truth)
  await redis.set(key, JSON.stringify(wallet))

  return wallet
}
