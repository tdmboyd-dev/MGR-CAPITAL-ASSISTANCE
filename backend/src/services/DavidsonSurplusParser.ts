import { PDFParse } from 'pdf-parse';
import { recordDate, recordMoney } from '../parsers/RecordValues.js';
import { AppError } from '../middleware/errorHandler.js';
const months:Record<string,string>={January:'01',February:'02',March:'03',April:'04',May:'05',June:'06',July:'07',August:'08',September:'09',October:'10',November:'11',December:'12'};
function usDate(value:string){const [month,day,year]=value.replace(/\*$/,'').split('/');return recordDate(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`)!.toISOString();}
export function parseDavidsonSurplusText(text:string) {
 if(!text.includes('Davidson County Chancery Court')||!text.includes('Delinquent Tax Sale Excess Proceeds'))throw new AppError('Source mismatch',422,'This is not the admitted Davidson surplus register.');
 const heading=text.match(/as of\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);if(!heading||!months[heading[1]])throw new AppError('Missing report date',422,'Report date requires review.');
 const sourceDate=recordDate(`${heading[3]}-${months[heading[1]]}-${heading[2].padStart(2,'0')}`)!.toISOString();
 const lines=text.split(/\r?\n/).map(line=>line.replace(/\s+/g,' ').trim().replace(/([\d,]+\.\d{2})\s+\$\s+(?=\d{1,2}\/)/,'$ $1 '));
 const pattern=/^(\d{2}-\d{3,4}-[IV]+)\s+([A-Z0-9]{8,20})\s+(.+?)\s+\$\s*([\d,]+\.\d{2})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})(\*)?$/;
 const rows=[];
 for(const line of lines){if(!/^\d{2}-\d{3,4}-[IV]+\s/.test(line))continue;const match=line.match(pattern);if(!match)throw new AppError('Changed report row',422,'A surplus row does not match its qualified columns; nothing was imported.');
  rows.push({sourceRecordId:match[1]+'|'+match[2],courtCaseNumber:match[1],parcelNumber:match[2],ownerName:match[3],surplusAmountCents:recordMoney(match[4]),state:'TN',county:'Davidson',sourceDate,fundsHeldSince:usDate(match[5]),mostRecentActivity:usDate(match[6]),confirmationOrderDate:usDate(match[7]),pendingProceedingFootnote:Boolean(match[8]),balanceStatus:'COUNTY_REPORTED_AS_OF_DATE',currentAvailabilityVerified:false,claimantIdentityVerified:false,contactPermissionVerified:false});
 }
 const totalLine=lines.find(line=>/^(?:\$\s*)?\d{1,3}(?:,\d{3})+\.\d{2}$/.test(line));
 if(!rows.length||rows.length>1000||!totalLine)throw new AppError('Incomplete register',422,'Report rows and published total are required.');
 const total=recordMoney(totalLine.replace(/^\$\s*/,''));if(rows.reduce((sum,row)=>sum+row.surplusAmountCents,0)!==total||new Set(rows.map(row=>row.sourceRecordId)).size!==rows.length)throw new AppError('Unbalanced register',422,'Rows do not reconcile to the published total or contain duplicates.');
 return {format:'TN_DAVIDSON_SURPLUS_V1',sourceDate,records:rows,totalCents:total,warning:'Published point-in-time balances; a pending motion or redemption may exist. Confirm current funds and entitlement separately.'};
}
export async function parseDavidsonSurplusPdf(bytes:Uint8Array) {
 if(bytes.length>2097152||!Buffer.from(bytes.subarray(0,5)).equals(Buffer.from('%PDF-')))throw new AppError('Invalid PDF',422,'Bounded PDF bytes required.');
 const parser=new PDFParse({data:Uint8Array.from(bytes)});
 try{const info=await parser.getInfo();if(info.total>50)throw new AppError('Oversized report',413,'Report page limit exceeded.');const result=await parser.getText();return parseDavidsonSurplusText(result.text);}finally{await parser.destroy();}
}
