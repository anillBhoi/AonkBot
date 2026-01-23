import 'dotenv/config'

function must(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing env: ${key}`)
  return value
}

export const config = {
  botToken: must('BOT_TOKEN'),
  redisUrl: must('REDIS_URL'),
  solanaRpc: must('SOLANA_RPC_URL'),
  solanaCluster: process.env.SOLANA_CLUSTER || 'devnet',
  encryptionSecret: must('ENCRYPTION_SECRET'),
  useDevnetDex: process.env.USE_DEVNET_DEX === 'true',
  devnetAutoSetup: process.env.DEVNET_AUTO_SETUP === 'true',
  devnetUsdcMint: process.env.DEVNET_USDC_MINT || ''
}
