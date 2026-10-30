import { z } from 'zod';
export const recoveryTypes=['TAX_SALE_SURPLUS','FORECLOSURE_SURPLUS','TREASURY_UNCLAIMED'] as const;
const stateCodes='AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ');
const typeSchema=z.enum(recoveryTypes);
const treasury='https://treasury.tn.gov/Unclaimed-Property/About-Unclaimed-Property/Third-Party-Locators';
const davidson='https://chanceryclerkandmaster.nashville.gov/wp-content/uploads/excess-sale-proceeds-information-sheet-revised08242017-a.pdf';
const shelby='https://www.shelbycountytn.gov/DocumentCenter/View/42034/FAQs-ExcessProceeds';
export function recoveryJurisdiction(state:string,recoveryType:unknown) {
 const code=state.toUpperCase();if(!stateCodes.includes(code))throw new Error('Unknown state');const type=typeSchema.parse(recoveryType);
 const base={state:code,recoveryType:type,priority:code==='TN'?'FIRST':'EXPANSION',coverageStatus:'RESEARCH_REQUIRED',feeStatus:'UNVERIFIED',maximumFeeCents:null as number|null,feeFormula:null as string|null,deadlineDays:null as number|null,deadlineStatus:'EVENT_AND_JURISDICTION_REVIEW_REQUIRED',autoQuoteAllowed:false,autoFileAllowed:false,requiredEvidence:['Actual funds record','Historical ownership and competing interests','Claimant identity/authority','Current jurisdiction procedure','Applicable fee/contract/licensing rules'],sources:[] as string[],notes:[] as string[]};
 if(code!=='TN')return base;
 if(type==='TREASURY_UNCLAIMED')return {...base,coverageStatus:'OFFICIAL_GUIDANCE_SOURCED',feeStatus:'SOURCED_CONDITIONAL',feeFormula:'max(10% of recoverable value, $50)',sources:[treasury],requiredEvidence:[...base.requiredEvidence,'Current Tennessee private-investigator licensure','Signed locator contract submitted for Treasury approval'],notes:['Applies to property held by Tennessee Treasury; do not use this rule for court-held tax-sale surplus.','Treasury pays the owner directly; the locator collects an agreed fee separately.','For property not yet reported to the treasurer, examine the separate statutory conditions.']};
 if(type==='TAX_SALE_SURPLUS')return {...base,coverageStatus:'COUNTY_SOURCES_PARTIALLY_QUALIFIED',sources:[davidson,shelby],notes:['Court-held excess proceeds require a motion and fact-specific entitlement review under TCA67-5-2702.','Davidson provides an information sheet and motion; Shelby says it has no standard motion form.','Neither a one-year nor a ten-year deadline may be inferred solely from the sale date in this software.','A generic no-cap label is not proof that an agent fee is unrestricted.']};
 return {...base,notes:['Mortgage-foreclosure surplus requires its own trustee/court and distribution-priority research. Do not reuse tax-sale or Treasury rules.']};
}
export function quoteTennesseeTreasuryFee(recoverableCents:number,requestedFeeCents:number){
 if(!Number.isSafeInteger(recoverableCents)||recoverableCents<0||!Number.isSafeInteger(requestedFeeCents)||requestedFeeCents<0)throw new Error('Positive integer cents required');
 const maximumFeeCents=Math.max(Math.floor(recoverableCents/10),5000);
 return {maximumFeeCents,requestedFeeCents,withinPublishedMonetaryLimit:requestedFeeCents<=maximumFeeCents,contractApproved:false,licenseVerified:false,authorizedToCharge:false,source:treasury,scope:'Treasury-held property only; monetary comparison is not approval of a business or contract'};
}
export function recoveryCoverage(){return stateCodes.map(state=>({state,types:recoveryTypes.map(type=>recoveryJurisdiction(state,type))}));}
