import { PublicKey } from '@solana/web3.js'

export async function validateToken(mint: string) {
  try {
    new PublicKey(mint)
  } catch {
    throw new Error('Invalid token mint')
  }
}
