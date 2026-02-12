export const redisKeys = {
  session: (id: number) => `session:${id}`,

  /* ===== Multi Wallet Keys ===== */

  walletList: (id: number) => `wallets:${id}`,              // stores ["W1","W2"]
  wallet: (id: number, walletId: string) => `wallet:${id}:${walletId}`,
  selectedWallet: (id: number) => `wallet:selected:${id}`,

  /* ===== Legacy (Backward compatibility) ===== */

  legacyWallet: (id: number) => `wallet:${id}`,

  /* ===== Locks ===== */

  lock: (id: number, cmd: string) => `lock:${id}:${cmd}`
}
