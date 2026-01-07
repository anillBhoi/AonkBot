import {
    Keypair, 
    PublicKey, 
    SystemProgram, 
    Transaction,
    sendAndConfirmTransaction
} from '@solana/web3.js'
import bs58 from 'bs58'
import { decrypt } from '../utils/crypto.js'
import { solana } from './solana.client.js'
import { getSolBalance } from './balance.service.js'


const SAFETY_BUFFER_LAMPORTS = 0.002 * 1e9  // rent + fees 

export async function sendSol(
    encryptedPrivateKey: string, 
    toAddress: string, 
    amountSol: number
) {
    const secret = decrypt(encryptedPrivateKey)
    const keypair = Keypair.fromSecretKey(bs58.decode(secret))

    const sender = keypair.publicKey
    const receiver = new PublicKey(toAddress)

    const lamports = Math.floor(amountSol * 1e9)

    // balance check
    const balance = await getSolBalance(sender.toBase58())
    if(balance * 1e9 < lamports + SAFETY_BUFFER_LAMPORTS){
        throw new Error('Insufficient balance (fees + rent protected)')
    }

    // build transaction 
    const tx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: sender, 
            toPubkey: receiver,
            lamports
        })
    )


    // simulate (critical)
    const simulation = await solana.simulateTransaction(tx, [keypair])
    if(simulation.value.err){
        throw new Error('Transaction simulation failed')
    }

    // send + confirm 
    const sig = await sendAndConfirmTransaction(
        solana, 
        tx, 
        [keypair],
        { commitment: 'confirmed'}
    )
    
    return sig

}