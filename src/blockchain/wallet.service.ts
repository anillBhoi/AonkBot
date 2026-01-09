import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import { decrypt, encrypt } from '../utils/crypto.js'

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


export async function loadWalletSigner(
  telegramId: number
): Promise<Keypair> {

  const key = redisKeys.wallet(telegramId)
  const raw = await redis.get(key)

  if (!raw) {
    throw new Error('Wallet not found for signer load')
  }

  const wallet = JSON.parse(raw) as UserWallet

  // 🔓 Decrypt private key only in-memory
  const secretKeyBase58 = decrypt(wallet.encryptedPrivateKey)
  const secretKey = bs58.decode(secretKeyBase58)

  return Keypair.fromSecretKey(secretKey)
}