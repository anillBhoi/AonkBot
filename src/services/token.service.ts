export async function fetchTokenInfo(token: string) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`)
  const data = await res.json()

  const pairs = data.pairs ?? []
  if (!pairs.length) return null

  // Prefer SOL pairs with the highest liquidity
  const best = pairs
    .filter((p: any) => p?.chainId === "solana")
    .sort((a: any, b: any) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0))[0]

  if (!best) return null

  return {
    name: best.baseToken?.name,
    symbol: best.baseToken?.symbol,
    price: best.priceUsd,
    mcap: best.marketCap ?? best.fdv ?? null,
    liquidityUsd: best.liquidity?.usd ?? null,
    priceChange5m: best.priceChange?.m5 ?? null,
    priceChange1h: best.priceChange?.h1 ?? null,
    priceChange6h: best.priceChange?.h6 ?? null,
    priceChange24h: best.priceChange?.h24 ?? null,
    url: best.url,
    dexId: best.dexId,
    pairAddress: best.pairAddress,
    raw: best
  }
}



export async function getTokenData(token: string) {
  const info = await fetchTokenInfo(token);
  return info?.raw ?? null;
}
