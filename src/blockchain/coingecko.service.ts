import axios from 'axios'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const API_TIMEOUT = 10000

/**
 * Get token price from CoinGecko (fallback API)
 * Works better in restricted networks
 */
export async function getPriceFromCoinGecko(
  tokenSymbol: string,
  vsCurrency = 'usd'
): Promise<number> {
  try {
    // Map token symbols to CoinGecko IDs
    const tokenMap: Record<string, string> = {
      'SOL': 'solana',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'BONK': 'bonk',
      'JUP': 'jupiter',
      'COPE': 'cope',
      'BTC': 'bitcoin',
      'ETH': 'ethereum'
    }

    const tokenId = tokenMap[tokenSymbol.toUpperCase()]
    if (!tokenId) {
      throw new Error(`Unknown token: ${tokenSymbol}`)
    }

    const res = await axios.get(
      `${COINGECKO_API}/simple/price`,
      {
        params: {
          ids: tokenId,
          vs_currencies: vsCurrency,
          include_market_cap: false,
          include_24hr_vol: false,
          include_24hr_change: false
        },
        timeout: API_TIMEOUT
      }
    )

    const price = res.data[tokenId]?.[vsCurrency]
    if (!price) {
      throw new Error(`No price data for ${tokenSymbol}`)
    }

    console.log(`[CoinGecko] ${tokenSymbol} = $${price}`)
    return price
  } catch (err) {
    console.error('[CoinGecko Error]', err instanceof Error ? err.message : err)
    throw new Error(`Failed to fetch ${tokenSymbol} price from CoinGecko`)
  }
}

/**
 * Get multiple token prices at once
 */
export async function getPricesFromCoinGecko(
  tokenIds: string[],
  vsCurrency = 'usd'
): Promise<Record<string, number>> {
  try {
    const res = await axios.get(
      `${COINGECKO_API}/simple/price`,
      {
        params: {
          ids: tokenIds.join(','),
          vs_currencies: vsCurrency
        },
        timeout: API_TIMEOUT
      }
    )

    const prices: Record<string, number> = {}
    for (const [id, data] of Object.entries(res.data)) {
      prices[id] = (data as any)[vsCurrency]
    }

    return prices
  } catch (err) {
    console.error('[CoinGecko Batch Error]', err instanceof Error ? err.message : err)
    throw new Error('Failed to fetch prices from CoinGecko')
  }
}
