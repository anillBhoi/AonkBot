export const redisKeys = {
  session: (id: number) => `session:${id}`,

  /* ===== Multi Wallet Keys ===== */

  walletList: (id: number) => `wallets:${id}`,
  wallet: (id: number, walletId: string) => `wallet:${id}:${walletId}`,
  selectedWallet: (id: number) => `wallet:selected:${id}`,

  /* ===== Legacy (Backward compatibility) ===== */

  legacyWallet: (id: number) => `wallet:${id}`,

  /* ===== Locks ===== */

  lock: (id: number, cmd: string) => `lock:${id}:${cmd}`,

  /* ===== TOTP / Auth ===== */

  totpSecret: (id: number) => `totp:secret:${id}`,
  totpAttempts: (id: number) => `totp:attempts:${id}`,
  totpLock: (id: number) => `totp:lock:${id}`,
  totpBackupCodes: (id: number) => `totp:backup:${id}`,

  /* ===== Simple Export Flow (exportSeedPhrase.handler) ===== */

  exportAwaitTotp: (id: number) => `export:await_totp:${id}`,

  /* ===== Secure 3-Layer Export Flow (exportSeedPhraseSecure.handler) ===== */

  exportStage: (id: number) => `export:stage:${id}`,
  exportSqAttempts: (id: number) => `export:sq_attempts:${id}`,
  exportSqLock: (id: number) => `export:sq_lock:${id}`,
  exportPwAttempts: (id: number) => `export:pw_attempts:${id}`,
  exportPwLock: (id: number) => `export:pw_lock:${id}`,
  exportTotpAttempts: (id: number) => `export:totp_attempts:${id}`,
  exportTotpLock: (id: number) => `export:totp_lock:${id}`,
  exportChoosingQuestion: (id: number) => `export:choosing_sq:${id}`,

  /* ===== Security Question ===== */

  securityQuestion: (id: number) => `security_question:${id}`,
  exportPassword: (id: number) => `export_password:${id}`,

  /* ===== Onboarding / 2FA Setup ===== */

  onboardingComplete: (id: number) => `user:onboarding:complete:${id}`,
  welcomeShown: (id: number) => `user:welcome:shown:${id}`,
  settingUp2FA: (id: number) => `user:setting_up_2fa:${id}`,
  verifying2FA: (id: number) => `user:verifying_2fa:${id}`,
  verify2FAAttempts: (id: number) => `user:2fa_verify_attempts:${id}`,

  /* ===== /totpsetup regen (requires current code to authorise) ===== */

  // Set when user runs /totpsetup and already has a secret.
  // They must supply the current 6-digit code before a new QR is issued.
  totpRegenAwait: (id: number) => `totp:regen:await:${id}`,
  totpRegenAttempts: (id: number) => `totp:regen:attempts:${id}`,
}