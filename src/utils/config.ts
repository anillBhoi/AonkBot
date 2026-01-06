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
  encryptionSecret: must('ENCRYPTION_SECRET')
}
