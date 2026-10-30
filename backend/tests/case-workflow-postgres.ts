import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || url.port !== '18588' || url.pathname !== '/capital_auth_lab' || !process.env.CAPITAL_LAB_DIR) throw Error('Owned isolated Capital lab required');
const { default: db } = await import('../src/lib/prisma.js');
const { createCapitalCase } = await import('../src/services/CaseCreationService.js');
const { transitionCase, assignCaseEmployee, updateCaseFields } = await import('../src/services/CaseWorkflowService.js');
const { notificationCenterService: notifications } = await import('../src/services/NotificationCenterService.js');
const { authService } = await import('../src/services/AuthService.js');
const { default: cases } = await import('../src/routes/cases.js');
const { default: inbox } = await import('../src/routes/notificationRoutes.js');
const { globalErrorHandler } = await import('../src/middleware/errorHandler.js');
const { default: express } = await import('express');
const { default: request } = await import('supertest');
const app = express(); app.use(express.json()); app.use('/cases', cases); app.use('/notifications', inbox); app.use(globalErrorHandler);
const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
const checks: string[] = [];
try {
  const creation = JSON.parse(await fs.readFile(path.join(process.env.CAPITAL_LAB_DIR, 'case-creation-receipt.json'), 'utf8'));
  const source = await db.case.findUniqueOrThrow({ where: { id: creation.reopenCaseId } });
  const owner = await db.user.findFirstOrThrow({ where: { role: 'FOUNDER', tenantId: null, isActive: true } });
  const employee = await db.user.create({ data: { email: `workflow-${crypto.randomUUID()}@example.invalid`, name: 'Synthetic Workflow Employee', passwordHash: 'unusable-test-hash', role: 'EMPLOYEE', employeeTier: 'TIER_1_ASSOCIATE', tenantId: source.tenantId } });
  const record = await createCapitalCase({ clientId: source.clientId, state: source.state, county: source.county, propertyAddress: 'Synthetic workflow ' + crypto.randomUUID(), assignedEmployeeId: employee.id, surplusAmountCents: 10000, feePercent: 0 }, owner.id);
  const token = async (id: string) => 'Bearer ' + authService.generateAccessToken(await db.user.findUniqueOrThrow({ where: { id } })).token;
  const administrator = await db.user.create({data:{email:`workflow-admin-${crypto.randomUUID()}@example.invalid`,name:'Synthetic Workflow Admin',passwordHash:'unusable-test-hash',role:'ADMIN',tenantId:record.tenantId}});
  const staff = await token(employee.id), client = await token(record.clientId), admin = await token(administrator.id), founder = await token(owner.id);
  const http = request(server);
  const post = (status: string) => http.post(`/cases/my/${record.id}/status`).set('Authorization', staff).send({ status });
  assert.equal((await post('CONTACTED')).status, 200);
  const messages = await db.opsInsight.findMany({ where: { relatedCaseIds: { has: record.id }, sourceBot: 'NotificationCenter' } });
  assert.equal(messages.length, 1); assert.equal(messages[0].tenantId, record.tenantId);
  const first = messages[0];
  let response = await http.get('/notifications').set('Authorization', client);
  assert.equal(response.status, 200); assert.ok(response.body.notifications.some((item: any) => item.id === first.id && item.isRead === false));
  checks.push('Assigned staff status change atomically creates an actual recipient-scoped client inbox entry');
  const concurrent = await Promise.all([transitionCase(owner.id, record.id, 'DOCS_PENDING'), transitionCase(owner.id, record.id, 'DOCS_PENDING')]);
  assert.equal(concurrent.filter(result => result.changed).length, 1);
  assert.equal(await db.opsInsight.count({ where: { relatedCaseIds: { has: record.id }, sourceBot: 'NotificationCenter' } }), 2);
  checks.push('Concurrent duplicate transition creates one audit/notification rather than duplicate side effects');
  for (const [table, condition] of [['AuditLog', "NEW.action='STATUS_CHANGED'"], ['OpsInsight', "NEW.\"sourceBot\"='NotificationCenter'"]]) {
    const beforeAudit = await db.auditLog.count({ where: { entityId: record.id } });
    const beforeNotifications = await db.opsInsight.count({ where: { relatedCaseIds: { has: record.id } } });
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION capital_workflow_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'synthetic workflow failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER capital_workflow_failure BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION capital_workflow_failure()`);
    try { await assert.rejects(transitionCase(owner.id, record.id, 'CONTACTED')); }
    finally { await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS capital_workflow_failure ON "${table}"`); await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS capital_workflow_failure()'); }
    assert.equal((await db.case.findUniqueOrThrow({ where: { id: record.id } })).status, 'DOCS_PENDING');
    assert.equal(await db.auditLog.count({ where: { entityId: record.id } }), beforeAudit);
    assert.equal(await db.opsInsight.count({ where: { relatedCaseIds: { has: record.id } } }), beforeNotifications);
    checks.push('Actual ' + table + ' failure rolls back status and all coupled records');
  }
  assert.equal((await http.patch(`/notifications/${first.id}/read`).set('Authorization', admin)).status, 404);
  assert.equal((await db.opsInsight.findUniqueOrThrow({ where: { id: first.id } })).isRead, false);
  checks.push('Another same-company account cannot mark a client notification read');
  assert.equal((await http.patch(`/notifications/${first.id}/read`).set('Authorization', client)).status, 200);
  response = await http.get('/notifications').set('Authorization', client);
  assert.ok(response.body.notifications.some((item: any) => item.id === first.id && item.isRead === true && item.readAt));
  checks.push('Read state is saved and mapped from actual isRead/readAt fields');
  const nonNotification = await db.opsInsight.create({ data: { type: 'CASE_RECOMMENDATION', priority: 'NORMAL', relatedUserIds: [record.clientId], relatedCaseIds: [], relatedAlertIds: [] } });
  await assert.rejects(notifications.markAsRead(nonNotification.id, record.clientId));
  assert.equal(await notifications.deleteNotification(nonNotification.id, record.clientId), false);
  checks.push('Notification mutations cannot alter unrelated OPS records');
  assert.equal((await http.get('/notifications?limit=-1').set('Authorization', client)).status, 400);
  assert.equal((await http.post('/notifications/send').set('Authorization', admin).send({ userIds: [owner.id], title: 'Synthetic', message: 'Synthetic' })).status, 403);
  checks.push('Malformed pagination and tenant-admin global fanout are denied');
  assert.equal((await http.get('/notifications/events?token=' + encodeURIComponent(client.slice(7)))).status, 401);
  checks.push('Access tokens in notification stream URLs no longer authenticate');
  await assert.rejects(notifications.sendNotification({ userId: record.clientId, category: 'system', title: 'Synthetic', message: 'Synthetic', link: 'https://example.invalid' }));
  checks.push('External notification navigation cannot be inserted through the service');
  const patch = await http.patch('/cases/' + record.id).set('Authorization', admin).send({ propertyAddress: record.propertyAddress + ' updated' });
  assert.equal(patch.status, 200); assert.equal(patch.body.data.surplusAmountCents, undefined); assert.equal(patch.body.data.feePercent, undefined);
  checks.push('Administrative case edit response preserves financial disclosure restrictions');
  const replacement = await db.user.create({ data: { email: `workflow-replacement-${crypto.randomUUID()}@example.invalid`, name: 'Synthetic Replacement', passwordHash: 'unusable-test-hash', role: 'EMPLOYEE', employeeTier: 'TIER_1_ASSOCIATE', tenantId: record.tenantId } });
  await assignCaseEmployee(owner.id, record.id, replacement.id);
  const assignedAudit = await db.auditLog.count({ where: { entityId: record.id, action: 'EMPLOYEE_ASSIGNED' } });
  await assignCaseEmployee(owner.id, record.id, replacement.id);
  assert.equal(await db.auditLog.count({ where: { entityId: record.id, action: 'EMPLOYEE_ASSIGNED' } }), assignedAudit);
  assert.equal((await post('CONTACTED')).status, 404);
  checks.push('Assignment saves its audit and employee inbox, duplicate assignment is a no-op, former assignee loses access');
  for (const [table, operation] of [['AuditLog', 'edit'], ['OpsInsight', 'assign']] as const) {
    const before = await db.case.findUniqueOrThrow({ where: { id: record.id } });
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION capital_workflow_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic workflow failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER capital_workflow_failure BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION capital_workflow_failure()`);
    try { await assert.rejects(operation === 'edit' ? updateCaseFields(owner.id, record.id, { propertyAddress: 'must roll back' }) : assignCaseEmployee(owner.id, record.id, employee.id)); }
    finally { await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS capital_workflow_failure ON "${table}"`); await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS capital_workflow_failure()'); }
    const after = await db.case.findUniqueOrThrow({ where: { id: record.id } });
    assert.equal(after.propertyAddress, before.propertyAddress); assert.equal(after.assignedEmployeeId, before.assignedEmployeeId);
    checks.push(operation + ' coupled-record failure rolls back actual case changes');
  }
  assert.equal((await http.patch('/cases/' + record.id).set('Authorization', founder).send({ saleDate: '2026-02-30' })).status, 400);
  await db.user.update({ where: { id: replacement.id }, data: { isActive: false } });
  await assert.rejects(assignCaseEmployee(owner.id, record.id, replacement.id));
  checks.push('Calendar rollover and inactive employee assignment are rejected');
  const options = await http.get('/cases/' + record.id + '/assignees').set('Authorization', founder);
  assert.equal(options.status, 200); assert.ok(options.body.data.some((item: any) => item.id === employee.id));
  assert.ok(options.body.data.every((item: any) => item.id !== replacement.id && Object.keys(item).sort().join(',') === 'email,id,name'));
  assert.equal((await http.get('/cases/' + record.id + '/assignees').set('Authorization', client)).status, 403);
  checks.push('Case assignee selector exposes active company employees and safe fields only');
  await fs.writeFile(path.join(process.env.CAPITAL_LAB_DIR, 'case-workflow-receipt.json'), JSON.stringify({ scope: 'Actual Express/JWT/PostgreSQL with synthetic status/inbox records; no external delivery or legal-state proof', passed: checks.length, checks, reopenCaseId: record.id, reopenNotificationId: first.id, clientId: record.clientId }, null, 2));
  console.log('Case workflow and notification checks passed: ' + checks.length);
} finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); }
