'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { workerFleetSchema } from '@/lib/workerFleet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function WorkerBotFleetCommandPage() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fleet = useQuery({
    queryKey: ['worker-fleet', user?.id], enabled: user?.role === 'FOUNDER',
    queryFn: async ({ signal }) => workerFleetSchema.parse((await api.get<unknown>('/worker-bots/fleet', { signal })).data).data,
    refetchInterval: 10000, retry: false, gcTime: 0,
  });
  const selected = fleet.data?.bots.find(bot => bot.id === selectedId);

  return <div className="min-h-screen space-y-6 bg-[#0a0a0a] p-4 text-gray-100 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-extrabold tracking-wide text-green-400">Worker Bot Fleet Command</h1><p className="mt-2 text-gray-400">Stored fleet status · refreshes every 10 seconds</p></div>
      <Button variant="outline" className="text-gray-900 dark:text-gray-100" disabled={fleet.isFetching || !user} onClick={() => { void fleet.refetch(); }}>{fleet.isFetching ? 'Refreshing…' : 'Refresh fleet'}</Button>
    </div>
    <p className="rounded-xl border border-amber-700 bg-amber-950/30 p-4 text-amber-200">These are stored worker records. A reported status, learning score or revenue counter is not proof of completed work, validated learning or bank settlement. Dispatch controls require end-to-end job and receipt qualification.</p>
    {user?.role !== 'FOUNDER' && <p role="alert">Global founder access is required.</p>}
    {fleet.isLoading && <p role="status">Loading the saved fleet…</p>}
    {fleet.isError && <p role="alert" className="text-red-300">The fleet could not be loaded. Refresh to retry. No sample workers, revenue or activity were substituted.</p>}
    {fleet.data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Stored bots', fleet.data.bots.length], ['Reported active', fleet.data.totalActive], ['Recorded cases worked', fleet.data.totalCases], ['Queued tasks', fleet.data.bots.reduce((sum, bot) => sum + bot.taskQueue, 0)]].map(([label, value]) => <Card key={label} className="border-gray-800 bg-gray-950"><CardHeader><CardTitle className="text-sm text-gray-400">{label}</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-cyan-300">{value}</CardContent></Card>)}
      </div>
      <section className="space-y-4"><h2 className="text-xl font-bold">Fleet records</h2>
        {fleet.data.bots.length === 0 && <p>No worker records have been initialized in this database. No workers were created by opening this screen.</p>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{fleet.data.bots.map(bot => <button key={bot.id} className={`rounded-xl border bg-gray-950 p-5 text-left ${selectedId === bot.id ? 'border-cyan-400' : 'border-gray-800'}`} onClick={() => setSelectedId(bot.id)}>
          <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-cyan-300">{bot.codename} · {bot.designation}</h3><Badge variant="outline">{bot.status}</Badge></div>
          <p className="mt-2 text-sm text-gray-400">{bot.role} · {bot.generation}</p><p className="mt-3 text-sm">{bot.activeCases} active assignments · {bot.taskQueue} queued tasks</p><p className="mt-1 text-sm">{bot.casesWorked} cases recorded · {bot.totalTasks} tasks recorded</p>
          <p className="mt-3 text-xs text-gray-500">{bot.lastActivityAt ? `Last recorded activity: ${new Date(bot.lastActivityAt).toLocaleString()}` : 'No activity timestamp recorded'}</p>
        </button>)}</div>
      </section>
      {selected && <Card className="border-cyan-800 bg-gray-950"><CardHeader><CardTitle>{selected.codename} · stored details</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>{selected.personality.catchphrase}</p><p>{selected.totalLearnings} learning records · {selected.totalSpawned} recorded descendants</p><p>Reported success rate: {selected.successRate}% · scoring method and outcome evidence remain unqualified.</p><p>Attributed revenue counter: {selected.revenueGenerated} cents. This is not verified collected money.</p><Button variant="outline" onClick={() => setSelectedId(null)}>Close details</Button></CardContent></Card>}
    </>}
    <section className="rounded-xl border border-gray-800 bg-gray-950 p-5"><h2 className="text-xl font-bold">Worker commands</h2><p className="my-3 text-sm text-gray-400">Deploy, recall, hunting, spawning and evolution need qualified server receipts and action permissions before this screen can issue them. Opening this page sends read requests only.</p><div className="flex flex-wrap gap-3">{['Deploy fleet', 'Recall fleet', 'Hunt leads', 'Spawn worker', 'Evolve worker'].map(label => <Button key={label} disabled title="Job workflow qualification required">{label}</Button>)}</div><Link className="mt-5 inline-block text-cyan-300 underline" href="/founder/recovery-pipeline">Open saved county research work</Link></section>
  </div>;
}
