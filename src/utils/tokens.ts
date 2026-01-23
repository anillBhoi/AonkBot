export interface TokenInfo {
  symbol: string
  mint: string
  decimals: number
}

export const TOKENS: Record<string, TokenInfo> = {
  SOL: {
    symbol: 'SOL',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9
  },
  USDC: {
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6
  },
  USDT: {
    symbol: 'USDT',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEsl',
    decimals: 6
  },
  BONK: {
    symbol: 'BONK',
    mint: 'DezXAZ8z7PnrnRJjgjG316tqvISL6smv2PnGatV5d1K',
    decimals: 5
  },
  JUP: {
    symbol: 'JUP',
    mint: 'JUPyiwrYJFskUPiHa7hKeZrC6cJwuqDJVhAaKso5Qe',
    decimals: 6
  },
  COPE: {
    symbol: 'COPE',
    mint: '8HGyAAB1yoM1ttS7pNoLeFYP9P7qsdVsEdE1XJDkzJ8d',
    decimals: 0
  }
}

