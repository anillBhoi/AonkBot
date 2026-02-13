import { Context, InlineKeyboard } from 'grammy'
import { getSelectedWallet, loadWalletSigner } from '../blockchain/wallet.service.js'
import bs58 from 'bs58'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import { getSecret } from '../auth/totp.service.js'

/**
 * STEP 1: Show warning and confirmation dialog before revealing seed phrase.
 *
 * SECURITY: We check upfront whether the user has completed TOTP setup.
 * If not, we block the export entirely and send them to onboarding.
 * This prevents QR generation from ever happening inside the export flow.
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

    // ─── SECURITY GATE: block export if 2FA was never set up ───
    const secret = await getSecret(userId)
    if (!secret) {
      await ctx.reply(
        '🔐 EXPORT BLOCKED\n\n' +
          'You must set up Google Authenticator before exporting your seed phrase.\n\n' +
          'This protects your wallet even if someone else has access to your Telegram.\n\n' +
          'Run /totpsetup to complete your 2FA setup first.',
        {
          reply_markup: new InlineKeyboard().text('🔐 Setup 2FA Now', 'onboarding:start_2fa'),
        }
      )
      return
    }

    const confirmKeyboard = new InlineKeyboard()
      .text('Cancel', 'export:cancel')
      .text('I understand, export seed phrase', 'export:confirm')

    const warningMessage =
      `🔐 Export Seed Phrase\n\n` +
      `⚠️ WARNING: This reveals your private seed phrase!\n\n` +
      `Your seed phrase is the key to your wallet. Anyone with this phrase can access and steal your funds.\n\n` +
      `✅ SAFE to share with:\n- Yourself (backup)\n- Hardware wallet (import)\n\n` +
      `❌ NEVER share with:\n- Anyone online\n- Suspicious links\n- Screenshots\n\n` +
      `Once you export, keep it safe. We recommend:\n` +
      `1. Write it down on paper\n` +
      `2. Store in a safe place\n` +
      `3. Never store digitally\n\n` +
      `Do you understand and want to proceed?`

    await ctx.reply(warningMessage, { reply_markup: confirmKeyboard })
  } catch (error) {
    console.error('Error initiating seed phrase export:', error)
    await ctx.reply('❌ Failed to initiate export. Please try again.')
  }
}

/**
 * STEP 2: Ask for TOTP code — never generates or shows a QR here.
 *
 * SECURITY: By this point we know the user already has a TOTP secret
 * (the gate in Step 1 ensures that). We simply ask for the code.
 * No "Regenerate QR" button is shown — that path is only available
 * via /totpsetup which requires the current code to authorise.
 */
export const exportConfirmHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery().catch(() => {})

    // Double-check secret still exists (e.g. wasn't wiped between steps)
    const secret = await getSecret(userId)
    if (!secret) {
      await ctx.reply(
        '❌ 2FA setup not found. Please run /totpsetup to configure Google Authenticator before exporting.'
      )
      return
    }

    // Mark that we are awaiting a TOTP code for this export (5-minute window)
    await redis.set(redisKeys.exportAwaitTotp(userId), '1', 'EX', 300)

    await ctx.reply(
      '🔐 Enter the 6-digit code from your Google Authenticator app to continue.\n\n' +
        '💡 Open your authenticator app and type the code shown for AonkBot.'
    )
  } catch (err) {
    console.error('Error initiating TOTP for export:', err)
    await ctx.reply('❌ Failed to start two-factor verification. Please try again.')
  }
}

/**
 * SECURITY: Regenerate via export flow is permanently disabled.
 *
 * The "export:regen" callback is kept wired in the router so old in-flight
 * messages don't crash, but it now refuses to do anything and redirects the
 * user to the safe /totpsetup path (which requires verifying the current
 * code before overwriting the secret).
 */
export const exportRegenHandler = async (ctx: Context): Promise<void> => {
  try {
    await ctx.answerCallbackQuery().catch(() => {})
    await ctx.reply(
      '🔒 For security reasons, you cannot regenerate your authenticator from the export screen.\n\n' +
        'To set up a new authenticator (e.g. if you got a new phone), use:\n' +
        '/totpsetup — you will need to verify your current code first.'
    )
  } catch (err) {
    console.error('Error in disabled regen handler', err)
  }
}

/**
 * Prompt user to type their TOTP code (kept for backward-compat with old keyboards)
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