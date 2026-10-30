"use client";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { employeeEarningsSchema,employeePayProfileSchema } from '@/lib/employeeEarnings';
import { useQuery } from '@tanstack/react-query';
import { Wallet,RefreshCw } from 'lucide-react';

const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export default function EmployeePayoutsPage(){
 const {user}=useAuth();
 const query=useQuery({queryKey:['my-payable-earnings',user?.id],enabled:Boolean(user),gcTime:0,retry:1,queryFn:async({signal})=>employeeEarningsSchema.parse((await api.get<unknown>('/payouts/my',{signal})).data).data});
 const profile=useQuery({queryKey:['my-payable-profile',user?.id],enabled:Boolean(user),gcTime:0,retry:1,queryFn:async({signal})=>employeePayProfileSchema.parse((await api.get<unknown>('/employees/me',{signal})).data).data});
 const refresh=()=>{void query.refetch();void profile.refetch();};
 return <div className="space-y-6 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="flex items-center gap-2 text-3xl font-bold"><Wallet className="text-green-500"/>My Payable Earnings</h1><p className="text-muted-foreground">Your own saved commissions and overrides, in actual payable dollars.</p></div><Button variant="outline" disabled={query.isFetching} onClick={refresh}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
 <p className="rounded-lg border p-4 text-sm">These are recorded allocations. Pending does not mean a bank transfer has started, and a completed ledger status alone does not prove payment. Internal company margins are excluded from this view.</p>
 {query.isLoading&&<p role="status">Loading your saved earnings…</p>}
 {query.isError&&<Card><CardContent className="space-y-3 pt-6"><p role="alert">Your earnings could not be loaded. No sample money or empty balance was substituted.</p><Button onClick={refresh} disabled={query.isFetching}>Retry</Button></CardContent></Card>}
 {query.data&&<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Recorded allocations',money(query.data.lifetimeEarningsCents)],['Allocated this month',money(query.data.thisMonthCents)],['Pending / processing',money(query.data.pendingCents)],['Entries needing review',String(query.data.reconciliationCount)]].map(([label,value])=><Card key={label}><CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{value}</CardContent></Card>)}</div>
 {query.data.reconciliationCount>0&&<p role="alert" className="rounded-lg border border-amber-600 p-4">Some records conflict or may duplicate an older commission entry. Their amounts are excluded from totals until accounting reviews them. Historical records have not been rewritten.</p>}
 <Card><CardHeader><CardTitle>Current commission tier</CardTitle><CardDescription>Actual payable rate, separate from tier progress.</CardDescription></CardHeader><CardContent>{profile.data?<p>{profile.data.tier} · {profile.data.commissionRate}</p>:<p>{profile.isLoading?'Loading tier…':'Current tier could not be loaded. No tier or progress percentage is assumed.'}</p>}</CardContent></Card>
 <Card><CardHeader><CardTitle>Commission and override history</CardTitle><CardDescription>Failed, cancelled and unresolved entries are not counted as payable earnings.</CardDescription></CardHeader><CardContent>{query.data.payouts.length===0?<p>No saved commission or override records were found.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Recorded</th><th className="p-3">Case / property</th><th className="p-3 text-right">Payable</th><th className="p-3">Ledger state</th></tr></thead><tbody>{query.data.payouts.map(row=><tr key={row.id} className="border-b"><td className="p-3">{new Date(row.date).toLocaleDateString()}</td><td className="p-3">{row.caseCode}<p className="text-muted-foreground">{row.property} · {row.location}</p></td><td className="p-3 text-right font-semibold">{row.amountCents===null?'Needs review':money(row.amountCents)}</td><td className="p-3"><Badge variant="outline">{row.status==='COMPLETED'?'Recorded complete':row.status.replaceAll('_',' ')}</Badge>{row.legacyDisplayAdjusted&&<p className="mt-1 text-xs text-muted-foreground">Shows actual allocation; older display value was different.</p>}</td></tr>)}</tbody></table></div>}</CardContent></Card></>}
 </div>;
}
