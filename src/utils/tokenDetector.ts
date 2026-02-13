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
