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


// import { solana } from './solana.client.js' 
// import { PublicKey } from '@solana/web3.js'

// const RENT_BUFFER = 0.01 * 1e9
// const FEE_BUFFER = 0.005 * 1e9

// export async function ensureSolBalance(
//   pubkey: string,
//   amount: bigint
// ) {
//   const balance = await solana.getBalance(new PublicKey(pubkey))
//   const required = Number(amount) + RENT_BUFFER + FEE_BUFFER

//   if (balance < required) {
//     throw new Error('Insufficient SOL balance')
//   }
// }