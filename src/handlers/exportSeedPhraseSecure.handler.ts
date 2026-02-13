import { Context, InlineKeyboard, InputFile } from 'grammy'
import { getSelectedWallet, loadWalletSigner } from '../blockchain/wallet.service.js'
import bs58 from 'bs58'
import { redis } from '../config/redis.js'
import { redisKeys } from '../utils/redisKeys.js'
import {
  generateAndSaveSecret,
  getSecret,
  verifyToken,
  verifyBackupCode,
  isLocked,
} from '../auth/totp.service.js'
import QRCode from 'qrcode'
import crypto from 'crypto'

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */

const SECURITY_QUESTIONS = [
  "What is your pet's name?",
  "What is your mother's maiden name?",
  'What city were you born in?',
  'What is your favorite food?',
  'What street did you grow up on?',
  'What is your favorite movie?',
  'What was your first job?',
  "What is your best friend's name?",
]

const MAX_ATTEMPTS = 5
const LOCK_TTL = 1800 // 30 minutes in seconds
const STAGE_TTL = 300 // 5 minutes

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function verifyPassword(input: string, hashed: string): boolean {
  return hashPassword(input) === hashed
}

/* ─────────────────────────────────────────────
   STEP 1: Warning + confirmation button
───────────────────────────────────────────── */

export const exportSeedPhraseSecureHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const wallet = await getSelectedWallet(userId)
    if (!wallet) {
      await ctx.reply('❌ No wallet selected.')
      return
    }

    const confirmKeyboard = new InlineKeyboard()
      .text('Cancel', 'exportsecure:cancel')
      .text('I understand, export seed phrase', 'exportsecure:confirm')

    const warningMessage =
      `🔐 EXPORT SEED PHRASE — MAXIMUM SECURITY\n\n` +
      `⚠️ WARNING: This reveals your private seed phrase!\n\n` +
      `Your seed phrase is the key to your wallet. Anyone with this phrase can access and steal your funds.\n\n` +
      `🛡️ THREE-LAYER SECURITY PROTECTION:\n` +
      `1️⃣  Security Question (personal knowledge)\n` +
      `2️⃣  Password (something only you know)\n` +
      `3️⃣  Google Authenticator (two-device verification)\n\n` +
      `✅ SAFE to share with:\n- Yourself (backup)\n- Hardware wallet (import)\n\n` +
      `❌ NEVER share with:\n- Anyone online\n- Suspicious links\n- Screenshots\n\n` +
      `Do you understand and want to proceed?`

    await ctx.reply(warningMessage, { reply_markup: confirmKeyboard })
  } catch (error) {
    console.error('Error initiating secure seed phrase export:', error)
    await ctx.reply('❌ Failed to initiate export. Please try again.')
  }
}

/* ─────────────────────────────────────────────
   STEP 2: Check if user has a security question
───────────────────────────────────────────── */

export const exportSecureConfirmHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery().catch(() => {})

    // Check both sq and pw locks
    const sqLocked = await redis.get(redisKeys.exportSqLock(userId))
    const pwLocked = await redis.get(redisKeys.exportPwLock(userId))
    if (sqLocked || pwLocked) {
      await ctx.reply('⛔ Export is locked due to too many failed attempts. Try again in 30 minutes.')
      return
    }

    const wallet = await getSelectedWallet(userId)
    if (!wallet) {
      await ctx.reply('❌ No wallet selected.')
      return
    }

    const securityQuestionData = await redis.get(redisKeys.securityQuestion(userId))

    if (!securityQuestionData) {
      // First time — set up security question
      await setupSecurityQuestion(ctx, userId)
    } else {
      // Returning user — ask them to answer their stored question
      const questionData = JSON.parse(securityQuestionData)
      await ctx.reply(
        `🔐 SECURITY LAYER 1: Answer Your Security Question\n\n${questionData.question}\n\nReply with your answer:`
      )
      await redis.set(redisKeys.exportStage(userId), 'answering_question', 'EX', STAGE_TTL)
    }
  } catch (err) {
    console.error('Error confirming secure export:', err)
    await ctx.reply('❌ Failed to proceed. Please try again.')
  }
}

/* ─────────────────────────────────────────────
   STEP 2a: First-time security question picker
───────────────────────────────────────────── */

