export function extractSolanaMint(text: string): string | null {

  // Match mint address
  const mintRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

  const match = text.match(mintRegex);
  if (match) return match[0];

  // Pump.fun URL support
  if (text.includes("pump.fun")) {
    const parts = text.split("/");
    return parts[parts.length - 1];
  }

  return null;
}

export function formatSmallPrice(price: number): string {
  if (price >= 0.001) return price.toFixed(6)

  const str = price.toFixed(12)
  const match = str.match(/^0\.0+(?=\d)/)

  if (!match) return price.toString()

  const zeros = match[0].length - 2
  const remaining = str.slice(match[0].length)

  return `0.0₍${zeros}₎${remaining.slice(0, 3)}`
}
