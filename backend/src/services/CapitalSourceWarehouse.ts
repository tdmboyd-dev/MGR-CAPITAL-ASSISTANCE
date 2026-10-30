import crypto from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { currentActor } from './CaseDocumentAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { governmentSources } from './GovernmentSourceService.js';
import { enrollRecoverySnapshot } from './CapitalRecoveryPipeline.js';
const sha = (bytes: Uint8Array | string) => crypto.createHash('sha256').update(bytes).digest('hex');
function canonical(value: unknown): string {
 if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
 if (value !== null && typeof value === 'object') return '{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>JSON.stringify(key)+':'+canonical(item)).join(',')+'}';
 return JSON.stringify(value);
}
export const sourceRecordHash = (value: unknown) => sha(canonical(value));
const rowSchema = z.object({ sourceRecordId:z.string().trim().min(1).max(200), ownerName:z.string().trim().min(1).max(500), state:z.string().regex(/^[A-Z]{2}$/),county:z.string().min(1).max(100),propertyAddress:z.string().max(2000).optional(),parcelNumber:z.string().max(200).optional(),surplusAmountCents:z.number().int().min(0).max(2147483647).optional(),sourceDate:z.iso.datetime() }).strict();
const normalizedSchema = z.object({format:z.literal('MGR_SOURCE_RECORDS_V1'),records:z.array(rowSchema).max(1000)}).strict();
async function owner(db:Prisma.TransactionClient,actorId:string) {
 const actor=await currentActor(db,actorId);if(actor.role!=='FOUNDER'||actor.tenantId!==null)throw new AppError('Forbidden',403,'Global founder acquisition access required.');return actor;
}
export class CapitalSourceWarehouse {
 constructor(private transport:typeof fetch=fetch){}
 async archive(actorId:string,sourceId:string,bytes:Uint8Array,contentType:string,rightsReference:string,acquiredUrl?:string) {
  const source=governmentSources.find(row=>row.id===sourceId);
  if(!source)throw new AppError('Unknown source',404,'Source is not admitted.');
  if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>2097152||typeof rightsReference!=='string'||rightsReference.trim().length<10||rightsReference.length>2000)throw new AppError('Invalid acquisition',400,'Provide bounded original bytes and the actual source/use reference.');
  if(typeof contentType!=='string'||contentType.length>200)throw new AppError('Invalid content type',400,'Invalid source media type.');
  const actualUrl=acquiredUrl || source.url;const target=new URL(actualUrl),admitted=new URL(source.url);
  const docketTarget=sourceId==='tn-davidson-rendered-docket'&&target.pathname==='/PublicAccess/CaseDetail.aspx'&&/^\?CaseID=\d+$/.test(target.search);
  if(target.origin!==admitted.origin||target.username||target.password||target.hash||(actualUrl!==source.url&&!docketTarget&&!(sourceId==='tn-davidson-excess-register'&&/^\/wp-content\/uploads\/[^/]*[Ee]xcess[^/]*\.pdf$/.test(target.pathname))))throw new AppError('Unadmitted URL',400,'Acquisition URL does not match the source.');
  const hash=sha(bytes);
  return prisma.$transaction(async db=>{
   await owner(db,actorId);
   const snapshot=await db.capitalSourceSnapshot.upsert({where:{sourceId_sha256:{sourceId,sha256:hash}},create:{sourceId,sourceUrl:actualUrl,sha256:hash,acquiredById:actorId,rawBytes:Buffer.from(bytes),byteLength:bytes.length,contentType,rightsReference: rightsReference.trim(),kind:source.kind},update:{}});
   await db.auditLog.create({data:{userId:actorId,action:'SOURCE_SNAPSHOT_ARCHIVED',entityType:'SOURCE_SNAPSHOT',entityId:snapshot.id,details:{sourceId,sha256:hash,bytes:bytes.length,sourceRightsReviewed:false}}});
   return {id:snapshot.id,sourceId,sha256:hash,byteLength:snapshot.byteLength,acquiredAt:snapshot.acquiredAt,sourceRightsReviewed:false,recordsImported:0};
  });
 }
 async capture(actorId:string,sourceId:string) {
  await owner(prisma,actorId);const source=governmentSources.find(row=>row.id===sourceId);if(!source)throw new AppError('Unknown source',404,'Source is not admitted.');
  if(source.kind==='PAID_BULK_FILE'||source.kind==='PAID_REPORT_CATALOG')throw new AppError('Paid acquisition',409,'This source requires owner purchase/terms review before acquisition.');
  if(source.kind==='BROWSER_ASSISTED_PUBLIC_DOCKET')throw new AppError('Browser verification required',409,'Capture the actual rendered case from an owner-verified browser session; do not bypass court access controls.');
  let acquisitionUrl=source.url as string;
  if(sourceId==='tn-davidson-excess-register') {
   const indexUrl='https://chanceryclerkandmaster.nashville.gov/fees/property-tax-schedule/';
   const index=await this.transport(indexUrl,{redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!index.ok||!index.body){await index.body?.cancel();throw new AppError('Index unavailable',503,'Official publication index unavailable.');}
   const reader=index.body.getReader();let text='';let count=0;const decoder=new TextDecoder();try{while(true){const item=await reader.read();if(item.done)break;count+=item.value.length;if(count>2097152)throw new AppError('Oversized index',413,'Publication index limit exceeded.');text+=decoder.decode(item.value,{stream:true});}}finally{await reader.cancel().catch(()=>{});}
   const matches=[...text.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].filter(match=>/Excess\s+Proceeds/i.test(match[2].replace(/<[^>]*>/g,'')));
   if(matches.length!==1)throw new AppError('Publication changed',409,'Official report link changed or is ambiguous. Review the publication index.');
   const next=new URL(matches[0][1].replace(/&amp;/g,'&'),indexUrl);if(next.origin!==new URL(indexUrl).origin||!/^\/wp-content\/uploads\/[^/]*[Ee]xcess[^/]*\.pdf$/.test(next.pathname)||next.search||next.hash)throw new AppError('Unadmitted report link',409,'Official report link requires review.');acquisitionUrl=next.href;
  }
  let response:Response;try{response=await this.transport(acquisitionUrl,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'text/html,application/json,text/plain,application/pdf','User-Agent':'MGR-Capital-Source-Acquisition/1.0'}});}catch{throw new AppError('Source unavailable',503,'Official acquisition was not confirmed.');}
  if(!response.ok||!response.body){await response.body?.cancel();throw new AppError('Source unavailable',503,'Official source is unavailable.');}
  const chunks:Uint8Array[]=[];const reader=response.body.getReader();let size=0;
  try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>2097152)throw new AppError('Oversized source',413,'Source exceeds the bounded acquisition limit.');chunks.push(item.value);}}finally{await reader.cancel().catch(()=>{});}
  return this.archive(actorId,sourceId,Buffer.concat(chunks),response.headers.get('content-type')||'application/octet-stream','Official public acquisition; record extraction and reuse rights require separate review.',acquisitionUrl);
 }
 async normalize(actorId:string,snapshotId:string) {
  return prisma.$transaction(async db=>{
   await owner(db,actorId);await db.$queryRaw`SELECT id FROM "CapitalSourceSnapshot" WHERE id=${snapshotId} FOR UPDATE`;
   const snapshot=await db.capitalSourceSnapshot.findUnique({where:{id:snapshotId}});if(!snapshot)throw new AppError('Not found',404,'Snapshot not found.');
   if(sha(snapshot.rawBytes)!==snapshot.sha256||snapshot.rawBytes.length!==snapshot.byteLength)throw new AppError('Snapshot changed',409,'Source bytes require reconciliation.');
   let parsed: {data: {records: Array<{sourceRecordId:string;sourceDate:string;[key:string]:unknown}>}};
   if(snapshot.sourceId==='tn-davidson-excess-register') {
    const {parseDavidsonSurplusPdf}=await import('./DavidsonSurplusParser.js');const report=await parseDavidsonSurplusPdf(snapshot.rawBytes);parsed={data:{records:report.records}};
    await db.capitalSourceSnapshot.update({where:{id:snapshotId},data:{sourceDate:new Date(report.sourceDate)}});
   } else {
    let raw:unknown;try{raw=JSON.parse(Buffer.from(snapshot.rawBytes).toString('utf8'));}catch{throw new AppError('Adapter required',422,'This source document needs a qualified format-specific adapter. Original bytes remain saved.');}
    const result=normalizedSchema.safeParse(raw);if(!result.success)throw new AppError('Schema changed',422,'Source does not match the admitted normalized-record format. No rows were imported.');parsed=result;
   }
   if(new Set(parsed.data.records.map(row=>row.sourceRecordId)).size!==parsed.data.records.length)throw new AppError('Conflicting rows',409,'Duplicate source record IDs require review.');
   if(parsed.data.records.some(row=>Date.parse(row.sourceDate)>Date.now()+300000))throw new AppError('Invalid source date',400,'Future source dates require review.');
   for(const row of parsed.data.records){
    const hash=sourceRecordHash(row);
    const stored=await db.capitalSourceRecord.upsert({where:{snapshotId_sourceRecordId:{snapshotId,sourceRecordId:row.sourceRecordId}},create:{snapshotId,sourceRecordId:row.sourceRecordId,normalized:row as import('@prisma/client').Prisma.InputJsonValue,sha256:hash},update:{}});
    if(sourceRecordHash(stored.normalized)!==hash || (stored.sha256!==hash && stored.sha256!==sha(JSON.stringify(row))))throw new AppError('Record changed',409,'Normalized source requires reconciliation.');
    // Upgrade only an exact semantic match whose old digest is independently
    // reproduced from the hash-verified original. Normalization and audit remain atomic.
    if(stored.sha256!==hash)await db.capitalSourceRecord.update({where:{id:stored.id},data:{sha256:hash}});
   }
   const recoveryItems=await enrollRecoverySnapshot(db,snapshotId);
   await db.auditLog.create({data:{userId:actorId,action:'SOURCE_ROWS_NORMALIZED',entityType:'SOURCE_SNAPSHOT',entityId:snapshotId,details:{rows:parsed.data.records.length,recoveryItems,format:'MGR_SOURCE_RECORDS_V1',claimantIdentityVerified:false,entitlementVerified:false}}});
   return {snapshotId,recordCount:parsed.data.records.length,recoveryItems,claimantIdentityVerified:false,entitlementVerified:false,casesCreated:0};
  },{timeout:20000,maxWait:5000});
 }
 async list(actorId:string) {await owner(prisma,actorId);return prisma.capitalSourceSnapshot.findMany({select:{id:true,sourceId:true,sourceUrl:true,acquiredAt:true,sourceDate:true,sha256:true,contentType:true,byteLength:true,rightsReference:true,kind:true,_count:{select:{records:true}}},orderBy:{acquiredAt:'desc'},take:100});}
}
export const capitalSourceWarehouse=new CapitalSourceWarehouse();
