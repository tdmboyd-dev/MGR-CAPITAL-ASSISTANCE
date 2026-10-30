import prisma from '../lib/prisma.js';
import { currentActor } from './CaseDocumentAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import type { LedgerEntry, LedgerEntryType } from '@prisma/client';

export const EMPLOYEE_EARNING_TYPES:LedgerEntryType[]=['COMMISSION','EMPLOYEE_COMMISSION','OVERRIDE'];
type EarningRow=Pick<LedgerEntry,'id'|'caseId'|'type'|'amountCents'|'displayedAmountCents'|'status'|'isPaid'|'paidAt'|'paymentRef'|'reference'|'createdAt'>;
/** Owner decision 2026-10-30: employee dollars are payable amounts, never inflated display dollars.
 * This is a projection of saved allocations. No status alone proves bank settlement.
 */
export function projectEmployeeEarnings<T extends EarningRow>(entries:T[],now=new Date()){
 const active=entries.filter(row=>!['FAILED','CANCELLED'].includes(row.status));
 const counts=new Map<string,number>();
 const key=(row:T)=>`${row.caseId}:${row.type==='OVERRIDE'?'override':'commission'}`;
 for(const row of active)counts.set(key(row),(counts.get(key(row))||0)+1);
 const rows=entries.map(row=>{
  const inconsistentPaidFlag=(row.status==='COMPLETED')!==row.isPaid;
  const missingPaidRecord=row.isPaid&&(!row.paidAt||!(row.paymentRef||row.reference));
  const reconciliationRequired=!Number.isSafeInteger(row.amountCents)||row.amountCents<0||row.amountCents>2147483647||inconsistentPaidFlag||Boolean(missingPaidRecord)||(!['FAILED','CANCELLED'].includes(row.status)&&(counts.get(key(row))||0)>1);
  return {...row,payableAmountCents:reconciliationRequired?null:['FAILED','CANCELLED'].includes(row.status)?0:row.amountCents,reconciliationRequired,legacyDisplayAdjusted:row.displayedAmountCents!==null&&row.displayedAmountCents!==row.amountCents};
 });
 const eligible=rows.filter(row=>!row.reconciliationRequired&&!['FAILED','CANCELLED'].includes(row.status));
 const startOfMonth=new Date(now.getFullYear(),now.getMonth(),1);
 const total=(items:typeof eligible)=>items.reduce((sum,row)=>sum+row.amountCents,0);
 return {rows,lifetimeEarningsCents:total(eligible),thisMonthCents:total(eligible.filter(row=>row.createdAt>=startOfMonth)),pendingCents:total(eligible.filter(row=>['PENDING','PROCESSING'].includes(row.status))),recordedCompletedCents:total(eligible.filter(row=>row.status==='COMPLETED')),reconciliationCount:rows.filter(row=>row.reconciliationRequired).length,basis:'payable_allocations_not_bank_settlement' as const};
}
export async function getOwnEmployeeEarnings(employeeId:string){
 const actor=await currentActor(prisma,employeeId);
 if(!['EMPLOYEE','TEAM_LEAD','FOUNDER'].includes(actor.role))throw new AppError('Forbidden',403,'Own employee earnings access required.');
 const entries=await prisma.ledgerEntry.findMany({where:{userId:employeeId,type:{in:EMPLOYEE_EARNING_TYPES},case:{tenantId:actor.tenantId},OR:[{tenantId:actor.tenantId},{tenantId:null}]},include:{case:{select:{internalCode:true,propertyAddress:true,county:true,state:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}]});
 return projectEmployeeEarnings(entries);
}
export function employeeEarningsSummary(view:Awaited<ReturnType<typeof getOwnEmployeeEarnings>>){
 return {lifetimeEarningsCents:view.lifetimeEarningsCents,thisMonthCents:view.thisMonthCents,pendingCents:view.pendingCents,recordedCompletedCents:view.recordedCompletedCents,reconciliationCount:view.reconciliationCount,basis:view.basis};
}
