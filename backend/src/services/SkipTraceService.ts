import crypto from "node:crypto";
import { z } from "zod";
import { AppError } from "../middleware/errorHandler.js";
export interface PersonInput {
    firstName: string;
    lastName: string;
    middleName?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    ssn?: string; // Last 4 only, for enhanced matching
    dob?: string; // YYYY-MM-DD format
}
export interface PhoneResult {
    number: string;
    type: "mobile" | "landline" | "voip" | "unknown";
    carrier?: string;
    isValid: boolean;
    doNotCall: boolean;
    lastSeen?: Date;
}
export interface EmailResult {
    address: string;
    isValid: boolean;
    type: "personal" | "work" | "unknown";
    lastSeen?: Date;
}
export interface AddressResult {
    street: string;
    city: string;
    state: string;
    zip: string;
    county?: string;
    type: "current" | "previous";
    moveInDate?: Date;
    moveOutDate?: Date;
    isVerified: boolean;
}
export interface RelativeResult {
    firstName: string;
    lastName: string;
    relationship?: string;
    age?: number;
    addresses?: AddressResult[];
    phones?: PhoneResult[];
}
export interface SkipTraceResult {
    id: string;
    input: PersonInput;
    matchConfidence: number; // 0-100
    status: "found" | "partial" | "not_found" | "error";
    person?: {
        firstName: string;
        lastName: string;
        middleName?: string;
        suffix?: string;
        age?: number;
        dob?: string;
        isDeceased?: boolean;
        deceasedDate?: string;
    };
    phones: PhoneResult[];
    emails: EmailResult[];
    addresses: AddressResult[];
    relatives: RelativeResult[];
    aliases?: string[];
    employment?: {
        employer: string;
        title?: string;
        address?: string;
    }[];
    bankruptcy?: {
        chapter: string;
        filingDate: string;
        dischargeDate?: string;
        court: string;
    }[];
    liens?: {
        type: string;
        amount: number;
        filingDate: string;
        creditor?: string;
    }[];
    processedAt: Date;
    cost: number;
    costVerified?: boolean;
    confidenceVerified?: boolean;
    provider?: string;
    requestId?: string;
    creditsDeducted?: number;
    candidateOnly?: boolean;
}
export interface BatchResult {
    batchId: string;
    totalRecords: number;
    successCount: number;
    failCount: number;
    results: SkipTraceResult[];
    totalCost: number;
}
export const personSchema = z.object({ firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), address: z.string().trim().min(1).max(250), city: z.string().trim().min(1).max(100), state: z.string().regex(/^[A-Z]{2}$/), zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional() }).strict();
const unavailable = (message: string, code = 503) => new AppError(message, code, message);
/** Real provider data only. Results are research candidates, never identity or legal-heir proof. */
export class SkipTraceService {
    private enabled: boolean;
    private key: string;
    private base: string;
    private transport: typeof fetch;
    private windowStart = Date.now();
    private count = 0;
    private batchStart = Date.now();
    private batchCount = 0;
    constructor(options: {
        apiKey?: string;
        baseUrl?: string;
        fetchImpl?: typeof fetch;
        enabled?: boolean;
    } = {}) {
        this.enabled = options.enabled ?? process.env.CAPITAL_EXTERNAL_SKIP_TRACE === 'enabled';
        this.key = options.apiKey ?? process.env.TRACERFY_API_KEY ?? "";
        this.base = (options.baseUrl ?? process.env.TRACERFY_API_URL ?? "https://tracerfy.com/v1/api").replace(/\/$/, "");
        this.transport = options.fetchImpl ?? fetch;
        const url = new URL(this.base);
        if (url.protocol !== "https:" || !["tracerfy.com", "www.tracerfy.com"].includes(url.hostname) || url.pathname !== "/v1/api" || url.search || url.hash || url.username || url.password || url.port)
            throw unavailable("Unapproved skip-trace provider endpoint");
    }
    private configured() { if (!this.key || !this.enabled)
        throw unavailable("Optional paid skip tracing is unavailable: it is disabled or not configured. MGR native research remains available. No search or charge was performed."); }
    private limit(batch = false) { const now = Date.now(); if (batch) {
        if (now - this.batchStart >= 300000) {
            this.batchStart = now;
            this.batchCount = 0;
        }
        if (this.batchCount >= 10)
            throw unavailable("Batch submission limit reached; wait before submitting again.", 429);
        this.batchCount++;
    }
    else {
        if (now - this.windowStart >= 60000) {
            this.windowStart = now;
            this.count = 0;
        }
        if (this.count >= 500)
            throw unavailable("Lookup limit reached; wait before submitting again.", 429);
        this.count++;
    } }
    private async request(endpoint: string, init: RequestInit = {}) {
        this.configured();
        let response: Response;
        try {
            response = await this.transport(this.base + endpoint, { ...init, redirect: "error", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${this.key}`, ...init.headers } });
        }
        catch {
            throw unavailable("Provider response was not confirmed. Do not automatically repeat a paid request.");
        }
        if (!response.ok) {
            const status = response.status;
            throw unavailable(status === 402 ? "Provider credits are insufficient; owner review is required." : status === 429 ? "Provider rate limit reached; do not automatically resubmit." : status === 409 ? "Provider job is still pending." : "Skip-trace provider could not complete the request.", status === 402 ? 402 : status === 429 ? 429 : status === 409 ? 409 : 503);
        }
        const declared = Number(response.headers.get("content-length"));
        if (declared > 4 * 1024 * 1024)
            throw unavailable("Provider response exceeded its allowed size.");
        if (!response.body)
            throw unavailable("Provider returned no response body.");
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
            while (true) {
                const part = await reader.read();
                if (part.done)
                    break;
                size += part.value.length;
                if (size > 4 * 1024 * 1024)
                    throw unavailable("Provider response exceeded its allowed size.");
                chunks.push(part.value);
            }
        }
        finally {
            await reader.cancel().catch(() => { });
        }
        let data: any;
        try {
            data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        }
        catch {
            throw unavailable("Provider returned malformed data.");
        }
        return { data, requestId: response.headers.get("x-request-id") ?? data?.meta?.request_id };
    }
    private map(person: any, input: PersonInput, requestId?: string): SkipTraceResult {
        if (!person || typeof person !== "object" || Array.isArray(person))
            throw unavailable("Provider returned an invalid person record.");
        const string = (v: unknown) => typeof v === "string" ? v.slice(0, 300) : "";
        const phones: PhoneResult[] = (Array.isArray(person.phones) ? person.phones : []).filter((p: any) => typeof p.number === "string" && /^\+?[\d ()-]{7,25}$/.test(p.number)).map((p: any) => ({ number: p.number, type: ["mobile", "landline", "voip"].includes(string(p.type).toLowerCase()) ? string(p.type).toLowerCase() : "unknown", carrier: string(p.carrier) || undefined, isValid: false, doNotCall: p.dnc !== false || p.tcpa !== false || person.litigator !== false })) as PhoneResult[];
        const emails: EmailResult[] = (Array.isArray(person.emails) ? person.emails : []).filter((e: any) => typeof e.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.email)).map((e: any) => ({ address: e.email, type: "unknown", isValid: false }));
        const addresses: AddressResult[] = [];
        if (person.mailing_address?.street)
            addresses.push({ street: string(person.mailing_address.street), city: string(person.mailing_address.city), state: string(person.mailing_address.state), zip: string(person.mailing_address.zip), type: "current", isVerified: false });
        const relatives: RelativeResult[] = (Array.isArray(person.relatives) ? person.relatives : []).slice(0, 20).filter((p: any) => p && typeof p === "object").map((p: any) => ({ firstName: string(p.first_name), lastName: string(p.last_name) }));
        return { id: crypto.randomUUID(), input, matchConfidence: 0, confidenceVerified: false, status: "found", person: { firstName: string(person.first_name), lastName: string(person.last_name), isDeceased: typeof person.deceased === "boolean" ? person.deceased : undefined }, phones, emails, addresses, relatives, processedAt: new Date(), cost: 0, costVerified: false, provider: "tracerfy", requestId, candidateOnly: true };
    }
    private async lookup(input: PersonInput, enhanced: boolean, owner = false): Promise<SkipTraceResult[]> {
        const validated = personSchema.safeParse(input);
        if (!validated.success)
            throw unavailable("Provide first name, last name, street address, city and uppercase two-letter state; no SSN is accepted.", 400);
        this.configured();
        this.limit();
        const p = validated.data;
        const { data, requestId } = await this.request(enhanced ? "/trace/enhanced/lookup/" : "/trace/lookup/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: p.address, city: p.city, state: p.state, zip: p.zip, find_owner: owner, ...(!owner ? { first_name: p.firstName, last_name: p.lastName } : {}) }) });
        if (typeof data?.hit !== "boolean" || !Array.isArray(data.persons))
            throw unavailable("Provider returned an unsupported response shape.");
        if (data.hit !== (data.persons.length > 0))
            throw unavailable("Provider hit indicator and person records disagree.");
        return data.persons.map((person: any) => ({ ...this.map(person, owner ? { ...p, firstName: "", lastName: "" } : p, requestId), creditsDeducted: typeof data.credits_deducted === "number" ? data.credits_deducted : undefined }));
    }
    async tracePerson(input: PersonInput, enhanced = false): Promise<SkipTraceResult> { const rows = await this.lookup(input, enhanced); if (rows.length > 1)
        throw unavailable("Multiple candidates returned; review the property lookup results before selecting a person.", 409); return rows[0] ?? { id: crypto.randomUUID(), input, status: "not_found", matchConfidence: 0, confidenceVerified: false, phones: [], emails: [], addresses: [], relatives: [], processedAt: new Date(), cost: 0, costVerified: false, candidateOnly: true, provider: "tracerfy" }; }
    async traceByProperty(address: string, city: string, state: string, zip: string) { return this.lookup({ firstName: "Owner", lastName: "Search", address, city, state, ...(zip ? { zip } : {}) }, false, true); }
    async traceBatch(_inputs: PersonInput[], _enhanced = false): Promise<BatchResult> { throw unavailable("Synchronous bulk tracing is disabled. Use a durable case-bound batch job before enabling bulk processing."); }
    async submitBatchTrace(_inputs: PersonInput[], _enhanced = false): Promise<{
        queueId: number;
        rowsUploaded: number;
        traceType: string;
    }> { throw unavailable("Batch submission requires durable case/input binding and recovery before paid jobs can be enabled."); }
    async fetchQueueResults(queueId: number): Promise<SkipTraceResult[]> { if (!Number.isSafeInteger(queueId) || queueId < 1)
        throw unavailable("Invalid queue id.", 400); const { data, requestId } = await this.request(`/queue/${queueId}`); if (!Array.isArray(data))
        throw unavailable("Provider queue response was malformed."); return data.flatMap((record: any) => { if (!Array.isArray(record?.persons))
        throw unavailable("Queue format requires an explicit parser; no records were assumed matched."); return record.persons.map((p: any) => this.map(p, { firstName: "", lastName: "", address: record.address, city: record.city, state: record.state }, requestId)); }); }
    async getTracerfyAnalytics() { return (await this.request("/analytics/")).data; }
    async findHeirs(_person: PersonInput, _maxGenerations = 2): Promise<{
        deceased: SkipTraceResult;
        heirs: SkipTraceResult[];
        confidence: number;
    }> { throw unavailable("Provider relatives are research leads, not verified legal heirs. Probate and relationship evidence must be reviewed before heir selection."); }
    async checkDeceasedStatus(_input: PersonInput): Promise<{
        isDeceased: boolean;
        confidence: number;
        deceasedDate?: string;
        source?: string;
    }> { throw unavailable("A skip-trace match does not verify death. No Death Master File or vital-records verification is connected."); }
    scoreResult(_result: SkipTraceResult) { return 0; }
    getStatus() { return { configured: !!this.key, enabled: this.enabled, mode: !this.enabled ? "disabled" : this.key ? "configured_unverified" : "unavailable", provider: "tracerfy", realProviderVerified: false, candidateOnly: true, rateLimit: { used: this.count, max: 500 }, batch: { enabled: false, reason: "Durable owner/case/input binding required" }, instantCredits: { normal: 5, enhanced: 15 }, dollarCostVerified: false }; }
}
export const skipTraceService = new SkipTraceService();
