import {z} from 'zod';
import prisma from '../lib/prisma.js';
import {currentActor} from './CaseDocumentAccess.js';
import {AppError} from '../middleware/errorHandler.js';
import type {Prisma} from '@prisma/client';
const text=(max:number)=>z.string().trim().min(1).max(max).refine(value=>!/[\x00-\x1f\x7f]/.test(value));
const states='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ');
const address={addressLine1:text(150),addressLine2:z.string().trim().max(150).default(''),city:text(80),state:z.string().refine(value=>states.includes(value)),postalCode:z.string().regex(/^\d{5}(?:-\d{4})?$/),phone:z.string().regex(/^\+1\d{10}$/),email:z.email().max(254)};
export const personProfileSchema=z.object({legalFirstName:text(80),legalLastName:text(80),...address,attestAccurate:z.literal(true)}).strict();
export const businessProfileSchema=z.object({legalBusinessName:text(160),dba:z.string().trim().max(160).default(''),...address,attestAccurate:z.literal(true)}).strict();
export async function businessContext(db:Prisma.TransactionClient,actorId:string,businessRef:string,write=false){
 const actor=await currentActor(db,actorId);
 if(businessRef==='MGR_ROOT'){if(actor.role!=='FOUNDER'||actor.tenantId!==null)throw new AppError('Forbidden',403,'MGR parent organization access required.');return {businessRef,tenantId:null,displayName:'MGR Capital',canEdit:true};}
 if(!businessRef.startsWith('TENANT:'))throw new AppError('Invalid organization',400,'Select an existing organization.');const tenantId=businessRef.slice(7);const tenant=await db.tenant.findUnique({where:{id:tenantId}});if(!tenant?.isActive)throw new AppError('Not found',404,'Organization unavailable.');
 const companies=await db.childCompany.findMany({where:{tenantId},take:2});if(companies.length>1)throw new AppError('Ambiguous affiliation',409,'Company workspace affiliation requires review.');const company=companies[0];
 if(company&&!['ACTIVE','ACTIVATING','OFFER_ACCEPTED'].includes(company.status))throw new AppError('Organization unavailable',409,'This company is not active for source operations.');
 const global=actor.role==='FOUNDER'&&actor.tenantId===null;const owns=company?.ownerId===actorId;const same=actor.tenantId===tenantId;const parentControls=company?.founderId===actorId&&actor.role==='FOUNDER'&&tenant.SUBparentTenantId===actor.tenantId;
 if(!global&&!owns&&!same&&!parentControls)throw new AppError('Not found',404,'Organization unavailable.');const canEdit=global||owns||parentControls||(same&&['FOUNDER','ADMIN'].includes(actor.role));if(write&&!canEdit)throw new AppError('Forbidden',403,'Organization profile management access required.');
 return {businessRef,tenantId,displayName:company?.companyName||tenant.name,canEdit};
}
export async function identityContext(actorId:string){const actor=await currentActor(prisma,actorId);const refs=new Set<string>();if(actor.role==='FOUNDER'&&actor.tenantId===null)refs.add('MGR_ROOT');if(actor.tenantId)refs.add('TENANT:'+actor.tenantId);for(const company of await prisma.childCompany.findMany({where:{ownerId:actorId,status:{in:['ACTIVE','ACTIVATING','OFFER_ACCEPTED']}},select:{tenantId:true},take:100})){if(company.tenantId)refs.add('TENANT:'+company.tenantId);}
 const businesses=[];for(const ref of refs)businesses.push(await businessContext(prisma,actorId,ref));return {actor:{id:actor.id,role:actor.role,tenantId:actor.tenantId},personProfile:await prisma.capitalIdentityProfile.findUnique({where:{subjectKind_subjectId:{subjectKind:'PERSON',subjectId:actorId}}}),businesses,identityIndependentlyVerified:false};}
export async function readBusinessProfile(actorId:string,ref:string){const business=await businessContext(prisma,actorId,ref);return {business,profile:await prisma.capitalIdentityProfile.findUnique({where:{subjectKind_subjectId:{subjectKind:'BUSINESS',subjectId:ref}}}),identityIndependentlyVerified:false};}
export async function saveIdentityProfile(actorId:string,kind:'PERSON'|'BUSINESS',subjectId:string,input:unknown){
 const envelope=z.object({version:z.number().int().min(0),details:z.unknown()}).strict().safeParse(input);if(!envelope.success)throw new AppError('Invalid profile',400,'Current version and complete profile required.');const parsed=(kind==='PERSON'?personProfileSchema:businessProfileSchema).safeParse(envelope.data.details);if(!parsed.success)throw new AppError('Incomplete profile',400,'Enter complete legal contact information, a US phone in +1 format, and confirm its accuracy.');
 return prisma.$transaction(async db=>{await currentActor(db,actorId);if(kind==='PERSON'&&subjectId!==actorId)throw new AppError('Forbidden',403,'You can attest only your own personal profile.');const business=kind==='BUSINESS'?await businessContext(db,actorId,subjectId,true):null;
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${kind+':'+subjectId},0))::text`;const existing=await db.capitalIdentityProfile.findUnique({where:{subjectKind_subjectId:{subjectKind:kind,subjectId}}});if((existing?.version||0)!==envelope.data.version)throw new AppError('Profile changed',409,'Reopen the saved profile before editing.');
  const data={details:parsed.data as Prisma.InputJsonValue,attestedById:actorId,attestedAt:new Date(),verificationStatus:'SELF_ATTESTED'};const profile=existing?await db.capitalIdentityProfile.update({where:{id:existing.id},data:{...data,version:{increment:1}}}):await db.capitalIdentityProfile.create({data:{subjectKind:kind,subjectId,...data}});
  await db.auditLog.create({data:{userId:actorId,tenantId:business?.tenantId,action:'IDENTITY_PROFILE_ATTESTED',entityType:'IDENTITY_PROFILE',entityId:profile.id,details:{subjectKind:kind,subjectId,version:profile.version,identityIndependentlyVerified:false}}});return profile;
 });
}
