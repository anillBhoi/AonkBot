import axios from "axios";

export async function getTokenData(mint: string) {

  const res = await axios.get(
    `https://api.dexscreener.com/latest/dex/tokens/${mint}`
  );

  return res.data?.pairs?.[0] ?? null;
}
