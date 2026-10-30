/** Unqualified legacy NFT lane. A token is not evidence of surplus entitlement. */
import { AppError } from '../middleware/errorHandler.js';
const reason='Claim tokenization is unavailable: custody, entitlement, authorized recipient, metadata storage and verified chain receipts have not been qualified. No mint, transfer or burn was performed.';
export class NFTService {
 async mintClaimNFT(_data:{claimId:string;amount:number;state:string;propertyId:string;ownerAddress:string;clientName:string}):Promise<{success:boolean;mintAddress?:string;metadataUri?:string;error?:string}>{return {success:false,error:reason};}
 async transferNFT(_mintAddress:string,_fromAddress:string,_toAddress:string):Promise<{success:boolean;txId?:string;error?:string}>{return {success:false,error:reason};}
 async burnNFT(_mintAddress:string):Promise<{success:boolean;error?:string}>{return {success:false,error:reason};}
 async getNFTDetails(_mintAddress:string):Promise<never>{throw new AppError('NFT unavailable',503,reason);}
 async listMintedNFTs(_limit=50):Promise<never>{throw new AppError('NFT unavailable',503,reason);}
}
export const nftService=new NFTService();
