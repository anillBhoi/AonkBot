import axios from 'axios'
import { TradeIntent } from '../core/trades/trade.intent.js'
import { VersionedTransaction } from '@solana/web3.js'
import { TOKENS } from '../utils/tokens.js'
import { config } from '../utils/config.js'
import { getPriceFromCoinGecko } from './coingecko.service.js'
// <<<<<<< HEAD
// //import { getQuoteDevnet, ensurePoolExistsOrSetup, buildSwapTxDevnet } from './devnetDex.service.js'
// =======
// import { getQuoteDevnet, ensurePoolExistsOrSetup, buildSwapTxDevnet } from './devnetDex.service.js'
// >>>>>>> 3125221f94ee30dfa87785544945241e3f5fad73
import fs from 'fs'
import path from 'path'

const QUOTE_API = 'https://quote-api.jup.ag/v6/quote'
const SWAP_API = 'https://quote-api.jup.ag/v6/swap'
const API_TIMEOUT = 15000 // Increased timeout to 15s

// Enable mock mode for testing without Jupiter API access
const MOCK_MODE = process.env.MOCK_JUPITER === 'true'
const USE_COINGECKO = process.env.USE_COINGECKO === 'true'

// Log on startup
if (MOCK_MODE) {
  console.log('[Jupiter] ✅ MOCK MODE ENABLED - Using simulated quotes')
} else if (USE_COINGECKO) {
  console.log('[Jupiter] Using CoinGecko API as fallback')
} else {
  console.log('[Jupiter] ❌ Mock mode disabled - Using real Jupiter API')
  console.log('[Jupiter] MOCK_JUPITER env var:', process.env.MOCK_JUPITER)
}

export interface QuoteResult {
  inAmount: number
  outAmount: number
  priceImpactPct: number
}

/**
 * Mock quote for testing without Jupiter API
 */
function getMockQuote(
  inputSymbol: string,
  outputSymbol: string,
  amount: number
): QuoteResult {
  // Current market prices (as of Jan 9, 2026)
  // SOL = $138.59
  const mockPrices: Record<string, number> = {
    'SOL-USDC': 138.59,  // 1 SOL = 138.59 USDC
    'SOL-USDT': 138.59,  // 1 SOL = 138.59 USDT
    'SOL-BONK': 5950000, // 1 SOL = ~5.95M BONK
    'SOL-JUP': 276,      // 1 SOL = ~276 JUP
    'SOL-COPE': 13859    // 1 SOL = ~13859 COPE
  }
  
  const key = `${inputSymbol}-${outputSymbol}`
  const rate = mockPrices[key] || 138.59
  const outAmount = amount * rate * 0.99 // 0.99 = 1% slippage simulation
  
  return {
    inAmount: amount,
    outAmount,
    priceImpactPct: 0.5
  }
}

/**
 * Get quote from CoinGecko (alternative to Jupiter)
 */
