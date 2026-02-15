/**
 * Devnet DEX stub. Used when USE_DEVNET_DEX=true and Jupiter needs fallback.
 * Implement full devnet AMM/pool logic here for local devnet testing.
 */

export interface DevnetQuote {
  inAmount: number
  outAmount: number
  priceImpactPct?: number
}

export async function getQuoteDevnet(
  _inputMint: string,
  _outputMint: string,
  _amountInSol: number
): Promise<DevnetQuote | null> {
  return null
}

export async function ensurePoolExistsOrSetup(
  _inputMint: string,
  _outputMint: string
): Promise<{ poolAddress: string } | null> {
  return null
}

export async function buildSwapTxDevnet(
  _route: unknown,
  _userPubkey: string
): Promise<import('@solana/web3.js').Transaction> {
  throw new Error('Devnet DEX not implemented; use mainnet or run devnet-setup.')
}
