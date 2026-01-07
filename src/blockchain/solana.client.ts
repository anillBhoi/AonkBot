import { Connection, clusterApiUrl } from '@solana/web3.js'
import { config } from '../utils/config.js'

export const solana = new Connection(
  config.solanaRpc || clusterApiUrl('mainnet-beta'),
  {
    commitment: 'confirmed',
    disableRetryOnRateLimit: false
  }
)
