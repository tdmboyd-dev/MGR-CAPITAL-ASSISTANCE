"use client";

import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Client = { id: string; name: string; email: string; isActive?: boolean };
type CaseInput = { clientId: string; state: string; county: string; propertyAddress: string; surplusAmountCents: number; feePercent: number; saleDate?: string; source: string };
type SavedCase = { id: string; internalCode: string; status: string; feePercent: number };

export function CaseIntakeForm({ initialAddress = '', source = 'manual' }: { initialAddress?: string; source?: string }) {
  const { user, accessToken } = useAuth();
  const cache = useQueryClient();
  const clientKey = ['case-intake-clients', user?.id];
  const clients = useQuery({ queryKey: clientKey, enabled: Boolean(user && accessToken), queryFn: async ({ signal }) => {
    const { data } = await api.get('/clients', { signal });
    if (!Array.isArray(data.data)) throw Error('Invalid client response');
    return data.data as Client[];
  } });
  const [clientId, setClientId] = useState('');
  const [state, setState] = useState('');
  const [county, setCounty] = useState('');
  const [address, setAddress] = useState(initialAddress);
  const [saleDate, setSaleDate] = useState('');
  const [surplus, setSurplus] = useState('0');
  const [fee, setFee] = useState('33');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState<SavedCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingClient, setAddingClient] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientBusy, setClientBusy] = useState(false);
  const attempt = useRef<{ key: string; payload: CaseInput } | null>(null);

  const addClient = async () => {
    setClientBusy(true); setError(null);
    try {
      const { data } = await api.post('/clients', { name: clientName, email: clientEmail });
      const created = data.data as Client;
      cache.setQueryData<Client[]>(clientKey, current => [created, ...(current || [])]);
      setClientId(created.id); setAddingClient(false); setClientName(''); setClientEmail('');
    } catch (cause: unknown) { setError((cause as { response?: { data?: { error?: string } } }).response?.data?.error || 'Client could not be saved. Check the client list before retrying.'); }
    finally { setClientBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    if (!attempt.current) {
      const cents = Math.round(Number(surplus) * 100), percent = Number(fee);
      if (!clientId || !/^[A-Z]{2}$/.test(state) || !county.trim() || !address.trim() || !/^\d+(?:\.\d{1,2})?$/.test(surplus) || !Number.isSafeInteger(cents) || cents < 0 || cents > 2147483647 || !Number.isInteger(percent) || percent < 0 || percent > 100) { setError('Select a client and enter a valid state, county, address, dollar amount and fee.'); return; }
      attempt.current = { key: crypto.randomUUID(), payload: { clientId, state, county: county.trim(), propertyAddress: address.trim(), surplusAmountCents: cents, feePercent: percent, ...(saleDate ? { saleDate } : {}), source } };
    }
    setBusy(true);
    try {
      const { data } = await api.post('/cases', attempt.current.payload, { headers: { 'Idempotency-Key': attempt.current.key } });
      if (!data.success || !data.data?.id) throw Error('Case save could not be confirmed');
      setSaved(data.data); setUncertain(false);
      await cache.invalidateQueries({ queryKey: ['cases'] });
    } catch (cause: unknown) {
      const failure = cause as { response?: { status?: number; data?: { error?: string } } };
      const status = failure.response?.status;
      if (status && status >= 400 && status < 500 && status !== 409) { attempt.current = null; setUncertain(false); }
      else setUncertain(true);
      setError(failure.response?.data?.error || 'Save outcome is unknown. Retry this same request to check or finish it without creating a duplicate.');
    } finally { setBusy(false); }
  };
  if (saved) return <section role="status" className="space-y-3 rounded-xl border border-primary/40 p-5">
    <h2 className="text-xl font-semibold">Case {saved.internalCode} saved</h2>
    <p>Status: {saved.status}. Recorded fee: {saved.feePercent}%.</p>
    <p className="text-sm text-muted-foreground">This saves a new case. No claim filing or payment has been performed.</p>
    <Button asChild><Link href={`/founder/cases/${saved.id}`}>Open saved case</Link></Button>
    <Button variant="outline" className="ml-2" onClick={() => { setSaved(null); attempt.current = null; }}>Start another case</Button>
  </section>;
  return <form onSubmit={submit} className="space-y-5">
    {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    {clients.isError && <p role="alert">Client list unavailable. <button type="button" className="underline" onClick={() => { void clients.refetch(); }}>Retry</button></p>}
    <fieldset disabled={busy || uncertain || clientBusy} className="space-y-4 disabled:opacity-70">
      <div className="space-y-2"><Label htmlFor="intake-client">Client</Label>
        <select id="intake-client" required value={clientId} onChange={event => setClientId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3">
          <option value="">{clients.isLoading ? 'Loading clients…' : 'Select a client'}</option>
          {clients.data?.filter(client => client.isActive !== false).map(client => <option key={client.id} value={client.id}>{client.name} — {client.email}</option>)}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={() => setAddingClient(value => !value)}>Add a client</Button>
      </div>
      {addingClient && <section className="space-y-3 rounded-lg border p-4">
        <Label htmlFor="intake-client-name">Client name</Label><Input id="intake-client-name" value={clientName} onChange={event => setClientName(event.target.value)} maxLength={200} />
        <Label htmlFor="intake-client-email">Client email</Label><Input id="intake-client-email" type="email" value={clientEmail} onChange={event => setClientEmail(event.target.value)} maxLength={254} />
        <p className="text-xs text-muted-foreground">The client is saved in your company. The configured welcome-email service may send a welcome message.</p>
        <Button type="button" disabled={!clientName.trim() || !clientEmail.trim()} onClick={() => { void addClient(); }}>Save client</Button>
      </section>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="intake-state">State code</Label><Input id="intake-state" placeholder="FL" value={state} onChange={event => setState(event.target.value.toUpperCase())} pattern="[A-Z]{2}" maxLength={2} required /></div>
        <div className="space-y-2"><Label htmlFor="intake-county">County</Label><Input id="intake-county" value={county} onChange={event => setCounty(event.target.value)} maxLength={100} required /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="intake-address">Property address</Label><Input id="intake-address" value={address} onChange={event => setAddress(event.target.value)} maxLength={2000} required /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="intake-date">Sale date, if known</Label><Input id="intake-date" type="date" value={saleDate} onChange={event => setSaleDate(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="intake-surplus">Recorded surplus (USD)</Label><Input id="intake-surplus" inputMode="decimal" value={surplus} onChange={event => setSurplus(event.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="intake-fee">Requested fee (%)</Label><Input id="intake-fee" type="number" min={0} max={100} step={1} value={fee} onChange={event => setFee(event.target.value)} required /></div>
      </div>
      <p className="text-sm text-muted-foreground">Use 0 when the surplus has not been established. A voice estimate does not confirm available funds.</p>
    </fieldset>
    {uncertain && <p className="text-sm">The input is held for a safe retry. Review your saved cases before starting a different request.</p>}
    <Button type="submit" disabled={busy || clientBusy || clients.isLoading || clients.isError}>{busy ? 'Saving…' : uncertain ? 'Retry same request' : 'Save new case'}</Button>
  </form>;
}
