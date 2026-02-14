const buyXState = new Map<number, string>() 
// userId -> tokenMint

export function setBuyXState(userId: number, mint: string) {
  buyXState.set(userId, mint)
}

export function getBuyXState(userId: number) {
  return buyXState.get(userId)
}

export function clearBuyXState(userId: number) {
  buyXState.delete(userId)
}
