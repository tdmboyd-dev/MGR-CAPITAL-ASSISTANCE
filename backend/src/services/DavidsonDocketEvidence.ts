import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { currentActor } from './CaseDocumentAccess.js';
import { CapitalSourceWarehouse } from './CapitalSourceWarehouse.js';
import { AppError } from '../middleware/errorHandler.js';
const eventSchema=z.object({date:z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),description:z.string().min(1).max(5000)}).strict();
const captureSchema=z.object({format:z.literal('MGR_DAVIDSON_RENDERED_DOCKET_V1'),caseNumber:z.string().regex(/^\d{2}-\d{3,5}-[IVX]+$/),sourceUrl:z.string().url(),capturedAt:z.iso.datetime(),visibleText:z.string().min(100).max(500000),events:z.array(eventSchema).min(1).max(3000)}).strict();
const normalized=(text:string)=>text.toUpperCase().replace(/[^A-Z0-9]/g,'');
function calendar(value:string){const [month,day,year]=value.split('/').map(Number);const date=new Date(Date.UTC(year,month-1,day));if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new AppError('Invalid event date',400,'Court event has an invalid calendar date.');return date.toISOString().slice(0,10);}
export function parseDavidsonDocket(input:unknown){
 const parsed=captureSchema.safeParse(input);if(!parsed.success)throw new AppError('Invalid docket',400,'A bounded actual rendered docket and dated rows are required.');const data=parsed.data;
 const url=new URL(data.sourceUrl);if(url.origin!=='https://portal-tnnashville.tylertech.cloud'||url.pathname!=='/PublicAccess/CaseDetail.aspx'||!/^\?CaseID=\d+$/.test(url.search)||url.username||url.password||url.hash)throw new AppError('Wrong court source',400,'Official Davidson case-detail source required.');
 if(!data.visibleText.includes('Case No. '+data.caseNumber)||!data.visibleText.includes('Events & Orders of the Court'))throw new AppError('Case mismatch',409,'Rendered court header and event section must match the supplied case.');
 if(Date.parse(data.capturedAt)>Date.now()+300000||Date.parse(data.capturedAt)<Date.now()-7*86400000)throw new AppError('Stale court capture',409,'Acquire a current court capture; old evidence remains historical.');
 const body=data.visibleText.replace(/\s/g,'');const events=data.events.map(event=>{const date=calendar(event.date);if(!body.includes(event.date+event.description.replace(/\s/g,'')))throw new AppError('Unbound event',409,'A supplied dated event is not present together in the original rendered source.');return {...event,date};});
 return {...data,events};
}
export function davidsonDocketSignals(events:Array<{date:string;description:string}>,parcel:string){
 const target=normalized(parcel);const exact: Array<{date:string;description:string;kind:string}>=[],unscoped:Array<{date:string;description:string}>=[];let otherParcelDisbursements=0;
 for(const event of events){const parcels=[...event.description.matchAll(/Map\s*\/?\s*Parcel:\s*([A-Z0-9-]+)/gi)].map(match=>normalized(match[1]));const relevant=parcels.includes(target);const claim=/claim\s+(?:excess|surplus)\s+proceeds/i.test(event.description),disburse=/order\s+to\s+disburse\s+funds/i.test(event.description);
  if(relevant)exact.push({...event,kind:disburse?'PARCEL_DISBURSEMENT_ORDER_SIGNAL':claim?'PARCEL_CLAIM_MOTION_SIGNAL':'PARCEL_EVENT_REQUIRES_REVIEW'});
  else if(claim&&parcels.length===0)unscoped.push(event);
  if(disburse&&parcels.length>0&&!relevant)otherParcelDisbursements++;
 }
 return {parcelSpecificEvents:exact,unscopedClaimMotions:unscoped,otherParcelDisbursements,claimedVerified:false,paidVerified:false,availabilityVerified:false,interpretation:'A motion is not an award; an order is not payment proof. Other parcels cannot establish this parcel\'s outcome. Unscoped motions need document/claimant/parcel review.'};
}
export async function saveDavidsonDocket(actorId:string,input:unknown){
 const actor=await currentActor(prisma,actorId);if(actor.role!=='FOUNDER'||actor.tenantId!==null)throw new AppError('Forbidden',403,'Global founder court-research access required.');
 const parsed=parseDavidsonDocket(input);const original=Buffer.from(JSON.stringify(input));
 const snapshot=await new CapitalSourceWarehouse().archive(actorId,'tn-davidson-rendered-docket',original,'application/json','Actual rendered public court docket from owner-verified browser session; submitted source is attributed, not cryptographically attested by the court.',parsed.sourceUrl);
 return prisma.$transaction(async db=>{
  const current=await currentActor(db,actorId);if(current.role!=='FOUNDER'||current.tenantId!==null)throw new AppError('Forbidden',403,'Current court-research access required.');
  const items=await db.capitalRecoveryItem.findMany({where:{state:'TN',county:'Davidson',courtCaseNumber:parsed.caseNumber},orderBy:{id:'asc'}});if(!items.length)throw new AppError('No matching work',409,'No imported recovery work matches this court case. Original capture is retained.');
  let added=0;const summaries=[];
  for(const item of items){await db.$queryRaw`SELECT id FROM "CapitalRecoveryItem" WHERE id=${item.id} FOR UPDATE`;const signals=davidsonDocketSignals(parsed.events,item.parcelNumber);const existing=await db.capitalRecoveryDocketCheck.findUnique({where:{itemId_snapshotId:{itemId:item.id,snapshotId:snapshot.id}}});if(!existing){await db.capitalRecoveryDocketCheck.create({data:{itemId:item.id,snapshotId:snapshot.id,acquiredById:actorId,capturedAt:new Date(parsed.capturedAt),method:'OWNER_VERIFIED_BROWSER_SUBMITTED_SOURCE',status:'EVIDENCE_ACQUIRED_REVIEW_REQUIRED',signals:signals as Prisma.InputJsonValue}});await db.capitalRecoveryItem.update({where:{id:item.id},data:{externalClaimStatus:'DOCKET_REVIEW_REQUIRED',version:{increment:1}}});added++;}summaries.push({itemId:item.id,parcelNumber:item.parcelNumber,parcelEvents:signals.parcelSpecificEvents.length,unscopedMotions:signals.unscopedClaimMotions.length,otherParcelDisbursements:signals.otherParcelDisbursements});}
  await db.auditLog.create({data:{userId:actorId,action:'PUBLIC_DOCKET_EVIDENCE_SAVED',entityType:'SOURCE_SNAPSHOT',entityId:snapshot.id,details:{caseNumber:parsed.caseNumber,eventRows:parsed.events.length,added,affectedItems:items.length,claimedVerified:false,paidVerified:false}}});
  return {snapshotId:snapshot.id,sha256:snapshot.sha256,caseNumber:parsed.caseNumber,eventRows:parsed.events.length,added,affectedItems:items.length,summaries,claimedVerified:false,paidVerified:false};
 },{timeout:20000});
}
