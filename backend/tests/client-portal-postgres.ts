import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || url.port !== '18588' || url.pathname !== '/capital_auth_lab' || !process.env.CAPITAL_LAB_DIR) throw Error('Owned isolated Capital lab required');
const { default: db } = await import('../src/lib/prisma.js');
const { authService } = await import('../src/services/AuthService.js');
const { createCapitalCase } = await import('../src/services/CaseCreationService.js');
const { default: clients } = await import('../src/routes/clients.js');
const { globalErrorHandler } = await import('../src/middleware/errorHandler.js');
const { default: express } = await import('express');
const { default: request } = await import('supertest');
const { default: cases } = await import('../src/routes/cases.js');
const app = express(); app.use(express.json()); app.use('/clients', clients); app.use('/cases', cases); app.use(globalErrorHandler);
const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
const checks: string[] = [];
try {
  const f = JSON.parse(await fs.readFile(path.join(process.env.CAPITAL_LAB_DIR, 'vault-reopen.private.json'), 'utf8'));
  const owner = await db.user.findFirstOrThrow({ where: { role: 'FOUNDER', tenantId: null, isActive: true } });
  const administrator = await db.user.findUniqueOrThrow({ where: { id: f.adminId } });
  const foreignUser = await db.user.findUniqueOrThrow({ where: { id: f.foreignId } });
  const token = async (id: string) => 'Bearer ' + authService.generateAccessToken(await db.user.findUniqueOrThrow({ where: { id } })).token;
  const admin = await token(administrator.id), founder = await token(owner.id);
  const other = await db.user.create({ data: { email: `portal-other-${crypto.randomUUID()}@example.invalid`, name: 'Synthetic Other Company Client', role: 'CLIENT', passwordHash: 'unusable-test-hash', tenantId: foreignUser.tenantId } });
  const http = request(server);
  const listed = await http.get('/clients').set('Authorization', admin); assert.equal(listed.status, 200); assert.ok(!listed.body.data.some((row: any) => row.id === other.id));
  assert.equal((await http.get('/clients/' + other.id).set('Authorization', admin)).status, 404);
  assert.equal((await http.patch('/clients/' + other.id).set('Authorization', admin).send({ name: 'Unauthorized' })).status, 404);
  assert.equal((await http.patch('/clients/' + owner.id).set('Authorization', admin).send({ name: 'Unauthorized' })).status, 404);
  checks.push('Company-scoped client listing/detail/edit cannot reach another company or non-client staff');
  const input = { email: `portal-native-${crypto.randomUUID()}@example.invalid`, name: 'Synthetic Portal Client' };
  assert.equal((await http.post('/clients').set('Authorization', admin).send({ ...input, tenantId: null })).status, 400);
  const created = await http.post('/clients').set('Authorization', admin).send(input); assert.equal(created.status, 201);
  const client = await db.user.findUniqueOrThrow({ where: { id: created.body.data.id } }); assert.equal(client.tenantId, administrator.tenantId);
  assert.equal(await db.auditLog.count({ where: { action: 'CLIENT_CREATED', entityId: client.id } }), 1);
  checks.push('Client creation derives company and commits its audit; forged company fields are rejected');
  const beforeUsers = await db.user.count();
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION capital_client_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='CLIENT_CREATED' THEN RAISE EXCEPTION 'synthetic client audit failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe('CREATE TRIGGER capital_client_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION capital_client_audit_failure()');
  try { assert.equal((await http.post('/clients').set('Authorization', admin).send({ ...input, email: `failed-${crypto.randomUUID()}@example.invalid` })).status, 500); }
  finally { await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS capital_client_audit_failure ON "AuditLog"'); await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS capital_client_audit_failure()'); }
  assert.equal(await db.user.count(), beforeUsers); checks.push('Actual client audit failure rolls back client creation');
  const receipt = JSON.parse(await fs.readFile(path.join(process.env.CAPITAL_LAB_DIR, 'case-creation-receipt.json'), 'utf8'));
  const template = await db.case.findUniqueOrThrow({ where: { id: receipt.reopenCaseId } });
  const owned = await createCapitalCase({ clientId: client.id, state: template.state, county: template.county, propertyAddress: 'Synthetic portal ' + crypto.randomUUID(), surplusAmountCents: 10000, feePercent: 0 }, owner.id);
  const otherCase = await createCapitalCase({ clientId: other.id, state: template.state, county: template.county, propertyAddress: 'Synthetic foreign portal ' + crypto.randomUUID(), surplusAmountCents: 10000, feePercent: 0 }, owner.id);
  const agreement = await db.document.create({ data: { caseId: owned.id, type: 'CLIENT_SERVICE_AGREEMENT', status: 'PENDING_SIGNATURE', uploadedById: owner.id, fileName: 'synthetic-unqualified.pdf', fileUrl: 'unavailable:synthetic-test-bytes', fileSize: 0, mimeType: 'application/pdf', signatureRequired: true } });
  const internal = await db.document.create({ data: { caseId: owned.id, type: 'FILING_PACKET', status: 'SUBMITTED', uploadedById: owner.id, fileName: 'synthetic-internal.pdf', fileUrl: 'unavailable:synthetic-test-bytes', fileSize: 0, mimeType: 'application/pdf', signatureRequired: false } });
  const countDocuments = await db.document.count();
  assert.equal((await http.post(`/clients/portal/${owned.publicAccessToken}/id-upload`).send({ fileName: 'fake.pdf', fileUrl: 'https://example.invalid/not-saved', fileSize: 100, mimeType: 'application/pdf' })).status, 409);
  assert.equal((await http.post(`/clients/portal/${owned.publicAccessToken}/sign/${agreement.id}`).send({ signatureData: 'unverified-pasted-image' })).status, 503);
  assert.equal(await db.document.count(), countDocuments); assert.equal((await db.document.findUniqueOrThrow({ where: { id: agreement.id } })).signedAt, null);
  checks.push('Legacy URL upload and pasted signature cannot create document bytes or signed state');
  assert.equal((await http.post(`/clients/documents/${agreement.id}/status`).set('Authorization', founder).send({ status: 'SIGNED', forceTransition: true })).status, 409);
  checks.push('Founder force-status cannot bypass signature evidence');
  const portal = await http.get(`/clients/portal/${owned.publicAccessToken}`); assert.equal(portal.status, 200);
  assert.ok(portal.body.data.documents.some((row: any) => row.id === agreement.id)); assert.ok(!portal.body.data.documents.some((row: any) => row.id === internal.id));
  checks.push('Public portal contains only admitted client documents, not internal filing packets');
  assert.equal((await http.patch(`/clients/portal/${owned.publicAccessToken}/info`).send({ email: 'takeover@example.invalid' })).status, 400);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: client.id } })).email, input.email);
  checks.push('Possession of a portal link cannot replace the login email');
  await db.user.update({ where: { id: client.id }, data: { isActive: false } });
  try { assert.equal((await http.get(`/clients/portal/${owned.publicAccessToken}`)).status, 404); }
  finally { await db.user.update({ where: { id: client.id }, data: { isActive: true } }); }
  checks.push('Inactive account revokes public portal access');
  assert.equal((await http.post('/clients/portal-link/' + otherCase.id).set('Authorization', admin).send({ action: 'copy' })).status, 404);
  assert.equal((await http.patch('/clients/portal-settings/' + owned.id).set('Authorization', admin).send({ portalDissolveAfterDays: -1 })).status, 400);
  const communications = await db.communication.count({ where: { caseId: owned.id } });
  assert.equal((await http.post('/clients/portal-link/' + owned.id).set('Authorization', admin).send({ action: 'sms' })).status, 503);
  assert.equal(await db.communication.count({ where: { caseId: owned.id } }), communications);
  checks.push('Cross-company portal management, negative expiry and fake sent messages are rejected');
  const copied = await http.post('/clients/portal-link/' + owned.id).set('Authorization', admin).send({ action: 'copy' }); assert.equal(copied.status, 200);
  const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: owned.id, action: 'PORTAL_LINK_GENERATED' } }); assert.ok(!JSON.stringify(audit.details).includes(owned.publicAccessToken));
  checks.push('Explicit copy returns a portal link while audit records omit its bearer token');
  const expired = new Date(Date.now() - 86400000);
  await db.case.update({ where: { id: owned.id }, data: { portalExpiresAt: expired, portalKeptAlive: false } });
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION capital_client_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PORTAL_LINK_GENERATED' THEN RAISE EXCEPTION 'synthetic portal audit failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe('CREATE TRIGGER capital_client_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION capital_client_audit_failure()');
  try { assert.equal((await http.post('/clients/portal-link/' + owned.id).set('Authorization', admin).send({ action: 'copy' })).status, 500); }
  finally { await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS capital_client_audit_failure ON "AuditLog"'); await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS capital_client_audit_failure()'); }
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: owned.id } })).portalExpiresAt?.getTime(), expired.getTime());
  const renewed = await http.post('/clients/portal-link/' + owned.id).set('Authorization', admin).send({ action: 'copy' });
  assert.equal(renewed.status, 200); assert.ok(Date.parse(renewed.body.data.expiresAt) > Date.now());
  assert.equal(renewed.body.data.expiresAt, (await db.case.findUniqueOrThrow({ where: { id: owned.id } })).portalExpiresAt?.toISOString());
  checks.push('Portal renewal and audit roll back together; successful response reports the actual renewed expiration');
  await db.document.update({ where: { id: agreement.id }, data: { deletionStatus: 'DELETED' } });
  const publicCase = await http.get('/cases/client/' + owned.publicAccessToken);
  assert.equal(publicCase.status, 200); assert.ok(!publicCase.body.data.documents.some((item: any) => item.id === agreement.id));
  await db.user.update({ where: { id: client.id }, data: { isActive: false } });
  try { assert.equal((await http.get('/cases/client/' + owned.publicAccessToken)).status, 404); }
  finally { await db.user.update({ where: { id: client.id }, data: { isActive: true } }); }
  checks.push('Alternate public case route excludes deleted documents and revoked client accounts');
  await fs.writeFile(path.join(process.env.CAPITAL_LAB_DIR, 'client-portal-receipt.json'), JSON.stringify({ scope: 'Actual Express/JWT/PostgreSQL with synthetic client/document records; no external messages, uploads, legal signatures or production proof', passed: checks.length, checks }, null, 2));
  console.log('Client and portal boundary checks passed: ' + checks.length);
} finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
