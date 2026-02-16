/**
 * FOIA Request Bot Service
 *
 * Automates FOIA/Public Records requests to county clerks:
 * - Email templates for FOIA requests
 * - Contact database for county clerks in all 50 states
 * - Automated email sending via Modoboa
 * - Response tracking and follow-up scheduling
 * - PDF/Excel attachment parsing when counties respond
 *
 * FREE lead generation - no API costs
 */

import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { emailService } from '../EmailService.js';
import { ingestionService } from '../IngestionService.js';
import {
  CountyClerkContact,
  FOIARequest,
  FOIATemplate,
  LeadRecord,
  LeadGenerationResult,
} from './types.js';

// =============================================================================
// FOIA EMAIL TEMPLATES
// =============================================================================

const FOIA_TEMPLATES: FOIATemplate[] = [
  {
    id: 'surplus_funds_general',
    name: 'General Surplus Funds Request',
    requestType: 'surplus_funds',
    subject: 'Public Records Request - Tax Sale Surplus Funds List',
    body: `Dear [CLERK_NAME],

I am writing to request public records pursuant to [STATE_FOIA_STATUTE] (Freedom of Information Act / Public Records Act).

Specifically, I am requesting:

1. A list of all tax sale surplus funds, excess proceeds, or overbid amounts currently held by [COUNTY_NAME] County that are available for claim by former property owners.

2. For each surplus fund entry, please include:
   - Former property owner name
   - Property address or parcel number
   - Sale date
   - Amount of surplus funds
   - Claim deadline (if applicable)

3. Any list of unclaimed tax sale surplus funds from the past 5 years.

I prefer to receive these records in electronic format (Excel, CSV, or PDF) if available.

Please advise if there are any fees associated with this request. I am willing to pay reasonable fees for copying and retrieval.

If you have any questions regarding this request, please contact me at [REPLY_EMAIL].

Thank you for your assistance.

Sincerely,
MGR Capital Assistance
Public Records Department
Email: [REPLY_EMAIL]
Phone: [COMPANY_PHONE]`,
    followUpSubject: 'Follow-Up: Public Records Request - Tax Sale Surplus Funds (Original Request [REQUEST_DATE])',
    followUpBody: `Dear [CLERK_NAME],

I am following up on my public records request submitted on [REQUEST_DATE] regarding tax sale surplus funds held by [COUNTY_NAME] County.

I have not yet received a response to this request. Under [STATE_FOIA_STATUTE], I believe a response is due within [RESPONSE_DEADLINE] days.

Could you please provide an update on the status of this request?

If you need any clarification, please let me know.

Thank you,
MGR Capital Assistance`,
  },
  {
    id: 'excess_proceeds_specific',
    name: 'Excess Proceeds - Specific Format Request',
    requestType: 'excess_proceeds',
    subject: 'Public Records Request - Tax Sale Excess Proceeds Report',
    body: `Dear Records Custodian,

Pursuant to the public records laws of [STATE_NAME], I am requesting the following records:

REQUESTED RECORDS:
- Current list of all tax sale excess proceeds/surplus funds
- Historical surplus funds list for the past 3 years
- Any annual or quarterly excess proceeds reports

PREFERRED FORMAT:
Electronic format (spreadsheet preferred - Excel or CSV)

FIELDS REQUESTED (if available):
- Parcel/Property ID
- Former Owner Name
- Property Address
- Sale Date
- Excess Proceeds Amount
- Current Status

FEE WAIVER REQUEST:
If fees apply, please advise of the estimated cost before processing. We are a research organization and request a fee waiver if possible.

Please send records to: [REPLY_EMAIL]

Thank you for your prompt attention to this request.

Regards,
MGR Capital Assistance
[COMPANY_ADDRESS]`,
    followUpSubject: 'Second Request: Tax Sale Excess Proceeds Records - [COUNTY_NAME] County',
    followUpBody: `Dear Records Custodian,

This is a follow-up to my public records request dated [REQUEST_DATE].

I have not received a response or acknowledgment. Please confirm receipt of this request and provide an expected timeline for fulfillment.

Original Request: Tax Sale Excess Proceeds/Surplus Funds List

If this request was directed to the wrong office, please advise who I should contact.

Thank you,
MGR Capital Assistance
[REPLY_EMAIL]`,
  },
  {
    id: 'tax_sale_results',
    name: 'Tax Sale Results Request',
    requestType: 'tax_sale_results',
    subject: 'Public Records Request - Recent Tax Sale Results',
    body: `To Whom It May Concern:

Under the [STATE_NAME] Public Records Act, I am requesting:

1. Results from all tax sales conducted in [COUNTY_NAME] County in the past 12 months, including:
   - Properties sold
   - Sale amounts
   - Previous owner information
   - Any surplus/excess proceeds generated

2. List of scheduled upcoming tax sales

3. Current surplus funds awaiting claim

Please provide in electronic format if available. I am willing to pay reasonable copying fees.

Contact: [REPLY_EMAIL]

Thank you,
MGR Capital Assistance`,
    followUpSubject: 'Follow-Up: Tax Sale Results Request - [COUNTY_NAME] County',
    followUpBody: `Hello,

Following up on my records request from [REQUEST_DATE] regarding tax sale results and surplus funds.

Please confirm if this request is being processed or if additional information is needed.

Thank you,
MGR Capital Assistance
[REPLY_EMAIL]`,
  },
];

