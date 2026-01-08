export function validateSolAmount(amount: number): void {
  if (isNaN(amount)) throw new Error('Amount is not a number')
  if (amount <= 0) throw new Error('Amount must be positive')
  if (amount > 10) throw new Error('Amount exceeds safety limit')
}
