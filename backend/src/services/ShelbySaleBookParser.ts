import {PDFParse} from 'pdf-parse';
import crypto from 'node:crypto';
import {recordMoney} from '../parsers/RecordValues.js';
import {AppError} from '../middleware/errorHandler.js';

const knownHash='832590aa775b936c1f97d025ca5f572473268c132b26d253bf3c3806fc423e41';
const header=/TX-2024, Tax Sale 2202\s+Sale Dates: April 21 - 23, 2026\s+Date for Determination of Interest \(Funds Received\): May 11, 2026\s+Order Confirming Sale, Divesting and Vesting Title: June 23,\s*2026\s+REDEMPTION DATES \(last date to file\):\s+90 day redemption period: Monday, September 21, 2026\s+180 day redemption period: Monday, December 21, 2026 \(rolls over from Sunday\)\s+1 year redemption period: Wednesday, June 23, 2027/g;
const invalid=(message:string)=>new AppError('Sale book requires review',422,message);

/** This edition contains visual corrections. Extraction never qualifies current funds. */
export function parseShelby2202Pages(pages:Array<{num:number;text:string}>){
 if(pages.length!==175||pages.some((page,index)=>page.num!==index+1))throw invalid('The complete175page edition is required.');
 let text='';const ranges:Array<{page:number;start:number;end:number}>=[];
 for(const page of pages){
  if(page.text.match(header)?.length!==1)throw invalid('A page header changed; no partial import.');
  const clean=page.text.replace(header,'').replace(/-- \d+ of 175 --/g,'').trim();
  const start=text.length;text+=clean+'\n';ranges.push({page:page.num,start,end:text.length});
 }
 const starts=[...text.matchAll(/Parent Parcel /g)];
 if(starts.length!==427||text.slice(0,starts[0]?.index).trim())throw invalid('All427parcel sections are required.');
 const records=starts.map((entry,index)=>{
  const start=entry.index!,end=starts[index+1]?.index??text.length,block=text.slice(start,end).trim();
  const identity=block.match(/^Parent Parcel ([\s\S]+?), Parcel No\. ([A-Z0-9]{14}), Location: ([\s\S]+?),\s*Described as:/);
  const owner=block.match(/sold as the property of\s+([\s\S]+?)\s+The property sold to:/);
  const purchaser=block.match(/The property sold to: ([\s\S]+?) whose address is:/);
  const redemption=block.match(/the redemption period is: (1 Year|180 Day|90 Day|30 Days)\./g);
  const excess=[...block.matchAll(/The Clerk is holding excess proceeds of sale, if any \(\$([\d,]+(?:\.\d{2})?)\)\./g)];
  if(!identity||!owner||!purchaser||redemption?.length!==1||excess.length!==1||block.length>6000)throw invalid('A parcel section is incomplete or changed.');
  const parentParcels=identity[1].trim().split(/\s+/);
  if(parentParcels.some(id=>!(/^[A-Z0-9]{14}$/).test(id)))throw invalid('Parent-parcel identifiers require review.');
  const money=[...block.matchAll(/\$([\d,]+(?:\.\d{2})?)/g)].map(match=>recordMoney(match[1]));
  // In this edition recording fees are separately paid; deducting them again is wrong.
  if(money.length!==6||money[0]-money[1]-money[2]-money[3]!==money[5])throw invalid('Bid, taxes, commission and excess do not reconcile.');
  const parcel=identity[2],buyer=purchaser[1].replace(/\s+/g,' ').trim();
  const notSold=/PROPERTY NOT SOLD/i.test(buyer)||/PROPERTY NOT SOLD/i.test(block.slice(block.lastIndexOf('the redemption period is:')));
  // Corrections can expressly supersede a positive printed figure. Preserve both,
  // then exclude not-sold properties from recovery enrollment.
  return {sourceRecordId:'TX-2024|2202|'+parcel,courtCaseNumber:parcel,parcelNumber:parcel,parentParcels,ownerName:owner[1].replace(/\s+/g,' ').trim(),propertyAddress:identity[3].replace(/\s+/g,' ').trim(),purchaserName:buyer,state:'TN' as const,county:'Shelby' as const,saleBook:'TX-2024 / Tax Sale2202',sourceDate:'2026-06-23T00:00:00.000Z',sourceDateBasis:'CONFIRMATION_ORDER_DATE_NOT_PUBLICATION_DATE',sourcePages:ranges.filter(range=>range.start<end&&range.end>start).map(range=>range.page),bidCents:money[0],countyCostCents:money[1],cityCostCents:money[2],commissionCents:money[3],separateRecordingFeeCents:money[4],surplusAmountCents:money[5],redemptionPeriod:redemption[0].replace('the redemption period is: ','').replace(/\.$/,''),notSold,pendingProceedingFootnote:false,sourceVisualReviewRequired:true,reportedBalanceType:'HISTORICAL_SALE_BOOK_FIGURE_NOT_CURRENT_BALANCE',currentAvailabilityVerified:false,claimantIdentityVerified:false,contactPermissionVerified:false,sourceExcerpt:block};
 });
 if(new Set(records.map(row=>row.sourceRecordId)).size!==427||records.filter(row=>row.surplusAmountCents>0).length!==155||records.reduce((sum,row)=>sum+row.surplusAmountCents,0)!==359390506)throw invalid('Edition totals changed; review before import.');
 return {format:'TN_SHELBY_SALE_BOOK_2202_V1',sourceDate:'2026-06-23T00:00:00.000Z',records,totalCents:359390506,positiveRecords:155,zeroRecords:272};
}

export async function parseShelby2202Pdf(bytes:Uint8Array){
 if(bytes.length>2097152||crypto.createHash('sha256').update(bytes).digest('hex')!==knownHash)throw invalid('File differs from the qualified official edition. Retain it for adapter review.');
 const parser=new PDFParse({data:Uint8Array.from(bytes)});
 try{const info=await parser.getInfo();if(info.total!==175)throw invalid('All175pages required.');const result=await parser.getText();return parseShelby2202Pages(result.pages);}finally{await parser.destroy();}
}
