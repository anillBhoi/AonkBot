import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import { encrypt, decrypt } from '../utils/crypto.js'

export interface UserWallet {
  walletId: string
  telegramId: number
  publicKey: string
  encryptedPrivateKey: string
  name: string
  createdAt: number
}

/* ===============================
   CREATE NEW WALLET
================================ */
export async function createWallet(
  telegramId: number,
  name?: string
): Promise<UserWallet> {

  const walletId = crypto.randomUUID()

  const keypair = Keypair.generate()

  const wallet: UserWallet = {
    walletId,
    telegramId,
    publicKey: keypair.publicKey.toBase58(),
    encryptedPrivateKey: encrypt(bs58.encode(keypair.secretKey)),
    name: name || `Wallet ${walletId.split('-')[0]}`,
    createdAt: Date.now()
  }

  const key = redisKeys.wallet(telegramId, walletId)

  await redis.set(key, JSON.stringify(wallet))

  /* Track wallet list */
  await redis.sadd(`wallets:${telegramId}`, walletId)

  return wallet
}

/* ===============================
   GET ALL USER WALLETS
================================ */
export async function getUserWallets(
  telegramId: number
): Promise<UserWallet[]> {

  const walletIds = await redis.smembers(`wallets:${telegramId}`)

  const wallets: UserWallet[] = []

  for (const id of walletIds) {
    const raw = await redis.get(redisKeys.wallet(telegramId, id))
    if (raw) wallets.push(JSON.parse(raw))
  }

  return wallets
}

/* ===============================
   SELECT WALLET
================================ */
export async function selectWallet(
  telegramId: number,
  walletId: string
) {
  await redis.set(`wallet:selected:${telegramId}`, walletId)
}

/* ===============================
   GET SELECTED WALLET
================================ */
export async function getSelectedWallet(
  telegramId: number
): Promise<UserWallet | null> {

  const walletId = await redis.get(`wallet:selected:${telegramId}`)
  if (!walletId) return null

  const raw = await redis.get(redisKeys.wallet(telegramId, walletId))
  return raw ? JSON.parse(raw) : null
}

/* ===============================
   LOAD SIGNER
================================ */
/* ===============================
   GET OR CREATE WALLET
================================ */
export async function getOrCreateWallet(
  telegramId: number
): Promise<UserWallet> {

  let wallet = await getSelectedWallet(telegramId)

  if (!wallet) {
    // No selected wallet, try to get the first wallet
    const wallets = await getUserWallets(telegramId)
    if (wallets.length > 0) {
      wallet = wallets[0]
      await selectWallet(telegramId, wallet.walletId)
    } else {
      // No wallets exist, create a new one
      wallet = await createWallet(telegramId)
      await selectWallet(telegramId, wallet.walletId)
    }
  }

  return wallet
}

/* ===============================
   LOAD SIGNER
================================ */
export async function loadWalletSigner(
  telegramId: number
): Promise<Keypair> {

  const wallet = await getSelectedWallet(telegramId)

  if (!wallet) throw new Error('No wallet selected')

  const secret = decrypt(wallet.encryptedPrivateKey)

  return Keypair.fromSecretKey(bs58.decode(secret))
}
