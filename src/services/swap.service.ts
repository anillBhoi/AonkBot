import { Connection, VersionedTransaction } from "@solana/web3.js"
import { loadWalletSigner } from "../blockchain/wallet.service.js"
import { getTokenBalanceAndDecimals } from "../blockchain/balance.service.js"
import { redis } from "../config/redis.js"
import { redisKeys } from "../utils/redisKeys.js"
import { recordReferralTrade } from "./referral.service.js"
import { config } from "../utils/config.js"

const SOL_MINT = "So11111111111111111111111111111111111111112"
const DEFAULT_SLIPPAGE_BPS = 100

async function getSlippageBps(userId: number): Promise<number> {
  const raw = await redis.get(redisKeys.userSlippageBps(userId))
  const bps = raw ? Number(raw) : DEFAULT_SLIPPAGE_BPS
  return Number.isNaN(bps) || bps < 10 || bps > 5000 ? DEFAULT_SLIPPAGE_BPS : bps
}

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed")

export async function executeSwap({
  userId,
  inputMint,
  outputMint,
  amountSol,
}: {
  userId: number
  inputMint: string
  outputMint: string
  amountSol: number
}) {
  const wallet = await loadWalletSigner(userId)
  const amountLamports = Math.floor(amountSol * 1_000_000_000)
  const slippageBps = await getSlippageBps(userId)

  // 1) QUOTE
  let quoteRes: Response
  try {
    quoteRes = await fetch(
      `${config.jupiterQuoteUrl}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}`
    )
  } catch (e: any) {
    const msg = e?.cause?.code === 'ENOTFOUND'
      ? `Network/DNS error: cannot reach Jupiter API (${e?.cause?.hostname ?? 'quote-api.jup.ag'}). Check internet and firewall.`
      : (e?.message ?? 'Failed to fetch quote')
    throw new Error(msg)
  }
  const quoteData = await quoteRes.json()

  const route = quoteData?.data?.[0]
  if (!route) throw new Error("No swap route found")

  // 2) SWAP TX
  const swapRes = await fetch(config.jupiterSwapUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: route,
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
    }),
  })

  const swapData = await swapRes.json()
  if (!swapData?.swapTransaction) {
    throw new Error(`Failed to build swap transaction: ${swapData?.error ?? "unknown"}`)
  }

  // 3) Deserialize + sign
  const tx = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, "base64"))
  tx.sign([wallet])

  // 4) Send + confirm (single confirm, correct form)
  const latest = await connection.getLatestBlockhash("confirmed")
  const txid = await connection.sendTransaction(tx, { maxRetries: 3 })

  await connection.confirmTransaction(
    { signature: txid, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed"
  )

  recordReferralTrade(userId, amountSol).catch(() => {})
  return txid
}

/**
 * Sell token for SOL. amountToken is in human units (e.g. 1000 tokens).
 * Use amountTokenPortion in (0, 1] to sell a fraction of balance (e.g. 0.5 = 50%).
 */
export async function executeSell({
  userId,
  tokenMint,
  amountToken,
  amountTokenPortion,
}: {
  userId: number
  tokenMint: string
  amountToken?: number
  amountTokenPortion?: number
}) {
  const wallet = await loadWalletSigner(userId)
  const { balance, decimals } = await getTokenBalanceAndDecimals(wallet.publicKey.toString(), tokenMint)

  if (balance <= 0) throw new Error("You have no balance of this token.")

  let toSell: number
  if (amountTokenPortion != null && amountTokenPortion > 0 && amountTokenPortion <= 1) {
    toSell = balance * amountTokenPortion
  } else if (amountToken != null && amountToken > 0) {
    toSell = Math.min(amountToken, balance)
  } else {
    throw new Error("Specify amount or portion (e.g. 0.5 for 50%).")
  }

  if (toSell <= 0) throw new Error("Sell amount must be positive.")

  const amountRaw = BigInt(Math.floor(toSell * 10 ** decimals))
  const slippageBps = await getSlippageBps(userId)

  let quoteRes: Response
  try {
    quoteRes = await fetch(
      `${config.jupiterQuoteUrl}?inputMint=${tokenMint}&outputMint=${SOL_MINT}&amount=${amountRaw.toString()}&slippageBps=${slippageBps}`
    )
  } catch (e: any) {
    const msg = e?.cause?.code === 'ENOTFOUND'
      ? `Network/DNS error: cannot reach Jupiter API. Check internet and firewall.`
      : (e?.message ?? 'Failed to fetch sell quote')
    throw new Error(msg)
  }
  const quoteData = await quoteRes.json()
  const route = quoteData?.data?.[0]
  if (!route) throw new Error("No sell route found. Low liquidity or unsupported token.")

  const swapRes = await fetch(config.jupiterSwapUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: route,
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
    }),
  })
  const swapData = await swapRes.json()
  if (!swapData?.swapTransaction) {
    throw new Error(`Failed to build sell transaction: ${swapData?.error ?? "unknown"}`)
  }

  const tx = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, "base64"))
  tx.sign([wallet])

  const latest = await connection.getLatestBlockhash("confirmed")
  const txid = await connection.sendTransaction(tx, { maxRetries: 3 })
  await connection.confirmTransaction(
    { signature: txid, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed"
  )
  // Approximate SOL received from sell for referral volume (quote is token→SOL)
  const outLamports = route?.outAmount ?? 0
  const solReceived = Number(outLamports) / 1e9
  if (solReceived > 0) recordReferralTrade(userId, solReceived).catch(() => {})
  return txid
}
