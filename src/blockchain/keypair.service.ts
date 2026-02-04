import { Keypair } from "@solana/web3.js";

export function keypairFromPrivateKey(privateKey: Uint8Array) {
  return Keypair.fromSecretKey(privateKey);
}
