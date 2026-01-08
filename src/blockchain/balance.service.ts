import { PublicKey } from '@solana/web3.js'
import { solana } from './solana.client.js'

export async function getSolBalance(
  publicKey: string
): Promise<number> {
  try {
    const pubKey = new PublicKey(publicKey)

    const lamports = await solana.getBalance(
      pubKey,
      'confirmed'
    )

    return lamports / 1_000_000_000
  } catch (err) {
    console.error('[Balance Error]', err)
    throw new Error('Failed to fetch SOL balance')
  }
}
