import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const url=new URL(process.env.DATABASE_URL||'http://invalid');
if(url.hostname!=='127.0.0.1'||url.port!=='18588'||url.pathname!=='/capital_auth_lab'||!process.env.CAPITAL_LAB_DIR)throw Error('Owned lab required');
const {default:db}=await import('../src/lib/prisma.js');
const {sourceRecordHash}=await import('../src/services/CapitalSourceWarehouse.js');
try {
 const root=process.env.CAPITAL_LAB_DIR;
 const previous=JSON.parse(await fs.readFile(path.join(root,'owned-email-warehouse-receipt.json'),'utf8'));
 const snapshot=await db.capitalSourceSnapshot.findUniqueOrThrow({where:{id:previous.snapshotId},include:{records:true}});
 const hash=(input:Uint8Array|string)=>crypto.createHash('sha256').update(input).digest('hex');
 assert.equal(hash(snapshot.rawBytes),snapshot.sha256);assert.equal(snapshot.rawBytes.length,snapshot.byteLength);
 assert.equal(snapshot.records.length,41);
 for(const row of snapshot.records)assert.equal(sourceRecordHash(row.normalized),row.sha256);
 const accepted=await db.capitalEmailJob.findUniqueOrThrow({where:{id:previous.reopenEmailId}});
 assert.equal(accepted.status,'ACCEPTED');assert.ok(accepted.acceptedAt);assert.ok(accepted.messageId);assert.equal(accepted.attempts,1);
 const unknown=await db.capitalEmailJob.findFirstOrThrow({where:{status:'UNKNOWN',recipient:'synthetic@example.invalid'},orderBy:{createdAt:'desc'}});
 assert.equal(unknown.leaseUntil,null);assert.ok(unknown.lastError?.includes('reconcil'));
 const pipelineReceipt=JSON.parse(await fs.readFile(path.join(root,'recovery-pipeline-receipt.json'),'utf8'));
 const work=await db.capitalRecoveryItem.findUniqueOrThrow({where:{id:pipelineReceipt.reopenItemId},include:{observations:true}});
 assert.equal(work.stage,'RESEARCHING');assert.ok(work.notes.length>0);assert.ok(work.observations.length>=2);const workCheckCount=await db.capitalRecoveryDocketCheck.count({where:{itemId:work.id}});assert.equal(work.externalClaimStatus,workCheckCount?'DOCKET_REVIEW_REQUIRED':'NOT_CHECKED');
 const docket=JSON.parse(await fs.readFile(path.join(root,'davidson-docket-receipt.json'),'utf8'));const source=await db.capitalSourceSnapshot.findUniqueOrThrow({where:{id:docket.snapshotId}});assert.equal(hash(source.rawBytes),docket.sha256);const checks=await db.capitalRecoveryDocketCheck.findMany({where:{itemId:docket.reopenItemId,snapshotId:docket.snapshotId}});assert.equal(checks.length,1);assert.equal((checks[0].signals as {paidVerified:boolean}).paidVerified,false);
 const receipt={passed:5,checks:['Original county bytes and41 normalized row hashes survive fresh process','Accepted SMTP receipt survives with one attempt','Unknown SMTP outcome remains held after reopening','Individual recovery work, notes, stage, source history and unresolved outside status survive fresh process','Actual saved rendered docket bytes/hash and parcel-specific check survive fresh process without certifying payment'],proof:'Fresh Node process against isolated PostgreSQL; loopback SMTP is not external delivery'};
 await fs.writeFile(path.join(root,'owned-systems-reopen-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await db.$disconnect();}
