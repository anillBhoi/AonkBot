import { PublicKey } from '@solana/web3.js'
import { solana } from './solana.client.js'

export async function getSolBalance(
  publicKey: string
): Promise<number> {
  const pubKey = new PublicKey(publicKey)

  const lamports = await solana.getBalance(pubKey)
  return lamports / 1_000_000_000 // SOL
}
