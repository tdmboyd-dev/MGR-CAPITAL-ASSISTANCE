# MGR Capital: owning the research capability and acquiring the data

Research date: October 29, 2026. Owner decision: prefer MGR-owned capability and investigate original/bulk data acquisition before assuming a vendor is necessary. The earlier blanket limitation on owning contact data was premature. The research below replaces it.

## Decision

Build and own the research application, source registry, record ingestion, evidence index, matching, conflict review, case workflow and first-party contact history. Acquire public records directly where available. Evaluate commercial bulk licenses only for gaps that matter, under an MGR-owned contract. A database copied to our server can still be licensed rather than owned outright. A right to use data internally is different from a right to retain it after termination, combine it, expose it to child companies, train models on it, or resell it.

There is no demonstrated technical prohibition on MGR operating its own skip-tracing business. There is also no evidence that we presently own or have a license to a national phone/email-history database. Provider approval, exact coverage, usage rights and quotes remain unresolved. Those are acquisition requirements to investigate, not proof the business cannot be built.

## How the suppliers do it

The FTC describes people-search services combining government/public information with purchased broker data. Melissa's own technical documentation describes property, loan, credit, telephone and private-source inputs. Its exact supplier identities are not disclosed. These sources support a collection-and-linkage business model; they do not establish that a particular database or use is automatically available to MGR.

Primary references:
- https://consumer.ftc.gov/articles/what-know-about-people-search-sites-sell-your-information
- https://docs.melissa.com/cloud-api/personator-consumer/personator-consumer-faq.html#data-sources

## Acquisition routes verified or sourced

| Route | What it supplies | What was actually checked | Ownership/access decision |
|---|---|---|---|
| Florida DOR public rolls/GIS | Owner names, mailing/property addresses, parcels, assessment and sale-related attributes | Official publication page, 2026 field summary, actual public ArcGIS item/layer metadata and aggregate query | ADAPT: direct public source for an MGR index; validate reuse/exemptions and retain provenance |
| Miami-Dade bulk file library | Parcel, sales and building files | Official page advertises weekly files and $50 per file; no purchase | SOURCED: inspect samples/terms before requesting an owner-approved purchase |
| County clerk surplus inventories | Held surplus, case/deed identifiers, claim-source instructions | Sarasota/Hillsborough official pages; Palm Beach catalog/FAQ | Separate from assessor ownership. Catalog/page retrieval is not a parsed surplus inventory |
| ATTOM bulk licensing | Owner, tax-mailing, recorder, foreclosure and related property records | Published bulk delivery and licensing description | SOURCED: alternative to collecting each county; quote and exact derived-use/retention rights required |
| Regrid bulk exports | Normalized county/state/national parcels and owner-mailing fields | Provider collection description and standard store license page | SOURCED: store export is one-time without updates; standard terms need review, enterprise rights may differ |
| Data Axle licensing/reseller programs | Consumer/business data licensed for products and services | Official licensing and reseller pages | SOURCED: investigate a direct consumer/contact-data license for MGR instead of a finished skip-trace platform; no quote/approval obtained |
| USPS NCOALink | Change-of-address list processing | Official categories, certification and published fees | Possible direct license, but mailing-purpose restrictions make it unsuitable as an unrestricted people-finder database |
| NTIS Limited Access Death Master File | Certain reported death records | Certification and service documentation | Available through certification/licensing, not a free unrestricted death-certificate database |
| First-party collection | Client-confirmed contact details, authorizations and corrections | Native evidence workflow implemented; no real customers contacted | MGR can build this asset over time with appropriate permission and recorded source; no inferred consent |

Official references:
- Florida publication: https://www.floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx
- Florida 2026 NAL fields: https://www.floridarevenue.com/property/Documents/2026NALSummaryTable.pdf
- Official GIS item: https://geodata.floridagio.gov/datasets/efa909d6b1c841d298b0a649e7f71cf2_0/explore
- Miami-Dade: https://bbs.miamidade.gov/
- Sarasota: https://www.sarasotaclerk.com/Home-and-Property/Tax-Deeds/Surplus-Funds-from-Tax-Deed-Sale
- Hillsborough: https://www.hillsclerk.com/taxdeeds
- Palm Beach: https://www.mypalmbeachclerk.com/about-us/frequently-asked-questions-faq/tax-deed-sales-faq
- ATTOM: https://www.attomdata.com/solutions/delivery/bulk-data-licensing/how-it-works/
- Regrid acquisition: https://support.regrid.com/docs/general-faqs and https://app.regrid.com/store/license
- Data Axle: https://www.data-axle.com/data-solutions/data-licensing/ and https://www.data-axle.com/marketing-solutions/resellers/
- USPS: https://postalpro.usps.com/mailing-and-shipping-services/NCOALink
- NTIS: https://dmf.ntis.gov/ and https://www.ntis.gov/ladmf/submit.xhtml

## The concrete Florida finding

The official item exposed a public FeatureServer supporting Query and Extract, with owner name, owner mailing address, parcel ID and physical address fields. An actual aggregate query returned 10,950,670 records and68 CO_NO groups. One group was code0 with97,244 records. This is observed source output, not a claim of68 counties or flawless statewide completeness. The endpoint is recorded in evidence. No national phone database, full Florida bulk snapshot or real claimant record was imported.

