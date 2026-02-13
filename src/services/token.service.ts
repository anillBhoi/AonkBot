export async function fetchTokenInfo(token: string) {

  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${token}`
  )

  const data = await res.json()

  const pair = data.pairs?.[0]
  if (!pair) return null

  return {
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    price: pair.priceUsd,
    mcap: pair.marketCap,
    raw: pair
  }
}

export async function getTokenData(token: string) {
  const info = await fetchTokenInfo(token)
  return info?.raw ?? null
}
