const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, ports) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => {
    if (Object.hasOwn(ports, id)) return ports[id];
    throw new Error(`Unexpected dependency ${id}`);
  }, module, module.exports);
  return module.exports;
}
function searchSetup(role = 'EMPLOYEE') {
  const captured = {};
  const actor = { id: 'u', role, tenantId: 'tenant-A' };
  const db = Object.fromEntries(['case', 'user', 'document', 'communication'].map(model => [model, { findMany: async query => { captured[model] = query; return []; } }]));
  const service = load('services/GlobalSearchService.ts', {
    '../lib/prisma.js': { __esModule: true, default: db },
    './CaseDocumentAccess.js': {
      currentActor: async () => actor,
      caseScope: value => ({ tenantId: value.tenantId, assignedEmployeeId: value.id }),
      documentScope: value => ({ case: { tenantId: value.tenantId }, deletionStatus: { not: 'DELETED' } }),
    },
  }).globalSearchService;
  return { service, actor, captured };
}
test('search passes current actor scopes into every case, document and communication query', async () => {
  const f = searchSetup();
  await f.service.globalSearch({ query: 'needle', userId: 'u', userRole: 'FOUNDER' });
  assert.deepEqual(f.captured.case.where.AND, [{ tenantId: 'tenant-A', assignedEmployeeId: 'u' }]);
  assert.deepEqual(f.captured.document.where.AND, [{ case: { tenantId: 'tenant-A' }, deletionStatus: { not: 'DELETED' } }]);
  assert.deepEqual(f.captured.communication.where.case, { tenantId: 'tenant-A', assignedEmployeeId: 'u' });
  assert.equal(f.captured.user, undefined);
});
test('client search cannot inspect staff communications, directory or hidden internal notes', async () => {
  const f = searchSetup('CLIENT');
  await f.service.globalSearch({ query: 'private', userId: 'u', userRole: 'FOUNDER' });
  assert.equal(f.captured.user, undefined);
  assert.equal(f.captured.communication, undefined);
  assert.equal(f.captured.case.where.OR.some(filter => Object.hasOwn(filter, 'notes')), false);
});
test('company admin directory query is bounded to its current company', async () => {
  const f = searchSetup('ADMIN');
  await f.service.globalSearch({ query: 'needle', userId: 'u', userRole: 'ADMIN' });
  assert.equal(f.captured.user.where.tenantId, 'tenant-A');
});
test('company founder does not gain global directory access from a founder role alone', async () => {
  const f = searchSetup('FOUNDER');
  await f.service.globalSearch({ query: 'needle', userId: 'u', userRole: 'FOUNDER' });
  assert.equal(f.captured.user.where.tenantId, 'tenant-A');
});
function paymentSetup(findMany) {
  const service = load('services/PaymentService.ts', {
    stripe: class NeverUsedStripe {},
    '../utils/logger.js': { logger: { info() {}, warn() {}, error() {} } },
    '../lib/prisma.js': { __esModule: true, default: { payment: { findMany } } },
  }).paymentService;
  return service;
}
test('a financial database failure rejects both reads instead of becoming a successful empty dashboard', async () => {
  const service = paymentSetup(async () => { throw new Error('controlled database failure'); });
  await assert.rejects(service.getMetrics(), /controlled database failure/);
  await assert.rejects(service.listPayments(), /controlled database failure/);
});
test('real payment implementation preserves dollar conversion and pending/refunded separation', async () => {
  const now = new Date();
  const service = paymentSetup(async () => [
    { id: 'p1', amountCents: 12345, method: 'ach', status: 'succeeded', createdAt: now },
    { id: 'p2', amountCents: 5000, method: 'ach', status: 'pending', createdAt: now },
    { id: 'p3', amountCents: 2500, method: 'card', status: 'refunded', createdAt: now },
  ]);
  const result = await service.getMetrics();
  assert.equal(result.totalRecovered, 123.45);
  assert.equal(result.pending, 50);
  assert.equal(result.refunded, 25);
  assert.equal(result.byMethod.length, 1);
  assert.equal((await service.listPayments())[0].amount, 123.45);
});
