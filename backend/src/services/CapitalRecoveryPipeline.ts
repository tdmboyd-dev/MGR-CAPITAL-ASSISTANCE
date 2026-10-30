import crypto from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { currentActor } from './CaseDocumentAccess.js';
import { AppError } from '../middleware/errorHandler.js';
const normalize=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,'');
const fact=z.object({state:z.literal('TN'),county:z.literal('Davidson'),courtCaseNumber:z.string().min(1),parcelNumber:z.string().min(1),ownerName:z.string().min(1),surplusAmountCents:z.number().int().min(0),sourceDate:z.iso.datetime(),pendingProceedingFootnote:z.boolean()});
const edit=z.object({version:z.number().int().positive(),stage:z.enum(['RESEARCH_REQUIRED','RESEARCHING','ON_HOLD','READY_FOR_CLIENT','CLOSED']),notes:z.string().max(10000)}).strict();
async function owner(db:Prisma.TransactionClient,actorId:string){const actor=await currentActor(db,actorId);if(actor.role!=='FOUNDER'||actor.tenantId!==null)throw new AppError('Forbidden',403,'Global founder recovery access required.');return actor;}

/** Called inside the same transaction as original-record validation and audit. */
export async function enrollRecoverySnapshot(db:Prisma.TransactionClient,snapshotId:string){
 const snapshot=await db.capitalSourceSnapshot.findUniqueOrThrow({where:{id:snapshotId}});
 if(snapshot.sourceId!=='tn-davidson-excess-register')return 0;
 const rows=await db.capitalSourceRecord.findMany({where:{snapshotId},orderBy:{sourceRecordId:'asc'}});
 for(const row of rows){
  const data=fact.parse(row.normalized);
  const businessKey=crypto.createHash('sha256').update(JSON.stringify(['TN','DAVIDSON','TAX_SALE_SURPLUS',normalize(data.courtCaseNumber),normalize(data.parcelNumber)])).digest('hex');
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${businessKey}, 0))::text`;
  const existing=await db.capitalRecoveryItem.findUnique({where:{businessKey}});
  const values={state:data.state,county:data.county,recoveryType:'TAX_SALE_SURPLUS',courtCaseNumber:data.courtCaseNumber,parcelNumber:data.parcelNumber,reportedOwner:data.ownerName,reportedAmountCents:data.surplusAmountCents,sourceDate:new Date(data.sourceDate),latestRecordId:row.id};
  const item=existing || await db.capitalRecoveryItem.create({data:{businessKey,...values}});
  const newObservation=!(await db.capitalRecoveryObservation.findUnique({where:{recordId:row.id}}));
  await db.capitalRecoveryObservation.upsert({where:{recordId:row.id},create:{itemId:item.id,recordId:row.id},update:{}});
  // A later report is new evidence, never proof of availability or an invitation
  // to clear a founder's work. Older reports cannot overwrite newer balances.
  if(existing&&newObservation&&values.sourceDate>=existing.sourceDate)await db.capitalRecoveryItem.update({where:{id:item.id},data:{...values,version:{increment:1}}});
 }
 return rows.length;
}
export class CapitalRecoveryPipeline {
 async list(actorId:string,page=1){await owner(prisma,actorId);if(!Number.isSafeInteger(page)||page<1||page>100000)throw new AppError('Invalid page',400,'Invalid recovery page.');const [items,total]=await prisma.$transaction([prisma.capitalRecoveryItem.findMany({orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*50,take:50,include:{_count:{select:{observations:true}}}}),prisma.capitalRecoveryItem.count()]);return {items,total,page};}
 async detail(actorId:string,id:string){
  await owner(prisma,actorId);const item=await prisma.capitalRecoveryItem.findUnique({where:{id},include:{observations:{include:{record:{select:{snapshotId:true,normalized:true,sha256:true}}},orderBy:{createdAt:'desc'},take:100},docketChecks:{select:{id:true,capturedAt:true,status:true,method:true,signals:true,snapshot:{select:{sourceUrl:true,sha256:true}}},orderBy:{capturedAt:'desc'},take:5}}});
  if(!item)throw new AppError('Not found',404,'Recovery work item not found.');
  // Exact normalized parcel match is a candidate inside our system, not proof
  // that a court paid a claimant. Limit and coverage are explicit.
  const candidates=await prisma.$queryRaw<Array<{id:string;internalCode:string;parcelNumber:string|null;courtCaseNumber:string|null;status:string;filedAt:Date|null;fundsReceivedAt:Date|null}>>`SELECT id,"internalCode","parcelNumber","courtCaseNumber",status,"filedAt","fundsReceivedAt" FROM "Case" WHERE upper(state)=${item.state.toUpperCase()} AND upper(county)=${item.county.toUpperCase()} AND regexp_replace(upper(coalesce("parcelNumber",'')), '[^A-Z0-9]', '', 'g')=${normalize(item.parcelNumber)} ORDER BY id LIMIT 201`;
  const matches=candidates.slice(0,200);
  return {item,internalCaseCandidates:matches,internalSearchComplete:candidates.length<=200,externalClaimStatus:item.externalClaimStatus,externalCheckVerified:false,availabilityVerified:false,missingFromLaterReportMeansClaimed:false,nextChecks:['Read current court docket and any excess-proceeds motion/order','Confirm current clerk-held balance and competing claims','Trace ownership at the legally relevant date; assess heirs/liens','Obtain claimant authority before creating a customer engagement'],warning:'A record in our database is not proof of entitlement. A listed balance, pending footnote, missing later row, or matching internal case does not establish whether someone else already claimed the funds.'};
 }
 async update(actorId:string,id:string,input:unknown){const parsed=edit.safeParse(input);if(!parsed.success)throw new AppError('Invalid work update',400,'Valid stage, notes and current version required.');return prisma.$transaction(async db=>{await owner(db,actorId);const changed=await db.capitalRecoveryItem.updateMany({where:{id,version:parsed.data.version},data:{stage:parsed.data.stage,notes:parsed.data.notes,version:{increment:1}}});if(changed.count!==1)throw new AppError('Work changed',409,'Reopen this work item before saving; another update or source version changed it.');await db.auditLog.create({data:{userId:actorId,action:'RECOVERY_WORK_UPDATED',entityType:'RECOVERY_ITEM',entityId:id,details:{stage:parsed.data.stage,externalClaimVerified:false}}});return db.capitalRecoveryItem.findUniqueOrThrow({where:{id}});});}
}
export const capitalRecoveryPipeline=new CapitalRecoveryPipeline();
