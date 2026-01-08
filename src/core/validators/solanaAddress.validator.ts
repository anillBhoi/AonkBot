import { PublicKey } from '@solana/web3.js'

export function validateSolanaAddress(address: string): void {
  try {
    new PublicKey(address)
  } catch {
    throw new Error('Invalid Solana address')
  }
}