async function getQuoteFromCoinGecko(
  inputSymbol: string,
  outputSymbol: string,
  amount: number,
  slippageBps = 50
): Promise<QuoteResult> {
  if (amount <= 0 || Number.isNaN(amount)) {
    throw new Error('Invalid amount')
  }

  const input = TOKENS[inputSymbol.toUpperCase()]
  const output = TOKENS[outputSymbol.toUpperCase()]

  if (!input || !output) {
    throw new Error('Unsupported token')
  }

  // If configured to use Devnet DEX and we're on devnet, try Devnet DEX first
// <<<<<<< HEAD
  // if (config.useDevnetDex && config.solanaCluster === 'devnet') {
  //   try {
  //     const devnetQuote = await getQuoteDevnet(input.mint, output.mint, amount)
  //     if (devnetQuote) {
  //       console.log('[DevnetDEX] Using Devnet DEX for quote')
  //       return {
  //         inAmount: devnetQuote.inAmount,
  //         outAmount: devnetQuote.outAmount,
  //         priceImpactPct: devnetQuote.priceImpactPct ?? 0
  //       }
  //     }
  //   } catch (e) {
  //     console.warn('[DevnetDEX] Quote failed, continuing to Jupiter/CoinGecko fallback', e)
  //   }
  // }
// =======
//   if (config.useDevnetDex && config.solanaCluster === 'devnet') {
//     try {
//       const devnetQuote = await getQuoteDevnet(input.mint, output.mint, amount)
//       if (devnetQuote) {
//         console.log('[DevnetDEX] Using Devnet DEX for quote')
//         return {
//           inAmount: devnetQuote.inAmount,
//           outAmount: devnetQuote.outAmount,
//           priceImpactPct: devnetQuote.priceImpactPct ?? 0
//         }
//       }
//     } catch (e) {
//       console.warn('[DevnetDEX] Quote failed, continuing to Jupiter/CoinGecko fallback', e)
//     }
//   }
// >>>>>>> 3125221f94ee30dfa87785544945241e3f5fad73

  // Use mock mode if enabled
  if (MOCK_MODE) {
    console.log('[Jupiter] Using MOCK mode (MOCK_JUPITER=true)')
    return getMockQuote(inputSymbol, outputSymbol, amount)
  }

  // Try Jupiter first
  const amountInBaseUnits = Math.floor(amount * 10 ** input.decimals).toString()

  try {
    const res = await axios.get(QUOTE_API, {
      params: {
        inputMint: input.mint,
        outputMint: output.mint,
        amount: amountInBaseUnits,
        slippageBps: slippageBps,
        onlyDirectRoutes: false
      },
      timeout: API_TIMEOUT
    })

    const route = res.data?.data?.[0]
    if (!route) {
      throw new Error('No route found')
    }

    console.log('[Jupiter] ✅ Using Jupiter API for quote')
    return {
      inAmount: Number(route.inAmount) / 10 ** input.decimals,
      outAmount: Number(route.outAmount) / 10 ** output.decimals,
      priceImpactPct: Number(route.priceImpactPct || 0) * 100
    }
  } catch (jupiterErr) {
    console.warn('[Jupiter] Failed to fetch quote, trying CoinGecko fallback...')
    console.warn('[Jupiter Error]', jupiterErr instanceof Error ? jupiterErr.message : jupiterErr)

    // Fallback to CoinGecko
    try {
      console.log('[CoinGecko] Falling back to CoinGecko API...')
      const inputPrice = await getPriceFromCoinGecko(inputSymbol)
      const outputPrice = await getPriceFromCoinGecko(outputSymbol)
      const rate = inputPrice / outputPrice
      const outAmount = amount * rate * (1 - slippageBps / 10000)
      return {
        inAmount: amount,
        outAmount,
        priceImpactPct: 0
      }
    } catch (coingeckoErr) {
      console.error('[CoinGecko] Fallback also failed', coingeckoErr)
      throw new Error('Failed to fetch quote - try again later')
    }
  }
}

/**
 * Get swap route from Jupiter
 */
