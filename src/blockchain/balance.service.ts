import { PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { solana } from './solana.client.js'
import { redis } from '../config/redis.js'
import { TOKENS } from '../utils/tokens.js'
import { config } from '../utils/config.js'

const BALANCE_CACHE_TTL = 10 // seconds

/**
 * Get SOL balance with caching
 */
export async function getSolBalance(
  publicKey: string
): Promise<number> {
  try {
    // Check cache first
    const cached = await redis.get(`balance:sol:${publicKey}`)
    if (cached) {
      return Number(cached)
    }

    const pubKey = new PublicKey(publicKey)
    const lamports = await solana.getBalance(pubKey, 'confirmed')
    const solBalance = lamports / 1_000_000_000

    // Cache for 10 seconds
    await redis.set(
      `balance:sol:${publicKey}`,
      solBalance.toString(),
      'EX',
      BALANCE_CACHE_TTL
    )

    return solBalance
  } catch (err) {
    console.error('[Balance Error]', err)
    throw new Error('Failed to fetch SOL balance')
  }
}

/**
 * Get SOL balance from both mainnet and devnet
 */
export async function getSolBalanceMultiNetwork(
  publicKey: string
): Promise<{ mainnet: number; devnet: number }> {
  try {
    const pubKey = new PublicKey(publicKey)

    // Get mainnet balance
    let mainnetBalance = 0
    try {
      const mainnetConnection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed')
      const lamports = await mainnetConnection.getBalance(pubKey, 'confirmed')
      mainnetBalance = lamports / LAMPORTS_PER_SOL
    } catch (err) {
      console.log('[Mainnet Balance Error]', err)
    }

    // Get devnet balance
    let devnetBalance = 0
    try {
      const devnetConnection = new Connection('https://api.devnet.solana.com', 'confirmed')
      const lamports = await devnetConnection.getBalance(pubKey, 'confirmed')
      devnetBalance = lamports / LAMPORTS_PER_SOL
    } catch (err) {
      console.log('[Devnet Balance Error]', err)
    }

    return { mainnet: mainnetBalance, devnet: devnetBalance }
  } catch (err) {
    console.error('[Multi-Network Balance Error]', err)
    return { mainnet: 0, devnet: 0 }
  }
}

/**
 * Get token balance with caching
 */
export async function getTokenBalance(
  publicKey: string,
  tokenMint: string
): Promise<number> {
  try {
    // Check cache first
    const cached = await redis.get(`balance:token:${publicKey}:${tokenMint}`)
    if (cached) {
      return Number(cached)
    }

    const pubKey = new PublicKey(publicKey)
    const mint = new PublicKey(tokenMint)

    // Get token accounts
    const accounts = await solana.getTokenAccountsByOwner(pubKey, {
      mint: mint
    })

    if (accounts.value.length === 0) {
      // Cache zero balance
      await redis.set(
        `balance:token:${publicKey}:${tokenMint}`,
        '0',
        'EX',
        BALANCE_CACHE_TTL
      )
      return 0
    }

    // Get token amount
    const accountInfo = accounts.value[0].account.data
    const balance = await solana.getTokenAccountBalance(
      accounts.value[0].pubkey
    )

    const tokenBalance = Number(balance.value.amount) / 10 ** (balance.value.decimals || 0)

    // Cache balance
    await redis.set(
      `balance:token:${publicKey}:${tokenMint}`,
      tokenBalance.toString(),
      'EX',
      BALANCE_CACHE_TTL
    )

    return tokenBalance
  } catch (err) {
    console.error('[Token Balance Error]', err)
    throw new Error(`Failed to fetch token balance for ${tokenMint}`)
  }
}

/**
 * Get token balance and decimals (for sell flow).
 * Returns decimals from token account; defaults to 6 if no account.
 */
export async function getTokenBalanceAndDecimals(
  publicKey: string,
  tokenMint: string
): Promise<{ balance: number; decimals: number }> {
  try {
    const pubKey = new PublicKey(publicKey)
    const mint = new PublicKey(tokenMint)
    const accounts = await solana.getTokenAccountsByOwner(pubKey, { mint })
    if (accounts.value.length === 0) {
      return { balance: 0, decimals: 6 }
    }
    const balance = await solana.getTokenAccountBalance(accounts.value[0].pubkey)
    const decimals = balance.value.decimals ?? 6
    const amount = Number(balance.value.amount) / 10 ** decimals
    return { balance: amount, decimals }
  } catch (err) {
    console.error('[Token BalanceAndDecimals Error]', err)
    return { balance: 0, decimals: 6 }
  }
}

/**
 * Get all token balances for a wallet
 */
export async function getTokenBalances(publicKey: string): Promise<
  Array<{ symbol: string; balance: number; mint: string }>
> {
  try {
    const pubKey = new PublicKey(publicKey)

    // Get all token accounts
    const accounts = await solana.getTokenAccountsByOwner(pubKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJsyFbPVwwQQf64JsrwQQf')
    })

    const balances = []

    for (const account of accounts.value) {
      const balance = await solana.getTokenAccountBalance(account.pubkey)
      
      // Get mint from token account data (parsed)
      const accountData = account.account.data as any
      let mint = ''
      
      // Try to parse token account data to get mint
      try {
        if (accountData?.parsed?.info?.mint) {
          mint = accountData.parsed.info.mint
        } else {
          // Fallback: use pubkey as identifier if we can't parse
          continue
        }
      } catch {
        continue
      }

      // Find token symbol by checking known mints
      let symbol = 'UNKNOWN'

      for (const [tokenSymbol, tokenInfo] of Object.entries(TOKENS)) {
        if (tokenInfo.mint === mint) {
          symbol = tokenSymbol
          break
        }
      }

      balances.push({
        symbol,
        balance: Number(balance.value.amount) / 10 ** (balance.value.decimals || 0),
        mint
      })
    }

    return balances.filter(b => b.balance > 0)
  } catch (err) {
    console.error('[Token Balances Error]', err)
    throw new Error('Failed to fetch token balances')
  }
}

/**
 * Check if wallet has sufficient balance
 */
export async function ensureSolBalance(
  pubkey: string,
  amount: number,
  feeBuffer = 0.01 // SOL
): Promise<boolean> {
  try {
    const balance = await getSolBalance(pubkey)
    return balance >= amount + feeBuffer
  } catch (err) {
    console.error('[Ensure Balance Error]', err)
    return false
  }
}

/**
 * Invalidate balance cache for a wallet
 * Call this after transactions to force refresh
 */
export async function invalidateBalanceCache(publicKey: string, tokenMint?: string): Promise<void> {
  try {
    // Always invalidate SOL balance
    await redis.del(`balance:sol:${publicKey}`)
    
    // If token mint provided, invalidate that token balance
    if (tokenMint) {
      await redis.del(`balance:token:${publicKey}:${tokenMint}`)
    } else {
      // Invalidate all token balances (delete all matching keys)
      const keys = await redis.keys(`balance:token:${publicKey}:*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    }
    
    console.log(`[Balance Cache] Invalidated cache for ${publicKey}${tokenMint ? ` (token: ${tokenMint})` : ''}`)
  } catch (err) {
    console.error('[Invalidate Balance Cache Error]', err)
    // Don't throw - cache invalidation failure shouldn't break the flow
  }
}