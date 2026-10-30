"use client";
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card,CardHeader,CardTitle,CardContent } from '@/components/ui/card';
import Link from 'next/link';
const schema=z.object({success:z.literal(true),count:z.number().int().nonnegative(),data:z.array(z.object({id:z.string(),title:z.string(),message:z.string(),priority:z.enum(['HIGH','MEDIUM','LOW']),createdAt:z.string(),link:z.string().nullable()}))});
export default function FounderInsightsPage(){
 const {user}=useAuth();
 const feed=useQuery({queryKey:['founder-focus-items',user?.id],enabled:Boolean(user),gcTime:0,queryFn:async({signal})=>schema.parse((await api.get('/ops/insights?limit=100',{signal})).data)});
 return <div className="space-y-6 p-6"><div className="flex items-center justify-between gap-4"><h1 className="text-3xl font-bold">Founder Focus Feed</h1><Button variant="outline" disabled={feed.isFetching} onClick={()=>{void feed.refetch();}}>Refresh</Button></div><p>Saved, undismissed operational items. An empty feed does not certify that the business has no problems. Read receipts and dismissal controls are not connected on this screen.</p><Link className="underline" href="/founder/dashboard">Open the operations dashboard</Link>{feed.isLoading&&<p role="status">Loading saved focus items...</p>}{feed.isError&&<p role="alert">Focus items are unavailable. Refresh to retry; no empty success or sample metrics were substituted.</p>}{feed.data&&<><p>{feed.data.count} undismissed items · showing {feed.data.data.length}</p>{feed.data.data.length===0&&<p>No undismissed items were returned.</p>}{feed.data.data.map(item=><Card key={item.id}><CardHeader><CardTitle>{item.title}</CardTitle></CardHeader><CardContent className="space-y-2"><p>{item.priority} priority · {new Date(item.createdAt).toISOString()}</p><p>{item.message}</p>{item.link?.startsWith('/founder/cases/')&&<Link className="underline" href={item.link}>Open related case</Link>}</CardContent></Card>)}</>}</div>;
}
