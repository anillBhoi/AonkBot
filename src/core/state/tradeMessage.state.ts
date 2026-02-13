const tradeMessages = new Map<number, number>()

export function setTradeMessage(userId: number, messageId: number) {
  tradeMessages.set(userId, messageId)
}

export function getTradeMessage(userId: number): number | undefined {
  return tradeMessages.get(userId)
}

export function clearTradeMessage(userId: number) {
  tradeMessages.delete(userId)
}
