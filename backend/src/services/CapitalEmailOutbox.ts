import crypto from 'node:crypto';
import { z } from 'zod';
import type { Prisma, CapitalEmailJob } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';
import prisma from '../lib/prisma.js';
import { currentActor, requireCase } from './CaseDocumentAccess.js';
import { AppError } from '../middleware/errorHandler.js';

const inputSchema = z.object({ recipient: z.email().max(254), subject: z.string().trim().min(1).max(300).refine(value => !/[\r\n]/.test(value)), textBody: z.string().min(1).max(100000), htmlBody: z.string().max(200000).optional(), caseId: z.string().min(1).max(100).optional() }).strict();
const keySchema = z.string().regex(/^[a-zA-Z0-9-]{16,100}$/);
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
async function manager(db: Prisma.TransactionClient, actorId: string, caseId?: string) {
 const actor = await currentActor(db, actorId);
 if (!['FOUNDER','ADMIN'].includes(actor.role)) throw new AppError('Forbidden',403,'Email management access required.');
 if (caseId) { const owned = await requireCase(db, actorId, caseId, 'manage'); return { actor, tenantId: owned.record.tenantId }; }
 if (actor.role !== 'FOUNDER' || actor.tenantId !== null) throw new AppError('Forbidden',403,'A managed case is required.');
 return { actor, tenantId: actor.tenantId };
}
export class CapitalEmailOutbox {
 constructor(private transport?: Transporter) {}
 async enqueue(actorId: string, requestKey: string, payload: unknown, db: Prisma.TransactionClient = prisma): Promise<CapitalEmailJob> {
  if (db === prisma) return prisma.$transaction(tx => this.enqueue(actorId,requestKey,payload,tx));
  const input = inputSchema.safeParse(payload);
  if (!input.success || !keySchema.safeParse(requestKey).success) throw new AppError('Invalid email',400,'Invalid recipient, message or request key.');
  const ctx = await manager(db, actorId, input.data.caseId);
  const hash = digest(actorId+':'+requestKey), payloadHash = digest(JSON.stringify(input.data));
  const job = await db.capitalEmailJob.upsert({ where: { requestHash: hash }, create: { requestHash: hash, payloadHash, createdById: actorId, tenantId: ctx.tenantId, ...input.data }, update: {} });
  if (job.payloadHash !== payloadHash) throw new AppError('Request changed',409,'This email request key has different saved content.');
  await db.auditLog.create({data:{userId:actorId,tenantId:ctx.tenantId,action:"EMAIL_ENQUEUED",entityType:"EMAIL_JOB",entityId:job.id,details:{status:job.status}}});
  return job;
 }
 async list(actorId: string) {
  const actor = await currentActor(prisma,actorId);
  if (!['FOUNDER','ADMIN'].includes(actor.role)) throw new AppError('Forbidden',403,'Email management access required.');
  return prisma.capitalEmailJob.findMany({ where: actor.role === 'FOUNDER' && actor.tenantId === null ? {} : { tenantId: actor.tenantId,caseId:{not:null} }, select: { id:true,caseId:true,recipient:true,subject:true,status:true,attempts:true,nextAttemptAt:true,acceptedAt:true,messageId:true,lastError:true,createdAt:true }, orderBy:{createdAt:'desc'},take:100 });
 }
 private smtp() {
  if (this.transport) return this.transport;
  const host = process.env.MODOBOA_SMTP_HOST || process.env.SMTP_HOST;
  const user = process.env.MODOBOA_NOREPLY_EMAIL || process.env.SMTP_USER;
  const pass = process.env.MODOBOA_NOREPLY_PASS || process.env.SMTP_PASS;
  const port = Number(process.env.MODOBOA_SMTP_PORT || process.env.SMTP_PORT || '587');
  if (!host || !user || !pass || ![465,587].includes(port)) throw new AppError('SMTP unavailable',503,'Configure the existing SMTP server on port465 or587.');
  if (host.endsWith('.amazonaws.com') && process.env.CAPITAL_EMAIL_ALLOW_EXTERNAL_FALLBACKS !== 'true') throw new AppError('External SMTP disabled',503,'External email service requires explicit owner configuration.');
  return this.transport = nodemailer.createTransport({host,port,secure:port===465,requireTLS:port!==465,auth:{user,pass},disableFileAccess:true,disableUrlAccess:true,connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000});
 }
 async dispatch(actorId: string, id: string) {
  const actor=await currentActor(prisma,actorId);if(!['FOUNDER','ADMIN'].includes(actor.role))throw new AppError('Forbidden',403,'Email management access required.');
  // Validate configuration before claiming work; no missing-provider success or new chargeable fallback.
  const smtp = this.smtp();
  const job = await prisma.$transaction(async db => {
   await db.$queryRaw`SELECT id FROM "CapitalEmailJob" WHERE id=${id} FOR UPDATE`;
   const row = await db.capitalEmailJob.findUnique({where:{id}});
   if (!row) throw new AppError('Not found',404,'Email job not found.');
   const ctx = await manager(db,actorId,row.caseId || undefined);
   if (!(ctx.actor.role==='FOUNDER' && ctx.actor.tenantId===null) && row.tenantId!==ctx.tenantId) throw new AppError('Not found',404,'Email job not found.');
   if (row.status==='SENDING' && row.leaseUntil && row.leaseUntil < new Date()) {
    await db.capitalEmailJob.update({where:{id},data:{status:'UNKNOWN',leaseUntil:null,lastError:'Worker stopped after beginning SMTP; reconcile before any retry.'}}); return null;
   }
   if (!['QUEUED','RETRY'].includes(row.status) || row.nextAttemptAt > new Date()) return null;
   const messageId = row.messageId || '<'+row.id+'@capitalmgr.com>';
   return db.capitalEmailJob.update({where:{id},data:{status:'SENDING',messageId,attempts:{increment:1},leaseUntil:new Date(Date.now()+120000)}});
  });
  if (!job) return { attempted:false };
  try {
   const info = await smtp.sendMail({from:process.env.SMTP_FROM || process.env.MODOBOA_NOREPLY_EMAIL || process.env.SMTP_USER || 'noreply@capitalmgr.com',to:job.recipient,subject:job.subject,text:job.textBody,html:job.htmlBody || undefined,messageId:job.messageId!,disableFileAccess:true,disableUrlAccess:true});
   if (!Array.isArray(info.accepted) || !info.accepted.some((value: unknown) => typeof value==='string' && value.toLowerCase()===job.recipient.toLowerCase())) {
    await this.finish(actorId,job,'FAILED',{accepted:false},'SMTP did not accept this recipient.');return {attempted:true,status:'FAILED'};
   }
   await this.finish(actorId,job,'ACCEPTED',{messageId:info.messageId,response:String(info.response || '').slice(0,1000),accepted:true},null);
   return {attempted:true,status:'ACCEPTED',messageId:info.messageId};
  } catch (error: unknown) {
   const cause = error as { responseCode?:number;code?:string };
   // SMTP timeout or lost final acknowledgement may already have sent the message.
   const explicitRejection = Number.isInteger(cause.responseCode);
   const retry = explicitRejection && cause.responseCode!>=400 && cause.responseCode!<500 && job.attempts<5;
   const status = retry ? 'RETRY' : explicitRejection ? 'FAILED' : 'UNKNOWN';
   await this.finish(actorId,job,status,{accepted:false,smtpCode:cause.responseCode || null},explicitRejection?'SMTP rejected this attempt.':'SMTP outcome is unknown; reconcile before any retry.');
   return {attempted:true,status};
  }
 }
 private async finish(actorId:string,job: CapitalEmailJob,status:string,receipt:Prisma.InputJsonValue,error:string|null) {
  await prisma.$transaction(async db => {
   const changed = await db.capitalEmailJob.updateMany({where:{id:job.id,status:'SENDING',attempts:job.attempts},data:{status,receipt,lastError:error,leaseUntil:null,acceptedAt:status==='ACCEPTED'?new Date():null,nextAttemptAt:new Date(Date.now()+Math.min(3600000,30000*2**job.attempts))}});
   if (changed.count!==1) throw new Error('Email attempt requires reconciliation');
   await db.auditLog.create({data:{userId:actorId,tenantId:job.tenantId,action:'EMAIL_'+status,entityType:'EMAIL_JOB',entityId:job.id,details:{queuedBy:job.createdById,attempt:job.attempts,messageId:job.messageId,recipientAccepted:status==='ACCEPTED',deliveryVerified:false}}});
  });
 }
}
export const capitalEmailOutbox = new CapitalEmailOutbox();
