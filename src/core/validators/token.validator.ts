import { PublicKey } from '@solana/web3.js'
import { TOKENS } from '../../utils/tokens.js'

export function validateToken(symbol: string) {
  const tokenInfo = TOKENS[symbol.toUpperCase()]
  if (!tokenInfo) {
    throw new Error(`Unsupported token: ${symbol}. Available: ${Object.keys(TOKENS).join(', ')}`)
  }
  return tokenInfo
}

export function validateTokenMint(mint: string): void {
  try {
    new PublicKey(mint)
  } catch {
    throw new Error('Invalid token mint')
  }
}