export async function getSwapRoute(intent: TradeIntent) {
  console.log('[getSwapRoute] MOCK_MODE:', MOCK_MODE, 'useDevnetDex:', config.useDevnetDex, 'cluster:', config.solanaCluster, 'intent:', { 
    inputMint: intent.inputMint, 
    outputMint: intent.outputMint 
  })

  // Use mock mode if enabled
  if (MOCK_MODE) {
    console.log('[Jupiter] ✅ MOCK MODE - Returning mock swap route')
    // Handle both BigInt and string formats for amountLamports
    const amount = typeof intent.amountLamports === 'bigint' 
      ? intent.amountLamports.toString() 
      : intent.amountLamports
    
    console.log('[Jupiter] Mock route amount:', amount)
    return {
      inAmount: amount,
      outAmount: amount, // Simplified mock
      priceImpactPct: 0.5
    }
  }

  // On devnet, we MUST use devnet DEX - Jupiter API doesn't work on devnet
  if (config.solanaCluster === 'devnet') {
    if (!config.useDevnetDex) {
      console.error('[getSwapRoute] ❌ CRITICAL: On devnet but USE_DEVNET_DEX is not enabled!')
      console.error('[getSwapRoute] Please set USE_DEVNET_DEX=true in your .env file')
      throw new Error('Devnet swaps require USE_DEVNET_DEX=true. Please add USE_DEVNET_DEX=true to your .env file and restart the bot.')
    }

    // If using devnet dex and cluster is devnet, attempt to ensure pool exists and return a synthetic route
    // (we already checked useDevnetDex above, so this will always be true here)
// <<<<<<< HEAD
    // try {
    //   console.log('[getSwapRoute] Attempting to resolve route via Devnet DEX')
    //   const pool = await ensurePoolExistsOrSetup(intent.inputMint, intent.outputMint)
    //   if (!pool) {
    //     console.error('[getSwapRoute] No pool found on Devnet')
    //     const poolFile = path.resolve('.devnet', 'pool.json')
    //     const adminFile = path.resolve('.devnet', 'admin.json')
    //     let errorMsg = 'No devnet pool found. '
    //     if (!fs.existsSync(poolFile) || !fs.existsSync(adminFile)) {
    //       errorMsg += 'Please run: `node scripts/devnet-setup.js` to create the devnet pool. '
    //     } else {
    //       errorMsg += 'Pool file exists but pool setup may be incomplete. Check .devnet/pool.json and ensure USE_DEVNET_DEX=true is set.'
    //     }
    //     throw new Error(errorMsg)
    //   }

    //   // Determine the expected output using constant-product approximation
    //   const inAmount = typeof intent.amountLamports === 'bigint' ? Number(intent.amountLamports) : Number(intent.amountLamports)
    //   // convert lamports to SOL if input is SOL mint
    //   const inputIsSol = intent.inputMint === TOKENS.SOL.mint
    //   const amountInSol = inputIsSol ? inAmount / 1_000_000_000 : inAmount

    //   const quote = await getQuoteDevnet(intent.inputMint, intent.outputMint, amountInSol)
    //   if (!quote) {
    //     console.error('[getSwapRoute] Failed to get devnet quote')
    //     throw new Error('Failed to get devnet quote. Pool may not have sufficient liquidity.')
    //   }

    //   console.log('[getSwapRoute] ✅ Successfully got devnet route')
    //   return {
    //     inAmount: quote.inAmount,
    //     outAmount: quote.outAmount,
    //     priceImpactPct: quote.priceImpactPct || 0,
    //     poolAddress: pool.poolAddress
    //   }
    // } catch (e) {
    //   console.error('[getSwapRoute] Devnet DEX route resolution failed:', e)
    //   // On devnet, don't fall through to Jupiter - throw a helpful error
    //   if (config.solanaCluster === 'devnet') {
    //     const errorMsg = e instanceof Error ? e.message : String(e)
        
    //     // Check if pool.json has MISSING values
    //     const poolFile = path.resolve('.devnet', 'pool.json')
    //     if (fs.existsSync(poolFile)) {
    //       try {
    //         const poolRaw = JSON.parse(fs.readFileSync(poolFile, 'utf8'))
    //         if (poolRaw.poolTokenAccount === 'MISSING' || poolRaw.tokenMint === 'MISSING') {
    //           throw new Error(
    //             `❌ Devnet pool setup incomplete!\n\n` +
    //             `Your .devnet/pool.json has MISSING values. This means devnet-setup.js failed because:\n` +
    //             `1. Admin key has no SOL (devnet faucet is rate-limited)\n` +
    //             `2. You need to fund the admin key manually\n\n` +
    //             `**Fix steps:**\n` +
    //             `1. Fund admin key: HdeRc2G4Lz8MwnZRfCg1p2zTbAsYq2Y2tZgmtRNaSo (get from .devnet/admin.json)\n` +
    //             `2. Visit https://faucet.solana.com and fund it with devnet SOL\n` +
    //             `3. Run: node scripts/devnet-setup.js --force\n` +
    //             `4. Then try swapping again\n\n` +
    //             `OR use a real devnet pool by setting DEVNET_USDC_MINT in .env`
    //           )
    //         }
    //       } catch (parseErr) {
    //         // If we can't parse, use original error
    //       }
    //     }
        
    //     throw new Error(
    //       `Devnet DEX failed: ${errorMsg}\n\n` +
    //       `**Possible issues:**\n` +
    //       `1. Pool not set up - Run: node scripts/devnet-setup.js\n` +
    //       `2. USE_DEVNET_DEX not set - Add USE_DEVNET_DEX=true to .env\n` +
    //       `3. Pool.json has MISSING values - Fund admin key and re-run setup\n` +
    //       `4. No devnet pools found - Check Raydium devnet API or create your own pool`
    //     )
    //   }
    // }
// =======
//     try {
//       console.log('[getSwapRoute] Attempting to resolve route via Devnet DEX')
//       const pool = await ensurePoolExistsOrSetup(intent.inputMint, intent.outputMint)
//       if (!pool) {
//         console.error('[getSwapRoute] No pool found on Devnet')
//         const poolFile = path.resolve('.devnet', 'pool.json')
//         const adminFile = path.resolve('.devnet', 'admin.json')
//         let errorMsg = 'No devnet pool found. '
//         if (!fs.existsSync(poolFile) || !fs.existsSync(adminFile)) {
//           errorMsg += 'Please run: `node scripts/devnet-setup.js` to create the devnet pool. '
//         } else {
//           errorMsg += 'Pool file exists but pool setup may be incomplete. Check .devnet/pool.json and ensure USE_DEVNET_DEX=true is set.'
//         }
//         throw new Error(errorMsg)
//       }

//       // Determine the expected output using constant-product approximation
//       const inAmount = typeof intent.amountLamports === 'bigint' ? Number(intent.amountLamports) : Number(intent.amountLamports)
//       // convert lamports to SOL if input is SOL mint
//       const inputIsSol = intent.inputMint === TOKENS.SOL.mint
//       const amountInSol = inputIsSol ? inAmount / 1_000_000_000 : inAmount

//       const quote = await getQuoteDevnet(intent.inputMint, intent.outputMint, amountInSol)
//       if (!quote) {
//         console.error('[getSwapRoute] Failed to get devnet quote')
//         throw new Error('Failed to get devnet quote. Pool may not have sufficient liquidity.')
//       }

//       console.log('[getSwapRoute] ✅ Successfully got devnet route')
//       return {
//         inAmount: quote.inAmount,
//         outAmount: quote.outAmount,
//         priceImpactPct: quote.priceImpactPct || 0,
//         poolAddress: pool.poolAddress
//       }
//     } catch (e) {
//       console.error('[getSwapRoute] Devnet DEX route resolution failed:', e)
//       // On devnet, don't fall through to Jupiter - throw a helpful error
//       if (config.solanaCluster === 'devnet') {
//         const errorMsg = e instanceof Error ? e.message : String(e)
        
//         // Check if pool.json has MISSING values
//         const poolFile = path.resolve('.devnet', 'pool.json')
//         if (fs.existsSync(poolFile)) {
//           try {
//             const poolRaw = JSON.parse(fs.readFileSync(poolFile, 'utf8'))
//             if (poolRaw.poolTokenAccount === 'MISSING' || poolRaw.tokenMint === 'MISSING') {
//               throw new Error(
//                 `❌ Devnet pool setup incomplete!\n\n` +
//                 `Your .devnet/pool.json has MISSING values. This means devnet-setup.js failed because:\n` +
//                 `1. Admin key has no SOL (devnet faucet is rate-limited)\n` +
//                 `2. You need to fund the admin key manually\n\n` +
//                 `**Fix steps:**\n` +
//                 `1. Fund admin key: HdeRc2G4Lz8MwnZRfCg1p2zTbAsYq2Y2tZgmtRNaSo (get from .devnet/admin.json)\n` +
//                 `2. Visit https://faucet.solana.com and fund it with devnet SOL\n` +
//                 `3. Run: node scripts/devnet-setup.js --force\n` +
//                 `4. Then try swapping again\n\n` +
//                 `OR use a real devnet pool by setting DEVNET_USDC_MINT in .env`
//               )
//             }
//           } catch (parseErr) {
//             // If we can't parse, use original error
//           }
//         }
        
//         throw new Error(
//           `Devnet DEX failed: ${errorMsg}\n\n` +
//           `**Possible issues:**\n` +
//           `1. Pool not set up - Run: node scripts/devnet-setup.js\n` +
//           `2. USE_DEVNET_DEX not set - Add USE_DEVNET_DEX=true to .env\n` +
//           `3. Pool.json has MISSING values - Fund admin key and re-run setup\n` +
//           `4. No devnet pools found - Check Raydium devnet API or create your own pool`
//         )
//       }
//     }
// >>>>>>> 3125221f94ee30dfa87785544945241e3f5fad73
//     // If we're on devnet, we should never reach here (should have returned or thrown above)
    throw new Error('Cannot use Jupiter API on devnet. Please enable USE_DEVNET_DEX=true and set up a devnet pool.')
  }

  try {
    console.log('[getSwapRoute] Using real Jupiter API (mainnet)')
    // Handle both BigInt and string formats for amountLamports
    const amount = typeof intent.amountLamports === 'bigint' 
      ? intent.amountLamports.toString() 
      : intent.amountLamports

    const res = await axios.get(QUOTE_API, {
      params: {
        inputMint: intent.inputMint,
        outputMint: intent.outputMint,
        amount: amount,
        slippageBps: intent.slippageBps || 50
      },
      timeout: API_TIMEOUT
    })

    const route = res.data?.data?.[0]
    if (!route) throw new Error('No swap route available')

    console.log('[Jupiter] ✅ Got swap route from Jupiter')
    return route
  } catch (err) {
    console.error('[Get Swap Route Error]', err)
    throw new Error('Failed to get swap route')
  }
}


