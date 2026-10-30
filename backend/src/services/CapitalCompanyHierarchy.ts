import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { currentActor } from './CaseDocumentAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Prisma } from '@prisma/client';
import { EMAIL_PRICING } from '../config/emailPricing.js';
const companyInput=z.object({companyName:z.string().trim().min(3).max(120),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60),plan:z.enum(['BRANDED','WHITE_LABEL']),emailDomainType:z.enum(['SUBDOMAIN','CUSTOM']),customDomain:z.string().regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i).optional(),logoUrl:z.url().optional(),primaryColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),secondaryColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),accentColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional()}).strict().refine(input=>input.emailDomainType!=='CUSTOM'||Boolean(input.customDomain),'Custom domain required');
export async function acceptChildCompanyOffer(actorId:string,offerId:string,input:unknown){
 const parsed=companyInput.safeParse(input);if(!parsed.success)throw new AppError('Invalid company',400,'Valid company name, slug, plan and email-domain choice required.');const data=parsed.data;
 return prisma.$transaction(async db=>{
  await db.$queryRaw`SELECT id FROM "User" WHERE id=${actorId} FOR UPDATE`;
  const actor=await currentActor(db,actorId);if(actor.role!=='EMPLOYEE')throw new AppError('Forbidden',403,'Employee offer access required.');
  await db.$queryRaw`SELECT id FROM "ChildCompanyOffer" WHERE id=${offerId} FOR UPDATE`;
  const offer=await db.childCompanyOffer.findUnique({where:{id:offerId}});if(!offer||offer.employeeId!==actorId)throw new AppError('Offer unavailable',404,'Offer not found.');
  if(offer.isAccepted&&offer.childCompanyId){const saved=await db.childCompany.findUniqueOrThrow({where:{id:offer.childCompanyId}});if(saved.companyName!==data.companyName||saved.slug!==data.slug||saved.plan!==data.plan||saved.emailDomainType!==data.emailDomainType)throw new AppError('Offer input changed',409,'This accepted offer has different saved company details.');if(!saved.tenantId)throw new AppError('Workspace missing',409,'This older company needs an explicit workspace repair.');return {success:true,childCompanyId:saved.id,repeated:true};}
  if(offer.isDeclined)throw new AppError('Offer declined',409,'This offer was declined.');
  const employee=await db.user.findUniqueOrThrow({where:{id:actorId},include:{teamMembers:{where:{isActive:true,tenantId:actor.tenantId},select:{id:true}}}});
  if(!['TIER_3_SENIOR_SPECIALIST','TIER_4_TEAM_LEADER','TIER_5_EXECUTIVE_PARTNER'].includes(employee.employeeTier||'')||employee.teamMembers.length<3)throw new AppError('Eligibility changed',409,'Current tier and three active team members in the same organization are required.');
  const existing=await db.childCompany.findFirst({where:{ownerId:actorId,status:{in:['ACTIVE','ACTIVATING','OFFER_ACCEPTED']}}});if(existing)throw new AppError('Company exists',409,'An active or pending company already belongs to this account.');
  const founders=await db.user.findMany({where:{role:'FOUNDER',tenantId:actor.tenantId,isActive:true},select:{id:true},take:2});if(founders.length!==1)throw new AppError('Hierarchy review required',409,'The parent organization must identify one active founder before accepting this offer.');
  if(await db.childCompany.findUnique({where:{slug:data.slug}}))throw new AppError('Slug used',409,'Company slug already taken.');
  const tenant=await db.tenant.create({data:{name:`${data.companyName} [${data.slug}]`,slug:'child-'+data.slug,SUBparentTenantId:actor.tenantId,settings:{childCompanyWorkspace:true}}});
  const custom=data.emailDomainType==='CUSTOM';
  const company=await db.childCompany.create({data:{founderId:founders[0].id,ownerId:actorId,tenantId:tenant.id,companyName:data.companyName,slug:data.slug,status:'OFFER_ACCEPTED',plan:data.plan,subdomain:data.slug+'.capitalmgr.com',customDomain:custom?data.customDomain:null,logoUrl:data.logoUrl,primaryColor:data.primaryColor||'#1a365d',secondaryColor:data.secondaryColor||'#2d3748',accentColor:data.accentColor||'#3182ce',annualFeeCents:custom?60000:30000,activationDeadline:new Date(Date.now()+30*86400000),emailDomainType:data.emailDomainType,emailSetupFeeCents:custom?EMAIL_PRICING.childCustom.setupFeeCents:EMAIL_PRICING.childSubdomain.setupFeeCents,emailMonthlyFeeCents:custom?EMAIL_PRICING.childCustom.monthlyFeeCents:EMAIL_PRICING.childSubdomain.monthlyFeeCents,employeeEmailSetupCents:1200,employeeEmailMonthlyCents:600}});
  await db.childCompanyOffer.update({where:{id:offer.id},data:{isAccepted:true,acceptedAt:new Date(),childCompanyId:company.id,selectedPlan:data.plan}});
  await db.auditLog.create({data:{userId:actorId,tenantId:actor.tenantId,action:'CHILD_COMPANY_WORKSPACE_CREATED',entityType:'CHILD_COMPANY',entityId:company.id,details:{workspaceId:tenant.id,parentWorkspaceId:actor.tenantId,feesCharged:false,legalIdentityVerified:false}}});
  return {success:true,childCompanyId:company.id,repeated:false};
 });
}
async function transferAuthority(db:Prisma.TransactionClient,actorId:string,employeeId:string,toCompanyId:string){
 const actor=await currentActor(db,actorId);if(!['FOUNDER','ADMIN'].includes(actor.role))throw new AppError('Forbidden',403,'Transfer management access required.');
 const employee=await db.user.findUnique({where:{id:employeeId},include:{tenant:true}});const company=await db.childCompany.findUnique({where:{id:toCompanyId}});
 if(!employee?.isActive||!['EMPLOYEE','TEAM_LEAD'].includes(employee.role)||employee.tenant?.isActive===false||!company||company.status!=='ACTIVE'||!company.tenantId)throw new AppError('Transfer unavailable',409,'Active employee and active provisioned destination company required.');
 const target=await db.tenant.findUnique({where:{id:company.tenantId}});const companyOwner=await db.user.findUnique({where:{id:company.ownerId},select:{isActive:true}});
 if(!target?.isActive||!companyOwner?.isActive||employee.id===company.ownerId)throw new AppError('Transfer unavailable',409,'Destination hierarchy requires review.');
 if(!(actor.role==='FOUNDER'&&actor.tenantId===null)&&!(employee.tenantId===actor.tenantId&&target.SUBparentTenantId===actor.tenantId))throw new AppError('Forbidden',403,'This transfer is outside your organization authority.');
 return {actor,employee,company,target};
}
export async function initiateChildTransfer(actorId:string,employeeId:string,toCompanyId:string){return prisma.$transaction(async db=>{
 await db.$queryRaw`SELECT id FROM "User" WHERE id=${employeeId} FOR UPDATE`;const {employee,company}=await transferAuthority(db,actorId,employeeId,toCompanyId);
 if(employee.tenantId===company.tenantId)throw new AppError('Already assigned',409,'Employee already belongs to this company.');
 if(await db.employeeTransfer.findFirst({where:{employeeId,status:{in:['PENDING','COOLING_PERIOD']}}}))throw new AppError('Transfer pending',409,'Employee already has a pending transfer.');
 const earnings=await db.ledgerEntry.aggregate({where:{userId:employeeId,type:'EMPLOYEE_COMMISSION',createdAt:{gte:new Date(Date.now()-90*86400000)}},_sum:{amountCents:true}});
 const row=await db.employeeTransfer.create({data:{employeeId,initiatedById:actorId,fromTenantId:employee.tenantId,toChildCompanyId:company.id,status:'COOLING_PERIOD',coolingStartDate:new Date(),coolingEndDate:new Date(Date.now()+5*86400000),currentCoolingDay:1,employeeName:employee.name,tierBeforeTransfer:employee.employeeTier,tierAfterTransfer:'TIER_1_ASSOCIATE',estimatedMonthlyLossCents:Math.floor((earnings._sum.amountCents||0)/3)}});
 await db.auditLog.create({data:{userId:actorId,tenantId:employee.tenantId,action:'EMPLOYEE_TRANSFER_REQUESTED',entityType:'EMPLOYEE_TRANSFER',entityId:row.id,details:{employeeId,destinationCompanyId:company.id}}});return {success:true,transferId:row.id};
});}
export async function completeChildTransfer(transferId:string){return prisma.$transaction(async db=>{
 await db.$queryRaw`SELECT id FROM "EmployeeTransfer" WHERE id=${transferId} FOR UPDATE`;const row=await db.employeeTransfer.findUnique({where:{id:transferId}});
 if(!row)throw new AppError('Not found',404,'Transfer not found.');if(row.status==='COMPLETED')return {success:true,repeated:true};
 if(row.status!=='COOLING_PERIOD'||!row.coolingEndDate||row.coolingEndDate>new Date()||!row.initiatedById)throw new AppError('Transfer not ready',409,'Approved transfer, elapsed cooling period and recorded initiating authority required.');
 const {employee,company}=await transferAuthority(db,row.initiatedById,row.employeeId,row.toChildCompanyId);if(employee.tenantId!==row.fromTenantId)throw new AppError('Membership changed',409,'Employee organization changed during the cooling period.');
 await db.user.update({where:{id:employee.id},data:{tenantId:company.tenantId,employeeTier:'TIER_1_ASSOCIATE',teamLeaderId:null}});
 await db.refreshToken.updateMany({where:{userId:employee.id,revokedAt:null},data:{revokedAt:new Date()}});
 await db.employeeTransfer.update({where:{id:row.id},data:{status:'COMPLETED',completedAt:new Date()}});
 const count=await db.user.count({where:{tenantId:company.tenantId,isActive:true,role:{in:['EMPLOYEE','TEAM_LEAD']}}});await db.childCompany.update({where:{id:company.id},data:{employeeCount:count}});
 if(row.fromTenantId){const previous=await db.childCompany.findFirst({where:{tenantId:row.fromTenantId}});if(previous)await db.childCompany.update({where:{id:previous.id},data:{employeeCount:await db.user.count({where:{tenantId:row.fromTenantId,isActive:true,role:{in:['EMPLOYEE','TEAM_LEAD']}}})}});}
 await db.auditLog.create({data:{userId:row.initiatedById,tenantId:company.tenantId,action:'EMPLOYEE_TRANSFER_COMPLETED',entityType:'EMPLOYEE_TRANSFER',entityId:row.id,details:{employeeId:employee.id,previousTenantId:row.fromTenantId,destinationTenantId:company.tenantId,previousCasesMoved:false}}});return {success:true,repeated:false};
});}
export async function cancelChildTransfer(actorId:string,id:string,reason:unknown){if(reason!==undefined&&(typeof reason!=='string'||reason.length>1000))throw new AppError('Invalid reason',400,'A bounded cancellation reason is required.');return prisma.$transaction(async db=>{const actor=await currentActor(db,actorId);await db.$queryRaw`SELECT id FROM "EmployeeTransfer" WHERE id=${id} FOR UPDATE`;const row=await db.employeeTransfer.findUnique({where:{id}});if(!row)throw new AppError('Not found',404,'Transfer not found.');if(!(actor.role==='FOUNDER'&&actor.tenantId===null)&&actor.id!==row.employeeId&&!(actor.id===row.initiatedById&&['FOUNDER','ADMIN'].includes(actor.role)))throw new AppError('Not found',404,'Transfer not found.');if(row.status!=='COOLING_PERIOD')throw new AppError('Transfer ended',409,'Only a cooling-period transfer can be cancelled.');await db.employeeTransfer.update({where:{id},data:{status:'CANCELLED',cancelledAt:new Date(),cancelReason:typeof reason==='string'?reason:undefined}});await db.auditLog.create({data:{userId:actorId,tenantId:row.fromTenantId,action:'EMPLOYEE_TRANSFER_CANCELLED',entityType:'EMPLOYEE_TRANSFER',entityId:id,details:{employeeId:row.employeeId}}});return {success:true};});}

/** Current parent authority for company management; never trust a founder role alone. */
export async function childCompanyManagementScope(actorId:string):Promise<Prisma.ChildCompanyWhereInput>{
 const actor=await currentActor(prisma,actorId);
 if(actor.role==='FOUNDER'&&actor.tenantId===null)return {};
 if(!['FOUNDER','ADMIN'].includes(actor.role))throw new AppError('Forbidden',403,'Company management access required.');
 if(!actor.tenantId)throw new AppError('Forbidden',403,'A current parent organization is required.');
 const children=await prisma.tenant.findMany({where:{SUBparentTenantId:actor.tenantId,isActive:true},select:{id:true}});
 return {OR:[...(actor.role==='FOUNDER'?[{founderId:actorId}]:[]),{tenantId:{in:children.map(row=>row.id)}}]};
}
export async function requireChildCompanyAccess(actorId:string,companyId:string){
 const actor=await currentActor(prisma,actorId);
 const scope=actor.role==='EMPLOYEE'?{ownerId:actorId}:await childCompanyManagementScope(actorId);
 const company=await prisma.childCompany.findFirst({where:{AND:[{id:companyId},scope]}});
 if(!company)throw new AppError('Not found',404,'Child company not found.');return company;
}