// =============================================================================
// STATE FOIA STATUTES
// =============================================================================

const STATE_FOIA_STATUTES: Record<string, string> = {
  AL: 'Alabama Public Records Law (Ala. Code 36-12-40)',
  AK: 'Alaska Public Records Act (AS 40.25.110)',
  AZ: 'Arizona Public Records Law (A.R.S. 39-121)',
  AR: 'Arkansas Freedom of Information Act (Ark. Code 25-19-105)',
  CA: 'California Public Records Act (Gov. Code 6250)',
  CO: 'Colorado Open Records Act (C.R.S. 24-72-201)',
  CT: 'Connecticut Freedom of Information Act (Conn. Gen. Stat. 1-200)',
  DE: 'Delaware Freedom of Information Act (29 Del. C. 10001)',
  FL: 'Florida Public Records Law (F.S. 119.01)',
  GA: 'Georgia Open Records Act (O.C.G.A. 50-18-70)',
  HI: 'Hawaii Uniform Information Practices Act (HRS 92F)',
  ID: 'Idaho Public Records Law (Idaho Code 74-101)',
  IL: 'Illinois Freedom of Information Act (5 ILCS 140)',
  IN: 'Indiana Access to Public Records Act (IC 5-14-3)',
  IA: 'Iowa Open Records Law (Iowa Code 22.1)',
  KS: 'Kansas Open Records Act (K.S.A. 45-215)',
  KY: 'Kentucky Open Records Act (KRS 61.870)',
  LA: 'Louisiana Public Records Law (La. R.S. 44:1)',
  ME: 'Maine Freedom of Access Act (1 M.R.S.A. 400)',
  MD: 'Maryland Public Information Act (GP 4-101)',
  MA: 'Massachusetts Public Records Law (M.G.L. c. 66 s 10)',
  MI: 'Michigan Freedom of Information Act (MCL 15.231)',
  MN: 'Minnesota Data Practices Act (Minn. Stat. 13.01)',
  MS: 'Mississippi Public Records Act (Miss. Code 25-61-1)',
  MO: 'Missouri Sunshine Law (RSMo 610.010)',
  MT: 'Montana Constitution Article II Section 9',
  NE: 'Nebraska Public Records Statutes (Neb. Rev. Stat. 84-712)',
  NV: 'Nevada Public Records Law (NRS 239.010)',
  NH: 'New Hampshire Right to Know Law (RSA 91-A)',
  NJ: 'New Jersey Open Public Records Act (N.J.S.A. 47:1A-1)',
  NM: 'New Mexico Inspection of Public Records Act (NMSA 14-2-1)',
  NY: 'New York Freedom of Information Law (Pub. Off. Law 84)',
  NC: 'North Carolina Public Records Law (G.S. 132-1)',
  ND: 'North Dakota Open Records Law (N.D.C.C. 44-04-18)',
  OH: 'Ohio Public Records Act (ORC 149.43)',
  OK: 'Oklahoma Open Records Act (51 O.S. 24A.1)',
  OR: 'Oregon Public Records Law (ORS 192.311)',
  PA: 'Pennsylvania Right-to-Know Law (65 P.S. 67.101)',
  RI: 'Rhode Island Access to Public Records Act (RIGL 38-2-1)',
  SC: 'South Carolina Freedom of Information Act (S.C. Code 30-4-10)',
  SD: 'South Dakota Open Meeting/Records Laws (SDCL 1-27-1)',
  TN: 'Tennessee Public Records Act (T.C.A. 10-7-503)',
  TX: 'Texas Public Information Act (Gov. Code 552.001)',
  UT: 'Utah Government Records Access and Management Act (UCA 63G-2)',
  VT: 'Vermont Public Records Act (1 V.S.A. 315)',
  VA: 'Virginia Freedom of Information Act (Va. Code 2.2-3700)',
  WA: 'Washington Public Records Act (RCW 42.56)',
  WV: 'West Virginia Freedom of Information Act (W. Va. Code 29B-1-1)',
  WI: 'Wisconsin Open Records Law (Wis. Stat. 19.31)',
  WY: 'Wyoming Public Records Act (Wyo. Stat. 16-4-201)',
  DC: 'DC Freedom of Information Act (D.C. Code 2-531)',
};

