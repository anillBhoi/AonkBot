const sellXState = new Map<number, string>()
// userId -> tokenMint (awaiting amount or portion)

export function setSellXState(userId: number, mint: string) {
  sellXState.set(userId, mint)
}

export function getSellXState(userId: number): string | undefined {
  return sellXState.get(userId)
}

export function clearSellXState(userId: number) {
  sellXState.delete(userId)
}
