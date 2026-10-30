import fs from 'node:fs/promises';import path from 'node:path';
const u=new URL(process.env.DATABASE_URL||'http://invalid');if(u.hostname!=='127.0.0.1'||u.port!=='18588'||u.pathname!=='/capital_auth_lab'||!process.env.CAPITAL_LAB_DIR)throw Error('Isolated lab required');
const {default:db}=await import('../src/lib/prisma.js');
try{
 const last=JSON.parse(await fs.readFile(path.join(process.env.CAPITAL_LAB_DIR,'browser-synthetic-login.private.json'),'utf8'));
 const emails=[...new Set(['capital-browser-74e2d0ca-2758-421a-8c88-5276752af030@example.invalid','capital-browser-bb99daba-bd47-4346-be1f-61aea30f56a1@example.invalid',last.email])];
 if(!emails.every(value=>/^capital-browser-[0-9a-f-]+@example\.invalid$/.test(value)))throw Error('Exact synthetic accounts required');
 const users=await db.user.findMany({where:{email:{in:emails},name:'Synthetic Browser Founder',role:'FOUNDER'},select:{id:true}});
 const receipt=await db.$transaction(async tx=>{const ids=users.map(user=>user.id);const disabled=await tx.user.updateMany({where:{id:{in:ids}},data:{isActive:false}});const revoked=await tx.refreshToken.updateMany({where:{userId:{in:ids},revokedAt:null},data:{revokedAt:new Date()}});return {disabledSyntheticBrowserAccounts:disabled.count,newlyRevokedSyntheticRefreshTokens:revoked.count,totalRevokedSyntheticRefreshTokens:await tx.refreshToken.count({where:{userId:{in:ids},revokedAt:{not:null}}}),scope:'Exact three synthetic founder emails from this cycle only; no customer/owner accounts'};});
 await fs.writeFile(path.join(process.env.CAPITAL_LAB_DIR,'owned-browser-cleanup-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await db.$disconnect();}
