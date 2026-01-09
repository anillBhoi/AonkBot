import { config } from '../utils/config.js'

export function explorerTxUrl(signature: string): string {
  if (config.solanaCluster === 'mainnet-beta') {
    return `https://explorer.solana.com/tx/${signature}`
  }

  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`
}