/**
 * Build swap transaction from route
 */
export async function buildSwapTx(
  route: any,
  userPubkey: string
): Promise<VersionedTransaction> {
  // In mock mode, create a dummy transaction
  if (MOCK_MODE) {
    console.log('[Jupiter] Creating mock swap transaction')
    // Create a minimal valid transaction for testing
    // In real mode, this would be a proper swap instruction
    
    // For now, we'll just return a mock object that passes basic validation
    // The transaction won't actually execute on-chain without real instructions
    return {
      signatures: [],
      message: {
        header: {
          numRequiredSignatures: 0,
          numReadonlySignedAccounts: 0,
          numReadonlyUnsignedAccounts: 0
        },
        staticAccountKeys: [],
        recentBlockhash: '11111111111111111111111111111111',
        compiledInstructions: []
      },
      serialize: () => Buffer.alloc(0),
      addSignature: () => {}
    } as any // Cast to any since we're mocking
  }

  // If devnet dex configured and route looks like a devnet route, use devnet tx builder
// <<<<<<< HEAD
//   // if (config.useDevnetDex && config.solanaCluster === 'devnet' && route?.poolAddress) {
//   //   try {
//   //     console.log('[buildSwapTx] Building Devnet swap tx')
//   //     // route can be passed to the devnet builder if needed
//   //     const tx = await buildSwapTxDevnet(route, userPubkey)
//   //     // VersionedTransaction expected by callers; devnet builder returns Transaction for now
//   //     return tx as any
//   //   } catch (e) {
//   //     console.warn('[buildSwapTx] Devnet tx build failed, falling back to Jupiter', e)
//   //   }
//   // }
// =======
//   if (config.useDevnetDex && config.solanaCluster === 'devnet' && route?.poolAddress) {
//     try {
//       console.log('[buildSwapTx] Building Devnet swap tx')
//       // route can be passed to the devnet builder if needed
//       const tx = await buildSwapTxDevnet(route, userPubkey)
//       // VersionedTransaction expected by callers; devnet builder returns Transaction for now
//       return tx as any
//     } catch (e) {
//       console.warn('[buildSwapTx] Devnet tx build failed, falling back to Jupiter', e)
//     }
//   }
// >>>>>>> 3125221f94ee30dfa87785544945241e3f5fad73

  try {
    const res = await axios.post(
      SWAP_API,
      {
        route,
        userPublicKey: userPubkey,
        wrapAndUnwrapSol: true
      },
      { timeout: API_TIMEOUT }
    )

    if (!res.data.swapTransaction) {
      throw new Error('No transaction returned from API')
    }

    const txBuf = Buffer.from(res.data.swapTransaction, 'base64')
    return VersionedTransaction.deserialize(txBuf)
  } catch (err) {
    console.error('[Build Swap Tx Error]', err)
    throw new Error('Failed to build swap transaction')
  }
}

// // Backwards-compatible export: `getQuote` used by handlers
// <<<<<<< HEAD
// export const getQuote = getQuoteFromCoinGecko;
// =======
// export const getQuote = getQuoteFromCoinGecko;
// >>>>>>> 3125221f94ee30dfa87785544945241e3f5fad73
