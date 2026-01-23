import { config } from '../utils/config.js'

export enum SolanaCluster {
  MAINNET = 'mainnet-beta',
  DEVNET = 'devnet',
  TESTNET = 'testnet'
}

const SOLSCAN_BASE = 'https://explorer.solana.com'

/**
 * Get the current cluster from config
 */
function getCluster(): SolanaCluster {
  return (config.solanaCluster as SolanaCluster) || SolanaCluster.MAINNET
}

/**
 * Get transaction explorer link
 */
export function getTxLink(signature: string, cluster?: SolanaCluster): string {
  const finalCluster = cluster || getCluster()
  return `${SOLSCAN_BASE}/tx/${signature}?cluster=${finalCluster}`
}

/**
 * Get account/wallet explorer link
 */
export function getAccountLink(address: string, cluster?: SolanaCluster): string {
  const finalCluster = cluster || getCluster()
  return `${SOLSCAN_BASE}/account/${address}?cluster=${finalCluster}`
}

/**
 * Get token explorer link
 */
export function getTokenLink(mint: string, cluster?: SolanaCluster): string {
  const finalCluster = cluster || getCluster()
  return `${SOLSCAN_BASE}/token/${mint}?cluster=${finalCluster}`
}

/**
 * Legacy function for backward compatibility
 */
export function explorerTxUrl(signature: string): string {
  return getTxLink(signature)
}

/**
 * Get short signature for display (first 8 + last 8)
 */
export function shortSig(signature: string): string {
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`
}

/**
 * Get short address for display
 */
export function shortAddr(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

/**
 * Format transaction markdown link
 */
export function formatTxLink(
  signature: string,
  displayText?: string,
  cluster?: SolanaCluster
): string {
  const text = displayText || shortSig(signature)
  return `[${text}](${getTxLink(signature, cluster)})`
}

/**
 * Format account markdown link
 */
export function formatAccountLink(
  address: string,
  displayText?: string,
  cluster?: SolanaCluster
): string {
  const text = displayText || shortAddr(address)
  return `[${text}](${getAccountLink(address, cluster)})`
}
