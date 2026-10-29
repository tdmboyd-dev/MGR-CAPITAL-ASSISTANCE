import { z } from 'zod';
import crypto from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';
export const floridaParcelEndpoint = 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0';
export const floridaParcelQuery = z.object({ countyNumber: z.number().int().min(1).max(99), parcelId: z.string().trim().regex(/^[A-Za-z0-9 ._\/-]{1,80}$/) }).strict();
export class FloridaPublicParcelService {
    constructor(private transport: typeof fetch = fetch) { }
    async lookup(input: unknown) {
        const parsed = floridaParcelQuery.safeParse(input);
        if (!parsed.success)
            throw new AppError('Invalid parcel query', 400, 'Provide the DOR county number and exact parcel ID.');
        const { countyNumber, parcelId } = parsed.data;
        const query = new URLSearchParams({ f: 'json', where: `CO_NO=${countyNumber} AND PARCEL_ID='${parcelId}'`, outFields: 'OBJECTID,CO_NO,PARCEL_ID,ASMNT_YR,OWN_NAME,OWN_ADDR1,OWN_ADDR2,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1,PHY_CITY,PHY_ZIPCD', returnGeometry: 'false', resultRecordCount: '5' });
        const sourceUrl = floridaParcelEndpoint + '/query?' + query.toString();
        let response: Response;
        try {
            response = await this.transport(sourceUrl, { redirect: 'error', signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
        }
        catch {
            throw new AppError('Public source unavailable', 503, 'Government parcel lookup was not confirmed.');
        }
        if (!response.ok)
            throw new AppError('Public source unavailable', 503, 'Government parcel lookup was not confirmed.');
        if (!response.body)
            throw new AppError('Empty response', 503, 'Government source returned no data.');
        const reader = response.body.getReader(), chunks: Uint8Array[] = [];
        let size = 0;
        try {
            while (true) {
                const item = await reader.read();
                if (item.done)
                    break;
                size += item.value.length;
                if (size > 262144)
                    throw new AppError('Oversized source', 503, 'Government response exceeded the bounded lookup size.');
                chunks.push(item.value);
            }
        }
        finally {
            await reader.cancel().catch(() => { });
        }
        const bytes = Buffer.concat(chunks);
        let data: any;
        try {
            data = JSON.parse(bytes.toString('utf8'));
        }
        catch {
            throw new AppError('Malformed response', 503, 'Government source returned unreadable data.');
        }
        if (data.error || !Array.isArray(data.features) || data.features.length > 5)
            throw new AppError('Invalid source response', 503, 'Government query could not be validated.');
        const candidates = data.features.map((feature: any) => { const a = feature?.attributes; if (!a || Number(a.CO_NO) !== countyNumber || a.PARCEL_ID !== parcelId)
            throw new AppError('Target disagreement', 503, 'Government response did not match the requested county and parcel.'); for (const key of ['OWN_NAME', 'OWN_ADDR1', 'OWN_ADDR2', 'OWN_CITY', 'OWN_STATE', 'PHY_ADDR1', 'PHY_CITY'])
            if (a[key] !== null && a[key] !== undefined && typeof a[key] !== 'string')
                throw new AppError('Invalid field', 503, 'Government source schema changed.'); return { sourceRecordId: String(a.OBJECTID), parcelId: a.PARCEL_ID, countyNumber: a.CO_NO, assessmentYear: a.ASMNT_YR, fullName: a.OWN_NAME ?? '', mailingAddress: { street: a.OWN_ADDR1 ?? '', line2: a.OWN_ADDR2 ?? '', city: a.OWN_CITY ?? '', state: a.OWN_STATE ?? '', zip: a.OWN_ZIPCD }, propertyAddress: { street: a.PHY_ADDR1 ?? '', city: a.PHY_CITY ?? '', zip: a.PHY_ZIPCD }, identityVerified: false, heirVerified: false, contactPermissionVerified: false }; });
        return { engine: 'MGR_DIRECT_GOVERNMENT_PARCEL_RESEARCH', sourceUrl, retrievedAt: new Date().toISOString(), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), candidates, truncated: data.exceededTransferLimit === true, identityVerified: false, recordsSaved: 0, limitation: 'Public assessment data may be stale and is not proof of current title, surplus entitlement, identity or contact consent.' };
    }
}
export const floridaPublicParcelService = new FloridaPublicParcelService();
