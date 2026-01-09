import { PublicKey } from '@solana/web3.js'
import { solana } from './solana.client.js'

export interface TxSummary {
  signature: string
  slot: number
  err: boolean
}

export async function getRecentTransactions(
  publicKey: string,
  limit = 5
): Promise<TxSummary[]> {
  try {
    const pubKey = new PublicKey(publicKey)

    const signatures = await solana.getSignaturesForAddress(
      pubKey,
      { limit },
      'confirmed'
    )

    return signatures.map(sig => ({
      signature: sig.signature,
      slot: sig.slot,
      err: !!sig.err
    }))
  } catch (err) {
    console.error('[Tx Fetch Error]', err)
    throw new Error('Failed to fetch transactions')
  }
}





import { VersionedTransaction } from '@solana/web3.js'

export async function simulateTx(tx: VersionedTransaction) {
  const sim = await solana.simulateTransaction(tx)
  if (sim.value.err) {
    throw new Error('Simulation failed')
  }
}

export async function sendTxAndConfirm(tx: VersionedTransaction) {
  const sig = await solana.sendTransaction(tx)
  await solana.confirmTransaction(sig, 'confirmed')
  return sig
}
