import { PublicKey, VersionedTransaction, Transaction, Keypair } from '@solana/web3.js'
import { solana } from './solana.client.js'
import { redis } from '../config/redis.js'

const MOCK_MODE = process.env.MOCK_JUPITER === 'true'

export interface TxSummary {
  signature: string
  slot: number
  err: boolean
}

/**
 * Get recent transactions for a public key
 */
export async function getRecentTransactions(
  publicKey: string,
  limit = 10
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

/**
 * Simulate a transaction without sending
 * Supports both Transaction and VersionedTransaction
 */
export async function simulateTx(tx: VersionedTransaction | Transaction): Promise<boolean> {
  // Mock mode: always succeeds
  if (MOCK_MODE) {
    console.log('[Simulation] Mock mode - simulating transaction')
    return true
  }

  try {
    // Use type guard to call correct overload
    // Transaction: simulateTransaction(tx, signers[]) - commitment is optional
    // VersionedTransaction: simulateTransaction(tx, { commitment? })
    let sim
    if (tx instanceof Transaction) {
      // Transaction - if partially signed (e.g., admin signature in devnet), pass empty signers
      // Otherwise would need signers, but we'll pass empty array and let it use defaults
      // Note: Simulation of partially signed transactions may not be perfect, but should work
      sim = await (solana.simulateTransaction as any)(tx, [], {
        commitment: 'confirmed',
        replaceRecentBlockhash: true
      })
    } else {
      // VersionedTransaction - pass options object
      sim = await solana.simulateTransaction(tx, {
        commitment: 'confirmed'
      })
    }

    if (sim.value.err) {
      console.error('[Simulation Error]', sim.value.err)
      return false
    }

    console.log('[Simulation Success] Units consumed:', sim.value.unitsConsumed)
    return true
  } catch (err) {
    console.error('[Simulation Error]', err)
    throw new Error('Transaction simulation failed')
  }
}

/**
 * Sign and send transaction with confirmation polling
 * Supports both Transaction (legacy) and VersionedTransaction
 */
export async function sendTxAndConfirm(
  tx: VersionedTransaction | Transaction,
  signer: Keypair,
  maxRetries = 3
): Promise<string> {
  // Mock mode: return fake signature
  if (MOCK_MODE) {
    const mockSig = 'mock' + Math.random().toString(36).substring(7) + Date.now().toString(36)
    console.log(`[Tx Sent - Mock] Signature: ${mockSig}`)
    
    // Store mock signature in Redis
    await redis.set(
      `tx:${mockSig}`,
      JSON.stringify({
        signature: mockSig,
        signer: signer.publicKey.toBase58(),
        timestamp: Date.now(),
        status: 'confirmed',
        isMock: true
      }),
      'EX',
      86400 // 24 hours
    )
    
    console.log(`[Tx Confirmed - Mock] Signature: ${mockSig}`)
    return mockSig
  }

  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Handle both Transaction and VersionedTransaction types
      let sig: string
      if (tx instanceof Transaction) {
        // Legacy Transaction - if already partially signed (e.g., with admin key), add user signature
        // Otherwise, sign normally with user keypair
        if (tx.signatures.length > 0 && tx.signatures.some(sig => sig.signature !== null)) {
          // Already has some signatures (e.g., admin), add user signature
          tx.partialSign(signer)
        } else {
          // Not signed yet, sign with user keypair
          tx.sign(signer)
        }
        // Send Transaction
        sig = await solana.sendTransaction(tx, [signer], {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        })
      } else {
        // VersionedTransaction - sign as array
        tx.sign([signer])
        // Send VersionedTransaction
        sig = await solana.sendTransaction(tx, {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        })
      }

      console.log(`[Tx Sent] Signature: ${sig}`)

      // Store signature in Redis for audit trail
      await redis.set(
        `tx:${sig}`,
        JSON.stringify({
          signature: sig,
          signer: signer.publicKey.toBase58(),
          timestamp: Date.now(),
          status: 'pending'
        }),
        'EX',
        86400 // 24 hours
      )

      // Wait for confirmation (with polling)
      const latestBlockhash = await solana.getLatestBlockhash('confirmed')
      await solana.confirmTransaction(
        {
          signature: sig,
          ...latestBlockhash
        },
        'confirmed'
      )

      console.log(`[Tx Confirmed] Signature: ${sig}`)

      // Update status
      await redis.set(
        `tx:${sig}:status`,
        JSON.stringify({
          status: 'confirmed',
          confirmedAt: Date.now()
        }),
        'EX',
        86400
      )

      // Import and invalidate balance cache after successful transaction
      try {
        const { invalidateBalanceCache } = await import('./balance.service.js')
        await invalidateBalanceCache(signer.publicKey.toBase58())
      } catch (err) {
        console.warn('[Balance Cache] Failed to invalidate cache after tx', err)
        // Don't fail the transaction if cache invalidation fails
      }

      return sig
    } catch (err: any) {
      lastError = err
      console.error(`[Send Tx Error - Attempt ${attempt}/${maxRetries}]`, err.message)

      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`[Retrying in ${delayMs}ms]`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  throw new Error(`Failed to send transaction after ${maxRetries} attempts: ${lastError?.message}`)
}

/**
 * Check transaction status
 */
export async function getTxStatus(signature: string): Promise<string | null> {
  try {
    const status = await redis.get(`tx:${signature}:status`)
    if (status) {
      return JSON.parse(status).status
    }

    // Fallback to blockchain query
    const tx = await solana.getTransaction(signature, {
      commitment: 'confirmed'
    })

    return tx ? 'confirmed' : 'failed'
  } catch (err) {
    console.error('[Get Tx Status Error]', err)
    return null
  }
}
