import crypto from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';
export const governmentSources = [
    { id: 'fl-dor-rolls', name: 'Florida assessment rolls and parcel data', url: 'https://www.floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx', kind: 'BULK_DATA_DIRECTORY', acquisition: 'Published downloads; historical files by records request', data: 'Name-address-legal, sale and GIS records; exempt records excluded', rightsStatus: 'PUBLICATION_CONFIRMED_REUSE_REVIEW_REQUIRED' },
    { id: 'miami-dade-bulk', name: 'Miami-Dade Property Appraiser bulk file library', url: 'https://bbs.miamidade.gov/', kind: 'PAID_BULK_FILE', acquisition: 'Published $50 per file; account/purchase requires owner action', data: 'Parcel, sales and building files; inspect sample/readme before acquisition', rightsStatus: 'PURCHASE_AND_TERMS_REQUIRED' },
    { id: 'hillsborough-tax-deed', name: 'Hillsborough tax deed source and claim instructions', url: 'https://www.hillsclerk.com/taxdeeds', kind: 'OFFICIAL_SOURCE_PAGE', acquisition: 'Official public page links to records systems', data: 'Tax deed process and records links; source page is not a surplus inventory', rightsStatus: 'PUBLIC_PAGE_NO_AUTOMATED_RECORDS_RIGHT_ASSERTED' },
    { id: 'sarasota-tax-deed', name: 'Sarasota surplus funds and records source', url: 'https://www.sarasotaclerk.com/Home-and-Property/Tax-Deeds/Surplus-Funds-from-Tax-Deed-Sale', kind: 'OFFICIAL_SOURCE_PAGE', acquisition: 'Official page links to tax deed records with Surplus Balance filter', data: 'Surplus claim process and linked record search', rightsStatus: 'PUBLIC_PAGE_NO_AUTOMATED_RECORDS_RIGHT_ASSERTED' },
    { id: 'palm-beach-reports', name: 'Palm Beach Clerk report catalog', url: 'https://appsgp.mypalmbeachclerk.com/clerkcart/ProductList.aspx', kind: 'PAID_REPORT_CATALOG', acquisition: 'Current Tax Deed Surplus/Registry Report; purchase requires owner action', data: 'Official report catalog; no report has been purchased', rightsStatus: 'PURCHASE_AND_TERMS_REQUIRED' },
    { id: 'census-geocoder', name: 'Census address geocoder documentation', url: 'https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html', kind: 'PUBLIC_API_DOCUMENTATION', acquisition: 'Public geocoding service', data: 'Address geography; no owner identity or phone append', rightsStatus: 'PUBLIC_DOCUMENTATION' }
] as const;
export class GovernmentSourceService {
    constructor(private transport: typeof fetch = fetch) { }
    async probe(id: string) {
        const source = governmentSources.find(s => s.id === id);
        if (!source)
            throw new AppError('Unknown source', 404, 'Unknown admitted source.');
        const checkedAt = new Date().toISOString();
        const signal = AbortSignal.timeout(15000);
        let url = source.url as string;
        try {
            for (let redirects = 0; redirects <= 3; redirects++) {
                const response = await this.transport(url, { redirect: 'manual', signal, headers: { 'User-Agent': 'MGR-Capital-Source-Research/1.0', 'Accept': 'text/html,application/json,text/plain' } });
                if (response.status >= 300 && response.status < 400) {
                    await response.body?.cancel();
                    const next = new URL(response.headers.get('location') ?? '', url);
                    const allowed = [new URL(source.url).hostname, new URL(source.url).hostname.replace(/^www\./, '')];
                    if (next.protocol !== 'https:' || next.username || next.password || !allowed.includes(next.hostname))
                        return { sourceId: id, checkedAt, status: 'REDIRECT_REVIEW_REQUIRED', httpStatus: response.status, recordsImported: 0 };
                    url = next.href;
                    continue;
                }
                if (!response.ok) {
                    await response.body?.cancel();
                    return { sourceId: id, checkedAt, status: 'SOURCE_ACCESS_UNAVAILABLE', httpStatus: response.status, recordsImported: 0 };
                }
                if (!response.body)
                    throw Error('No body');
                const reader = response.body.getReader(), hash = crypto.createHash('sha256');
                let bytes = 0;
                try {
                    while (true) {
                        const item = await reader.read();
                        if (item.done)
                            break;
                        bytes += item.value.length;
                        if (bytes > 2 * 1024 * 1024)
                            throw Error('Oversized source');
                        hash.update(item.value);
                    }
                }
                finally {
                    await reader.cancel().catch(() => { });
                }
                return { sourceId: id, checkedAt, status: 'SOURCE_PAGE_FETCHED', httpStatus: response.status, contentType: response.headers.get('content-type'), bytes, sha256: hash.digest('hex'), recordsImported: 0, recordExtractionVerified: false };
            }
            throw Error('Redirect limit');
        }
        catch {
            return { sourceId: id, checkedAt, status: 'SOURCE_FETCH_UNCONFIRMED', recordsImported: 0 };
        }
    }
}
export const governmentSourceService = new GovernmentSourceService();
