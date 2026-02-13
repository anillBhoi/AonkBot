import { Context, InlineKeyboard, InputFile } from 'grammy'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import { generateAndSaveSecret, getSecret, verifyToken } from '../auth/totp.service.js'
import QRCode from 'qrcode'

/* ─────────────────────────────────────────────
   STEP 1: Check if onboarding is needed
   (called from /start)
───────────────────────────────────────────── */

export const checkAndInitiateOnboarding = async (ctx: Context): Promise<boolean> => {
  const userId = ctx.from?.id
  if (!userId) return false

  try {
    const totpSecret = await getSecret(userId)
    const onboardingComplete = await redis.get(redisKeys.onboardingComplete(userId))

    if (!totpSecret || !onboardingComplete) {
      await showOnboardingWelcome(ctx, userId)
      return true // Onboarding needed
    }

    return false // Already done
  } catch (err) {
    console.error('Error checking onboarding status:', err)
    return false
  }
}

/* ─────────────────────────────────────────────
   STEP 2: Welcome screen
───────────────────────────────────────────── */

export const showOnboardingWelcome = async (ctx: Context, userId: number): Promise<void> => {
  const keyboard = new InlineKeyboard()
    .text('📚 Security Guide', 'onboarding:guide')
    .text('🔐 Setup 2FA Now', 'onboarding:setup_2fa')
    .row()
    .text('⏭️ Skip for Now', 'onboarding:skip')

  const welcomeMessage =
    `🎉 WELCOME TO AONKBOT\n\n` +
    `Your secure Solana wallet management assistant.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔒 SECURITY FIRST\n` +
    `We protect your funds with:\n` +
    `✓ 3-layer authentication for exports\n` +
    `✓ Google Authenticator (2FA)\n` +
    `✓ Password protection\n` +
    `✓ Rate limiting & auto-lockout\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `⚡ QUICK START\n` +
    `1. Set up 2-Factor Authentication (recommended)\n` +
    `2. /wallet - Check your balance\n` +
    `3. /swap - Start trading\n\n` +
    `📖 Learn more: /help\n\n` +
    `Ready to secure your wallet?`

  await ctx.reply(welcomeMessage, { reply_markup: keyboard })

  // Remember that the welcome has been shown (24 h)
  await redis.set(redisKeys.welcomeShown(userId), '1', 'EX', 86400)
}

/* ─────────────────────────────────────────────
   STEP 3: Security guide
───────────────────────────────────────────── */

export const showSecurityGuide = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery().catch(() => {})

    const guideMessage =
      `🔐 AONKBOT SECURITY GUIDE\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `WHY 2-FACTOR AUTHENTICATION?\n\n` +
      `Even if someone hacks your Telegram account,\n` +
      `they CANNOT access your funds without:\n\n` +
      `1️⃣  Security Question (personal knowledge)\n` +
      `   - Only YOU know the answer\n` +
      `   - Can't be transmitted or stolen\n\n` +
      `2️⃣  Password (something you know)\n` +
      `   - Different from Telegram password\n` +
      `   - Hashed securely\n\n` +
      `3️⃣  Google Authenticator (2FA on phone)\n` +
      `   - 6-digit codes change every 30 seconds\n` +
      `   - Can't be accessed remotely\n` +
      `   - Backup codes provided for phone loss\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `SECURITY BENEFITS:\n\n` +
      `✅ Account Hacked? → Can't export seed phrase (SQ blocks it)\n\n` +
      `✅ Password Phished? → Can't export seed phrase (SQ blocks it)\n\n` +
      `✅ Phone Lost? → Use 8 backup codes provided during setup\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `SETUP TAKES: ~2 minutes\n` +
      `YOU GET: Maximum security for your funds`

    const keyboard = new InlineKeyboard()
      .text('🔐 I understand, setup 2FA', 'onboarding:start_2fa')
      .row()
      .text('⏭️ Maybe later', 'onboarding:skip')

    await ctx.reply(guideMessage, { reply_markup: keyboard })
  } catch (err) {
    console.error('Error showing security guide:', err)
    await ctx.reply('❌ Error displaying guide')
  }
}

/* ─────────────────────────────────────────────
   STEP 4: Initiate 2FA setup
───────────────────────────────────────────── */

export const initiate2FASetup = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery().catch(() => {})

    // If already configured, skip straight to completion
    const existingSecret = await getSecret(userId)
    if (existingSecret) {
      await completeOnboarding(ctx, userId)
      return
    }

    // Generate new TOTP secret
    const { otpAuth, backupCodes } = await generateAndSaveSecret(userId)

    // Store setup state (10-minute window)
    await redis.set(redisKeys.settingUp2FA(userId), '1', 'EX', 600)

    const setupMessage =
      `🔐 GOOGLE AUTHENTICATOR SETUP\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `STEP 1: Install Google Authenticator\n` +
      `• iOS: App Store → "Google Authenticator"\n` +
      `• Android: Play Store → "Google Authenticator"\n` +
      `• Alternative apps: Authy, Microsoft Authenticator\n\n` +
      `STEP 2: Scan QR Code Below\n` +
      `• Open your authenticator app\n` +
      `• Tap "+" or "Scan QR code"\n` +
      `• Scan the image below\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

    // Send QR code image
    try {
      const png = await QRCode.toBuffer(otpAuth, { type: 'png', margin: 1, width: 300 })
      await ctx.replyWithPhoto(new InputFile(png, 'authenticator-qr.png'), {
        caption: setupMessage,
      })
    } catch (qrErr) {
      await ctx.reply(
        setupMessage +
          `Can't scan? Copy this setup key:\n\`${otpAuth}\`\n\n` +
          `Then click "Manual entry" in your authenticator app.`,
        { parse_mode: 'Markdown' }
      )
    }

    // Send backup codes
    const backupMessage =
      `📋 BACKUP CODES\n\n` +
      `Save these 8 codes in a SAFE PLACE (offline):\n\n` +
      `${backupCodes.join('\n')}\n\n` +
      `💡 TIP: Save to a password manager or write on paper\n\n` +
      `Use backup codes if you:\n` +
      `✓ Lose your phone\n` +
      `✓ Uninstall the authenticator app\n` +
      `✓ Can't access your authenticator\n\n` +
      `⚠️ Each code works ONCE only`

    await ctx.reply(backupMessage)

    // Ask for verification code
    await ctx.reply('Now enter the 6-digit code from your authenticator app:')

    // Mark as pending verification
    await redis.set(redisKeys.verifying2FA(userId), 'pending', 'EX', 600)
  } catch (err) {
    console.error('Error initiating 2FA setup:', err)
    await ctx.reply('❌ Error setting up 2FA. Please try again.')
  }
}

