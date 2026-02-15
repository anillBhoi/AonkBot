import { Connection, VersionedTransaction } from "@solana/web3.js"
import { loadWalletSigner } from "../blockchain/wallet.service.js"

const JUP_QUOTE = "https://quote-api.jup.ag/v6/quote"
const JUP_SWAP = "https://quote-api.jup.ag/v6/swap"

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

  // 1) QUOTE
  const quoteRes = await fetch(
    `${JUP_QUOTE}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=100`
  )
  const quoteData = await quoteRes.json()

  const route = quoteData?.data?.[0]
  if (!route) throw new Error("No swap route found")

  // 2) SWAP TX
  const swapRes = await fetch(JUP_SWAP, {
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

  return txid
}