The layer's copyright label mentions Alachua while the service/item describe statewide coverage. Record both, validate county codes against the DOR reference and do not assume a label proves jurisdiction. The source cautions about accuracy/completeness and possible inadvertent disclosure of exempt records. Its annual snapshot may lag current county records. Current assessor ownership must not be equated with ownership at the relevant sale or entitlement to surplus.

The original DOR directory link returned401 through the web reader. A separately published public GIS service was available without authentication. No authentication or restriction was bypassed. MGR's new direct connector successfully queried that official API using a synthetic nonexistent parcel and returned zero candidates. That proves the live bounded no-match transport, not positive claimant accuracy. Actual source probes retrieved Florida's information page, Sarasota's source page and Census documentation; the Miami-Dade runtime fetch remained unconfirmed. Source pages imported zero records by design.

## Costs and the unresolved questions

Miami-Dade publicly posts $50 per file. USPS currently displays annual fees of $17,840 for End User Mailer, $36,440 Limited Service Provider and $436,300 Full Service Provider, with separate developer/interface categories. These are posted program fees, not a complete implementation quote or MGR eligibility approval. An older2025 price document differs; do not use that older figure as current. USPS requires certification and CASS-certified matching; its EUM category excludes third-party and affiliate processing. A license category must fit the actual company structure and use.

ATTOM, Data Axle and negotiated enterprise/reseller rights have no verified MGR quote. Do not invent a national database price or claim a consumer mailing-list purchase grants permanent people-search or resale rights. Melissa's published Data Products terms show why this matters: that particular product's terms limit use and restrict combinations and ownership claims. That document is not assumed to govern every Melissa API/product.

Terms reference: https://www.melissa.com/hubfs/MelissaDirect_May2024/pdfs/data-products-terms-conditions.pdf

Before selecting a contact-data supplier, obtain in writing: recovery/claimant-location use; fields and geographic/date coverage; source refresh and correction process; raw/bulk delivery; internal hosting; joining with public records; child-company and Tevin access; caching and post-termination retention; derived records/model-training rights; redistribution/reseller rights if desired; deletion/suppression duties; security requirements; minimum commitment and price per retained verified match. A sample benchmark and exact license are needed before a business decision. No outreach, contract or purchase was authorized or performed by this research.

## MGR-native design and acceptance

Target: find a plausible claimant and assemble traceable evidence, then hand the matter to the appropriate verified case process.

Capabilities: source acquisition -> immutable snapshots -> schema/rights validation -> exact parcel/case joins -> candidate name/address linkage -> conflict review -> source-backed dossier -> independently verified identity/contact permission -> case documents -> confirmed filing -> recorded recovery and financial reconciliation.

MGR owns the source contracts and business workflow. Public records are not exclusive MGR intellectual property; our independent code, derived index and permitted first-party records can be MGR assets. External data remains subject to its actual rights.

Implemented now: bounded case-scoped evidence store in existing PostgreSQL Case.metadata,100 records per case; transactional append, duplicate detection, current-account/company/assignment controls, audits, exact-name/address/parcel research reasons, persisted browser workflow, source catalog/probes and direct Florida parcel API connector. This is an operational initial slice, not a national search index or a commercial Tracerfy-equivalent database. Source statements are stored as unverified; source-text hashing alone is not content verification. No AI confidence percentage is manufactured.

For bulk acquisition: preserve original files and SHA256, publisher/version/retrieval date and rights basis; use a separate normalized source-record table and resumable import jobs, not Case.metadata as a national warehouse. Index county+parcel, instrument/court case and normalized name/address; preserve temporal ownership and source conflicts. Reuse current PostgreSQL for case authority; evaluate Parquet/DuckDB for batch work behind a contract after real volume measurements. No GPU or vector database is inherently required for exact research joins. Hardware costs remain unbenchmarked.

Splink is an open implementation worth studying for probabilistic linkage, with MIT licensing and SQL backends. It is not installed or selected for production, and probabilistic matches require a labelled validation set and measured false-positive/false-negative rates before automated acceptance. Native exact matches are research aids, not calibrated probabilities.
References: https://github.com/moj-analytical-services/splink and https://github.com/moj-analytical-services/splink/blob/master/docs/getting_started.md

## Build order

1. Finish one Florida county's surplus inventory -> historical owner record -> native dossier -> authorized outreach -> document -> claim receipt journey. Include prior owners, joint owners, estate conflicts and competing claims.
2. Acquire current public bulk files for that county, document rights and field freshness, implement resumable/deduplicated normalized imports and source corrections.
3. Benchmark native research recall and staff time against a permitted sample contact-data license. Measure cost per correctly linked and actually contactable claimant, not vendor match percentage.
4. Add permitted phone/email history through direct first-party collection and/or a wholesale license if it materially improves the business. Reject licenses that prevent the intended internal index or child-company model.
5. Expand county-by-county, using measured source maintenance effort and recovery economics. National coverage is a separate data-operations program.

## Other capabilities to own

Own the case workflow, document templates, evidence packs, audit/recovery records, source monitoring, consent/suppression records, staff research tools, deadlines calculated from approved source rules, internal ledger and reconciliation. Reuse MGR Voice and SignMe through explicit contracts instead of creating duplicate divisions. Local OCR, document extraction and matching are reasonable native candidates after evaluating current parser gaps and accuracy. Bank settlement, government filing acceptance, notarization authority and legal eligibility are external outcomes that our software must reconcile; writing code cannot itself establish them. Optional NFTs, public auctions, marketplace and VR features should not delay the core recovery workflow. No approved product canon or fee agreement was changed.
