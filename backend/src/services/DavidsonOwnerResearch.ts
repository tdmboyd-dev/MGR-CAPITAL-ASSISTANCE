import crypto from 'node:crypto';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { currentActor } from './CaseDocumentAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { capitalSourceWarehouse } from './CapitalSourceWarehouse.js';
const endpoint='https://maps.nashville.gov/arcgis/rest/services/Cadastral/Parcels/MapServer/0/query';
const savedRow=z.object({parcelNumber:z.string().regex(/^[A-Z0-9]{8,20}$/),ownerName:z.string().min(1)});
const attributes=z.object({STANPAR:z.string().nullable().optional(),APN:z.string().nullable().optional(),Owner:z.string().max(500).nullable(),OwnAddr1:z.string().max(2000).nullable().optional(),OwnAddr2:z.string().max(2000).nullable().optional(),OwnCity:z.string().max(200).nullable().optional(),OwnState:z.string().max(10).nullable().optional(),OwnZip:z.string().max(30).nullable().optional(),PropAddr:z.string().max(2000).nullable().optional(),OwnDate:z.number().nullable().optional()});
export async function researchDavidsonOwner(actorId:string,recordId:string,transport:typeof fetch=fetch) {
 const actor=await currentActor(prisma,actorId);if(actor.role!=='FOUNDER'||actor.tenantId!==null)throw new AppError('Forbidden',403,'Global founder research access required.');
 const record=await prisma.capitalSourceRecord.findUnique({where:{id:recordId},include:{snapshot:{select:{sourceId:true}}}});
 if(!record||record.snapshot.sourceId!=='tn-davidson-excess-register')throw new AppError('Not found',404,'Davidson surplus record not found.');
 const input=savedRow.parse(record.normalized);const query=new URLSearchParams({f:'json',where:`STANPAR='${input.parcelNumber}' OR APN='${input.parcelNumber}'`,outFields:'STANPAR,APN,Owner,OwnAddr1,OwnAddr2,OwnCity,OwnState,OwnZip,PropAddr,OwnDate',returnGeometry:'false',resultRecordCount:'5'});const sourceUrl=endpoint+'?'+query;
 let response:Response;try{response=await transport(sourceUrl,{redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new AppError('Source unavailable',503,'Official parcel lookup was not confirmed.');}
 if(!response.ok||!response.body){await response.body?.cancel();throw new AppError('Source unavailable',503,'Official parcel source unavailable.');}
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>262144)throw new AppError('Oversized response',413,'Parcel response limit exceeded.');chunks.push(item.value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=Buffer.concat(chunks);const payload=z.object({features:z.array(z.object({attributes})).max(5),exceededTransferLimit:z.boolean().optional()}).safeParse(JSON.parse(bytes.toString('utf8')));if(!payload.success||payload.data.exceededTransferLimit)throw new AppError('Changed source',503,'Official parcel schema or result limit requires review.');
 const normalize=(value:string)=>value.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g,'');
 const candidates=payload.data.features.map(row=>{const a=row.attributes;if(a.STANPAR!==input.parcelNumber&&a.APN!==input.parcelNumber)throw new AppError('Target mismatch',503,'Parcel returned a different target.');return {currentAssessorOwner:a.Owner,mailingAddress:{street:a.OwnAddr1,line2:a.OwnAddr2,city:a.OwnCity,state:a.OwnState,zip:a.OwnZip},propertyAddress:a.PropAddr,ownerInstrumentDate:a.OwnDate===null||a.OwnDate===undefined?null:new Date(a.OwnDate).toISOString(),comparison:normalize(a.Owner||'')===normalize(input.ownerName)?'EXACT_NORMALIZED_NAME_CANDIDATE':'CURRENT_OWNER_DIFFERS_OR_UNRESOLVED',claimantIdentityVerified:false,contactPermissionVerified:false};});
 const envelope={sourceUrl,retrievedAt:new Date().toISOString(),responseSha256:crypto.createHash('sha256').update(bytes).digest('hex'),responseBase64:bytes.toString('base64'),targetParcel:input.parcelNumber,surplusRecordId:recordId};
 const snapshot=await capitalSourceWarehouse.archive(actorId,'tn-davidson-parcel-query',Buffer.from(JSON.stringify(envelope)),'application/json','Official Metro Nashville public parcel response; current owner may be the auction purchaser; no contact permission inferred.');
 return {recordId,snapshotId:snapshot.id,sourceUrl,retrievedAt:envelope.retrievedAt,responseSha256:envelope.responseSha256,reportedTaxpayer:input.ownerName,candidates,claimantIdentityVerified:false,contactPermissionVerified:false,warning:'Current assessor ownership can belong to the auction buyer. Research ownership and mailing history at the sale date before selecting the claimant.'};
}
