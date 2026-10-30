import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda, getCreateMintInstructionPlan, getCreateAssociatedTokenIdempotentInstruction, getMintToCheckedInstruction, getMintDecoder, getTokenDecoder } from '@solana-program/token';
export async function createMint(connection:Connection,payer:Keypair,mintAuthority:PublicKey,freezeAuthority:PublicKey,decimals:number) {
 if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw new Error('Invalid token decimals');
 const mint=await Keypair.generate();const plan=await getCreateMintInstructionPlan(connection,{payer,newMint:mint,decimals,mintAuthority,freezeAuthority});
 await sendAndConfirmTransaction(connection,new Transaction().add(plan),[payer,mint]);return mint.publicKey;
}
export async function associatedTokenAddress(mint:PublicKey,owner:PublicKey) {const [address]=await findAssociatedTokenPda({mint,owner,tokenProgram:TOKEN_PROGRAM_ADDRESS});return new PublicKey(address);}
export async function getOrCreateAssociatedTokenAccount(connection:Connection,payer:Keypair,mint:PublicKey,owner:PublicKey) {
 const address=await associatedTokenAddress(mint,owner);const instruction=getCreateAssociatedTokenIdempotentInstruction({payer,ata:address,owner,mint});
 await sendAndConfirmTransaction(connection,new Transaction().add(instruction),[payer]);return {address};
}
export async function getAccount(connection:Connection,address:PublicKey) {const info=await connection.getAccountInfo(address);if(!info||info.owner.toBase58()!==TOKEN_PROGRAM_ADDRESS)throw new Error('Token account not found');return getTokenDecoder().decode(info.data);}
export async function mintTo(connection:Connection,payer:Keypair,mint:PublicKey,token:PublicKey,mintAuthority:Keypair,amount:bigint|number) {
 if(typeof amount==='number'&&(!Number.isSafeInteger(amount)||amount<0)||typeof amount==='bigint'&&amount<0n)throw new Error('Invalid token amount');
 const info=await connection.getAccountInfo(mint);if(!info||info.owner.toBase58()!==TOKEN_PROGRAM_ADDRESS)throw new Error('Mint not found');const decoded=getMintDecoder().decode(info.data);
 const ix=getMintToCheckedInstruction({mint,token,mintAuthority,amount,decimals:decoded.decimals});return sendAndConfirmTransaction(connection,new Transaction().add(ix),payer.address===mintAuthority.address?[payer]:[payer,mintAuthority]);
}
