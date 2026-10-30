import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const url=new URL(process.env.DATABASE_URL??'http://invalid');if(url.hostname!=='127.0.0.1'||url.port!=='18588'||url.pathname!=='/capital_auth_lab'||!process.env.CAPITAL_LAB_DIR)throw Error('Exact isolated lab required');
const {default:db}=await import('../src/lib/prisma.js');
const lab=process.env.CAPITAL_LAB_DIR!,emails=new Set<string>(),ids=new Set<string>();
try{
 for(const name of ['browser-lint-first-login.private.json','browser-lint-second-login.private.json','browser-lint-third-login.private.json','browser-synthetic-login.private.json','browser-payroll-login.private.json']){
  try{const data=JSON.parse(await fs.readFile(path.join(lab,name),'utf8'));if(data.email){assert.match(data.email,/^capital-(browser-|payroll-employee-).+@example\.invalid$/);emails.add(data.email);}for(const id of data.userIds??[])ids.add(id);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }
 const payroll=JSON.parse(await fs.readFile(path.join(lab,'browser-payroll-login.private.json'),'utf8'));
 const record=await db.ledgerEntry.findFirstOrThrow({where:{caseId:payroll.caseId,type:'EMPLOYEE_COMMISSION'}});
 assert.equal(record.amountCents,1234);assert.equal(record.displayedAmountCents,2468);assert.equal(record.status,'PENDING');assert.equal(record.isPaid,false);
 const settings=await db.founderConfig.findUniqueOrThrow({where:{key:'master_settings'}});
 assert.equal((settings.value as Record<string,unknown>).activity_tracking,true);
 const work=await db.capitalRecoveryItem.count();assert.equal(work,194);
 const users=await db.user.findMany({where:{OR:[{email:{in:[...emails]}},{id:{in:[...ids]}}]},select:{id:true,email:true}});
 assert.ok(users.length>=4);assert.ok(users.every(row=>/^capital-(browser-|payroll-(employee|client)-).+@example\.invalid$/.test(row.email)));
 const userIds=users.map(row=>row.id);const disabled=await db.user.updateMany({where:{id:{in:userIds}},data:{isActive:false}});
 const revoked=await db.refreshToken.updateMany({where:{userId:{in:userIds},revokedAt:null},data:{revokedAt:new Date()}});
 assert.equal(await db.user.count({where:{id:{in:userIds},isActive:true}}),0);
 await fs.writeFile(path.join(lab,'frontend-cycle-closeout-receipt.json'),JSON.stringify({warehouseWorkItems:work,activityTrackingRestored:true,rawSyntheticLedger:{amountCents:record.amountCents,legacyDisplayCents:record.displayedAmountCents,status:record.status,isPaid:record.isPaid},exactSyntheticBrowserAccountsDisabled:disabled.count,refreshTokensRevoked:revoked.count,scope:'Separate process database corroboration; no historical ledger rewrite, provider charge or bank transfer'},null,2));
 console.log('Closeout database corroboration passed; exact synthetic browser accounts disabled',disabled.count);
}finally{await db.$disconnect();}
