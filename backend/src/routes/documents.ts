import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { documentVaultService } from "../services/DocumentVaultService.js";
import { requireCase, accessFailure } from "../services/CaseDocumentAccess.js";
import prisma from "../lib/prisma.js";
import multer from "multer";
const router=Router();
router.use(authMiddleware);
router.use((_req,res,next)=>{res.setHeader("Cache-Control","private, no-store");res.setHeader("X-Content-Type-Options","nosniff");next();});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:3,fieldSize:2048,parts:5}});
router.get("/",async(req:AuthRequest,res)=>{try{const documents=await documentVaultService.listDocuments(req.user!.id);res.json({success:true,documents,total:documents.length,limit:100});}catch(e){accessFailure(res,e);}});
router.get("/my-documents",async(req:AuthRequest,res)=>{try{const documents=await documentVaultService.listDocuments(req.user!.id);res.json({success:true,data:documents,count:documents.length,limit:100});}catch(e){accessFailure(res,e);}});
router.get("/vault/stats",async(req:AuthRequest,res)=>{try{res.json({success:true,data:await documentVaultService.getVaultStats(req.user!.id)});}catch(e){accessFailure(res,e);}});
router.get("/vault/storage-by-case",async(req:AuthRequest,res)=>{try{const raw=req.query.limit;const limit=raw===undefined?20:typeof raw==="string"&&/^\d+$/.test(raw)?Number(raw):NaN;res.json({success:true,data:await documentVaultService.getStorageByCase(limit,req.user!.id)});}catch(e){accessFailure(res,e);}});
router.post("/vault/cleanup",async(req:AuthRequest,res)=>{try{await documentVaultService.cleanupOrphanedFiles(req.user!.id);}catch(e){accessFailure(res,e);}});
router.get("/case/:caseId",async(req:AuthRequest,res)=>{try{res.json({success:true,data:await documentVaultService.getCaseDocuments(req.params.caseId,req.user!.id)});}catch(e){accessFailure(res,e);}});
router.post("/:caseId/upload",async(req:AuthRequest,res,next)=>{try{await requireCase(prisma,req.user!.id,req.params.caseId);next();}catch(e){accessFailure(res,e);}},(req,res,next)=>upload.single("file")(req,res,error=>error?res.status(400).json({success:false,error:"Upload one supported file up to10 MiB with bounded form fields."}):next()),async(req:AuthRequest,res)=>{
  try{if(!req.file)return void res.status(400).json({success:false,error:"File required"});if(Object.keys(req.body).some(k=>!["type","signatureRequired"].includes(k)))return void res.status(400).json({success:false,error:"Unsupported upload fields"});
    const result=await documentVaultService.uploadDocument({caseId:req.params.caseId,type:req.body.type,fileName:req.file.originalname,buffer:req.file.buffer,mimeType:req.file.mimetype,uploadedById:req.user!.id,signatureRequired:req.body.signatureRequired==="true"});
    res.status(result.success?201:503).json({...result,data:result});
  }catch(e){accessFailure(res,e,"Upload was not confirmed. Reopen saved records before retrying.");}
});
for(const mode of ["download","view"]){router.get(`/:id/${mode}`,async(req:AuthRequest,res)=>{try{const result=await documentVaultService.getDocumentFile(req.params.id,req.user!.id);res.setHeader("Content-Type",result.mimeType);res.setHeader("Content-Disposition",`attachment; filename="${encodeURIComponent(result.fileName)}"`);res.setHeader("Content-Security-Policy","sandbox; default-src 'none'");res.setHeader("X-Artifact-SHA256",result.sha256);res.setHeader("Content-Length",result.buffer.length);res.send(result.buffer);}catch(e){accessFailure(res,e);}});}
router.get("/:id",async(req:AuthRequest,res)=>{try{res.json({success:true,data:await documentVaultService.getDocumentMetadata(req.params.id,req.user!.id)});}catch(e){accessFailure(res,e);}});
router.post("/:id/reconcile",async(req:AuthRequest,res)=>{try{res.json({success:true,data:await documentVaultService.reconcileDocument(req.params.id,req.user!.id)});}catch(e){accessFailure(res,e);}});
router.patch("/:id/sign",async(req:AuthRequest,res)=>{try{await documentVaultService.markAsSigned(req.params.id,req.body.signatureUrl,req.user!.id);}catch(e){accessFailure(res,e);}});
router.patch("/:id/submit",async(req:AuthRequest,res)=>{try{res.json({success:true,data:await documentVaultService.markAsSubmitted(req.params.id,req.user!.id)});}catch(e){accessFailure(res,e);}});
router.patch("/:id/approve",async(req:AuthRequest,res)=>{try{res.json({success:true,data:await documentVaultService.approveDocument(req.params.id,req.user!.id)});}catch(e){accessFailure(res,e);}});
router.patch("/:id/reject",async(req:AuthRequest,res)=>{try{res.json({success:true,data:await documentVaultService.rejectDocument(req.params.id,req.body.reason,req.user!.id)});}catch(e){accessFailure(res,e);}});
router.delete("/:id",async(req:AuthRequest,res)=>{try{const result=await documentVaultService.deleteDocument(req.params.id,req.user!.id);res.status(result.success?200:503).json(result);}catch(e){accessFailure(res,e);}});
export default router;
