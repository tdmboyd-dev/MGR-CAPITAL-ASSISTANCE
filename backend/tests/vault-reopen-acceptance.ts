import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const url=new URL(process.env.DATABASE_URL || 'http://invalid');
if(url.hostname!=='127.0.0.1'||url.port!=='18588'||url.pathname!=='/capital_auth_lab'||!process.env.CAPITAL_LAB_DIR)throw Error('Owned Capital lab required');
const lab=path.resolve(process.env.CAPITAL_LAB_DIR);
if(path.resolve(process.env.DOCUMENT_STORAGE_PATH || '')!==path.join(lab,'vault-files'))throw Error('Owned vault root required');
const fixture=JSON.parse(await fs.readFile(path.join(lab,'vault-reopen.private.json'),'utf8'));
const {default:db}=await import('../src/lib/prisma.js');
const {authService}=await import('../src/services/AuthService.js');
const {default:router}=await import('../src/routes/documents.js');
const {default:express}=await import('express');
const {default:request}=await import('supertest');
const app=express();app.use(express.json());app.use('/api/documents',router);
const server=app.listen(0,'127.0.0.1');
await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const http=request(server),checks:string[]=[];
try {
 const token=async(id:string)=>authService.generateAccessToken(await db.user.findUniqueOrThrow({where:{id}})).token;
 const read=await http.get(`/api/documents/${fixture.documentId}/download`).set('Authorization','Bearer '+await token(fixture.clientId));
 assert.equal(read.status,200);assert.ok(read.headers['x-artifact-sha256']);checks.push('New Node process and fresh adapter cache recover previously reconciled bytes through actual HTTP');
 const foreign=await http.get(`/api/documents/${fixture.documentId}/download`).set('Authorization','Bearer '+await token(fixture.foreignId));assert.equal(foreign.status,404);checks.push('Cross-company denial survives process reopening');
 assert.equal((await db.document.findUniqueOrThrow({where:{id:fixture.deletedId}})).deletionStatus,'DELETED');assert.equal(await db.fileRegistry.count({where:{documentId:fixture.deletedId}}),0);assert.equal((await http.get(`/api/documents/${fixture.deletedId}/download`).set('Authorization','Bearer '+await token(fixture.adminId))).status,404);checks.push('Deletion tombstone and removed registry persist across process reopening');
 await fs.writeFile(path.join(lab,'vault-reopen-receipt.json'),JSON.stringify({scope:'Separate Node process; actual retained PostgreSQL records and Windows files, synthetic data only',checks,passed:checks.length},null,2));console.log('Actual reopen checks passed:'+checks.length);
} finally {if(server.listening)await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await db.$disconnect();}