/* ─────────────────────────────────────────────
   STEP 5: Verify TOTP code during onboarding
───────────────────────────────────────────── */

export const verify2FACode = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  const text = ctx.message?.text?.trim()
  if (!userId || !text) return

  try {
    const verifyingSetup = await redis.get(redisKeys.verifying2FA(userId))
    if (!verifyingSetup) return // Not in 2FA setup flow

    if (!/^[0-9]{6}$/.test(text)) {
      await ctx.reply('❌ Please enter the 6-digit code shown in your authenticator app.')
      return
    }

    const isValid = await verifyToken(userId, text)

    if (!isValid) {
      const attempts = await redis.incr(redisKeys.verify2FAAttempts(userId))
      if (attempts === 1) await redis.expire(redisKeys.verify2FAAttempts(userId), 300)

      if (attempts >= 3) {
        // Too many failures — delete the secret so it can be re-generated
        await redis.del(redisKeys.totpSecret(userId))
        await redis.del(redisKeys.totpBackupCodes(userId))
        await redis.del(redisKeys.verifying2FA(userId))
        await redis.del(redisKeys.settingUp2FA(userId))
        await redis.del(redisKeys.verify2FAAttempts(userId))

        await ctx.reply(
          '❌ Too many failed attempts. Please start over.',
          {
            reply_markup: new InlineKeyboard().text('🔐 Setup Again', 'onboarding:setup_2fa'),
          }
        )
        return
      }

      await ctx.reply(`❌ Invalid code (${attempts}/3 attempts). Try again:`)
      return
    }

    // ✅ Verification successful
    await redis.del(redisKeys.verifying2FA(userId))
    await redis.del(redisKeys.settingUp2FA(userId))
    await redis.del(redisKeys.verify2FAAttempts(userId))

    await ctx.reply(
      '✅ VERIFIED!\n\n' +
        'Your 2-Factor Authentication is now active!\n\n' +
        "🎉 You're all set. Your wallet is secure.\n\n" +
        'Next steps:\n' +
        '/wallet - Check your balance\n' +
        '/swap - Start trading\n' +
        '/help - View all commands'
    )

    await completeOnboarding(ctx, userId)
  } catch (err) {
    console.error('Error verifying 2FA code:', err)
    await ctx.reply('❌ Error verifying code. Please try again.')
  }
}

