import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryCoverage, recoveryJurisdiction, quoteTennesseeTreasuryFee } from '../src/services/RecoveryJurisdictionService.js';

test('All 153 state/type entries explicitly retain unknown or conditional authority', () => {
 const coverage = recoveryCoverage();
 assert.equal(coverage.length, 51);
 for (const state of coverage) for (const rule of state.types) {
  assert.equal(rule.autoFileAllowed, false);
  assert.equal(rule.autoQuoteAllowed, false);
  assert.equal(rule.deadlineDays, null);
  if (state.state !== 'TN') assert.equal(rule.coverageStatus, 'RESEARCH_REQUIRED');
 }
});
test('Tennessee Treasury limit never transfers to court or foreclosure proceeds', () => {
 assert.equal(recoveryJurisdiction('tn','TREASURY_UNCLAIMED').feeStatus,'SOURCED_CONDITIONAL');
 for (const type of ['TAX_SALE_SURPLUS','FORECLOSURE_SURPLUS']) {
  assert.equal(recoveryJurisdiction('TN',type).feeFormula,null);
  assert.equal(recoveryJurisdiction('TN',type).feeStatus,'UNVERIFIED');
 }
 assert.throws(() => recoveryJurisdiction('ZZ','TAX_SALE_SURPLUS'));
 assert.throws(() => recoveryJurisdiction('TN','UNKNOWN'));
});
test('Published Treasury formula respects integer cents and never approves a charge', () => {
 assert.equal(quoteTennesseeTreasuryFee(10000,5000).maximumFeeCents,5000);
 assert.equal(quoteTennesseeTreasuryFee(1000000,100000).maximumFeeCents,100000);
 assert.equal(quoteTennesseeTreasuryFee(1000001,100001).withinPublishedMonetaryLimit,false);
 assert.equal(quoteTennesseeTreasuryFee(1000000,100000).authorizedToCharge,false);
 for (const bad of [-1,0.1,Infinity,NaN,Number.MAX_SAFE_INTEGER+1]) assert.throws(() => quoteTennesseeTreasuryFee(bad,0));
});