async function setupSecurityQuestion(ctx: Context, userId: number): Promise<void> {
  const keyboard = new InlineKeyboard()

  SECURITY_QUESTIONS.forEach((_, index) => {
    if (index % 2 === 0) keyboard.row()
    keyboard.text(`${index + 1}`, `setup_sq:${index}`)
  })

  let questionText = '🔐 FIRST-TIME SETUP: Choose Your Security Question\n\n'
  SECURITY_QUESTIONS.forEach((q, i) => {
    questionText += `${i + 1}. ${q}\n`
  })
  questionText += '\nSelect a number (1–8):'

  await ctx.reply(questionText, { reply_markup: keyboard })
}

/* ─────────────────────────────────────────────
   STEP 2b: User taps a question number
───────────────────────────────────────────── */

export const setupSecurityQuestionHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery().catch(() => {})

    const data = ctx.callbackQuery?.data
    if (!data?.startsWith('setup_sq:')) return

    const questionIndex = parseInt(data.replace('setup_sq:', ''), 10)
    if (isNaN(questionIndex) || questionIndex < 0 || questionIndex >= SECURITY_QUESTIONS.length) return

    const question = SECURITY_QUESTIONS[questionIndex]

    await ctx.reply(
      `🔐 You selected:\n"${question}"\n\nPlease reply with your answer (you'll need this to export seed phrases):`
    )

    await redis.set(redisKeys.exportChoosingQuestion(userId), questionIndex.toString(), 'EX', STAGE_TTL)
    await redis.set(redisKeys.exportStage(userId), 'entering_sq_answer', 'EX', STAGE_TTL)
  } catch (err) {
    console.error('Error in security question setup:', err)
    await ctx.reply('❌ Error. Please try /exportphrasesecure again.')
  }
}

/* ─────────────────────────────────────────────
   STEP 3 + 4: Text handler for SQ answer & password
   (Also handles first-time SQ/password setup)
───────────────────────────────────────────── */