/* ─────────────────────────────────────────────
   STEP 6: Mark onboarding complete
───────────────────────────────────────────── */

export const completeOnboarding = async (ctx: Context, userId: number): Promise<void> => {
  try {
    await redis.set(redisKeys.onboardingComplete(userId), '1', 'EX', 31536000) // 1 year

    // Clean up setup flags
    await redis.del(redisKeys.settingUp2FA(userId))
    await redis.del(redisKeys.verifying2FA(userId))
    await redis.del(redisKeys.welcomeShown(userId))

    const completedMessage =
      `🎉 ONBOARDING COMPLETE\n\n` +
      `✅ 2-Factor Authentication Active\n` +
      `✅ Your wallet is secured\n` +
      `✅ Ready to use AonkBot\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `MAIN FEATURES:\n` +
      `/wallet - Check balance & holdings\n` +
      `/swap - Swap tokens (e.g., /swap 1 SOL)\n` +
      `/send - Transfer tokens\n` +
      `/txs - View transactions\n` +
      `/exportphrasesecure - Export seed phrase (3-layer security)\n\n` +
      `Need help? /help`

    await ctx.reply(completedMessage)

    // Show main menu
    const { mainMenuKeyboard } = await import('../ui/mainMenu.keyboard.js')
    await ctx.reply('Select an action below:', { reply_markup: mainMenuKeyboard })
  } catch (err) {
    console.error('Error completing onboarding:', err)
  }
}

/* ─────────────────────────────────────────────
   STEP 7: Skip onboarding
───────────────────────────────────────────── */

export const skipOnboarding = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery().catch(() => {})

    const message =
      `⏭️ SETUP SKIPPED\n\n` +
      `You can set up 2-Factor Authentication anytime:\n` +
      `/totpsetup - Setup Google Authenticator\n\n` +
      `Remember:\n` +
      `⚠️ Without 2FA, seed phrase export has less security\n` +
      `✓ With 2FA, even Telegram hacks can't compromise your funds\n\n` +
      `Ready to start using AonkBot!`

    await ctx.reply(message)

    await redis.set(redisKeys.welcomeShown(userId), '1', 'EX', 86400)

    const { mainMenuKeyboard } = await import('../ui/mainMenu.keyboard.js')
    await ctx.reply('Select an action below:', { reply_markup: mainMenuKeyboard })
  } catch (err) {
    console.error('Error skipping onboarding:', err)
  }
}

/* ─────────────────────────────────────────────
   Regenerate TOTP (prompt)
───────────────────────────────────────────── */

export const regenerateTOTPHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const message =
      `🔄 REGENERATE AUTHENTICATOR\n\n` +
      `This will create a NEW 2FA setup.\n\n` +
      `⚠️ WARNING:\n` +
      `• Old backup codes will NO LONGER work\n` +
      `• You must scan the new QR code\n` +
      `• Save the new backup codes\n\n` +
      `Continue?`

    const keyboard = new InlineKeyboard()
      .text('✅ Yes, regenerate', 'onboarding:confirm_regenerate')
      .text('❌ Cancel', 'onboarding:cancel')

    await ctx.reply(message, { reply_markup: keyboard })
  } catch (err) {
    console.error('Error in regenerate TOTP handler:', err)
    await ctx.reply('❌ Error. Please try again.')
  }
}

/* ─────────────────────────────────────────────
   Confirm TOTP regeneration
───────────────────────────────────────────── */

export const confirmRegenerateTOTP = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery().catch(() => {})

    // Delete old secret so initiate2FASetup generates a fresh one
    await redis.del(redisKeys.totpSecret(userId))
    await redis.del(redisKeys.totpBackupCodes(userId))

    await initiate2FASetup(ctx)
  } catch (err) {
    console.error('Error confirming TOTP regeneration:', err)
    await ctx.reply('❌ Error regenerating 2FA. Please try again.')
  }
}