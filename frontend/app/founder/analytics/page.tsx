"use client";
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { BarChartComponent } from '@/components/ui/charts';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { BarChart3,Download,RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';

const recordSchema = z.object({ id: z.string(), internalCode: z.string(), status: z.string(), state: z.string(), county: z.string(), surplusAmountCents: z.number().int().nonnegative(), createdAt: z.string() });
const responseSchema = z.object({ success: z.literal(true), data: z.array(recordSchema), total: z.number().int().nonnegative(), page: z.number().int().positive(), totalPages: z.number().int().nonnegative() });
export default function FounderAnalyticsPage() {
 const { user } = useAuth(); const [page, setPage] = useState(1);
 const query = useQuery({ queryKey: ['capital-recorded-analytics', user?.id, page], enabled: Boolean(user), queryFn: async ({ signal }) => {
  const { data } = await api.get('/cases', { params: { page, pageSize: 100 }, signal }); return responseSchema.parse(data);
 }});
 const records = query.data?.data || [];
 const groups = records.reduce<Record<string, number>>((result, record) => { result[record.status] = (result[record.status] || 0) + 1; return result; }, {});
 const chart = Object.entries(groups).map(([name, value]) => ({ name, value }));
 const recordedSurplus = records.reduce((sum, row) => sum + row.surplusAmountCents, 0);
 const exportRecords = () => {
  if (!query.data) return;
  const bytes = JSON.stringify({ exportedAt: new Date().toISOString(), scope: 'One actual case page; recorded balances and statuses do not certify settlement', ...query.data }, null, 2);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `capital-recorded-cases-page-${page}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
 };
 return <div className="space-y-6">
  <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="flex items-center gap-3 text-3xl font-bold"><BarChart3 />Capital Analytics</h1><p className="text-muted-foreground">Saved case inventory and recorded balances</p></div><div className="flex gap-2"><Button variant="outline" disabled={query.isFetching} onClick={() => { void query.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button variant="outline" disabled={!query.data} onClick={exportRecords}><Download className="mr-2 h-4 w-4" />Export this page</Button></div></div>
  <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">These are recorded case values. They do not establish available surplus, actual recovery, payment, profitability, employee conversion or a forecast. Those reports require reconciled source and settlement records.</p>
  {query.isLoading && <p role="status">Loading saved cases...</p>}
  {query.isError && <p role="alert">The case inventory could not be loaded or its format changed. Refresh to retry. No substitute figures are displayed.</p>}
  {query.data && <><div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle>Total saved cases</CardTitle></CardHeader><CardContent className="text-3xl">{query.data.total}</CardContent></Card><Card><CardHeader><CardTitle>Cases on this page</CardTitle></CardHeader><CardContent className="text-3xl">{records.length}</CardContent></Card><Card><CardHeader><CardTitle>Recorded surplus on this page</CardTitle></CardHeader><CardContent className="text-3xl">{formatCurrency(recordedSurplus)}</CardContent></Card></div>
  <Card><CardHeader><CardTitle>Recorded status distribution for this page</CardTitle></CardHeader><CardContent>{records.length ? <BarChartComponent data={chart} /> : <p>No cases on this page.</p>}</CardContent></Card>
  <Card><CardHeader><CardTitle>Source records</CardTitle></CardHeader><CardContent className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Case</th><th className="p-2">Status</th><th className="p-2">Location</th><th className="p-2">Recorded surplus</th></tr></thead><tbody>{records.map(row => <tr key={row.id} className="border-t"><td className="p-2"><Link className="underline" href={`/founder/cases/${row.id}`}>{row.internalCode}</Link></td><td className="p-2">{row.status}</td><td className="p-2">{row.county}, {row.state}</td><td className="p-2">{formatCurrency(row.surplusAmountCents)}</td></tr>)}</tbody></table></CardContent></Card>
  <nav aria-label="Analytics case pages" className="flex items-center justify-between"><Button variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page} of {Math.max(1, query.data.totalPages)}</span><Button variant="outline" disabled={page >= query.data.totalPages || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></nav></>}
 </div>;
}
