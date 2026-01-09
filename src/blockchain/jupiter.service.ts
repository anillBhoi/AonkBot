// import axios from 'axios'
// import { TOKENS } from '../utils/tokens.js'

// const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote'

// export interface QuoteResult {
//   inAmount: number
//   outAmount: number
//   priceImpactPct: number
// }

// export async function getQuote(
//   inputSymbol: string,
//   outputSymbol: string,
//   amount: number
// ): Promise<QuoteResult> {

//   if (amount <= 0 || Number.isNaN(amount)) {
//     throw new Error('Invalid amount')
//   }

//   const input = TOKENS[inputSymbol.toUpperCase()]
//   const output = TOKENS[outputSymbol.toUpperCase()]

//   if (!input || !output) {
//     throw new Error('Unsupported token')
//   }

//   const amountInBaseUnits = Math.floor(
//     amount * 10 ** input.decimals
//   )

//   try {
//     const res = await axios.get(JUPITER_QUOTE_API, {
//       params: {
//         inputMint: input.mint,
//         outputMint: output.mint,
//         amount: amountInBaseUnits,
//         slippageBps: 50,
//         onlyDirectRoutes: false
//       }
//     })

//     const route = res.data?.data?.[0]
//     if (!route) {
//       throw new Error('No route found')
//     }

//     return {
//       inAmount: route.inAmount / 10 ** input.decimals,
//       outAmount: route.outAmount / 10 ** output.decimals,
//       priceImpactPct: Number(route.priceImpactPct) * 100
//     }

//   } catch (err) {
//     if (axios.isAxiosError(err)) {
//       console.error('[Jupiter Quote Error]', err.response?.data)
//     } else {
//       console.error('[Jupiter Quote Error]', err)
//     }
//     throw new Error('Failed to fetch quote')
//   }
// }



import axios from 'axios'
import { TradeIntent } from '../core/trades/trade.intent.js' 
import { VersionedTransaction } from '@solana/web3.js'

const QUOTE_API = 'https://quote-api.jup.ag/v6/quote'
const SWAP_API = 'https://quote-api.jup.ag/v6/swap'

export async function getSwapRoute(intent: TradeIntent) {
  const res = await axios.get(QUOTE_API, {
    params: {
      inputMint: intent.inputMint,
      outputMint: intent.outputMint,
      amount: intent.amountLamports.toString(),
      slippageBps: intent.slippageBps
    }
  })

  const route = res.data?.data?.[0]
  if (!route) throw new Error('No swap route available')

  return route
}

export async function buildSwapTx(
  route: any,
  userPubkey: string
): Promise<VersionedTransaction> {
  const res = await axios.post(SWAP_API, {
    route,
    userPublicKey: userPubkey,
    wrapAndUnwrapSol: true
  })

  const txBuf = Buffer.from(res.data.swapTransaction, 'base64')
  return VersionedTransaction.deserialize(txBuf)
}