// =============================================================================
// TOP COUNTY CLERK CONTACTS (Seed Data)
// Start with highest population counties that have significant tax sales
// =============================================================================

const SEED_COUNTY_CONTACTS: Omit<CountyClerkContact, 'id' | 'totalRequests' | 'totalResponses'>[] = [
  // Texas - Large counties with significant surplus
  {
    county: 'Harris',
    state: 'Texas',
    stateAbbr: 'TX',
    email: 'publicrecords@hctx.net',
    website: 'https://www.hctax.net',
    preferredMethod: 'email',
  },
  {
    county: 'Dallas',
    state: 'Texas',
    stateAbbr: 'TX',
    email: 'tax.info@dallascounty.org',
    website: 'https://www.dallascounty.org',
    preferredMethod: 'email',
  },
  {
    county: 'Tarrant',
    state: 'Texas',
    stateAbbr: 'TX',
    email: 'info@tarrantcounty.com',
    website: 'https://www.tarrantcounty.com',
    preferredMethod: 'email',
  },
  {
    county: 'Bexar',
    state: 'Texas',
    stateAbbr: 'TX',
    email: 'tax-assessor@bexar.org',
    website: 'https://www.bexar.org',
    preferredMethod: 'email',
  },
  // Florida - Tax deed states with surplus
  {
    county: 'Miami-Dade',
    state: 'Florida',
    stateAbbr: 'FL',
    email: 'clerkpublicrecords@miamidadeclerk.gov',
    website: 'https://www.miamidadeclerk.gov',
    preferredMethod: 'email',
  },
  {
    county: 'Broward',
    state: 'Florida',
    stateAbbr: 'FL',
    email: 'records@browardclerk.org',
    website: 'https://www.browardclerk.org',
    preferredMethod: 'email',
  },
  {
    county: 'Palm Beach',
    state: 'Florida',
    stateAbbr: 'FL',
    email: 'clerkinfo@mypalmbeachclerk.com',
    website: 'https://www.mypalmbeachclerk.com',
    preferredMethod: 'email',
  },
  {
    county: 'Hillsborough',
    state: 'Florida',
    stateAbbr: 'FL',
    email: 'publicrecords@hillsclerk.com',
    website: 'https://www.hillsclerk.com',
    preferredMethod: 'email',
  },
  {
    county: 'Orange',
    state: 'Florida',
    stateAbbr: 'FL',
    email: 'records@occompt.com',
    website: 'https://www.occompt.com',
    preferredMethod: 'email',
  },
  // Georgia
  {
    county: 'Fulton',
    state: 'Georgia',
    stateAbbr: 'GA',
    email: 'openrecords@fultoncountyga.gov',
    website: 'https://www.fultoncountyga.gov',
    preferredMethod: 'email',
  },
  {
    county: 'Gwinnett',
    state: 'Georgia',
    stateAbbr: 'GA',
    email: 'gwinnettcourts@gwinnettcounty.com',
    website: 'https://www.gwinnettcounty.com',
    preferredMethod: 'email',
  },
  {
    county: 'DeKalb',
    state: 'Georgia',
    stateAbbr: 'GA',
    email: 'taxcommissioner@dekalbcountyga.gov',
    website: 'https://www.dekalbcountyga.gov',
    preferredMethod: 'email',
  },
  // Tennessee
  {
    county: 'Shelby',
    state: 'Tennessee',
    stateAbbr: 'TN',
    email: 'trustee@shelbycountytn.gov',
    website: 'https://www.shelbycountytrustee.com',
    preferredMethod: 'email',
  },
  {
    county: 'Davidson',
    state: 'Tennessee',
    stateAbbr: 'TN',
    email: 'publicrecords@nashville.gov',
    website: 'https://www.nashville.gov',
    preferredMethod: 'email',
  },
  {
    county: 'Knox',
    state: 'Tennessee',
    stateAbbr: 'TN',
    email: 'trustee@knoxcounty.org',
    website: 'https://www.knoxcounty.org',
    preferredMethod: 'email',
  },
  // North Carolina
  {
    county: 'Mecklenburg',
    state: 'North Carolina',
    stateAbbr: 'NC',
    email: 'tax@mecklenburgcountync.gov',
    website: 'https://www.mecknc.gov',
    preferredMethod: 'email',
  },
  {
    county: 'Wake',
    state: 'North Carolina',
    stateAbbr: 'NC',
    email: 'revenue@wakegov.com',
    website: 'https://www.wakegov.com',
    preferredMethod: 'email',
  },
  // California
  {
    county: 'Los Angeles',
    state: 'California',
    stateAbbr: 'CA',
    email: 'ttcinfo@ttc.lacounty.gov',
    website: 'https://ttc.lacounty.gov',
    preferredMethod: 'email',
  },
  {
    county: 'San Diego',
    state: 'California',
    stateAbbr: 'CA',
    email: 'taxinfo@sdcounty.ca.gov',
    website: 'https://www.sdcounty.ca.gov',
    preferredMethod: 'email',
  },
  {
    county: 'Orange',
    state: 'California',
    stateAbbr: 'CA',
    email: 'ttcinfo@ttc.ocgov.com',
    website: 'https://www.ocgov.com',
    preferredMethod: 'email',
  },
  // Arizona
  {
    county: 'Maricopa',
    state: 'Arizona',
    stateAbbr: 'AZ',
    email: 'treasurer@maricopa.gov',
    website: 'https://treasurer.maricopa.gov',
    preferredMethod: 'email',
  },
  {
    county: 'Pima',
    state: 'Arizona',
    stateAbbr: 'AZ',
    email: 'treasurer@pima.gov',
    website: 'https://www.pima.gov',
    preferredMethod: 'email',
  },
  // Nevada
  {
    county: 'Clark',
    state: 'Nevada',
    stateAbbr: 'NV',
    email: 'treasurer@clarkcountynv.gov',
    website: 'https://www.clarkcountynv.gov',
    preferredMethod: 'email',
  },
  // Ohio
  {
    county: 'Cuyahoga',
    state: 'Ohio',
    stateAbbr: 'OH',
    email: 'fiscal@cuyahogacounty.us',
    website: 'https://www.cuyahogacounty.us',
    preferredMethod: 'email',
  },
  {
    county: 'Franklin',
    state: 'Ohio',
    stateAbbr: 'OH',
    email: 'treasurer@franklincountyohio.gov',
    website: 'https://www.franklincountyohio.gov',
    preferredMethod: 'email',
  },
  // Michigan
  {
    county: 'Wayne',
    state: 'Michigan',
    stateAbbr: 'MI',
    email: 'treasurer@waynecounty.com',
    website: 'https://www.waynecounty.com',
    preferredMethod: 'email',
  },
  // Illinois
  {
    county: 'Cook',
    state: 'Illinois',
    stateAbbr: 'IL',
    email: 'publicrecords@cookcountyil.gov',
    website: 'https://www.cookcountyil.gov',
    preferredMethod: 'email',
  },
  // Pennsylvania
  {
    county: 'Philadelphia',
    state: 'Pennsylvania',
    stateAbbr: 'PA',
    email: 'revenue@phila.gov',
    website: 'https://www.phila.gov',
    preferredMethod: 'email',
  },
  {
    county: 'Allegheny',
    state: 'Pennsylvania',
    stateAbbr: 'PA',
    email: 'treasurerinfo@alleghenycounty.us',
    website: 'https://www.alleghenycounty.us',
    preferredMethod: 'email',
  },
  // New York
  {
    county: 'Kings',
    state: 'New York',
    stateAbbr: 'NY',
    email: 'foil@finance.nyc.gov',
    website: 'https://www.nyc.gov/finance',
    preferredMethod: 'email',
  },
];

