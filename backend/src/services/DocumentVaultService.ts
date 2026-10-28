import { DocumentType, DocumentStatus } from "@prisma/client";
import type { Prisma, Document } from "@prisma/client";
import * as path from "path";
import * as crypto from "crypto";
import prisma from "../lib/prisma.js";
import { storageRouter } from "./storage/StorageRouter.js";
import { LocalFilesystemAdapter } from "./storage/LocalFilesystemAdapter.js";
import { requireCase, requireDocument, currentActor, documentScope, requireDocumentAction, documentAudit } from "./CaseDocumentAccess.js";
import { AppError } from "../middleware/errorHandler.js";
const root=process.env.DOCUMENT_STORAGE_PATH || path.join(process.cwd(),"storage","documents");
const legacy=new LocalFilesystemAdapter({basePath:root});
const MIME_EXT:Record<string,string>={"application/pdf":".pdf","image/jpeg":".jpg","image/png":".png","image/gif":".gif","application/msword":".doc","application/vnd.openxmlformats-officedocument.wordprocessingml.document":".docx","text/plain":".txt"};
const meta=(doc:Document):Record<string,Prisma.JsonValue>=>doc.metadata && typeof doc.metadata==="object" && !Array.isArray(doc.metadata)?doc.metadata as Record<string,Prisma.JsonValue>:{};
export function safeDocument(doc:Document){return {id:doc.id,caseId:doc.caseId,type:doc.type,status:doc.status,fileName:doc.fileName,fileSize:doc.fileSize,mimeType:doc.mimeType,signatureRequired:doc.signatureRequired,signedAt:doc.signedAt,createdAt:doc.createdAt,updatedAt:doc.updatedAt,deletionStatus:doc.deletionStatus,storageState:meta(doc).storageState || "LEGACY_UNVERIFIED",needsSignature:doc.signatureRequired && !doc.signedAt,signed:!!doc.signedAt};}
class DocumentVaultService {
  async initialize(){await storageRouter.initialize();}
  async uploadDocument(params:{caseId:string;type:DocumentType;fileName:string;buffer:Buffer;mimeType:string;uploadedById:string;signatureRequired?:boolean;generatedContent?:string}) {
    if(!Buffer.isBuffer(params.buffer) || !params.buffer.length || params.buffer.length>10*1024*1024)throw new AppError("Invalid size",413,"Upload one nonempty document up to10 MiB.");
    if(!MIME_EXT[params.mimeType] || typeof params.fileName!=="string" || params.fileName.length>180 || /[\\/\x00-\x1f\x7f]/.test(params.fileName))throw new AppError("Invalid file",400,"Unsupported document type or filename.");
    if(!Object.values(DocumentType).includes(params.type))throw new AppError("Invalid type",400,"Invalid document type.");
    const hash=crypto.createHash("sha256").update(params.buffer).digest("hex");
    const name=`${params.type}_${crypto.randomUUID()}${MIME_EXT[params.mimeType]}`;
    const doc=await prisma.$transaction(async(db)=>{
      const {actor,record}=await requireCase(db,params.uploadedById,params.caseId);
      requireDocumentAction(actor,"upload",params.type);
      await db.$queryRaw`SELECT id FROM "Case" WHERE id=${record.id} FOR UPDATE`;
      await requireCase(db,params.uploadedById,params.caseId);
      const usage=await db.document.aggregate({where:{caseId:record.id,deletionStatus:{not:"DELETED"}},_sum:{fileSize:true}});
      if((usage._sum.fileSize || 0)+params.buffer.length>50*1024*1024)throw new AppError("Case capacity",413,"Case document limit is50 MiB.");
      const saved=await db.document.create({data:{caseId:record.id,tenantId:record.tenantId,type:params.type,fileName:params.fileName,fileUrl:"",filePath:`${record.id}/${name}`,fileSize:params.buffer.length,mimeType:params.mimeType,uploadedById:actor.id,signatureRequired:params.signatureRequired || false,generatedContent:params.generatedContent,metadata:{storageState:"UPLOAD_PENDING",storageKind:"ROUTED",sha256:hash,malwareScanStatus:"NOT_SCANNED"}}});
      await documentAudit(db,actor.id,saved.id,"DOCUMENT_UPLOAD_REQUESTED");return saved;
    });
    let routed;
    try {routed=await storageRouter.upload({caseId:doc.caseId,fileName:name,data:params.buffer,mimeType:doc.mimeType,documentId:doc.id});}
    catch {return {success:false,documentId:doc.id,error:"Upload unconfirmed. Saved operation requires reconciliation."};}
    if(!routed.success)return {success:false,documentId:doc.id,error:"Upload unconfirmed. Saved operation requires reconciliation."};
    await prisma.$transaction(async(db)=>{
      await requireDocument(db,params.uploadedById,doc.id,"upload");
      await db.document.update({where:{id:doc.id},data:{metadata:{...meta(doc),storageState:"READY"},fileUrl:`/api/documents/${doc.id}/download`}});
      await documentAudit(db,params.uploadedById,doc.id,"DOCUMENT_STORED");
    });
    return {success:true,documentId:doc.id,fileName:params.fileName,fileSize:doc.fileSize,sha256:hash,storageVerified:true,malwareScanStatus:"NOT_SCANNED"};
  }
  async uploadGeneratedDocument(params:{caseId:string;type:DocumentType;buffer:Buffer;uploadedById:string;generatedContent?:string}){return this.uploadDocument({...params,fileName:`${params.type}.pdf`,mimeType:"application/pdf"});}
  async verifyAccess(id:string,actorId:string,_callerRole?:string){try{await requireDocument(prisma,actorId,id);return true;}catch(error){if(error instanceof AppError)return false;throw error;}}
  async getDocumentFile(id:string,actorId:string){
    const {document}=await requireDocument(prisma,actorId,id);
    const state=meta(document).storageState;
    if(state && state!=="READY")throw new AppError("Storage pending",409,"Document storage is pending reconciliation.");
    const registry=await prisma.fileRegistry.findFirst({where:{documentId:id}});
    let bytes:Buffer|undefined;
    if(registry && registry.providerPath.replace(/\\/g,"/").split("/")[0]!==document.caseId)throw new AppError("Target mismatch",503,"Registered document target requires reconciliation.");
    if(registry){const result=await storageRouter.download({documentId:id});if(result.success)bytes=result.data;}
    else if(meta(document).storageKind!=="ROUTED" && document.filePath){if(document.filePath.replace(/\\/g,"/").split("/")[0]!==document.caseId)throw new AppError("Legacy target mismatch",503,"Legacy target requires reconciliation.");const result=await legacy.download(document.filePath);if(result.success)bytes=result.data;}
    if(!bytes || bytes.length!==document.fileSize)throw new AppError("Storage unavailable",503,"Saved document bytes could not be verified.");
    const hash=crypto.createHash("sha256").update(bytes).digest("hex");
    if(typeof meta(document).sha256==="string" && meta(document).sha256!==hash)throw new AppError("Integrity failure",503,"Saved document bytes could not be verified.");
    await prisma.$transaction(async(db)=>{await requireDocument(db,actorId,id);await documentAudit(db,actorId,id,"DOCUMENT_DOWNLOADED");});
    return {success:true,buffer:bytes,fileName:document.fileName,mimeType:document.mimeType,sha256:hash};
  }
  async getDocumentMetadata(id:string,actorId:string){const {document}=await requireDocument(prisma,actorId,id);await documentAudit(prisma,actorId,id,"DOCUMENT_METADATA_READ");return safeDocument(document);}
  async getCaseDocuments(caseId:string,actorId:string){return prisma.$transaction(async(db)=>{const {actor}=await requireCase(db,actorId,caseId);const rows=await db.document.findMany({where:{AND:[{caseId},documentScope(actor)]},orderBy:{createdAt:"desc"},take:100});await db.auditLog.create({data:{userId:actor.id,action:"CASE_DOCUMENTS_READ",entityType:"CASE",entityId:caseId}});return rows.map(safeDocument);});}
  async listDocuments(actorId:string){const actor=await currentActor(prisma,actorId);return (await prisma.document.findMany({where:documentScope(actor),orderBy:{createdAt:"desc"},take:100})).map(safeDocument);}
  async updateStatus(id:string,status:DocumentStatus,actorId:string,reason?:string){return prisma.$transaction(async(db)=>{const {document}=await requireDocument(db,actorId,id,status==="SUBMITTED"?"submit":"verify");if(meta(document).storageState && meta(document).storageState!=="READY")throw new AppError("Storage pending",409,"Finish storage reconciliation before review.");if(document.status==="SUBMITTED" && status==="SUBMITTED")throw new AppError("Invalid review state",409,"Document cannot be submitted from this state.");const row=await db.document.update({where:{id},data:{status,...(status==="APPROVED"?{approvedAt:new Date()}:{}),...(status==="REJECTED"?{rejectedAt:new Date(),rejectionReason:reason}:{}),...(status==="SUBMITTED"?{submittedAt:new Date()}: {})}});await documentAudit(db,actorId,id,`DOCUMENT_REVIEW_${status}`);return {...safeDocument(row),providerSubmissionVerified:false};});}
  async markAsSigned(id:string,_signatureUrl:string|undefined,actorId:string){await requireDocument(prisma,actorId,id,"sign");throw new AppError("Signature evidence required",503,"A recipient-bound signature workflow and verification receipt are required. A URL alone cannot mark a document signed.");}
  async markAsSubmitted(id:string,actorId:string){return this.updateStatus(id,"SUBMITTED",actorId);}
  async approveDocument(id:string,actorId:string){return this.updateStatus(id,"APPROVED",actorId);}
  async rejectDocument(id:string,reason:string,actorId:string){if(typeof reason!=="string" || !reason.trim() || reason.length>2000)throw new AppError("Invalid reason",400,"A review reason up to2000 characters is required.");return this.updateStatus(id,"REJECTED",actorId,reason.trim());}
  async reconcileDocument(id:string,actorId:string){
    const {actor,document}=await requireDocument(prisma,actorId,id,"upload");
    if(!["FOUNDER","ADMIN"].includes(actor.role))throw new AppError("Forbidden",403,"Administrator reconciliation required.");
    if(String(meta(document).storageState).startsWith("DELETE"))throw new AppError("Delete pending",409,"Retry the saved delete operation instead.");
    const rows=await prisma.fileRegistry.findMany({where:{documentId:id}});
    if(!rows.length)throw new AppError("No registered target",409,"No registered upload target exists; no file was assumed saved.");
    if(rows.some(row=>row.providerPath.replace(/\\/g,"/").split("/")[0]!==document.caseId))throw new AppError("Target mismatch",503,"Registered target requires reconciliation.");
    for(const row of rows)if(!(await storageRouter.reconcileUpload(row.id)).success)throw new AppError("Readback failed",503,"Stored bytes could not be verified.");
    return prisma.$transaction(async(db)=>{await requireDocument(db,actorId,id,"upload");const saved=await db.document.update({where:{id},data:{metadata:{...meta(document),storageState:"READY"},fileUrl:`/api/documents/${id}/download`}});await documentAudit(db,actorId,id,"DOCUMENT_UPLOAD_RECONCILED");return safeDocument(saved);});
  }
  async deleteDocument(id:string,actorId:string){
    const {document}=await requireDocument(prisma,actorId,id,"delete");
    await prisma.$transaction(async(db)=>{await requireDocument(db,actorId,id,"delete");await db.document.update({where:{id},data:{metadata:{...meta(document),storageState:"DELETE_PENDING"}}});await documentAudit(db,actorId,id,"DOCUMENT_DELETE_REQUESTED");});
    const targets=await prisma.fileRegistry.findMany({where:{documentId:id},select:{providerPath:true}});
    if(targets.some(t=>t.providerPath.replace(/\\/g,"/").split("/")[0]!==document.caseId))throw new AppError("Target mismatch",503,"Storage target requires reconciliation.");
    const registries=targets.length;
    if(registries){if(!(await storageRouter.deleteByDocumentId(id)).success)return {success:false,error:"Storage deletion unconfirmed; document and registry retained for retry."};}
    else if(meta(document).storageKind!=="ROUTED" && document.filePath){if(document.filePath.replace(/\\/g,"/").split("/")[0]!==document.caseId)throw new AppError("Legacy target mismatch",503,"Legacy target requires reconciliation.");if(!(await legacy.delete(document.filePath)).success)return {success:false,error:"Legacy deletion unconfirmed; document retained."};}
    await prisma.$transaction(async(db)=>{await requireDocument(db,actorId,id,"delete");await db.document.update({where:{id},data:{deletionStatus:"DELETED",deletedAt:new Date(),deletedBy:actorId,metadata:{...meta(document),storageState:"DELETED"}}});await documentAudit(db,actorId,id,"DOCUMENT_DELETED");});
    return {success:true};
  }
  async getVaultStats(actorId:string){const actor=await currentActor(prisma,actorId);if(actor.role!=="FOUNDER")throw new AppError("Forbidden",403,"Founder access required.");const where=documentScope(actor);const [total,byType,byStatus]=await Promise.all([prisma.document.aggregate({where,_count:true,_sum:{fileSize:true}}),prisma.document.groupBy({where,by:["type"],_count:true}),prisma.document.groupBy({where,by:["status"],_count:true})]);return {totalDocuments:total._count,totalSizeBytes:total._sum.fileSize||0,documentsByType:byType.map(r=>({type:r.type,count:r._count})),documentsByStatus:byStatus.map(r=>({status:r.status,count:r._count}))};}
  async getStorageByCase(limit:number,actorId:string){const actor=await currentActor(prisma,actorId);if(actor.role!=="FOUNDER")throw new AppError("Forbidden",403,"Founder access required.");if(!Number.isInteger(limit)||limit<1||limit>100)throw new AppError("Invalid limit",400,"Limit must be1 to100.");return prisma.document.groupBy({where:documentScope(actor),by:["caseId"],_count:true,_sum:{fileSize:true},take:limit,orderBy:{_sum:{fileSize:"desc"}}});}
  async cleanupOrphanedFiles(actorId:string){const actor=await currentActor(prisma,actorId);if(actor.role!=="FOUNDER")throw new AppError("Forbidden",403,"Founder access required.");throw new AppError("Cleanup unavailable",503,"Automatic orphan deletion requires a reviewed inventory and retention reconciliation. No files were deleted.");}
}
export const documentVaultService=new DocumentVaultService();
