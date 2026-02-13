export function buildMoonpayUrl(walletAddress: string): string {
  const params = new URLSearchParams({
    apiKey: process.env.MOONPAY_PUBLIC_KEY || "",
    walletAddress,
    currencyCode: "sol",
    showWalletAddressForm: "true",
  });

  return `https://buy.moonpay.com/?${params.toString()}`;
}
