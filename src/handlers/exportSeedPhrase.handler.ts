import { Context, InlineKeyboard, InputFile } from 'grammy'
import { getSelectedWallet, loadWalletSigner } from '../blockchain/wallet.service.js'
import bs58 from 'bs58'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import { generateAndSaveSecret, getSecret } from '../auth/totp.service.js'
import QRCode from 'qrcode'

/**
 * STEP 1: Show warning and confirmation dialog before revealing seed phrase
 */
export const exportSeedPhraseHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const wallet = await getSelectedWallet(userId)
    if (!wallet) {
      await ctx.reply('❌ No wallet selected.')
      return
    }

    const confirmKeyboard = new InlineKeyboard()
      .text('Cancel', 'export:cancel')
      .text('I understand, export seed phrase', 'export:confirm')

    const warningMessage = `🔐 Export Seed Phrase

⚠️ WARNING: This reveals your private seed phrase!

Your seed phrase is the key to your wallet. Anyone with this phrase can access and steal your funds.

✅ SAFE to share with:
- Yourself (backup)
- Hardware wallet (import)

❌ NEVER share with:
- Anyone online
- Suspicious links
- Screenshots

Once you export, keep it safe. We recommend:
1. Write it down on paper
2. Store in a safe place
3. Never store digitally

Do you understand and want to proceed?`

    await ctx.reply(warningMessage, { reply_markup: confirmKeyboard })
  } catch (error) {
    console.error('Error initiating seed phrase export:', error)
    await ctx.reply('❌ Failed to initiate export. Please try again.')
  }
}

/**
 * STEP 2: Initiate TOTP verification before revealing seed phrase.
 * If the user has no TOTP secret yet, generate one and show the QR code first.
 */
export const exportConfirmHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery().catch(() => {})

    const wallet = await getSelectedWallet(userId)
    if (!wallet) {
      await ctx.reply('❌ No wallet selected.')
      return
    }

    const secret = await getSecret(userId)

    if (!secret) {
      // First time — generate a new TOTP secret and show QR
      const { otpAuth, backupCodes } = await generateAndSaveSecret(userId)

      try {
        const png = await QRCode.toBuffer(otpAuth, { type: 'png', margin: 1, width: 300 })
        const input = new InputFile(png, 'qrcode.png')
        await ctx.replyWithPhoto(input, {
          caption:
            '🔐 Scan this QR code with Google Authenticator (or any TOTP app).\n\n' +
            'After adding, send the 6-digit code shown in your app to continue.',
        })
      } catch (err) {
        console.error('QR generation failed, sending otpAuth URL fallback', err)
        await ctx.reply(
          `Set up your TOTP app using this URL:\n\`${otpAuth}\`\n\nAfter adding, send the 6-digit code shown in your app.`,
          { parse_mode: 'Markdown' }
        )
      }

      if (backupCodes?.length) {
        await ctx.reply(
          `📋 One-time backup codes (save these offline). Each can be used once:\n\n${backupCodes.join('\n')}`
        )
      }

      // Show options keyboard
      const keyboard = new InlineKeyboard()
        .text('🔄 Regenerate QR', 'export:regen')
        .text('✏️ Enter code', 'export:enter_code')
      await ctx.reply('Once scanned, tap "Enter code" or just type your 6-digit code.', {
        reply_markup: keyboard,
      })
    } else {
      // Already has a TOTP secret — show options keyboard
      const keyboard = new InlineKeyboard()
        .text('🔄 Regenerate QR', 'export:regen')
        .text('✏️ Enter code', 'export:enter_code')
      await ctx.reply(
        '🔐 Please enter your 6-digit Google Authenticator code to continue.\n\nTap "Enter code" or just type the 6-digit code.',
        { reply_markup: keyboard }
      )
    }

    // Mark that we are awaiting a TOTP code for this export (5-minute window)
    await redis.set(redisKeys.exportAwaitTotp(userId), '1', 'EX', 300)
  } catch (err) {
    console.error('Error initiating TOTP for export:', err)
    await ctx.reply('❌ Failed to start two-factor verification. Please try again.')
  }
}

/**
 * Regenerate TOTP secret and send a fresh QR + backup codes
 */
