import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || url.port !== '18588' || url.pathname !== '/capital_auth_lab' || !process.env.CAPITAL_LAB_DIR) throw Error('Owned isolated Capital lab required');
const { default: db } = await import('../src/lib/prisma.js');
const { notificationCenterService } = await import('../src/services/NotificationCenterService.js');
try {
  const creation = JSON.parse(await fs.readFile(path.join(process.env.CAPITAL_LAB_DIR, 'case-creation-receipt.json'), 'utf8'));
  const workflow = JSON.parse(await fs.readFile(path.join(process.env.CAPITAL_LAB_DIR, 'case-workflow-receipt.json'), 'utf8'));
  const created = await db.case.findUniqueOrThrow({ where: { id: creation.reopenCaseId } });
  assert.match(created.internalCode, /^C-[0-9]+$/); assert.equal(created.feePercent, 0);
  assert.ok(await db.auditLog.count({ where: { entityId: created.id, action: 'CASE_CREATED' } }));
  const changed = await db.case.findUniqueOrThrow({ where: { id: workflow.reopenCaseId } });
  assert.equal(changed.status, 'DOCS_PENDING');
  const inbox = await notificationCenterService.getAll(workflow.clientId, { page: 1, limit: 100 });
  const notification = inbox.notifications.find(item => item.id === workflow.reopenNotificationId);
  assert.equal(notification?.isRead, true); assert.ok(notification?.readAt);
  await fs.writeFile(path.join(process.env.CAPITAL_LAB_DIR, 'case-workflow-reopen-receipt.json'), JSON.stringify({ scope: 'Separate fresh Node process using actual saved PostgreSQL records', passed: 3, checks: ['Case code, zero fee and creation audit survive process reopening', 'Saved workflow status survives process reopening', 'Client notification and read timestamp survive process reopening'] }, null, 2));
  console.log('Separate process reopening: 3 passed');
} finally { await db.$disconnect(); }
