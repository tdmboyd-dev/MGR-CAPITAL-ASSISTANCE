import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || url.port !== '18588' || url.pathname !== '/capital_auth_lab' || !process.env.CAPITAL_LAB_DIR) throw Error('Owned isolated Capital lab required');
const { default: db } = await import('../src/lib/prisma.js');
try {
  const receipt = JSON.parse(await fs.readFile(path.join(process.env.CAPITAL_LAB_DIR, 'payout-planning-receipt.json'), 'utf8'));
  const record = await db.case.findUniqueOrThrow({ where: { id: receipt.caseId } });
  const entries = await db.ledgerEntry.findMany({ where: { caseId: receipt.caseId } });
  assert.equal(record.status, 'AWAITING_FUNDS');
  assert.equal(record.fundsDisbursedAt, null);
  assert.equal(entries.length, 2);
  assert.equal(entries.reduce((sum, entry) => sum + entry.amountCents, 0), 10000);
  assert.ok(entries.every((entry) => entry.status === 'PENDING' && !entry.isPaid));
  await fs.writeFile(path.join(process.env.CAPITAL_LAB_DIR, 'payout-planning-reopen-receipt.json'), JSON.stringify({ scope: 'Separate Node process, actual isolated PostgreSQL; synthetic allocations, no settlement', passed: 1, checks: ['Pending balanced allocations and awaiting-funds case survive process reopening'] }, null, 2));
  console.log('Payout plan separate-process reopening: 1 passed');
} finally { await db.$disconnect(); }
