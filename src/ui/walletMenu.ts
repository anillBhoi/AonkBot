// // import { InlineKeyboard } from 'grammy'

// // export const walletMenu = new InlineKeyboard()
// //   .text('View on Solscan', 'cmd:txs')
// //   .text('Close', 'close')
// //   .row()
// //   .text('Deposit SOL', 'cmd:deposit')
// //   .text('Buy SOL', 'cmd:buysol')
// //   .row()
// //   .text('Withdraw all SOL', 'cmd:withdraw')
// //   .text('Withdraw X SOL', 'cmd:withdraw')
// //   .row()
// //   .text('Manage Wallets', 'cmd:managewallets')
// //   .text('Manage Tokens', 'cmd:managetkn')
// //   .row()
// //   .text('Reset All Wallets', 'cmd:resetwallets')
// //   .text('Export Seed Phrase', 'cmd:exportphrase')
// //   .row()
// //   .text('Refresh', 'cmd:wallet')


// import { InlineKeyboard } from 'grammy'

// /**
//  * Build the wallet menu keyboard.
//  *
//  * The Refresh button uses 'wallet:refresh' — a dedicated callback that
//  * edits the existing message in-place (BonkBot style) instead of
//  * posting a new one.
//  */
// export function buildWalletKeyboard(): InlineKeyboard {
//   return new InlineKeyboard()
//     .text('View on Solscan', 'wallet:solscan')
//     .text('Close', 'close')
//     .row()
//     .text('Deposit SOL', 'cmd:deposit')
//     .text('Buy SOL', 'cmd:buysol')
//     .row()
//     .text('Withdraw all SOL', 'cmd:withdrawall')
//     .text('Withdraw X SOL', 'cmd:withdrawx')
//     .row()
//     .text('Manage Wallets', 'cmd:managewallets')
//     .text('Manage Tokens', 'cmd:managetkn')
//     .row()
//     .text('Reset All Wallets', 'cmd:resetwallets')
//     .text('Export Seed Phrase', 'cmd:exportphrase')
//     .row()
//     .text('🔄 Refresh', 'wallet:refresh')
// }

// // Keep a static instance for the initial /wallet reply
// // (the refresh handler rebuilds it dynamically each time)
// export const walletMenu = buildWalletKeyboard()



import { InlineKeyboard } from 'grammy'
import { config } from '../utils/config.js'

/**
 * Build the wallet menu keyboard.
 *
 * @param publicKey  The wallet's public key — used to build the live
 *                   Solscan URL so the button opens the browser directly
 *                   instead of showing an alert popup.
 *
 * The Refresh button uses 'wallet:refresh' — a dedicated callback that
 * edits the existing message in-place (BonkBot style) instead of
 * posting a new one.
 */
export function buildWalletKeyboard(publicKey: string): InlineKeyboard {
  const cluster = config.solanaCluster === 'devnet' ? 'devnet' : 'mainnet-beta'

  // Use the correct explorer depending on cluster
  const solscanUrl =
    cluster === 'mainnet-beta'
      ? `https://solscan.io/account/${publicKey}`
      : `https://explorer.solana.com/address/${publicKey}?cluster=devnet`

  return new InlineKeyboard()
    // ✅ .url() opens the browser directly — no popup
    .url('View on Solscan', solscanUrl)
    .text('Close', 'close')
    .row()
    .text('Deposit SOL', 'cmd:deposit')
    .text('Buy SOL', 'cmd:buysol')
    .row()
    .text('Withdraw all SOL', 'cmd:withdrawall')
    .text('Withdraw X SOL', 'cmd:withdrawx')
    .row()
    .text('Manage Wallets', 'cmd:managewallets')
    .text('Manage Tokens', 'cmd:managetkn')
    .row()
    .text('Reset All Wallets', 'cmd:resetwallets')
    .text('Export Seed Phrase', 'cmd:exportphrase')
    .row()
    .text('🔄 Refresh', 'wallet:refresh')
}