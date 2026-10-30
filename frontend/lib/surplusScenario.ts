/** A user-entered arithmetic scenario, never a county balance or legal entitlement. */
function cents(input:string):number {
 if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(input.trim()))throw Error('Enter nonnegative dollar amounts with at most two decimal places.');
 const [dollars,fraction='']=input.trim().split('.');
 const amount=Number(dollars)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(amount))throw Error('Amount is too large.');
 return amount;
}
export function surplusScenario(sale:string,taxes:string,otherCosts:string){
 const saleCents=cents(sale),taxCents=cents(taxes),costCents=cents(otherCosts);
 const differenceCents=saleCents-taxCents-costCents;
 return {saleCents,taxCents,costCents,differenceCents,positiveRemainderCents:Math.max(0,differenceCents)};
}
