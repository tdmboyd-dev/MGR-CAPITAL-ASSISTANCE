import { CaseStatus, type Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireCase } from './CaseDocumentAccess.js';
import { validateTransition, getAutoUpdateFields } from '../utils/caseLifecycle.js';
import { notificationCenterService } from './NotificationCenterService.js';

async function lockCase(tx: Prisma.TransactionClient, caseId: string) {
  await tx.$queryRaw`SELECT id FROM "Case" WHERE id = ${caseId} FOR UPDATE`;
}

export async function transitionCase(actorId: string, caseId: string, status: CaseStatus, options: { employeeOnly?: boolean; forceTransition?: boolean; notes?: string } = {}) {
  if (!Object.values(CaseStatus).includes(status) || (options.notes !== undefined && (typeof options.notes !== 'string' || options.notes.length > 4000)) || (options.forceTransition !== undefined && typeof options.forceTransition !== 'boolean')) throw new AppError('Invalid transition', 400, 'Invalid case transition fields.');
  if (status === 'PAID') throw new AppError('Settlement unavailable', 409, 'A status edit cannot certify settlement. Complete payout reconciliation first.');
  return prisma.$transaction(async (tx) => {
    await lockCase(tx, caseId);
    const { actor, record: previous } = await requireCase(tx, actorId, caseId, options.employeeOnly ? 'read' : 'manage');
    if (options.employeeOnly && (previous.assignedEmployeeId !== actorId || !['FOUNDER', 'ADMIN', 'EMPLOYEE'].includes(actor.role) || !['CONTACTED', 'DOCS_PENDING'].includes(status))) throw new AppError('Forbidden', 403, 'Assigned employee transition required.');
    const documents = await tx.document.findMany({ where: { caseId, deletionStatus: { not: 'DELETED' } }, select: { id: true, type: true, status: true } });
    const validation = validateTransition(previous.status, status, { ...previous, documents });
    if (!validation.valid && !(options.forceTransition === true && actor.role === 'FOUNDER')) throw new AppError('Invalid transition', 400, validation.errors.join('. '));
    if (previous.status === status) return { record: previous, previous, validation, changed: false };
    const record = await tx.case.update({ where: { id: caseId }, data: { status, ...getAutoUpdateFields(status) } });
    await tx.auditLog.create({ data: { userId: actorId, tenantId: previous.tenantId, action: options.employeeOnly ? 'EMPLOYEE_STATUS_UPDATE' : 'STATUS_CHANGED', entityType: 'CASE', entityId: caseId, details: { previousStatus: previous.status, newStatus: status, notes: options.notes, forced: !validation.valid && options.forceTransition === true, warnings: validation.warnings } } });
    const client = await tx.user.findUnique({ where: { id: record.clientId }, select: { isActive: true } });
    if (client?.isActive) await notificationCenterService.sendNotification({ userId: record.clientId, category: 'case_update', title: 'Case status updated', message: 'Your case status has changed. Open your case for the current information.', link: `/client/cases/${caseId}`, metadata: { caseId } }, tx);
    return { record, previous, validation, changed: true };
  }, { maxWait: 10000, timeout: 20000 });
}

export async function assignCaseEmployee(actorId: string, caseId: string, employeeId: string) {
  return prisma.$transaction(async (tx) => {
    await lockCase(tx, caseId);
    const { record } = await requireCase(tx, actorId, caseId, 'manage');
    const employee = await tx.user.findFirst({ where: { id: employeeId, role: 'EMPLOYEE', isActive: true, tenantId: record.tenantId }, select: { id: true } });
    if (!employee) throw new AppError('Invalid assignment', 400, 'Employee must belong to the case company.');
    if (record.assignedEmployeeId === employeeId) return record;
    const updated = await tx.case.update({ where: { id: caseId }, data: { assignedEmployeeId: employeeId }, include: { client: { select: { name: true } }, assignedEmployee: { select: { id: true, name: true, email: true } } } });
    await tx.auditLog.create({ data: { userId: actorId, tenantId: record.tenantId, action: 'EMPLOYEE_ASSIGNED', entityType: 'CASE', entityId: caseId, details: { employeeId, previousEmployeeId: record.assignedEmployeeId } } });
    await notificationCenterService.sendNotification({ userId: employeeId, category: 'case_update', priority: 'high', title: 'New case assignment', message: 'A case has been assigned to you. Open your case list for details.', link: `/employee/cases/${caseId}`, metadata: { caseId } }, tx);
    return updated;
  });
}

export async function updateCaseFields(actorId: string, caseId: string, data: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    await lockCase(tx, caseId);
    const { actor, record } = await requireCase(tx, actorId, caseId, 'manage');
    const text = ['propertyAddress', 'parcelNumber', 'county', 'state', 'notes', 'source'];
    const money = ['surplusAmountCents', 'feePercent', 'estimatedFeeCents', 'actualFeeCents', 'clientPayoutCents'];
    for (const [key, value] of Object.entries(data)) {
      if (money.includes(key) || key === 'priority') {
        if ((money.includes(key) && actor.role !== 'FOUNDER') || !Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > (key === 'feePercent' ? 100 : 2147483647)) throw new AppError('Invalid amount', 400, 'Invalid or unavailable case financial fields.');
      } else if (key === 'saleDate') {
        if (value !== null && (!(value instanceof Date) || !Number.isFinite(value.getTime()))) throw new AppError('Invalid date', 400, 'Invalid sale date.');
      } else if (!text.includes(key) || typeof value !== 'string' || value.length > 2000) throw new AppError('Invalid fields', 400, 'Unsupported case fields.');
    }
    const updated = await tx.case.update({ where: { id: caseId }, data: data as Prisma.CaseUncheckedUpdateInput, include: { client: { select: { name: true, email: true } } } });
    await tx.auditLog.create({ data: { userId: actorId, tenantId: record.tenantId, action: 'CASE_UPDATED', entityType: 'CASE', entityId: caseId, details: { updatedFields: Object.keys(data) } } });
    return updated;
  });
}
