import fs from 'fs'
import path from 'path'
import { config } from './config.js'

const POOL_FILE = path.resolve('.devnet', 'pool.json')

/**
 * Get the devnet USDC mint address from pool.json
 * Falls back to mainnet USDC if pool.json doesn't exist or has MISSING values
 */
export function getDevnetUsdcMint(): string | null {
  // Only on devnet
  if (config.solanaCluster !== 'devnet') {
    return null
  }

  try {
    if (!fs.existsSync(POOL_FILE)) {
      return null
    }

    const raw = fs.readFileSync(POOL_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    
    // Try new format first (tokenMint)
    if (parsed.tokenMint && parsed.tokenMint !== 'MISSING') {
      return parsed.tokenMint
    }
    
    // Try old format (tokenA/tokenB - use the non-SOL one)
    const SOL_NATIVE = 'So11111111111111111111111111111111111111112'
    if (parsed.tokenA && parsed.tokenA !== SOL_NATIVE && parsed.tokenA !== 'MISSING') {
      return parsed.tokenA
    }
    if (parsed.tokenB && parsed.tokenB !== SOL_NATIVE && parsed.tokenB !== 'MISSING') {
      return parsed.tokenB
    }
    
    return null
  } catch (e) {
    console.warn('[getDevnetUsdcMint] Failed to read pool.json', e)
    return null
  }
}
