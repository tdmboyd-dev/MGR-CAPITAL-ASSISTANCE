const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const zod = require('zod');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/lib', `${name}.ts`), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => {
    if (id === 'zod') return zod;
    if (id.startsWith('./')) return load(id.slice(2));
    throw new Error(`Unexpected dependency ${id}`);
  }, module, module.exports);
  cache.set(name, module.exports);
  return module.exports;
}
const search = load('globalSearch');
const cases = load('caseRecords');
const command = load('commandCenter');
const payments = load('paymentRecords');
const record = { id: 'case_123', type: 'case', caseCode: 'TN-123', status: 'NEW', previousOwner: 'Public record owner', propertyAddress: null, matchedField: 'caseCode', score: 100 };

test('actual search wire fields produce a display name and role-specific existing case route', () => {
  const parsed = search.searchResultSchema.parse(record);
  assert.equal(search.searchResultDisplay(parsed).subtitle, 'Public record owner');
  for (const role of ['FOUNDER', 'ADMIN', 'EMPLOYEE', 'CLIENT']) assert.equal(search.searchResultLink(parsed, role), `/${role.toLowerCase()}/cases/case_123`);
  assert.equal(search.searchResultLink(parsed, 'UNKNOWN'), null);
});
test('server result IDs cannot supply external origins or path navigation', () => {
  for (const id of ['..', '.', 'https://example.invalid', '//example.invalid', 'a/b', 'a\\b', '%2e%2e', 'bad\nvalue']) assert.equal(search.searchResultSchema.safeParse({ ...record, id }).success, false);
});
test('user results use the actual backend name field and do not invent client-detail routes', () => {
  const parsed = search.searchResultSchema.parse({ id: 'user_123', type: 'user', name: 'Real wire name', email: 'n@example.invalid', role: 'EMPLOYEE', matchedField: 'name', score: 80 });
  assert.equal(search.searchResultDisplay(parsed).title, 'Real wire name');
  assert.equal(search.searchResultLink(parsed, 'CLIENT'), null);
  assert.equal(search.searchResultLink(parsed, 'FOUNDER'), '/founder/employees');
});
test('search rejects an error envelope, wrong record shape and nonfinite score', () => {
  const response = { success: true, query: 'TN', totalResults: 1, results: [record], searchTime: 1, breakdown: { cases: 1, users: 0, documents: 0, communications: 0 } };
  assert.equal(search.globalSearchSchema.parse(response).results.length, 1);
  for (const payload of [{ success: false, results: [] }, { ...response, results: [{ ...record, score: NaN }] }, { ...response, results: [{ id: '1', title: 'demo' }] }]) assert.equal(search.globalSearchSchema.safeParse(payload).success, false);
});
test('case lists admit nullable actual source fields without inventing recovery money', () => {
  const result = cases.caseListSchema.parse({ success: true, count: 1, data: [{ id: 'c1', status: 'ON_HOLD', createdAt: '2026-10-30T00:00:00.000Z', county: null, state: 'TN', client: null }] });
  assert.equal(result.count, 1);
  assert.equal(result.data[0].actualRecoveryCents, undefined);
  assert.equal(cases.caseListSchema.safeParse({ success: false, data: [] }).success, false);
});
test('settings preserve a disabled boolean and require a real boolean mutation receipt', () => {
  const data = command.masterSettingsSchema.parse({ settings: { auto_outreach: false }, metadata: [{ key: 'auto_outreach', label: 'Auto outreach', category: 'Outreach', description: 'Controls outreach' }] });
  assert.equal(data.settings.auto_outreach, false);
  for (const value of [{}, { enabled: 'false' }, { enabled: null }]) assert.equal(command.toggleReceiptSchema.safeParse(value).success, false);
});
test('actual ops summary is required; arbitrary legacy flat dashboard data is rejected', () => {
  assert.equal(command.opsDashboardSchema.safeParse({ activeBots: 8, activeAutomations: 12 }).success, false);
  const payload = { summary: { totalCases: 0, activeCases: 0, totalPayoutsCents: 0, pendingAlerts: 0, employeeCount: 0 }, recentActivity: { newCases24h: 0, payoutsProcessed24h: 0, alertsCreated24h: 0, documentsUploaded24h: 0 }, alerts: { critical: 0, high: 0, medium: 0, low: 0 } };
  assert.equal(command.opsDashboardSchema.parse(payload).summary.totalCases, 0);
});
test('financial records accept empty successful database results but reject missing, failed or malformed data', () => {
  assert.deepEqual(payments.paymentListSchema.parse({ success: true, data: [] }).data, []);
  for (const payload of [{ success: false, data: [] }, { success: true }, { success: true, data: [{ id: 'x', amount: '100', status: 'paid' }] }]) assert.equal(payments.paymentListSchema.safeParse(payload).success, false);
  const row = payments.paymentRecordSchema.parse({ id: 'p1', amount: 12.34, method: null, status: 'pending', createdAt: '2026-10-30T00:00:00.000Z' });
  assert.equal(row.amount, 12.34);
  assert.equal(row.fraudScore, undefined);
});