export const exportRegenHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery().catch(() => {})

    // Remove old secret and backup codes
    await redis.del(redisKeys.totpSecret(userId))
    await redis.del(redisKeys.totpBackupCodes(userId))

    const { otpAuth, backupCodes } = await generateAndSaveSecret(userId)

    try {
      const png = await QRCode.toBuffer(otpAuth, { type: 'png', margin: 1, width: 300 })
      const input = new InputFile(png, 'qrcode.png')
      await ctx.replyWithPhoto(input, {
        caption:
          '🔄 New TOTP setup generated. Scan this QR with your authenticator app, then send the 6-digit code.',
      })
    } catch (err) {
      console.error('QR generation failed, sending otpAuth URL fallback', err)
      await ctx.reply(
        `Set up your TOTP app using this URL:\n\`${otpAuth}\`\n\nAfter adding, send the 6-digit code shown in your app.`,
        { parse_mode: 'Markdown' }
      )
    }

    if (backupCodes?.length) {
      await ctx.reply(
        `📋 One-time backup codes (save these offline). Each can be used once:\n\n${backupCodes.join('\n')}`
      )
    }

    // Reset the awaiting flag (5-minute window)
    await redis.set(redisKeys.exportAwaitTotp(userId), '1', 'EX', 300)
  } catch (err) {
    console.error('Error regenerating TOTP', err)
    await ctx.reply('❌ Failed to regenerate TOTP. Please try again.')
  }
}

/**
 * Prompt user to type their TOTP code (used by the 'Enter code' button)
 */
export const exportEnterCodeHandler = async (ctx: Context): Promise<void> => {
  try {
    await ctx.answerCallbackQuery().catch(() => {})
    await ctx.reply('Please type the 6-digit code shown in your authenticator app.')
  } catch (err) {
    console.error('Error prompting for code', err)
  }
}

/**
 * Perform the actual export — called after successful TOTP verification
 */
export const exportPerformHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const keypair = await loadWalletSigner(userId)
    const base58SeedPhrase = bs58.encode(keypair.secretKey)

    const wallet = await getSelectedWallet(userId)
    if (!wallet) {
      await ctx.reply('❌ Wallet not found.')
      return
    }

    const base58Message =
      `🔑 *YOUR PRIVATE KEY (Base58 Format)*\n\n` +
      `✅ THIS IS YOUR RECOVERY KEY!\n\n` +
      `Never share this with anyone:\n\n` +
      `\`\`\`\n${base58SeedPhrase}\n\`\`\`\n\n` +
      `✅ Works with:\n` +
      `• Phantom Wallet\n` +
      `• Solflare\n` +
      `• Ledger\n` +
      `• Solana CLI\n` +
      `• Any Solana wallet\n\n` +
      `📌 Your Public Address:\n\`${wallet.publicKey}\``

    await ctx.reply(base58Message, { parse_mode: 'Markdown' })

    const securityMessage =
      `🛡️ BACKUP & RECOVERY GUIDE:\n\n` +
      `🔐 CRITICAL STEPS:\n` +
      `1. Copy your Base58 Private Key above\n` +
      `2. Save it OFFLINE (paper, safe, etc)\n` +
      `3. Never share with anyone\n` +
      `4. Never store on computer/cloud\n\n` +
      `✅ HOW TO RECOVER YOUR WALLET:\n` +
      `1. Open Phantom Wallet\n` +
      `2. Tap "Add Account" → "Import Private Key"\n` +
      `3. Paste your Base58 key above\n` +
      `4. Verify address matches: ${wallet.publicKey}\n` +
      `5. If address matches ✅ Recovery works!\n\n` +
      `⚠️ IMPORTANT:\n` +
      `• This is your ONLY backup\n` +
      `• If you lose it, your wallet is gone\n` +
      `• Test your backup recovery now\n` +
      `• Do not rely on memory\n` +
      `• Do not take screenshots\n` +
      `• Store in physically safe location`

    await ctx.reply(securityMessage)
  } catch (error) {
    console.error('Error exporting seed phrase:', error)
    await ctx.reply('❌ Failed to export seed phrase. Please try again.')
  }
}

/**
 * Cancel export
 */
export const exportCancelHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  try {
    await ctx.answerCallbackQuery({ text: 'Export cancelled' })
    // Clear the awaiting flag if present
    if (userId) await redis.del(redisKeys.exportAwaitTotp(userId))
    await ctx.deleteMessage()
  } catch (error) {
    console.error('Error cancelling export:', error)
  }
}