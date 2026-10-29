'use client';
import { useState } from 'react';
import { api as capitalApi } from '@/lib/api';
import { Search, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
interface Evidence {
    id: string;
    fullName: string;
    address?: string;
    sourceUrl: string;
    sourceRecordId: string;
    sourceDate: string;
    assessment: {
        reasons: string[];
        reviewPriority: string;
    };
}
interface Dossier {
    caseId: string;
    target: {
        fullName: string;
        address: string;
    };
    records: Evidence[];
    scope: string;
}
export default function SkipTraceDashboard() {
    const [caseId, setCaseId] = useState(''), [dossier, setDossier] = useState<Dossier | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [form, setForm] = useState({ fullName: '', address: '', sourceUrl: '', sourceRecordId: '', sourceDate: '', rightsBasis: 'PUBLIC_RECORD', rightsReference: '' });
    async function api(url: string, init: RequestInit = {}) { try {
        const response = await capitalApi.request({ url: url.replace(/^\/api/, ''), method: init.method ?? 'GET', data: init.body ? JSON.parse(String(init.body)) : undefined, timeout: 20000 });
        const body = response.data;
        if (!body.success)
            throw Error(body.error ?? 'The operation could not be confirmed.');
        return body.data;
    }
    catch (error) {
        const e = error as {
            response?: {
                data?: {
                    error?: string;
                };
            };
            message?: string;
        };
        throw Error(e.response?.data?.error ?? e.message ?? 'The operation could not be confirmed.');
    } }
    async function load() { if (!caseId.trim()) {
        setError('Enter the case ID from the case record.');
        return;
    } setBusy(true); setError(''); setNotice(''); setDossier(null); try {
        setDossier(await api('/api/research/cases/' + encodeURIComponent(caseId.trim())));
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function save(event: React.FormEvent) { event.preventDefault(); if (!dossier)
        return; setBusy(true); setError(''); setNotice(''); try {
        const date = new Date(form.sourceDate);
        if (!Number.isFinite(date.getTime()))
            throw Error('Choose the date shown on the source record.');
        const payload = { ...form, sourceDate: date.toISOString(), ...(form.address ? {} : { address: undefined }) };
        const result = await api('/api/research/cases/' + encodeURIComponent(dossier.caseId) + '/evidence', { method: 'POST', body: JSON.stringify(payload) });
        setDossier(await api('/api/research/cases/' + encodeURIComponent(dossier.caseId)));
        setNotice(result.duplicate ? 'This exact source record was already saved.' : 'Evidence saved. Reopening the case will reload the saved research.');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <div className="space-y-6 p-8"><div><h1 className="text-3xl font-bold">MGR Claimant Research</h1><p className="mt-2 text-muted-foreground">Build a source-backed claimant file using your own public-record and client research. No paid skip-trace platform is required for this workflow.</p></div>
 <Card><CardHeader><CardTitle className="flex gap-2"><Search />Open case research</CardTitle></CardHeader><CardContent><Label htmlFor="research-case">Case ID</Label><div className="mt-2 flex gap-3"><Input id="research-case" value={caseId} onChange={e => setCaseId(e.target.value)} disabled={busy} placeholder="Case record ID"/><Button onClick={load} disabled={busy}>{busy ? <Loader2 className="animate-spin"/> : 'Load saved research'}</Button></div></CardContent></Card>
 {error && <p role="alert" className="rounded border border-red-500 p-4">{error}</p>}{notice && <p role="status" className="rounded border p-4">{notice}</p>}
 {dossier && <><Card><CardHeader><CardTitle>{dossier.target.fullName || 'Claimant not identified'}</CardTitle></CardHeader><CardContent><p>{dossier.target.address}</p><p className="mt-3 text-sm text-muted-foreground">Matching records guide research. They do not establish identity, inheritance rights, entitlement to funds, or permission to contact someone.</p></CardContent></Card>
 <Card><CardHeader><CardTitle className="flex gap-2"><FileText />Add source evidence</CardTitle></CardHeader><CardContent><form onSubmit={save} className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{[['fullName', 'Name on record', 'text'], ['address', 'Address on record (optional)', 'text'], ['sourceUrl', 'Source URL', 'url'], ['sourceRecordId', 'Source record or document ID', 'text'], ['sourceDate', 'Source record date', 'date'], ['rightsReference', 'Permitted-use or public-record reference', 'text']].map(([key, label, type]) => <div key={key}><Label htmlFor={'evidence-' + key}>{label}</Label><Input id={'evidence-' + key} type={type} value={form[key as keyof typeof form]} maxLength={key === 'sourceUrl' ? 2000 : 300} required={key !== 'address'} disabled={busy} onChange={e => setForm({ ...form, [key]: e.target.value })}/></div>)}</div><Label htmlFor="evidence-rights">How this record may be used</Label><select id="evidence-rights" className="block w-full rounded border bg-background p-2" disabled={busy} value={form.rightsBasis} onChange={e => setForm({ ...form, rightsBasis: e.target.value })}><option value="PUBLIC_RECORD">Public record</option><option value="CLIENT_CONSENT">Provided with client consent</option><option value="LICENSED_INTERNAL_USE">Licensed for internal use</option></select><Button disabled={busy} type="submit">Save evidence</Button></form></CardContent></Card>
 <div className="space-y-3">{dossier.records.length === 0 ? <p>No evidence has been saved for this case yet.</p> : dossier.records.map(row => <Card key={row.id}><CardHeader><CardTitle>{row.fullName}</CardTitle></CardHeader><CardContent><p>{row.address}</p><a className="underline" href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Source: {row.sourceRecordId}</a><p className="mt-2">Record date: {new Date(row.sourceDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}</p><p className="mt-2">Research support: {row.assessment.reasons.join(', ').replaceAll('_', ' ') || 'No exact link to the current case fields'}</p><p className="text-sm text-muted-foreground">Source contents and claimant identity still require review.</p></CardContent></Card>)}</div></>}
 </div>;
}
