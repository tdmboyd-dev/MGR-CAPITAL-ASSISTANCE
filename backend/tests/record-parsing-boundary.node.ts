import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTaxSaleCsv } from '../src/parsers/taxSaleCsvParser.js';
import { parseSurplusPdfText } from '../src/parsers/surplusPdfParser.js';
import { recordDate, recordMoney } from '../src/parsers/RecordValues.js';
test('money rejects partial values, bad grouping, extra decimals and database overflow',()=>{
  for(const value of ['12abc','1,23.00','10.001','-1.00','1e4','9999999999999999999']) assert.throws(()=>recordMoney(value));
  assert.equal(recordMoney('$1,234.56'),123456);
});
test('calendar dates reject overflow and ambiguous years',()=>{
  for(const value of ['2026-02-30','13/01/2026','1/1/26','not a date']) assert.throws(()=>recordDate(value));
  assert.equal(recordDate('10/1/2026')?.toISOString(),'2026-10-01T00:00:00.000Z');
});
test('CSV distinguishes county name, owner name, mailing and property addresses',()=>{
  const result=parseTaxSaleCsv('County Name,Parcel ID,Owner Name,Owner Address,Property Address,Surplus Amount\nSynthetic,P123,Jane Synthetic,Mailing Test,Property Test,100.00','Synthetic','https://example.invalid');
  assert.equal(result.records.length,1);assert.equal(result.records[0].ownerName,'Jane Synthetic');assert.equal(result.records[0].propertyAddress,'Property Test');assert.equal(result.records[0].surplusAmountCents,10000);
});
test('CSV malformed money or calendar date produces a diagnostic rather than a case',()=>{
  for(const [money,date] of [['12abc','10/01/2026'],['100','2026-02-30'],['','10/01/2026']]){
    const result=parseTaxSaleCsv('Parcel ID,Owner Name,Surplus Amount,Sale Date\nP123,Jane Synthetic,'+money+','+date,'Synthetic','https://example.invalid');
    assert.equal(result.records.length,0);assert.equal(result.diagnostics.malformedRows.length,1);
  }
});
test('PDF chooses explicit surplus rather than a larger sale or arbitrary dollar amount',()=>{
  const result=parseSurplusPdfText('Case: SYN-12345\nOwner: Jane Synthetic\nSale Price: $100000\nSurplus: $125.00','Synthetic','https://example.invalid');
  assert.equal(result.records.length,1);assert.equal(result.records[0].surplusAmountCents,12500);
  assert.equal(parseSurplusPdfText('Case: SYN-12345\nOwner: Jane Synthetic\nSale Price: $100000','Synthetic','https://example.invalid').records.length,0);
});
test('conflicting explicitly labelled surplus amounts require review',()=>{
  assert.equal(parseSurplusPdfText('Case: SYN-12345\nSurplus: $125.00\nExcess Funds: $300.00','Synthetic','https://example.invalid').records.length,0);
});
