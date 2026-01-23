import { Connection, clusterApiUrl } from '@solana/web3.js'
import { config } from '../utils/config.js'

/**
 * RPC endpoints with fallback strategy
 * Primary: User-configured RPC or Solana cluster URL
 * Fallback: Official Solana RPC endpoints for the selected cluster
 */
const cluster = (config.solanaCluster as any) || 'devnet'

const RPC_ENDPOINTS = [
  config.solanaRpc || clusterApiUrl(cluster),
  clusterApiUrl(cluster), // Official Solana endpoint for the cluster
  cluster === 'mainnet-beta' 
    ? 'https://solana-rpc.publicnode.com' 
    : 'https://api.devnet.solana.com', // PublicNode/Devnet free endpoint
]

let currentRpcIndex = 0
let rpcHealthScores: Map<string, number> = new Map()

/**
 * Get connection with automatic fallback
 */
function getConnection(): Connection {
  const rpc = RPC_ENDPOINTS[currentRpcIndex]

  return new Connection(rpc, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: false,
    wsEndpoint: rpc.replace('https', 'wss')
  })
}

export let solana = getConnection()

/**
 * Health check and fallback mechanism
 */
export async function initRpcHealth() {
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const conn = new Connection(rpc, { commitment: 'confirmed' })
      const start = Date.now()
      await conn.getLatestBlockhash()
      const latency = Date.now() - start

      rpcHealthScores.set(rpc, latency)
      console.log(`[RPC Health] ${rpc.substring(0, 40)}... - ${latency}ms`)
    } catch (err) {
      rpcHealthScores.set(rpc, Infinity)
      console.log(`[RPC Health] ${rpc.substring(0, 40)}... - FAILED`)
    }
  }

  // Switch to healthiest RPC
  switchToHealthiestRpc()
}

/**
 * Switch to the healthiest (lowest latency) RPC
 */
function switchToHealthiestRpc() {
  let bestRpc = RPC_ENDPOINTS[0]
  let bestScore = Infinity

  for (const rpc of RPC_ENDPOINTS) {
    const score = rpcHealthScores.get(rpc) ?? Infinity
    if (score < bestScore) {
      bestScore = score
      bestRpc = rpc
    }
  }

  const newIndex = RPC_ENDPOINTS.indexOf(bestRpc)
  if (newIndex !== currentRpcIndex) {
    console.log(`[RPC Switch] Switching to ${bestRpc.substring(0, 40)}...`)
    currentRpcIndex = newIndex
    solana = getConnection()
  }
}

/**
 * Periodic health check (every 5 minutes)
 */
export function startRpcHealthCheck() {
  setInterval(async () => {
    await initRpcHealth()
  }, 5 * 60 * 1000)
}