test('scenario uses exact entered sale proceeds less taxes and costs, never market-value speculation',()=>{
 const {surplusScenario}=load('surplusScenario');
 assert.equal(surplusScenario('100000.01','20000.01','1500.00').differenceCents,7850000);
 assert.equal(surplusScenario('0.30','0.10','0.20').differenceCents,0);
 assert.equal(surplusScenario('10','20','1').differenceCents,-1100);
 for(const value of ['-1','1e4','Infinity','NaN','1.234','','1,000','999999999999999999'])assert.throws(()=>surplusScenario(value,'0','0'));
});
test('chat contracts require native room/message fields and strip password material',()=>{
 const {chatRoomsSchema,chatMessagesSchema}=load('commsRecords');
 const parsed=chatRoomsSchema.parse({success:true,data:[{id:'r1',name:'Synthetic room',type:'COMPANY',locked:true,password:'must-not-leave-server'}]});
 assert.equal('password' in parsed.data[0],false);
 assert.equal(chatRoomsSchema.safeParse({success:true,data:[{id:'r1',name:'Wrong shape',type:'company'}]}).success,false);
 assert.equal(chatMessagesSchema.safeParse({success:false,data:[]}).success,false);
});
test('training progress admits actual saved status and rejects invented completion state',()=>{
 const {trainingProgressSchema}=load('trainingRecords');
 const payload={success:true,data:[{moduleId:'m1',title:'Training',status:'LOCKED',progress:0,bestScore:null,completedAt:null}]};
 assert.equal(trainingProgressSchema.parse(payload).data[0].status,'LOCKED');
 assert.equal(trainingProgressSchema.safeParse({...payload,data:[{...payload.data[0],status:'APPROVED'}]}).success,false);
});
test('employee earnings require an actual allocation basis and preserve unresolved amounts as unknown',()=>{
 const {employeeEarningsSchema}=load('employeeEarnings');
 const payload={success:true,data:{lifetimeEarningsCents:0,thisMonthCents:0,pendingCents:0,recordedCompletedCents:0,reconciliationCount:1,basis:'payable_allocations_not_bank_settlement',payouts:[{id:'e1',caseCode:'Synthetic',property:'Synthetic only',location:'Synthetic, TN',amountCents:null,status:'RECONCILIATION_REQUIRED',date:'2026-10-30',reconciliationRequired:true,legacyDisplayAdjusted:false}]}};
 assert.equal(employeeEarningsSchema.parse(payload).data.payouts[0].amountCents,null);
 assert.equal(employeeEarningsSchema.safeParse({...payload,data:{...payload.data,basis:'paid'}}).success,false);
 assert.equal(employeeEarningsSchema.safeParse({...payload,data:{...payload.data,pendingCents:-1}}).success,false);
});
