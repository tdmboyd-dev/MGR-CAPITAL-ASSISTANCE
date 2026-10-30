import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
const url=new URL(process.env.DATABASE_URL||'http://invalid');
if(url.hostname!=='127.0.0.1'||url.port!=='18588'||url.pathname!=='/capital_auth_lab'||!process.env.CAPITAL_LAB_DIR||process.env.OPENAI_API_KEY)throw new Error('Exact keyless isolated lab required');
const {default:db}=await import('../src/lib/prisma.js');
const {authService}=await import('../src/services/AuthService.js');
const {default:insights}=await import('../src/routes/opsInsights.js');
const {default:legal}=await import('../src/routes/legalRoutes.js');
const {default:fleet}=await import('../src/routes/workerBotRoutes.js');
const {default:inbox}=await import('../src/routes/emailInboxRoutes.js');
const {opsMetricsService}=await import('../src/services/OpsMetricsService.js');
const {workerBotEngine}=await import('../src/services/WorkerBotEngine.js');
const {workerBotSpawner}=await import('../src/services/WorkerBotSpawner.js');
const {legalAuditorService}=await import('../src/services/LegalAuditorService.js');
const {globalErrorHandler}=await import('../src/middleware/errorHandler.js');
const checks:string[]=[],users:string[]=[],suffix=crypto.randomUUID();
const app=express();app.use(express.json());app.use('/insights',insights);app.use('/legal',legal);app.use('/fleet',fleet);app.use('/inbox',inbox);
app.post('/synthetic-error/:id',(req,res,next)=>next(new Error(String(req.body.privateDocument))));app.use(globalErrorHandler);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const http=request(server);
const originalFeed=opsMetricsService.getFounderFocusFeed;
const originalRevenue=workerBotEngine.getRevenueAttribution, originalLearning=workerBotEngine.getLearningInsights, originalGrowth=workerBotEngine.getGrowthReport, originalPopulation=workerBotSpawner.getPopulationStats;
try{
 const tenant=await db.tenant.create({data:{name:`Synthetic handbook ${suffix}`,slug:`handbook-${suffix}`}});
 const actor=async(role:'FOUNDER'|'EMPLOYEE',tenantId:string|null,label:string)=>{const user=await db.user.create({data:{name:`Synthetic audit ${label}`,email:`handbook-${label}-${suffix}@example.invalid`,passwordHash:'unusable-synthetic',role,tenantId}});users.push(user.id);return {user,token:authService.generateAccessToken(user).token}};
 const root=await actor('FOUNDER',null,'root'),company=await actor('FOUNDER',tenant.id,'company'),employee=await actor('EMPLOYEE',tenant.id,'employee');
 const get=(p:string,token:string)=>http.get(p).auth(token,{type:'bearer'});
 for(const p of ['/insights','/legal/requirements/TN/claim_form','/fleet/revenue','/inbox/emails'])assert.equal((await http.get(p)).status,401);checks.push('Anonymous insights/legal/fleet/inbox denied over real HTTP');
 for(const who of [company,employee])for(const p of ['/insights','/legal/requirements/TN/claim_form','/fleet/revenue','/inbox/emails'])assert.equal((await get(p,who.token)).status,403);checks.push('Current company founder and employee cannot read global operator surfaces or shared IMAP credentials');
 // Real saved focus item, real DB query and envelope, no mocked feed.
 const item=await db.founderFocusItem.create({data:{category:'AUDIT_TEST',priority:100,title:`Synthetic handbook ${suffix}`,description:'Synthetic route contract verification'}});
 const response=await get('/insights?limit=100',root.token);assert.equal(response.status,200);assert.equal(response.body.success,true);assert.ok(response.body.data.some((x:{id:string})=>x.id===item.id));assert.deepEqual(response.body.insights,response.body.data);assert.match(response.headers['cache-control'],/no-store/);checks.push('Saved focus item returned through actual DB/HTTP with compatible data envelope');
 for(const value of ['0','-1','101','NaN','1.5','1&limit=2'])assert.equal((await get('/insights?limit='+value,root.token)).status,400);checks.push('Unbounded, malformed and repeated insight limits denied');
 assert.equal((await get('/insights?isRead=true',root.token)).status,400);checks.push('Unsupported read state does not fabricate read receipts');
 opsMetricsService.getFounderFocusFeed=async()=>{throw new Error('synthetic unavailable DB')};assert.equal((await get('/insights',root.token)).status,503);opsMetricsService.getFounderFocusFeed=originalFeed;checks.push('Focus storage failure reports unavailable, not empty success');
 // Stub downstream report computation only. This proves Express dispatch, not bot correctness.
 workerBotEngine.getRevenueAttribution=async()=>({auditRoute:'revenue'}) as any;workerBotEngine.getLearningInsights=async()=>({auditRoute:'learnings'}) as any;workerBotEngine.getGrowthReport=async()=>({auditRoute:'growth-report'}) as any;workerBotSpawner.getPopulationStats=async()=>({auditRoute:'population'}) as any;
 for(const name of ['revenue','learnings','growth-report','population']){const result=await get('/fleet/'+name,root.token);assert.equal(result.status,200);assert.equal(result.body.data.auditRoute,name)}checks.push('Four literal worker reports reach their own handlers, not codename lookup (report computation stubbed)');
 const audit=await http.post('/legal/audit').auth(root.token,{type:'bearer'}).send({docText:'Synthetic document with no personal data',state:'TN',type:'claim_form'});assert.equal(audit.status,503);assert.equal(audit.body.score,undefined);checks.push('Missing AI provider cannot produce a document compliance score');
 const invalid=await http.post('/legal/audit').auth(root.token,{type:'bearer'}).send({docText:'test',state:'Tennessee',type:'claim_form'});assert.equal(invalid.status,400);checks.push('Malformed document-review input denied');
 assert.equal((await http.post('/legal/batch-audit').auth(root.token,{type:'bearer'}).send({documents:Array.from({length:6},()=>({text:'x',state:'TN',type:'claim_form'}))})).status,400);checks.push('Batch document review bounded to five inputs');
 const checklist=await get('/legal/requirements/TN/claim_form',root.token);assert.equal(checklist.body.status,'GENERIC_CHECKLIST_UNVERIFIED');checks.push('Generic preparation checklist explicitly unqualified');
 const draft=await http.post('/inbox/emails/draft').auth(root.token,{type:'bearer'}).send({subject:'synthetic'});assert.equal(draft.status,503);assert.equal(draft.body.code,'DRAFT_STORAGE_UNAVAILABLE');assert.equal(draft.body.data,undefined);checks.push('Disconnected draft persistence cannot acknowledge a saved draft');
 const marker='SyntheticSensitiveMarker'+crypto.randomUUID();const messages:string[]=[];const originalError=console.error;
 try{console.error=(...args:unknown[])=>{messages.push(args.map(String).join(' '))};const result=await http.post('/synthetic-error/'+marker+'?private='+marker).send({privateDocument:marker,nested:{password:marker}});assert.equal(result.status,500);assert.equal(JSON.stringify(result.body).includes(marker),false);assert.equal(result.body._debug,undefined);assert.equal(messages.join('').includes(marker),false);assert.ok(messages.join('').includes('/synthetic-error/:id'));}finally{console.error=originalError}
 checks.push('Raw document/error/body/query/path values excluded from global error response and metadata logs');
 await db.user.update({where:{id:root.user.id},data:{role:'EMPLOYEE'}});assert.equal((await get('/insights',root.token)).status,403);assert.equal((await get('/legal/requirements/TN/claim_form',root.token)).status,403);checks.push('Existing token loses global read access after current role changes');
 await db.founderFocusItem.delete({where:{id:item.id}});
 const dir=path.join(process.env.CAPITAL_LAB_DIR!,'audit-handbook');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'receipt.json'),JSON.stringify({passed:checks.length,checks,proof:'Local actual PostgreSQL/current actors/HTTP; report computation explicitly stubbed; no live AI or business outcome'},null,2));console.log(JSON.stringify({passed:checks.length,checks},null,2));
}finally{
 opsMetricsService.getFounderFocusFeed=originalFeed;workerBotEngine.getRevenueAttribution=originalRevenue;workerBotEngine.getLearningInsights=originalLearning;workerBotEngine.getGrowthReport=originalGrowth;workerBotSpawner.getPopulationStats=originalPopulation;
 await db.user.updateMany({where:{id:{in:users}},data:{isActive:false}});await new Promise<void>(resolve=>server.close(()=>resolve()));await db.$disconnect();
}
