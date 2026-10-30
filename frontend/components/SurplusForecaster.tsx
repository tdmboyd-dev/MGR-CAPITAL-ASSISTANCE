"use client";
import { useState } from 'react';
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { surplusScenario } from '@/lib/surplusScenario';

export default function SurplusForecaster(){
 const [sale,setSale]=useState(''),[taxes,setTaxes]=useState(''),[costs,setCosts]=useState('');
 const [result,setResult]=useState<ReturnType<typeof surplusScenario>|null>(null);
 const [error,setError]=useState('');
 function calculate(){try{setResult(surplusScenario(sale,taxes,costs));setError('');}catch(error){setResult(null);setError(error instanceof Error?error.message:'Calculation failed.');}}
 const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
 return <Card className="border-none shadow-lg"><CardHeader><CardTitle>Surplus Scenario Calculator</CardTitle><CardDescription>Compare a sale amount with the taxes and costs you enter. This calculation does not confirm county funds, priority claims or eligibility.</CardDescription></CardHeader>
 <CardContent className="space-y-6"><div className="grid gap-4 md:grid-cols-3">
 <div><Label htmlFor="scenario-sale">Sale proceeds ($)</Label><Input id="scenario-sale" inputMode="decimal" value={sale} onChange={e=>{setSale(e.target.value);setResult(null);}} /></div>
 <div><Label htmlFor="scenario-taxes">Taxes applied ($)</Label><Input id="scenario-taxes" inputMode="decimal" value={taxes} onChange={e=>{setTaxes(e.target.value);setResult(null);}} /></div>
 <div><Label htmlFor="scenario-costs">Other applicable costs ($)</Label><Input id="scenario-costs" inputMode="decimal" value={costs} onChange={e=>{setCosts(e.target.value);setResult(null);}} /></div></div>
 <Button onClick={calculate} disabled={!sale||!taxes||!costs}>Calculate scenario</Button>
 {error&&<p role="alert" className="text-red-600">{error}</p>}
 {result&&<div role="status" className="rounded-lg border p-5 space-y-2"><p>Entered sale {money(result.saleCents)} − taxes {money(result.taxCents)} − costs {money(result.costCents)}</p><p className="text-3xl font-bold">{money(result.differenceCents)}</p><p>Arithmetic remainder only. No claim deadline, ownership, current balance, fee limit or recoverable amount is inferred. Reconcile with the authorized county source before using it for a case.</p></div>}
 </CardContent></Card>;
}
