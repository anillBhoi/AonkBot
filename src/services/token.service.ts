// services/token.service.ts
const DEX_URL = "https://api.dexscreener.com/latest/dex/tokens";
const JUP_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUP_PRICE_URL = "https://price.jup.ag/v4/price";

// WSOL mint (Solana)
const WSOL_MINT = "So11111111111111111111111111111111111111112";

type DexPair = any;

function pickBestPair(pairs: DexPair[]) {
  // Prefer SOL/WSOL/USDC-quoted pools with highest liquidity
  const preferred = pairs
    .filter((p) => p?.chainId === "solana")
    .filter((p) => ["SOL", "WSOL", "USDC"].includes(p?.quoteToken?.symbol))
    .sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));

  if (preferred.length) return preferred[0];

  // fallback: any solana pair with highest liquidity
  return pairs
    .filter((p) => p?.chainId === "solana")
    .sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0))[0];
}

async function fetchDexScreener(tokenMint: string) {
  const res = await fetch(`${DEX_URL}/${tokenMint}`);
  if (!res.ok) return null;
  const data = await res.json();
  const pairs: DexPair[] = data?.pairs ?? [];
  if (!pairs.length) return null;

  const best = pickBestPair(pairs);
  if (!best) return null;

  return {
    name: best.baseToken?.name ?? "Unknown",
    symbol: best.baseToken?.symbol ?? "UNK",
    mcap: best.marketCap ?? best.fdv ?? null,
    liquidityUsd: best.liquidity?.usd ?? null,
    priceChange5m: best.priceChange?.m5 ?? null,
    priceChange1h: best.priceChange?.h1 ?? null,
    priceChange6h: best.priceChange?.h6 ?? null,
    priceChange24h: best.priceChange?.h24 ?? null,
    dexId: best.dexId,
    pairAddress: best.pairAddress, // IMPORTANT for correct DexScreener chart link
    url: best.url,
    raw: best,
  };
}

// async function fetchSolUsd(): Promise<number | null> {
//   const res = await fetch(`${JUP_PRICE_URL}?ids=SOL`);
//   if (!res.ok) return null;
//   const data = await res.json();
//   const sol = data?.data?.SOL?.price;
//   return typeof sol === "number" ? sol : null;
// }

async function fetchSolUsd(): Promise<number | null> {
  const data = await safeFetchJson(`${JUP_PRICE_URL}?ids=SOL`);
  const sol = data?.data?.SOL?.price;
  return typeof sol === "number" ? sol : null;
}

async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps = 50
) {
  const url =
    `${JUP_QUOTE_URL}?` +
    `inputMint=${inputMint}&outputMint=${outputMint}` +
    `&amount=${amountLamports}&slippageBps=${slippageBps}` +
    `&onlyDirectRoutes=false`;

  const data = await safeFetchJson(url, 8000);
  return data?.data?.[0] ?? null;
}


function lamports(sol: number) {
  // 1 SOL = 1_000_000_000 lamports
  return Math.floor(sol * 1_000_000_000);
}

/**
 * BonkBot-style pricing:
 * - executable token USD price derived from Jupiter quote WSOL->token
 * - price impact from Jupiter for 5 SOL
 */
async function fetchExecutablePrice(tokenMint: string) {
  if (process.env.SOLANA_CLUSTER !== "mainnet-beta") {
  console.warn("[JUPITER] Skipped (not mainnet)");
  return null;
}
  const solUsd = await fetchSolUsd();
  if (!solUsd) return null;

  // Use 1 SOL quote to compute "spot" executable price
  const q1 = await fetchJupiterQuote(WSOL_MINT, tokenMint, lamports(1), 50);
  if (!q1) return null;

  const outAmount = Number(q1.outAmount);
  const outDecimals = Number(q1.outputMintDecimals);

  if (!Number.isFinite(outAmount) || !Number.isFinite(outDecimals) || outAmount <= 0) return null;

  const tokensOut = outAmount / Math.pow(10, outDecimals);
  if (tokensOut <= 0) return null;

  const priceUsd = solUsd / tokensOut;

  // 5 SOL quote for price impact (this mirrors what users see in BonkBot)
  const q5 = await fetchJupiterQuote(WSOL_MINT, tokenMint, lamports(5), 50);
  const priceImpactPct = q5?.priceImpactPct ?? null;

  return {
    priceUsd,
    solUsd,
    priceImpactPct: typeof priceImpactPct === "number" ? priceImpactPct : null,
  };
}

export async function fetchTokenInfo(tokenMint: string) {
  // Pull metadata from DexScreener
  const dex = await fetchDexScreener(tokenMint);

  // Pull executable price from Jupiter (BonkBot-style)
  const execPrice = await fetchExecutablePrice(tokenMint);

  // If DexScreener has nothing AND Jupiter also fails -> token not found / not tradable
  if (!dex && !execPrice) return null;

  return {
    // metadata (prefer DexScreener, fall back to unknown)
    name: dex?.name ?? "Unknown",
    symbol: dex?.symbol ?? "UNK",

    // BONK-style executable price
    price: execPrice?.priceUsd ?? (dex?.raw?.priceUsd ? Number(dex.raw.priceUsd) : null),

    // market info from DexScreener
    mcap: dex?.mcap ?? null,
    liquidityUsd: dex?.liquidityUsd ?? null,
    priceChange5m: dex?.priceChange5m ?? null,
    priceChange1h: dex?.priceChange1h ?? null,
    priceChange6h: dex?.priceChange6h ?? null,
    priceChange24h: dex?.priceChange24h ?? null,

    // Bonk-style impact
    priceImpact5SolPct: execPrice?.priceImpactPct ?? null,

    // chart correctness
    dexId: dex?.dexId ?? null,
    pairAddress: dex?.pairAddress ?? null,
    url: dex?.url ?? null,

    raw: dex?.raw ?? null,
  };
}

// ---------- SAFE FETCH (Jupiter fallback protection) ----------
async function safeFetchJson(url: string, timeoutMs = 6000) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, { signal: controller.signal as any });
    clearTimeout(id);

    if (!res.ok) return null;

    try {
      return await res.json();
    } catch {
      return null;
    }
  } catch (err) {
    console.warn("[JUPITER FALLBACK] Failed:", url);
    return null;
  }
}


export async function getTokenData(tokenMint: string) {
  const info = await fetchTokenInfo(tokenMint);
  return info?.raw ?? null;
}
