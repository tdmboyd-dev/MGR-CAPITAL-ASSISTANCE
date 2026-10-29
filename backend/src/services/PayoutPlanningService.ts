import prisma from '../lib/prisma.js';
import { currentActor } from './CaseDocumentAccess.js';
import { bankingService } from './BankingService.js';
import { AppError } from '../middleware/errorHandler.js';

/** Creates pending accounting allocations. It never sends money or certifies settlement. */
export async function planCasePayout(actorId: string, caseId: string, confirmAmount?: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Case" WHERE id = ${caseId} FOR UPDATE`;
    const actor = await currentActor(tx, actorId);
    if (actor.role !== 'FOUNDER' || actor.tenantId !== null) throw new AppError('Forbidden', 403, 'Global founder financial access required.');
    const record = await tx.case.findUnique({ where: { id: caseId }, include: { assignedEmployee: true } });
    if (!record) throw new AppError('Missing case', 404, 'Case not found.');
    if (confirmAmount !== undefined && (!Number.isSafeInteger(confirmAmount) || confirmAmount !== record.surplusAmountCents)) throw new AppError('Amount mismatch', 400, 'Confirm the recorded surplus amount in integer cents.');
    const existing = await tx.ledgerEntry.findMany({ where: { caseId }, orderBy: { id: 'asc' } });
    if (existing.length) {
      const plan = await tx.auditLog.findFirst({ where: { entityId: caseId, action: 'PAYOUT_PLAN_CREATED' } });
      if (!plan) throw new AppError('Reconciliation required', 409, 'Historical ledger entries require reconciliation before another payout plan.');
      const details = plan.details as Record<string, unknown> | null;
      if (record.status !== 'AWAITING_FUNDS' || !details || details.totalCents !== record.surplusAmountCents || details.feePercent !== record.feePercent || details.clientId !== record.clientId || details.assignedEmployeeId !== record.assignedEmployeeId || existing.some((entry) => entry.status !== 'PENDING' || entry.isPaid)) throw new AppError('Plan changed', 409, 'The case or allocation changed. Reconcile the existing plan before reuse.');
      return { caseId, internalCode: record.internalCode, alreadyProcessed: true, status: 'planned', fundsSubmitted: false, ledgerEntries: existing };
    }
    if (record.status !== 'AWAITING_FUNDS' || !record.fundsReceivedAt) throw new AppError('Not ready', 409, 'A payout plan requires AWAITING_FUNDS and recorded funds receipt.');
    const calculation = bankingService.calculatePayout({ surplusAmountCents: record.surplusAmountCents, feePercent: record.feePercent, employeeTier: record.assignedEmployee?.employeeTier || 'TIER_1_ASSOCIATE' });
    // An unassigned employee cannot receive a commission. Preserve the fee remainder.
    if (!record.assignedEmployeeId) {
      calculation.founderShareCents += calculation.employeeCommissionCents;
      calculation.employeeCommissionCents = 0;
      calculation.employeeDisplayedCommissionCents = 0;
    }
    const entries = [
      { type: 'CLIENT_PAYOUT' as const, userId: record.clientId, amountCents: calculation.clientPayoutCents },
      ...(record.assignedEmployeeId ? [{ type: 'EMPLOYEE_COMMISSION' as const, userId: record.assignedEmployeeId, amountCents: calculation.employeeCommissionCents, displayedAmountCents: calculation.employeeDisplayedCommissionCents }] : []),
      { type: 'FOUNDER_SHARE' as const, userId: actorId, amountCents: calculation.founderShareCents },
    ];
    if (entries.reduce((sum, entry) => sum + entry.amountCents, 0) !== record.surplusAmountCents || entries.some((entry) => !Number.isSafeInteger(entry.amountCents) || entry.amountCents < 0)) throw new AppError('Invalid allocation', 409, 'Payout allocation does not balance.');
    const ledgerEntries = [];
    for (const entry of entries) ledgerEntries.push(await tx.ledgerEntry.create({ data: { ...entry, caseId, tenantId: record.tenantId, description: `Pending allocation for ${record.internalCode}; no transfer submitted`, status: 'PENDING', metadata: { allocationOnly: true, fundsSubmitted: false } } }));
    await tx.auditLog.create({ data: { userId: actorId, tenantId: record.tenantId, action: 'PAYOUT_PLAN_CREATED', entityType: 'CASE', entityId: caseId, details: { totalCents: record.surplusAmountCents, feePercent: record.feePercent, clientId: record.clientId, assignedEmployeeId: record.assignedEmployeeId, entries: ledgerEntries.map((entry) => entry.id), fundsSubmitted: false } } });
    return { caseId, internalCode: record.internalCode, alreadyProcessed: false, status: 'planned', fundsSubmitted: false, calculation, ledgerEntries };
  });
}
