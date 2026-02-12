import { Context, InlineKeyboard } from 'grammy';
import { getSelectedWallet, loadWalletSigner } from '../blockchain/wallet.service.js';
import bs58 from 'bs58';

/**
 * First step: Show confirmation dialog before revealing seed phrase
 */
export const exportSeedPhraseHandler = async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
        const wallet = await getSelectedWallet(userId);
        if (!wallet) {
            await ctx.reply('❌ No wallet selected.');
            return;
        }

        // Create confirmation keyboard
        const confirmKeyboard = new InlineKeyboard()
            .text('Cancel', 'export:cancel')
            .text('I understand, export seed phrase', 'export:confirm');

        // Show warning message
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

Do you understand and want to proceed?`;

        await ctx.reply(warningMessage, {
            reply_markup: confirmKeyboard,
        });
    } catch (error) {
        console.error('Error initiating seed phrase export:', error);
        await ctx.reply('❌ Failed to initiate export. Please try again.');
    }
};

/**
 * Second step: Display the actual seed phrase
 */
export const exportConfirmHandler = async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
        // Get the wallet keypair
        const keypair = await loadWalletSigner(userId);
        
        // Convert private key bytes to base58 format
        const secretKeyBuffer = keypair.secretKey;
        const base58SeedPhrase = bs58.encode(secretKeyBuffer);

        // Get the wallet info
        const wallet = await getSelectedWallet(userId);
        if (!wallet) {
            await ctx.reply('❌ Wallet not found.');
            return;
        }

        // Show the base58 private key format (ONLY recovery key)
        const base58Message = `🔑 YOUR PRIVATE KEY (Base58 Format)\n\n✅ THIS IS YOUR RECOVERY KEY!\n\nNever share this with anyone:\n\n\`\`\`\n${base58SeedPhrase}\n\`\`\`\n\n✅ Works with:\n• Phantom Wallet\n• Solflare\n• Ledger\n• Solana CLI\n• Any Solana wallet\n\n📌 Your Public Address:\n${wallet.publicKey}`;

        await ctx.reply(base58Message, {
            parse_mode: 'Markdown',
        });

        // Show security guide
        const securityMessage = `🛡️ BACKUP & RECOVERY GUIDE:\n\n🔐 CRITICAL STEPS:\n1. Copy your Base58 Private Key above\n2. Save it OFFLINE (paper, safe, etc)\n3. Never share with anyone\n4. Never store on computer/cloud\n\n✅ HOW TO RECOVER YOUR WALLET:\n1. Open Phantom Wallet\n2. Tap "Add Account" → "Import Private Key"\n3. Paste your Base58 key above\n4. Verify address matches: ${wallet.publicKey}\n5. If address matches ✅ Recovery works!\n\n⚠️ IMPORTANT:\n• This is your ONLY backup\n• If you lose it, your wallet is gone\n• Test your backup recovery now\n• Do not rely on memory\n• Do not take screenshots\n• Store in physically safe location`;

        await ctx.reply(securityMessage);

        await ctx.answerCallbackQuery({ text: '✅ Exported! Test recovery with Phantom.' });
    } catch (error) {
        console.error('Error exporting seed phrase:', error);
        await ctx.answerCallbackQuery({ text: '❌ Failed to export seed phrase' });
        await ctx.reply('❌ Failed to export seed phrase. Please try again.');
    }
};

/**
 * Cancel export
 */
export const exportCancelHandler = async (ctx: Context): Promise<void> => {
    try {
        await ctx.answerCallbackQuery({ text: 'Export cancelled' });
        await ctx.deleteMessage();
    } catch (error) {
        console.error('Error cancelling export:', error);
    }
};
