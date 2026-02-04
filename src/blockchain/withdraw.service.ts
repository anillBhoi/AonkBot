import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import { getOrCreateWallet, loadWalletSigner } from "./wallet.service.js";
import { getSolBalance } from "./balance.service.js";
import { config } from "../utils/config.js";

export async function withdrawSol(
  userId: number,
  destination: string,
  amount: number
) {

  const connection = new Connection( config.solanaRpc);

  const wallet = await getOrCreateWallet(userId);
  const signer = await loadWalletSigner(userId);

  /* ===== Validate Destination ===== */
  let destinationKey: PublicKey;

  try {
    destinationKey = new PublicKey(destination);
  } catch {
    throw new Error("Invalid wallet address");
  }

  /* ===== Withdraw Amount ===== */
  let withdrawAmount = amount;

  if (amount === -1) {
    const balance = await getSolBalance(wallet.publicKey);
    withdrawAmount = balance - 0.00001;
  }

  if (withdrawAmount <= 0) {
    throw new Error("Insufficient balance");
  }

  const lamports =
    Math.floor(withdrawAmount * LAMPORTS_PER_SOL);

  /* ===== Build TX ===== */
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: destinationKey,
      lamports
    })
  );

  tx.feePayer = signer.publicKey;

  /* ===== Add Blockhash ===== */
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  /* ===== Send TX ===== */
  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [signer]
  );

  return signature;
}
