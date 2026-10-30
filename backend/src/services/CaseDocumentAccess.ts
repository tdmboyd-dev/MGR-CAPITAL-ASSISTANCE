import type { Prisma, UserRole, DocumentType } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
export type AccessDb = Prisma.TransactionClient;
export type Actor = { id: string; role: UserRole; tenantId: string | null; ownedTenantIds?:string[] };
export type DocumentAction = "read" | "upload" | "verify" | "submit" | "delete" | "sign";
export const CLIENT_DOCUMENT_TYPES: DocumentType[] = ["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA", "CLIENT_ID"];
export async function currentActor(db: AccessDb, id: string): Promise<Actor> {
  const user=await db.user.findUnique({where:{id},select:{id:true,role:true,tenantId:true,isActive:true,tenant:{select:{isActive:true}}}});
  if(!user?.isActive || (user.tenant && !user.tenant.isActive))throw new AppError("Account unavailable",403,"Account access is unavailable.");
  let ownedTenantIds:string[]=[];
  if(user.role==='EMPLOYEE'||(user.role==='FOUNDER'&&user.tenantId!==null)){
    const companies=await db.childCompany.findMany({where:{...(user.role==='FOUNDER'?{founderId:id}:{ownerId:id}),status:'ACTIVE',tenantId:{not:null}},select:{tenantId:true}});
    if(companies.length){const tenants=await db.tenant.findMany({where:{id:{in:companies.flatMap(row=>row.tenantId?[row.tenantId]:[])},isActive:true,SUBparentTenantId:user.tenantId},select:{id:true}});ownedTenantIds=tenants.map(row=>row.id);}
  }
  return {...user,ownedTenantIds};
}
export function caseScope(actor: Actor): Prisma.CaseWhereInput {
  if(actor.role==="FOUNDER" && actor.tenantId===null)return {};
  if(actor.ownedTenantIds?.length)return {OR:[{tenantId:{in:actor.ownedTenantIds}},caseScope({...actor,ownedTenantIds:[]})]};
  const tenant={tenantId:actor.tenantId};
  if(["FOUNDER","ADMIN","COMPLIANCE"].includes(actor.role))return tenant;
  if(actor.role==="EMPLOYEE")return {...tenant,assignedEmployeeId:actor.id};
  if(actor.role==="TEAM_LEAD")return {...tenant,OR:[{assignedEmployeeId:actor.id},{assignedEmployee:{teamLeaderId:actor.id,tenantId:actor.tenantId,isActive:true}}]};
  if(actor.role==="CLIENT")return {...tenant,clientId:actor.id};
  return {id:{in:[]}};
}
export function documentScope(actor: Actor): Prisma.DocumentWhereInput {
  return {case:caseScope(actor),deletionStatus:{not:"DELETED"},...(actor.role==="CLIENT"?{type:{in:CLIENT_DOCUMENT_TYPES}}:{}),...(actor.role==="TEAM_LEAD"?{type:{not:"CLIENT_ID"}}:{})};
}
export async function requireCase(db: AccessDb, actorId: string, caseId: string, action: "read" | "manage" = "read") {
  const actor=await currentActor(db,actorId);
  const record=await db.case.findFirst({where:{AND:[{id:caseId},caseScope(actor)]}});
  if(!record)throw new AppError("Case not found",404,"Case not found.");
  if(action==="manage" && !["FOUNDER","ADMIN"].includes(actor.role)&&!actor.ownedTenantIds?.includes(record.tenantId||''))throw new AppError("Forbidden",403,"Case management access required.");
  return {actor,record};
}
export function requireDocumentAction(actor: Actor, action: DocumentAction, type: DocumentType) {
  if(action==="delete" && actor.role!=="FOUNDER")throw new AppError("Forbidden",403,"Founder access required.");
  if(action==="verify" && !["FOUNDER","ADMIN"].includes(actor.role))throw new AppError("Forbidden",403,"Document review access required.");
  if(action==="submit" && !["FOUNDER","ADMIN","TEAM_LEAD","EMPLOYEE"].includes(actor.role))throw new AppError("Forbidden",403,"Assigned staff access required.");
  if(action==="upload" && !["FOUNDER","ADMIN","TEAM_LEAD","EMPLOYEE","CLIENT"].includes(actor.role))throw new AppError("Forbidden",403,"Document upload access required.");
  if(action==="sign" && actor.role!=="CLIENT")throw new AppError("Forbidden",403,"Recipient access required.");
  if(actor.role==="CLIENT" && !CLIENT_DOCUMENT_TYPES.includes(type))throw new AppError("Forbidden",403,"Document type unavailable.");
  if(actor.role==="TEAM_LEAD" && type==="CLIENT_ID")throw new AppError("Forbidden",403,"Identity documents unavailable to this role.");
}
export async function requireDocument(db: AccessDb, actorId: string, id: string, action: DocumentAction="read") {
  const actor=await currentActor(db,actorId);
  const document=await db.document.findFirst({where:{AND:[{id},documentScope(actor)]}});
  if(!document)throw new AppError("Document not found",404,"Document not found.");
  requireDocumentAction(actor,action,document.type);
  return {actor,document};
}
export async function documentAudit(db: AccessDb, actorId: string, id: string, action: string) {
  const target=await db.document.findUnique({where:{id},select:{case:{select:{tenantId:true}}}});
  await db.auditLog.create({data:{userId:actorId,tenantId:target?.case.tenantId,action,entityType:"DOCUMENT",entityId:id}});
}
export function accessFailure(res: {status:(code:number)=>any}, error: unknown, fallback="Document operation could not be confirmed") {
  return res.status(error instanceof AppError?error.statusCode:503).json({success:false,error:error instanceof AppError?error.safeMessage:fallback});
}
export const accessDb=prisma;
