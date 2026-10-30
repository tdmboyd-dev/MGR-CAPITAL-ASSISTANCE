import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || url.port !== '18588' || url.pathname !== '/capital_auth_lab' || !process.env.CAPITAL_LAB_DIR) throw Error('Owned isolated Capital lab required');
const { default: db } = await import('../src/lib/prisma.js');
const { createCapitalCase } = await import('../src/services/CaseCreationService.js');
const { caseService } = await import('../src/services/CaseService.js');
const { ingestionService } = await import('../src/services/IngestionService.js');
const { authService } = await import('../src/services/AuthService.js');
const { default: routes } = await import('../src/routes/cases.js');
const { default: express } = await import('express');
const { default: request } = await import('supertest');
const f = JSON.parse(await fs.readFile(path.join(process.env.CAPITAL_LAB_DIR, 'vault-reopen.private.json'), 'utf8'));
const checks: string[] = [];
const prefix = 'Synthetic atomic ' + crypto.randomUUID();
const app = express(); app.use(express.json()); app.use('/cases', routes);
const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
try {
  const owner = await db.user.findFirstOrThrow({ where: { role: 'FOUNDER', tenantId: null, isActive: true } });
  const original = await db.case.findUniqueOrThrow({ where: { id: f.caseId } });
  await db.stateRule.upsert({where:{stateCode:'FL'},update:{},create:{stateCode:'FL',stateName:'Synthetic Florida schema support only',surplusFundLaw:'SYNTHETIC TEST SUPPORT, NOT LEGAL EVIDENCE',claimPeriodDays:1,requiredDocuments:[],filingMethod:'none',deadlineCalculation:'synthetic schema support only'}});
  await db.countyRule.upsert({where:{stateCode_countyName:{stateCode:'FL',countyName:'Synthetic Atomic Lab'}},update:{},create:{stateCode:'FL',countyName:'Synthetic Atomic Lab'}});
  const base = { clientId: original.clientId, state: 'FL', county: 'Synthetic Atomic Lab', propertyAddress: prefix, surplusAmountCents: 10000, feePercent: 0, saleDate: '2026-01-01' };
  const auth = async (id: string) => 'Bearer ' + authService.generateAccessToken(await db.user.findUniqueOrThrow({ where: { id } })).token;
  const founder = await auth(owner.id), admin = await auth(f.adminId), foreign = await auth(f.foreignId), client = await auth(original.clientId);
  const http = request(server);
  const post = (data: unknown, token = founder) => http.post('/cases').set('Authorization', token).send(data);
  assert.equal((await http.post('/cases').send(base)).status, 401);
  assert.equal((await post(base, client)).status, 403);
  assert.equal((await post(base, foreign)).status, 404);
  checks.push('Anonymous, client and foreign-company creation denied by actual HTTP authority');
  const created = await post(base, admin); assert.equal(created.status, 201);
  const saved = await db.case.findUniqueOrThrow({ where: { id: created.body.data.id } });
  assert.equal(saved.tenantId, original.tenantId); assert.equal(saved.feePercent, 0);
  assert.match(saved.publicAccessToken, /^[a-f0-9]{64}$/);
  assert.equal(await db.auditLog.count({ where: { entityId: saved.id, action: 'CASE_CREATED' } }), 1);
  assert.ok(await db.deadline.count({ where: { caseId: saved.id } }) > 0);
  checks.push('Case, derived tenant, zero fee, cryptographic token, deadlines and audit commit together');
  const before = await db.case.count();
  for (const data of [{ ...base, surplusAmountCents: -1 }, { ...base, surplusAmountCents: 1.1 }, { ...base, feePercent: 101 }, { ...base, saleDate: '2026-02-30' }, { ...base, tenantId: 'forged' }]) assert.equal((await post(data)).status, 400);
  assert.equal(await db.case.count(), before); checks.push('Malformed amounts, invalid calendar date and forged server-owned fields create no case');
  const simultaneous = await Promise.all([
    createCapitalCase({ ...base, propertyAddress: prefix + ' A' }, owner.id),
    createCapitalCase({ ...base, propertyAddress: prefix + ' B' }, owner.id),
    caseService.createFromIngestion({ ...base, propertyAddress: prefix + ' C', saleDate: new Date('2026-01-01T00:00:00Z') }),
    caseService.createFromIngestion({ ...base, propertyAddress: prefix + ' D', saleDate: new Date('2026-01-01T00:00:00Z') }),
  ]);
  assert.equal(new Set(simultaneous.map(row => row.internalCode)).size, 4);
  assert.ok(simultaneous.every(row => /^C-\d{6,}$/.test(row.internalCode)));
  checks.push('Concurrent manual and trusted service creators share unique sequential codes');
  const highest = simultaneous.sort((a,b) => Number(a.internalCode.slice(2)) - Number(b.internalCode.slice(2))).at(-1)!;
  await db.case.delete({ where: { id: highest.id } });
  const next = await createCapitalCase({ ...base, propertyAddress: prefix + ' after delete' }, owner.id);
  assert.ok(Number(next.internalCode.slice(2)) > Number(highest.internalCode.slice(2)));
  checks.push('Deleting a just-created synthetic case does not reuse its issued code');
  const requestKey = crypto.randomUUID();
  const retryPayload = { ...base, propertyAddress: prefix + ' idempotent request' };
  const retried = await Promise.all([http.post('/cases').set('Authorization', founder).set('Idempotency-Key',requestKey).send(retryPayload),http.post('/cases').set('Authorization', founder).set('Idempotency-Key',requestKey).send(retryPayload)]);
  assert.ok(retried.every(response=>response.status===201));assert.equal(retried[0].body.data.id,retried[1].body.data.id);
  const replay=await http.post('/cases').set('Authorization',founder).set('Idempotency-Key',requestKey).send(retryPayload);assert.equal(replay.body.data.id,retried[0].body.data.id);
  assert.equal((await http.post('/cases').set('Authorization',founder).set('Idempotency-Key',requestKey).send({...retryPayload,propertyAddress:prefix+' changed retry'})).status,409);
  checks.push('Concurrent and lost-response retries reuse one durable request receipt; changed input conflicts');
  const counter = await db.founderConfig.findUniqueOrThrow({ where: { key: 'capital.sequence.case-code.v1' } });
  const countBeforeFailure = await db.case.count();
  for (const [table, condition] of [['AuditLog', "NEW.action='CASE_CREATED'"], ['Deadline', 'true']]) {
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION capital_atomic_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'synthetic atomic failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER capital_atomic_failure BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION capital_atomic_failure()`);
    try { assert.equal((await post({ ...base, propertyAddress: prefix + ' failure ' + table })).status, 503); }
    finally { await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS capital_atomic_failure ON "${table}"`); await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS capital_atomic_failure()'); }
    assert.equal(await db.case.count(), countBeforeFailure);
    assert.deepEqual((await db.founderConfig.findUniqueOrThrow({ where: { key: counter.key } })).value, counter.value);
    checks.push('Actual ' + table + ' failure rolls back case, allocation counter and dependent writes');
  }
  await db.founderConfig.update({ where: { key: counter.key }, data: { value: { lastIssued: 'corrupt' } } });
  try { assert.equal((await post({ ...base, propertyAddress: prefix + ' corrupt counter' })).status, 409); }
  finally { await db.founderConfig.update({ where: { key: counter.key }, data: { value: counter.value! } }); }
  checks.push('Malformed durable counter fails closed instead of resetting case numbers');
  const source = await db.ingestionSource.create({ data: { name: prefix, type: 'BULK_UPLOAD', state: base.state, county: base.county } });
  const batch = await db.ingestionBatch.create({ data: { sourceId: source.id } });
  const record = await db.ingestionRecord.create({ data: { batchId: batch.id, rawData: { synthetic: true } } });
  const parsed = { ownerName: 'Synthetic acquisition only', propertyAddress: prefix + ' ingestion', parcelNumber: null, saleDate: new Date('2026-01-01T00:00:00Z'), saleAmount: 20000, surplusAmount: 10000, city: null, state: base.state, county: base.county, zipCode: null, rawData: { synthetic: true } };
  assert.equal(await (ingestionService as any).createCaseFromRecord(record.id, parsed), true);
  const linked = await db.ingestionRecord.findUniqueOrThrow({ where: { id: record.id } });
  const imported = await db.case.findUniqueOrThrow({ where: { id: linked.caseId! } });
  assert.ok(Number(imported.internalCode.slice(2)) > Number(next.internalCode.slice(2)));
  assert.ok(await db.deadline.count({ where: { caseId: imported.id } }) > 0);
  checks.push('Actual ingestion creator uses the same durable allocator and transactional deadline writer');
  await fs.writeFile(path.join(process.env.CAPITAL_LAB_DIR, 'case-creation-receipt.json'), JSON.stringify({ scope: 'Actual Express/JWT/PostgreSQL with synthetic cases; deadline consistency only, no current-law/claimant/filing proof', passed: checks.length, checks, reopenCaseId: saved.id }, null, 2));
  console.log('Atomic case creation checks passed: ' + checks.length);
} finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