// =============================================================================
// FOIA REQUEST BOT SERVICE
// =============================================================================

class FOIARequestBot {
  private templates: Map<string, FOIATemplate> = new Map();
  private companyEmail = process.env.FOIA_REPLY_EMAIL || 'records@capitalmgr.com';
  private companyPhone = process.env.COMPANY_PHONE || '(888) 555-0100';
  private companyAddress = process.env.COMPANY_ADDRESS || '123 Business Center, Suite 100';

  constructor() {
    // Load templates
    for (const template of FOIA_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  // ===========================================================================
  // CONTACT MANAGEMENT
  // ===========================================================================

  /**
   * Initialize county clerk contacts from seed data
   */
  async initializeContacts(): Promise<number> {
    let created = 0;

    for (const contact of SEED_COUNTY_CONTACTS) {
      const existing = await (prisma as any).fOIACountyContact?.findFirst({
        where: {
          county: contact.county,
          stateAbbr: contact.stateAbbr,
        },
      }).catch(() => null);

      if (!existing) {
        await (prisma as any).fOIACountyContact?.create({
          data: {
            id: crypto.randomUUID(),
            ...contact,
            totalRequests: 0,
            totalResponses: 0,
          },
        }).catch(() => {
          // Table might not exist yet - log silently
        });
        created++;
      }
    }

    return created;
  }

  /**
   * Get all county contacts
   */
  async getContacts(filters?: {
    state?: string;
    hasEmail?: boolean;
    neverContacted?: boolean;
  }): Promise<CountyClerkContact[]> {
    // If table doesn't exist, return seed data
    try {
      const where: any = {};
      if (filters?.state) where.stateAbbr = filters.state;
      if (filters?.hasEmail) where.email = { not: null };
      if (filters?.neverContacted) where.totalRequests = 0;

      return await (prisma as any).fOIACountyContact?.findMany({ where }) || [];
    } catch {
      // Return seed data if table doesn't exist
      return SEED_COUNTY_CONTACTS.map((c, i) => ({
        ...c,
        id: `seed-${i}`,
        totalRequests: 0,
        totalResponses: 0,
      })) as CountyClerkContact[];
    }
  }

  /**
   * Add a new county contact
   */
  async addContact(contact: Omit<CountyClerkContact, 'id' | 'totalRequests' | 'totalResponses'>): Promise<string> {
    const id = crypto.randomUUID();
    await (prisma as any).fOIACountyContact?.create({
      data: {
        id,
        ...contact,
        totalRequests: 0,
        totalResponses: 0,
      },
    });
    return id;
  }

  // ===========================================================================
  // TEMPLATE MANAGEMENT
  // ===========================================================================

  /**
   * Get all templates
   */
  getTemplates(): FOIATemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): FOIATemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Render template with contact-specific variables
   */
  private renderTemplate(
    template: FOIATemplate,
    contact: CountyClerkContact,
    isFollowUp: boolean = false,
    originalRequestDate?: Date
  ): { subject: string; body: string } {
    const variables: Record<string, string> = {
      '[CLERK_NAME]': contact.clerkName || 'Records Custodian',
      '[COUNTY_NAME]': contact.county,
      '[STATE_NAME]': contact.state,
      '[STATE_FOIA_STATUTE]': STATE_FOIA_STATUTES[contact.stateAbbr] || 'applicable public records law',
      '[REPLY_EMAIL]': this.companyEmail,
      '[COMPANY_PHONE]': this.companyPhone,
      '[COMPANY_ADDRESS]': this.companyAddress,
      '[RESPONSE_DEADLINE]': this.getResponseDeadline(contact.stateAbbr),
      '[REQUEST_DATE]': originalRequestDate?.toLocaleDateString() || new Date().toLocaleDateString(),
    };

    let subject = isFollowUp ? template.followUpSubject : template.subject;
    let body = isFollowUp ? template.followUpBody : template.body;

    for (const [key, value] of Object.entries(variables)) {
      subject = subject.replace(new RegExp(key.replace(/[[\]]/g, '\\$&'), 'g'), value);
      body = body.replace(new RegExp(key.replace(/[[\]]/g, '\\$&'), 'g'), value);
    }

    return { subject, body };
  }

  /**
   * Get FOIA response deadline for a state
   */
  private getResponseDeadline(stateAbbr: string): string {
    const deadlines: Record<string, string> = {
      TX: '10 business',
      FL: '5 business',
      GA: '3 business',
      TN: '7 business',
      NC: '10 business',
      CA: '10',
      NY: '5 business',
      OH: 'reasonable time',
      MI: '5 business',
      IL: '5 business',
      PA: '5 business',
      AZ: '5 business',
      NV: '5 business',
    };
    return deadlines[stateAbbr] || '10';
  }

  // ===========================================================================
  // SEND REQUESTS
  // ===========================================================================

  /**
   * Send FOIA request to a specific county
   */
  async sendRequest(
    contactId: string,
    templateId: string = 'surplus_funds_general'
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      // Get contact
      const contacts = await this.getContacts();
      const contact = contacts.find(c => c.id === contactId);

      if (!contact) {
        return { success: false, error: 'Contact not found' };
      }

      if (!contact.email) {
        return { success: false, error: 'Contact has no email address' };
      }

      // Get template
      const template = this.templates.get(templateId);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      // Render template
      const { subject, body } = this.renderTemplate(template, contact);

      // Send email
      const sent = await emailService.sendRaw(contact.email, subject, body);

      if (!sent) {
        return { success: false, error: 'Failed to send email' };
      }

      // Record the request
      const requestId = crypto.randomUUID();
      await (prisma as any).fOIARequest?.create({
        data: {
          id: requestId,
          countyId: contact.id,
          county: contact.county,
          state: contact.stateAbbr,
          requestType: template.requestType,
          sentAt: new Date(),
          sentVia: 'email',
          status: 'pending',
        },
      }).catch(() => {
        // Table might not exist
      });

      // Update contact stats
      await (prisma as any).fOIACountyContact?.update({
        where: { id: contact.id },
        data: {
          lastRequestSentAt: new Date(),
          totalRequests: { increment: 1 },
        },
      }).catch(() => {});

      return { success: true, requestId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send batch requests to multiple counties
   */
  async sendBatchRequests(
    stateAbbr?: string,
    maxRequests: number = 10,
    templateId: string = 'surplus_funds_general'
  ): Promise<LeadGenerationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let sent = 0;

    try {
      // Get contacts that haven't been contacted recently
      const contacts = await this.getContacts({
        state: stateAbbr,
        hasEmail: true,
      });

      // Filter to contacts not contacted in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const eligibleContacts = contacts.filter(
        c => !c.lastRequestSentAt || c.lastRequestSentAt < thirtyDaysAgo
      );

      // Send requests with delays
      for (const contact of eligibleContacts.slice(0, maxRequests)) {
        const result = await this.sendRequest(contact.id, templateId);

        if (result.success) {
          sent++;
        } else {
          errors.push(`${contact.county}, ${contact.stateAbbr}: ${result.error}`);
        }

        // Delay between sends (2-5 seconds)
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
      }

      return {
        success: errors.length === 0,
        source: 'FOIA_REQUEST_BOT',
        leadsFound: 0, // Leads come when responses are processed
        leadsCreated: 0,
        errors,
        durationMs: Date.now() - startTime,
        nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
      };
    } catch (error: any) {
      return {
        success: false,
        source: 'FOIA_REQUEST_BOT',
        leadsFound: 0,
        leadsCreated: 0,
        errors: [error.message],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Send follow-up requests for pending requests
   */
  async sendFollowUps(daysOld: number = 14): Promise<number> {
    let sentCount = 0;

    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      // Get pending requests older than cutoff that haven't been followed up
      const pendingRequests = await (prisma as any).fOIARequest?.findMany({
        where: {
          status: 'pending',
          sentAt: { lt: cutoffDate },
          followUpSentAt: null,
        },
      }) || [];

      for (const request of pendingRequests) {
        const contacts = await this.getContacts();
        const contact = contacts.find(c => c.id === request.countyId);

        if (!contact || !contact.email) continue;

        const template = this.templates.get('surplus_funds_general')!;
        const { subject, body } = this.renderTemplate(
          template,
          contact,
          true,
          request.sentAt
        );

        const sent = await emailService.sendRaw(contact.email, subject, body);

        if (sent) {
          await (prisma as any).fOIARequest?.update({
            where: { id: request.id },
            data: { followUpSentAt: new Date() },
          }).catch(() => {});
          sentCount++;
        }

        // Delay between sends
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch {
      // Silent fail
    }

    return sentCount;
  }

  // ===========================================================================
  // RESPONSE PROCESSING
  // ===========================================================================

  /**
   * Process an email response (called by email ingestion)
   */
  async processResponse(
    fromEmail: string,
    subject: string,
    body: string,
    attachments: { filename: string; content: Buffer }[]
  ): Promise<LeadGenerationResult> {
    const startTime = Date.now();
    let leadsFound = 0;
    let leadsCreated = 0;
    const errors: string[] = [];

    try {
      // Find matching request by email domain
      const domain = fromEmail.split('@')[1];
      const contacts = await this.getContacts();
      const matchingContact = contacts.find(c =>
        c.email?.includes(domain) ||
        c.website?.includes(domain.replace('mail.', ''))
      );

      if (!matchingContact) {
        return {
          success: false,
          source: 'FOIA_RESPONSE',
          leadsFound: 0,
          leadsCreated: 0,
          errors: ['Could not match response to a county contact'],
          durationMs: Date.now() - startTime,
        };
      }

      // Process attachments
      for (const attachment of attachments) {
        const ext = attachment.filename.toLowerCase().split('.').pop();

        if (['pdf', 'xlsx', 'xls', 'csv'].includes(ext || '')) {
          // Create ingestion batch
          const batchId = await ingestionService.createBatch(
            `foia-${matchingContact.county}-${matchingContact.stateAbbr}`,
            attachment.filename,
            undefined
          );

          // Process based on file type
          let result;
          if (ext === 'csv') {
            result = await ingestionService.processIngestionBatch(
              batchId,
              attachment.content.toString(),
              'CSV'
            );
          } else if (ext === 'pdf') {
            result = await ingestionService.processIngestionBatch(
              batchId,
              attachment.content.toString(),
              'PDF'
            );
          }

          if (result) {
            leadsFound += result.processed;
            leadsCreated += result.created;
            errors.push(...result.errors);
          }
        }
      }

      // Update request status
      const pendingRequests = await (prisma as any).fOIARequest?.findMany({
        where: {
          countyId: matchingContact.id,
          status: 'pending',
        },
        orderBy: { sentAt: 'desc' },
        take: 1,
      }) || [];

      if (pendingRequests.length > 0) {
        await (prisma as any).fOIARequest?.update({
          where: { id: pendingRequests[0].id },
          data: {
            status: 'responded',
            respondedAt: new Date(),
            responseType: attachments.length > 0 ? 'pdf' : 'denied',
            recordsExtracted: leadsFound,
          },
        }).catch(() => {});
      }

      // Update contact stats
      await (prisma as any).fOIACountyContact?.update({
        where: { id: matchingContact.id },
        data: {
          lastResponseAt: new Date(),
          totalResponses: { increment: 1 },
        },
      }).catch(() => {});

      return {
        success: true,
        source: 'FOIA_RESPONSE',
        leadsFound,
        leadsCreated,
        errors,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        source: 'FOIA_RESPONSE',
        leadsFound,
        leadsCreated,
        errors: [...errors, error.message],
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get FOIA bot statistics
   */
  async getStats(): Promise<{
    totalContacts: number;
    contactsByState: Record<string, number>;
    totalRequests: number;
    pendingRequests: number;
    responseRate: number;
    avgResponseDays: number;
    leadsGenerated: number;
  }> {
    const contacts = await this.getContacts();

    const contactsByState: Record<string, number> = {};
    for (const contact of contacts) {
      contactsByState[contact.stateAbbr] = (contactsByState[contact.stateAbbr] || 0) + 1;
    }

    let totalRequests = 0;
    let totalResponses = 0;

    for (const contact of contacts) {
      totalRequests += contact.totalRequests;
      totalResponses += contact.totalResponses;
    }

    return {
      totalContacts: contacts.length,
      contactsByState,
      totalRequests,
      pendingRequests: totalRequests - totalResponses,
      responseRate: totalRequests > 0 ? (totalResponses / totalRequests) * 100 : 0,
      avgResponseDays: 14, // Placeholder - would calculate from actual data
      leadsGenerated: 0, // Would query from ingestion records
    };
  }
}

export const foiaRequestBot = new FOIARequestBot();
export { FOIARequestBot };
