export async function fetchTokenInfo(token: string) {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${token}`
  );

  const data = await res.json();
  const pair = data.pairs?.[0];
  if (!pair) return null;

  return {
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    price: pair.priceUsd,
    mcap: pair.marketCap,

    priceChange5m: pair.priceChange?.m5 ?? null,
    priceChange1h: pair.priceChange?.h1 ?? null,
    priceChange6h: pair.priceChange?.h6 ?? null,
    priceChange24h: pair.priceChange?.h24 ?? null,

    raw: pair
  };
}


export async function getTokenData(token: string) {
  const info = await fetchTokenInfo(token);
  return info?.raw ?? null;
}
