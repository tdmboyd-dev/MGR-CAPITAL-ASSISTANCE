import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { currentActor, requireCase } from './CaseDocumentAccess.js';
import { legalService } from './LegalService.js';
import { enforceStateFeeCap } from '../data/stateRules.js';
import { recordDate } from '../parsers/RecordValues.js';

const COUNTER_KEY = 'capital.sequence.case-code.v1';
/** Call only inside the transaction that creates the case. Retains the high-water
 * mark after deletion, without adding a production schema or resetting old codes. */
export async function allocateCaseCode(tx: Prisma.TransactionClient): Promise<string> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(20641029, 1)::text AS locked`;
  const rows = await tx.$queryRaw<{ maximum: string }[]>`SELECT COALESCE(MAX(substring("internalCode" from '^C-([0-9]+)$')::numeric), 1000)::text AS maximum FROM "Case"`;
  const existingMaximum = Number(rows[0].maximum);
  const counter = await tx.founderConfig.findUnique({ where: { key: COUNTER_KEY } });
  const persisted = counter ? (counter.value as { lastIssued?: unknown }).lastIssued : 1000;
  if (!Number.isSafeInteger(existingMaximum) || !Number.isSafeInteger(persisted) || Number(persisted) < 1000) throw new AppError('Counter invalid', 409, 'Case numbering requires reconciliation.');
  const next = Math.max(existingMaximum, Number(persisted), 1000) + 1;
  if (!Number.isSafeInteger(next)) throw new AppError('Counter exhausted', 409, 'Case numbering requires reconciliation.');
  await tx.founderConfig.upsert({ where: { key: COUNTER_KEY }, create: { key: COUNTER_KEY, value: { lastIssued: next }, description: 'Reserved durable case number high-water mark; do not reset' }, update: { value: { lastIssued: next } } });
  return `C-${String(next).padStart(6, '0')}`;
}

const inputSchema = z.object({
  clientId: z.string().min(1).max(100),
  state: z.string().regex(/^[A-Z]{2}$/),
  county: z.string().trim().min(1).max(100),
  propertyAddress: z.string().trim().min(1).max(2000),
  parcelNumber: z.string().max(200).nullish(),
  saleDate: z.union([z.string(), z.date()]).nullish(),
  surplusAmountCents: z.number().int().min(0).max(2147483647).default(0),
  feePercent: z.number().int().min(0).max(100).default(33),
  assignedEmployeeId: z.string().min(1).max(100).nullish(),
  source: z.string().max(200).default('manual'),
}).strict();

/** Actor is supplied by authenticated server code, never taken from request data.
 * Omitting it is reserved for trusted ingestion entrypoints, not public routes. */
export async function createCapitalCase(payload: unknown, actorId?: string, idempotencyKey?: string) {
  if (idempotencyKey !== undefined && (!actorId || !/^[a-zA-Z0-9-]{16,100}$/.test(idempotencyKey))) throw new AppError('Invalid request key', 400, 'Invalid case creation request key.');
  const parsed = inputSchema.safeParse(payload);
  if (!parsed.success) throw new AppError('Invalid case', 400, 'Invalid case fields, amounts or assignment.');
  const input = parsed.data;
  let saleDate: Date | null = null;
  if (input.saleDate) {
    try {
      const text = input.saleDate instanceof Date ? input.saleDate.toISOString() : input.saleDate;
      if (!/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(text)) throw Error('Date-only input required');
      saleDate = recordDate(text.slice(0, 10));
    } catch { throw new AppError('Invalid sale date', 400, 'Sale date must be a valid calendar date.'); }
  }
  return prisma.$transaction(async (tx) => {
    const actor = actorId ? await currentActor(tx, actorId) : null;
    if (actor && !['FOUNDER', 'ADMIN'].includes(actor.role)) throw new AppError('Forbidden', 403, 'Case management access required.');
    const client = await tx.user.findFirst({ where: { id: input.clientId, role: 'CLIENT', isActive: true, ...(actor && !(actor.role === 'FOUNDER' && actor.tenantId === null) ? { tenantId: actor.tenantId } : {}) }, select: { tenantId: true, tenant: { select: { isActive: true } } } });
    if (!client || client.tenant?.isActive === false) throw new AppError('Client missing', 404, 'Client not found.');
    if (input.assignedEmployeeId && !await tx.user.findFirst({ where: { id: input.assignedEmployeeId, role: 'EMPLOYEE', tenantId: client.tenantId, isActive: true }, select: { id: true } })) throw new AppError('Invalid employee', 400, 'Employee must belong to the case company.');
    const requestKeyHash = idempotencyKey ? createHash('sha256').update(`${actorId}:${idempotencyKey}`).digest('hex') : null;
    const payloadHash = createHash('sha256').update(JSON.stringify({ ...input, saleDate: saleDate?.toISOString() ?? null })).digest('hex');
    if (requestKeyHash) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${requestKeyHash})::bigint)::text AS locked`;
      const prior = await tx.case.findFirst({ where: { metadata: { path: ['creationRequest', 'keyHash'], equals: requestKeyHash } } });
      if (prior) {
        await requireCase(tx, actorId!, prior.id, 'manage');
        const receipt = (prior.metadata as { creationRequest: { payloadHash: string } }).creationRequest;
        if (receipt.payloadHash !== payloadHash) throw new AppError('Request changed', 409, 'This request key already created a different case input. Review the saved case before retrying.');
        return tx.case.findUniqueOrThrow({ where: { id: prior.id }, include: { client: { select: { name: true, email: true } } } });
      }
    }
    const internalCode = await allocateCaseCode(tx);
    const fee = enforceStateFeeCap(input.state, input.feePercent, input.surplusAmountCents);
    const created = await tx.case.create({ data: { ...input, saleDate, feePercent: fee.effectiveFeePercent, internalCode, publicAccessToken: randomBytes(32).toString('hex'), tenantId: client.tenantId, status: 'NEW', priority: input.surplusAmountCents >= 1000000 ? 100 : 50, ...(requestKeyHash ? { metadata: { creationRequest: { keyHash: requestKeyHash, payloadHash } } } : {}) }, include: { client: { select: { name: true, email: true } } } });
    if (saleDate && legalService.getStateRules(input.state)) await legalService.createCaseDeadlines(created.id, input.state, saleDate, tx);
    await tx.auditLog.create({ data: { userId: actorId, tenantId: client.tenantId, action: 'CASE_CREATED', entityType: 'CASE', entityId: created.id, details: { internalCode, state: input.state, county: input.county, source: input.source } } });
    return created;
  }, { maxWait: 10000, timeout: 20000 });
}
