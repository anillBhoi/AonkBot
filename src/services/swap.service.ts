import {
  Connection,
  VersionedTransaction
} from "@solana/web3.js"
import { loadWalletSigner } from "../blockchain/wallet.service.js"


const JUP_QUOTE = "https://quote-api.jup.ag/v6/quote"
const JUP_SWAP = "https://quote-api.jup.ag/v6/swap"

const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed"
)
export async function executeSwap({
    userId, 
    inputMint, 
    outputMint,
    amountSol
}: {
    userId: number
    inputMint:string
    outputMint:string
    amountSol: number
}) {
    const wallet = await loadWalletSigner(userId)

    const amountLamports = amountSol * 1_000_000_000

    // Get qoute 
    const qouteRes = await fetch(
          `${JUP_QUOTE}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=100`
    )

    const quoteData = await qouteRes.json()

    if(!quoteData?.data?.[0]) {
        throw new Error("No swap route found ")
    }

    const route = quoteData.data[0]

    // get swap transaction
    const swapRes = await fetch(JUP_SWAP, {
        method: "POST", 
        headers :{ "Content-Type":"application/json"},
        body:JSON.stringify({
            qouteResponse: route, 
            userPublicKey: wallet.publicKey.toString(), 
            wrapAndUnwrapSol: true
        })
    })

    const swapData = await swapRes.json()

    if(!swapData.swapTransaction){
        throw new Error("Failed to build swap transaction")
    }

    // Deserialize transaction
    const tx = VersionedTransaction.deserialize(
        Buffer.from(swapData.swapTransaction, "base64")
    )

    tx.sign([wallet])

    // send transaction
    const txid = await connection.sendTransaction(tx)

    await connection.confirmTransaction(txid, "confirmed")

    return txid





}