export const verifySecurityQuestionHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  const text = ctx.message?.text?.trim()
  if (!text) return

  try {
    const stage = await redis.get(redisKeys.exportStage(userId))

    /* ── Saving new security-question answer ── */
    if (stage === 'entering_sq_answer') {
      const questionIndexStr = await redis.get(redisKeys.exportChoosingQuestion(userId))
      if (questionIndexStr === null) {
        await ctx.reply('❌ Session expired. Please try /exportphrasesecure again.')
        return
      }

      const question = SECURITY_QUESTIONS[parseInt(questionIndexStr, 10)]
      const answerHash = hashPassword(text.toLowerCase())

      await redis.set(
        redisKeys.securityQuestion(userId),
        JSON.stringify({ question, answerHash })
      )
      await redis.del(redisKeys.exportChoosingQuestion(userId))
      await redis.set(redisKeys.exportStage(userId), 'answering_password', 'EX', STAGE_TTL)

      await ctx.reply(
        '✅ Security question saved!\n\n🔐 SECURITY LAYER 2: Create Your Password\n\n' +
          'Please enter a password (minimum 6 characters):'
      )
      return
    }

    /* ── Verifying existing security-question answer ── */
    if (stage === 'answering_question') {
      const sqLocked = await redis.get(redisKeys.exportSqLock(userId))
      if (sqLocked) {
        await ctx.reply('⛔ Too many wrong answers. Export locked for 30 minutes.')
        return
      }

      const raw = await redis.get(redisKeys.securityQuestion(userId))
      if (!raw) {
        await ctx.reply('❌ Security question not found. Please try /exportphrasesecure again.')
        return
      }

      const questionData = JSON.parse(raw)
      const answerHash = hashPassword(text.toLowerCase())

      if (answerHash !== questionData.answerHash) {
        const attempts = await redis.incr(redisKeys.exportSqAttempts(userId))
        if (attempts === 1) await redis.expire(redisKeys.exportSqAttempts(userId), STAGE_TTL)

        if (attempts >= MAX_ATTEMPTS) {
          await redis.set(redisKeys.exportSqLock(userId), '1', 'EX', LOCK_TTL)
          await redis.del(redisKeys.exportSqAttempts(userId))
          await ctx.reply('⛔ Too many wrong answers. Export locked for 30 minutes.')
          return
        }

        await ctx.reply(`❌ Wrong answer (${attempts}/${MAX_ATTEMPTS} attempts). Try again.`)
        return
      }

      // Correct answer ✅
      await redis.del(redisKeys.exportSqAttempts(userId))
      await redis.set(redisKeys.exportStage(userId), 'answering_password', 'EX', STAGE_TTL)
      await ctx.reply('✅ Correct!\n\n🔐 SECURITY LAYER 2: Enter Your Password\n\nPassword:')
      return
    }

    /* ── Password (setup or verification) ── */
    if (stage === 'answering_password') {
      const pwLocked = await redis.get(redisKeys.exportPwLock(userId))
      if (pwLocked) {
        await ctx.reply('⛔ Too many wrong passwords. Export locked for 30 minutes.')
        return
      }

      if (text.length < 6) {
        await ctx.reply('❌ Password must be at least 6 characters. Try again:')
        return
      }

      const existingPasswordHash = await redis.get(redisKeys.exportPassword(userId))

      if (!existingPasswordHash) {
        // First time — save the password hash
        await redis.set(redisKeys.exportPassword(userId), hashPassword(text))

        // Check if TOTP is already set up
        const totpSecret = await getSecret(userId)
        if (!totpSecret) {
          await redis.set(redisKeys.exportStage(userId), 'awaiting_totp', 'EX', STAGE_TTL)
          await ctx.reply('✅ Password saved!\n\n🔐 SECURITY LAYER 3: Set Up Google Authenticator', {
            reply_markup: new InlineKeyboard().text('Continue to Authenticator Setup', 'exportsecure:setup_totp'),
          })
        } else {
          await redis.set(redisKeys.exportStage(userId), 'awaiting_totp', 'EX', STAGE_TTL)
          await ctx.reply(
            '✅ Password saved!\n\n🔐 SECURITY LAYER 3: Enter your 6-digit Google Authenticator code:'
          )
        }
        return
      }

      // Verify existing password
      if (!verifyPassword(text, existingPasswordHash)) {
        const attempts = await redis.incr(redisKeys.exportPwAttempts(userId))
        if (attempts === 1) await redis.expire(redisKeys.exportPwAttempts(userId), STAGE_TTL)

        if (attempts >= MAX_ATTEMPTS) {
          await redis.set(redisKeys.exportPwLock(userId), '1', 'EX', LOCK_TTL)
          await redis.del(redisKeys.exportPwAttempts(userId))
          await ctx.reply('⛔ Too many wrong passwords. Export locked for 30 minutes.')
          return
        }

        await ctx.reply(`❌ Wrong password (${attempts}/${MAX_ATTEMPTS} attempts). Try again.`)
        return
      }

      // Correct password ✅
      await redis.del(redisKeys.exportPwAttempts(userId))
      await redis.set(redisKeys.exportStage(userId), 'awaiting_totp', 'EX', STAGE_TTL)

      // Check if TOTP is already set up
      const totpSecret = await getSecret(userId)
      if (!totpSecret) {
        // Generate and show QR
        const { otpAuth, backupCodes } = await generateAndSaveSecret(userId)
        try {
          const png = await QRCode.toBuffer(otpAuth, { type: 'png', margin: 1, width: 300 })
          await ctx.replyWithPhoto(new InputFile(png, 'qrcode.png'), {
            caption:
              '🔐 SECURITY LAYER 3: Google Authenticator\n\nScan this QR code with Google Authenticator (or any TOTP app), then enter the 6-digit code.',
          })
        } catch (err) {
          await ctx.reply(
            `Set up your TOTP app using this URL:\n\`${otpAuth}\`\n\nThen enter the 6-digit code shown in your app.`,
            { parse_mode: 'Markdown' }
          )
        }
        if (backupCodes?.length) {
          await ctx.reply(
            `📋 BACKUP CODES (save these offline)\n\nEach code can be used once if you lose your phone:\n\n${backupCodes.join('\n')}`
          )
        }
      } else {
        await ctx.reply('✅ Correct!\n\n🔐 SECURITY LAYER 3: Enter your 6-digit Google Authenticator code:')
      }
    }
  } catch (err) {
    console.error('Error in security verification:', err)
    await ctx.reply('❌ Error. Please try again.')
  }
}

/* ─────────────────────────────────────────────
   STEP 5: Verify TOTP (final layer)
───────────────────────────────────────────── */

