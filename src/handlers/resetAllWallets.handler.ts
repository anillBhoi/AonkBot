import { Context, InlineKeyboard } from 'grammy';
import { getSelectedWallet, getAllWallets, resetAllWalletsInDb } from '../blockchain/wallet.service.js';
import { getSolBalance, getTokenBalances } from '../blockchain/balance.service.js';

export const resetAllWalletsHandler = async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
        const wallets = await getAllWallets(userId);
        if (!wallets || wallets.length === 0) {
            await ctx.reply('❌ No wallets found to reset.');
            return;
        }

        const selectedWallet = await getSelectedWallet(userId);
        if (!selectedWallet) {
            await ctx.reply('❌ No wallet selected.');
            return;
        }

        // Fetch actual SOL balance
        let solBalance = 0;
        try {
            solBalance = await getSolBalance(selectedWallet.publicKey);
        } catch (err) {
            console.log('Could not fetch SOL balance during reset check');
        }

        // Fetch actual token balances
        let tokenCount = 0;
        try {
            const tokenBalances = await getTokenBalances(selectedWallet.publicKey);
            tokenCount = tokenBalances.length;
        } catch (err) {
            console.log('Could not fetch token balances during reset check');
        }

        // If wallet has SOL or tokens, show stronger warning
        const hasAssets = solBalance > 0 || tokenCount > 0;
        const assetWarning = hasAssets 
            ? `\n\n🚨 *WARNING: You have assets in this wallet!*\nSOL: ${solBalance.toFixed(6)}\nTokens: ${tokenCount}\n\n`
            : '';

        // Create confirmation keyboard - matching BonkBot style
        const confirmKeyboard = new InlineKeyboard()
            .text('Cancel', 'reset:cancel')
            .text('Confirm', 'reset:confirm');

        // Main confirmation message - matches BonkBot structure
        const warningMessage = `🔄 Are you sure you want to reset your AonkBot Wallet?\n\nAonkBot will discard your current wallet and generate a new one.\n\nYour wallet:\n- ${solBalance.toFixed(9)} SOL\n- ${tokenCount} token(s) (~$N/A total value)\n- 0 open Limit and/or DCA order(s) (cancelled upon reset)\n\nIf you don't back up your seed phrase, all assets will be permanently lost.`;

        await ctx.reply(warningMessage, {
            reply_markup: confirmKeyboard,
        });

        // Send recommendation message separately - matching BonkBot style
        const recommendationKeyboard = new InlineKeyboard()
            .text('RECOMMENDED: Export Seed Phrase', 'cmd:wallet');

        await ctx.reply('RECOMMENDED: Export Seed Phrase', {
            reply_markup: recommendationKeyboard,
        });
    } catch (error) {
        console.error('Error initiating wallet reset:', error);
        await ctx.reply('❌ Failed to initiate reset. Please try again.');
    }
};

export const resetConfirmHandler = async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
        await resetAllWalletsInDb(userId);
        await ctx.answerCallbackQuery({ text: '✅ All wallets have been reset successfully!' });
        
        // Send success message matching BonkBot style
        await ctx.reply('✅ All wallets have been reset successfully!');
        
        // Send wallet generated message
        await ctx.reply('Your new wallet has been generated.');
    } catch (error) {
        console.error('Error resetting wallets:', error);
        await ctx.answerCallbackQuery({ text: '❌ Failed to reset wallets' });
        await ctx.reply('❌ Failed to reset wallets. Please try again later.');
    }
};

export const resetCancelHandler = async (ctx: Context): Promise<void> => {
    try {
        await ctx.answerCallbackQuery({ text: 'Reset cancelled' });
        await ctx.deleteMessage();
    } catch (error) {
        console.error('Error cancelling reset:', error);
    }
};
