import { Context } from 'grammy'
import fs from 'fs'
import path from 'path'
import { Keypair, PublicKey } from '@solana/web3.js'
import { config } from '../utils/config.js'
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token'
import { solana } from '../blockchain/solana.client.js'

export async function devnetCreditHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  // Admin-only
  const adminTelegram = process.env.ADMIN_TELEGRAM_ID
  if (!adminTelegram || Number(adminTelegram) !== Number(userId)) {
    await ctx.reply('❌ Unauthorized. This command is admin-only.')
    return
  }

  const text = ctx.message?.text || ''
  const args = text.split(' ')
  const amountStr = args[1]
  if (!amountStr) {
    await ctx.reply('Usage: /devnet-credit <amount>')
    return
  }

  const amount = Number(amountStr)
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('Invalid amount')
    return
  }

  const poolFile = path.resolve('.devnet', 'pool.json')
  const adminFile = path.resolve('.devnet', 'admin.json')

  if (!fs.existsSync(poolFile) || !fs.existsSync(adminFile)) {
    await ctx.reply('Devnet pool or admin key not found. Run devnet-setup first.')
    return
  }

  try {
    const pool = JSON.parse(fs.readFileSync(poolFile, 'utf8'))
    const adminRaw = JSON.parse(fs.readFileSync(adminFile, 'utf8'))
    const adminKey = Keypair.fromSecretKey(Buffer.from(adminRaw.secret))

    const mint = new PublicKey(pool.tokenMint)

    // Determine target: the admin is minting to the admin or a specified wallet.
    // For simplicity, credit the admin's own wallet for now
    const toPubKey = adminKey.publicKey

    const ata = await getOrCreateAssociatedTokenAccount(solana, adminKey, mint, toPubKey)
    const decimals = pool.tokenDecimals || 6
    const amountScaled = BigInt(Math.floor(amount * Math.pow(10, decimals)))

    const sig = await mintTo(solana, adminKey, mint, ata.address, adminKey, amountScaled)

    await ctx.reply(`✅ Credited ${amount} tokens to ${toPubKey.toBase58()}\nSignature: ${sig}`)
  } catch (err: any) {
    console.error('[Devnet Credit Error]', err)
    await ctx.reply('❌ Failed to credit tokens: ' + err.message)
  }
}