export const verifyTOTPForExportHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  const text = ctx.message?.text?.trim()
  if (!text) return

  try {
    const stage = await redis.get(redisKeys.exportStage(userId))
    if (stage !== 'awaiting_totp') return

    // Check all locks
    const sqLocked = await redis.get(redisKeys.exportSqLock(userId))
    const pwLocked = await redis.get(redisKeys.exportPwLock(userId))
    const totpGlobalLocked = await isLocked(userId)
    const totpExportLocked = await redis.get(redisKeys.exportTotpLock(userId))

    if (sqLocked || pwLocked || totpGlobalLocked || totpExportLocked) {
      await ctx.reply('⛔ Too many failed attempts. Export locked for 30 minutes.')
      return
    }

    // Accept 6-digit TOTP or 8-char backup code
    let isValid = false

    if (/^[0-9]{6}$/.test(text)) {
      isValid = await verifyToken(userId, text)
    } else if (/^[a-zA-Z0-9]{8}$/.test(text)) {
      isValid = await verifyBackupCode(userId, text)
    } else {
      await ctx.reply('❌ Please enter your 6-digit authenticator code or an 8-character backup code.')
      return
    }

    if (!isValid) {
      const attempts = await redis.incr(redisKeys.exportTotpAttempts(userId))
      if (attempts === 1) await redis.expire(redisKeys.exportTotpAttempts(userId), STAGE_TTL)

      if (attempts >= MAX_ATTEMPTS) {
        await redis.set(redisKeys.exportTotpLock(userId), '1', 'EX', LOCK_TTL)
        await redis.del(redisKeys.exportTotpAttempts(userId))
        await ctx.reply('⛔ Too many wrong codes. Export locked for 30 minutes.')
        return
      }

      await ctx.reply(`❌ Invalid code (${attempts}/${MAX_ATTEMPTS} attempts). Try again.`)
      return
    }

    // ✅ All three layers passed — clean up and reveal the key
    await redis.del(redisKeys.exportStage(userId))
    await redis.del(redisKeys.exportTotpAttempts(userId))
    await redis.del(redisKeys.exportSqAttempts(userId))
    await redis.del(redisKeys.exportPwAttempts(userId))

    await ctx.reply('✅ All security layers verified!\n\n🎉 Revealing your seed phrase now...')
    await exportPerformHandler(ctx)
  } catch (err) {
    console.error('Error verifying TOTP for secure export:', err)
    await ctx.reply('❌ Error. Please try again.')
  }
}

/* ─────────────────────────────────────────────
   STEP 6: Actual export (after all layers pass)
───────────────────────────────────────────── */

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
      `• Phantom Wallet\n• Solflare\n• Ledger\n• Solana CLI\n• Any Solana wallet\n\n` +
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

/* ─────────────────────────────────────────────
   Cancel export
───────────────────────────────────────────── */

export const exportSecureCancelHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery({ text: 'Export cancelled' })
    await redis.del(redisKeys.exportStage(userId))
    await ctx.deleteMessage()
  } catch (error) {
    console.error('Error cancelling export:', error)
  }
}

/* ─────────────────────────────────────────────
   Setup TOTP after password (button callback)
───────────────────────────────────────────── */

export const setupTOTPHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    await ctx.answerCallbackQuery().catch(() => {})

    const { otpAuth, backupCodes } = await generateAndSaveSecret(userId)

    try {
      const png = await QRCode.toBuffer(otpAuth, { type: 'png', margin: 1, width: 300 })
      await ctx.replyWithPhoto(new InputFile(png, 'qrcode.png'), {
        caption:
          '🔐 SECURITY LAYER 3: Google Authenticator\n\nScan this QR code with Google Authenticator, then enter the 6-digit code.',
      })
    } catch (err) {
      await ctx.reply(
        `Set up your TOTP app using this URL:\n\`${otpAuth}\``,
        { parse_mode: 'Markdown' }
      )
    }

    if (backupCodes?.length) {
      await ctx.reply(`📋 BACKUP CODES (save these offline)\n\n${backupCodes.join('\n')}`)
    }

    await ctx.reply('Enter the 6-digit code from your authenticator app:')
    await redis.set(redisKeys.exportStage(userId), 'awaiting_totp', 'EX', STAGE_TTL)
  } catch (err) {
    console.error('Error setting up TOTP:', err)
    await ctx.reply('❌ Error. Please try again.')
  }
}