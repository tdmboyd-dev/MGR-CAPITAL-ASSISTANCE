/**
 * CountySurplusRequirementsService.ts — MGR CAPITAL ASSISTANCE
 *
 * County-by-county surplus claim requirements database.
 * Tracks what each county needs for surplus recovery claims:
 * - Forms required
 * - Notarization requirements
 * - Deadlines
 * - POA requirements
 * - Filing methods
 *
 * This is CRITICAL for surplus recovery - every county is different.
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export interface CountyRequirements {
  state: string;
  county: string;

  // Notarization requirements
  notarizationRequired: boolean;
  notarizationDetails: string[];

  // Forms required
  formsRequired: {
    name: string;
    description: string;
    notarized: boolean;
    templateUrl?: string;
  }[];

  // POA requirements
  poaRequired: boolean;
  poaDetails: string;

  // Heirship requirements (if owner deceased)
  heirshipAffidavitRequired: boolean;
  heirshipDetails: string;

  // Filing method
  filingMethod: 'mail' | 'online' | 'in_person' | 'email' | 'multiple';
  filingAddress?: string;
  filingEmail?: string;
  filingPortalUrl?: string;

  // Deadlines
  deadlineType: 'from_sale' | 'specific_date' | 'no_deadline' | 'varies';
  deadlineDays?: number; // Days from sale date
  deadlineNotes?: string;

  // Minimum claim amount
  minimumClaimAmount?: number;
  smallClaimThreshold?: number; // Amount below which notarization may be waived

  // Contact info
  clerkOfficePhone?: string;
  clerkOfficeEmail?: string;
  clerkOfficeAddress?: string;

  // Additional requirements
  additionalRequirements: string[];

  // Notes
  notes: string;

  // Last verified
  lastVerified?: Date;
  verifiedBy?: string;
}

// =============================================================================
// TENNESSEE COUNTY DATA
// =============================================================================

const TENNESSEE_COUNTIES: Record<string, CountyRequirements> = {
  'SHELBY': {
    state: 'TN',
    county: 'SHELBY',
    notarizationRequired: true,
    notarizationDetails: [
      'Claim for Excess Proceeds form must be notarized',
      'POA must be notarized if agent is filing',
      'Affidavit of Heirship must be notarized (if deceased owner)',
    ],
    formsRequired: [
      {
        name: 'Claim for Excess Proceeds',
        description: 'Official county form for claiming surplus funds',
        notarized: true,
      },
      {
        name: 'W-9',
        description: 'IRS tax form for payment processing',
        notarized: false,
      },
    ],
    poaRequired: true,
    poaDetails: 'Notarized Power of Attorney required if agent files on behalf of owner. Must specifically authorize agent to claim surplus funds.',
    heirshipAffidavitRequired: true,
    heirshipDetails: 'If owner is deceased, notarized Affidavit of Heirship required along with death certificate and proof of relationship.',
    filingMethod: 'mail',
    filingAddress: 'Shelby County Trustee, 160 N Main St, Memphis, TN 38103',
    deadlineType: 'from_sale',
    deadlineDays: 365, // 1 year from sale
    deadlineNotes: 'Must file within 1 year of tax sale date. After that, funds may escheat to the state.',
    clerkOfficePhone: '(901) 222-0200',
    additionalRequirements: [
      'Copy of government-issued photo ID',
      'Proof of current address (utility bill, bank statement)',
      'Copy of deed or proof of ownership at time of sale',
    ],
    notes: 'Shelby County is strict about notarization. RON is accepted. Processing time is typically 30-60 days after complete submission.',
    lastVerified: new Date('2024-12-01'),
  },

  'DAVIDSON': {
    state: 'TN',
    county: 'DAVIDSON',
    notarizationRequired: true,
    notarizationDetails: [
      'Surplus funds claim form must be notarized',
      'POA must be notarized',
      'All affidavits must be notarized',
    ],
    formsRequired: [
      {
        name: 'Claim for Surplus Funds',
        description: 'Davidson County surplus claim form',
        notarized: true,
      },
      {
        name: 'W-9',
        description: 'Required for payment over $600',
        notarized: false,
      },
    ],
    poaRequired: true,
    poaDetails: 'Notarized POA required. Must be specific to surplus recovery.',
    heirshipAffidavitRequired: true,
    heirshipDetails: 'Affidavit of Heirship with supporting documentation required for deceased owners.',
    filingMethod: 'multiple',
    filingAddress: 'Metro Nashville Trustee, 700 2nd Ave S, Nashville, TN 37210',
    filingEmail: 'trustee@nashville.gov',
    deadlineType: 'from_sale',
    deadlineDays: 365,
    clerkOfficePhone: '(615) 862-6330',
    additionalRequirements: [
      'Photo ID',
      'Proof of address',
      'Proof of ownership',
    ],
    notes: 'Nashville/Davidson accepts email submissions but originals may be required. RON accepted.',
    lastVerified: new Date('2024-11-15'),
  },

  'KNOX': {
    state: 'TN',
    county: 'KNOX',
    notarizationRequired: true,
    notarizationDetails: [
      'Claim form must be notarized',
      'POA must be notarized if using agent',
    ],
    formsRequired: [
      {
        name: 'Excess Proceeds Claim Form',
        description: 'Knox County official form',
        notarized: true,
      },
    ],
    poaRequired: true,
    poaDetails: 'Notarized POA required for agent representation.',
    heirshipAffidavitRequired: true,
    heirshipDetails: 'Heirship affidavit required with death certificate.',
    filingMethod: 'mail',
    filingAddress: 'Knox County Trustee, 400 Main St, Knoxville, TN 37902',
    deadlineType: 'from_sale',
    deadlineDays: 365,
    clerkOfficePhone: '(865) 215-2305',
    additionalRequirements: [
      'Photo ID',
      'Proof of ownership',
    ],
    notes: 'Knox County is straightforward. RON accepted.',
    lastVerified: new Date('2024-10-01'),
  },

  'HAMILTON': {
    state: 'TN',
    county: 'HAMILTON',
    notarizationRequired: true,
    notarizationDetails: [
      'All claim documents must be notarized',
      'POA must be notarized',
    ],
    formsRequired: [
      {
        name: 'Surplus Funds Claim',
        description: 'Hamilton County form',
        notarized: true,
      },
      {
        name: 'W-9',
        description: 'Tax form',
        notarized: false,
      },
    ],
    poaRequired: true,
    poaDetails: 'Notarized POA required.',
    heirshipAffidavitRequired: true,
    heirshipDetails: 'Notarized affidavit required for deceased owners.',
    filingMethod: 'mail',
    filingAddress: 'Hamilton County Trustee, 625 Georgia Ave, Chattanooga, TN 37402',
    deadlineType: 'from_sale',
    deadlineDays: 365,
    clerkOfficePhone: '(423) 209-6100',
    additionalRequirements: [
      'Photo ID',
      'Address verification',
      'Ownership documentation',
    ],
    notes: 'Chattanooga area. RON accepted.',
    lastVerified: new Date('2024-09-15'),
  },
};

// =============================================================================
// OTHER MAJOR STATES (Florida, Texas, Georgia, California)
// =============================================================================

const FLORIDA_COUNTIES: Record<string, Partial<CountyRequirements>> = {
  'MIAMI-DADE': {
    state: 'FL',
    county: 'MIAMI-DADE',
    notarizationRequired: true,
    poaRequired: true,
    deadlineType: 'from_sale',
    deadlineDays: 120, // 120 days in FL
    notes: 'Florida has 120-day deadline from sale. Very strict.',
  },
  'BROWARD': {
    state: 'FL',
    county: 'BROWARD',
    notarizationRequired: true,
    poaRequired: true,
    deadlineType: 'from_sale',
    deadlineDays: 120,
    notes: 'Fort Lauderdale area. Standard FL requirements.',
  },
  'HILLSBOROUGH': {
    state: 'FL',
    county: 'HILLSBOROUGH',
    notarizationRequired: true,
    poaRequired: true,
    deadlineType: 'from_sale',
    deadlineDays: 120,
    notes: 'Tampa area. Standard FL requirements.',
  },
};

const TEXAS_COUNTIES: Record<string, Partial<CountyRequirements>> = {
  'HARRIS': {
    state: 'TX',
    county: 'HARRIS',
    notarizationRequired: true,
    poaRequired: true,
    deadlineType: 'from_sale',
    deadlineDays: 730, // 2 years in TX
    notes: 'Houston area. Texas has 2-year deadline.',
  },
  'DALLAS': {
    state: 'TX',
    county: 'DALLAS',
    notarizationRequired: true,
    poaRequired: true,
    deadlineType: 'from_sale',
    deadlineDays: 730,
    notes: 'Standard TX requirements.',
  },
  'TARRANT': {
    state: 'TX',
    county: 'TARRANT',
    notarizationRequired: true,
    poaRequired: true,
    deadlineType: 'from_sale',
    deadlineDays: 730,
    notes: 'Fort Worth area. Standard TX requirements.',
  },
};

const GEORGIA_COUNTIES: Record<string, Partial<CountyRequirements>> = {
  'FULTON': {
    state: 'GA',
    county: 'FULTON',
    notarizationRequired: true,
    poaRequired: true,
    deadlineType: 'from_sale',
    deadlineDays: 365,
    notes: 'Atlanta area. Georgia has 1-year deadline.',
  },
  'DEKALB': {
    state: 'GA',
    county: 'DEKALB',
    notarizationRequired: true,
    poaRequired: true,
    deadlineType: 'from_sale',
    deadlineDays: 365,
    notes: 'Metro Atlanta. Standard GA requirements.',
  },
  'GWINNETT': {
    state: 'GA',
    county: 'GWINNETT',
    notarizationRequired: true,
    poaRequired: true,
    deadlineType: 'from_sale',
    deadlineDays: 365,
    notes: 'North Atlanta suburbs. Standard GA requirements.',
  },
};

// =============================================================================
// SERVICE CLASS
// =============================================================================

class CountySurplusRequirementsService {
  /**
   * Get requirements for a specific county
   */
  getRequirements(state: string, county: string): CountyRequirements | null {
    const stateUpper = state.toUpperCase();
    const countyUpper = county.toUpperCase().replace(' COUNTY', '').replace(' ', '_');

    // Check Tennessee first (most detailed)
    if (stateUpper === 'TN' || stateUpper === 'TENNESSEE') {
      return TENNESSEE_COUNTIES[countyUpper] || this.getDefaultRequirements('TN', countyUpper);
    }

    // Check other states
    if (stateUpper === 'FL' || stateUpper === 'FLORIDA') {
      const partial = FLORIDA_COUNTIES[countyUpper];
      if (partial) {
        return this.mergeWithDefaults('FL', countyUpper, partial);
      }
      return this.getDefaultRequirements('FL', countyUpper);
    }

    if (stateUpper === 'TX' || stateUpper === 'TEXAS') {
      const partial = TEXAS_COUNTIES[countyUpper];
      if (partial) {
        return this.mergeWithDefaults('TX', countyUpper, partial);
      }
      return this.getDefaultRequirements('TX', countyUpper);
    }

    if (stateUpper === 'GA' || stateUpper === 'GEORGIA') {
      const partial = GEORGIA_COUNTIES[countyUpper];
      if (partial) {
        return this.mergeWithDefaults('GA', countyUpper, partial);
      }
      return this.getDefaultRequirements('GA', countyUpper);
    }

    // Default for unknown states
    return this.getDefaultRequirements(stateUpper, countyUpper);
  }

  /**
   * Get all Tennessee counties
   */
  getTennesseeCounties(): CountyRequirements[] {
    return Object.values(TENNESSEE_COUNTIES);
  }

  /**
   * Get state-level deadline info
   */
  getStateDeadlines(): Record<string, { days: number; notes: string }> {
    return {
      'TN': { days: 365, notes: '1 year from tax sale date' },
      'FL': { days: 120, notes: '120 days - very short!' },
      'TX': { days: 730, notes: '2 years from sale' },
      'GA': { days: 365, notes: '1 year from sale' },
      'CA': { days: 365, notes: '1 year, varies by county' },
      'NY': { days: 365, notes: '1 year typical' },
      'OH': { days: 365, notes: '1 year' },
      'MI': { days: 365, notes: '1 year' },
      'NC': { days: 365, notes: '1 year' },
      'SC': { days: 365, notes: '1 year' },
    };
  }

  /**
   * Check if a claim is approaching deadline
   */
  checkDeadline(state: string, saleDateStr: string): {
    daysRemaining: number;
    isUrgent: boolean;
    isExpired: boolean;
    deadlineDate: Date;
  } {
    const deadlines = this.getStateDeadlines();
    const stateDeadline = deadlines[state.toUpperCase()] || { days: 365 };

    const saleDate = new Date(saleDateStr);
    const deadlineDate = new Date(saleDate);
    deadlineDate.setDate(deadlineDate.getDate() + stateDeadline.days);

    const now = new Date();
    const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      daysRemaining,
      isUrgent: daysRemaining <= 30 && daysRemaining > 0,
      isExpired: daysRemaining <= 0,
      deadlineDate,
    };
  }

  /**
   * Get documents needed for a case
   */
  getRequiredDocuments(state: string, county: string, isDeceased: boolean, hasAgent: boolean): string[] {
    const requirements = this.getRequirements(state, county);
    const docs: string[] = [];

    // Always needed
    docs.push('Government-issued photo ID');
    docs.push('Proof of current address');
    docs.push('Proof of property ownership at time of sale');

    // Forms
    if (requirements) {
      for (const form of requirements.formsRequired) {
        docs.push(`${form.name}${form.notarized ? ' (NOTARIZED)' : ''}`);
      }
    }

    // POA if agent
    if (hasAgent) {
      docs.push('Power of Attorney (NOTARIZED)');
      docs.push('Agent photo ID');
    }

    // Heirship docs if deceased
    if (isDeceased) {
      docs.push('Death Certificate');
      docs.push('Affidavit of Heirship (NOTARIZED)');
      docs.push('Proof of relationship (birth certificate, marriage certificate, etc.)');
    }

    // W-9 usually required
    docs.push('W-9 Tax Form');

    return docs;
  }

  /**
   * Generate claim packet checklist
   */
  generateClaimChecklist(state: string, county: string, caseDetails: {
    isDeceased: boolean;
    hasAgent: boolean;
    claimAmount: number;
    saleDate: string;
  }): {
    documents: { name: string; required: boolean; notarized: boolean; status: 'pending' }[];
    deadline: { date: Date; daysRemaining: number; isUrgent: boolean };
    filingMethod: string;
    estimatedProcessingDays: number;
    notes: string[];
  } {
    const requirements = this.getRequirements(state, county);
    const deadline = this.checkDeadline(state, caseDetails.saleDate);
    const docs = this.getRequiredDocuments(state, county, caseDetails.isDeceased, caseDetails.hasAgent);

    return {
      documents: docs.map(name => ({
        name,
        required: true,
        notarized: name.includes('NOTARIZED'),
        status: 'pending' as const,
      })),
      deadline: {
        date: deadline.deadlineDate,
        daysRemaining: deadline.daysRemaining,
        isUrgent: deadline.isUrgent,
      },
      filingMethod: requirements?.filingMethod || 'mail',
      estimatedProcessingDays: 45,
      notes: [
        requirements?.notes || 'Verify requirements with county clerk',
        deadline.isUrgent ? '⚠️ URGENT: Less than 30 days until deadline!' : '',
        deadline.isExpired ? '❌ DEADLINE EXPIRED - May need court petition' : '',
      ].filter(Boolean),
    };
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private getDefaultRequirements(state: string, county: string): CountyRequirements {
    const deadlines = this.getStateDeadlines();
    const stateDeadline = deadlines[state] || { days: 365, notes: '1 year typical' };

    return {
      state,
      county,
      notarizationRequired: true,
      notarizationDetails: [
        'Claim form likely requires notarization',
        'POA requires notarization if using agent',
        'Verify specific requirements with county clerk',
      ],
      formsRequired: [
        {
          name: 'Surplus/Excess Funds Claim Form',
          description: 'Contact county clerk for official form',
          notarized: true,
        },
      ],
      poaRequired: true,
      poaDetails: 'Notarized POA typically required for agent representation',
      heirshipAffidavitRequired: true,
      heirshipDetails: 'Notarized affidavit required if owner is deceased',
      filingMethod: 'mail',
      deadlineType: 'from_sale',
      deadlineDays: stateDeadline.days,
      deadlineNotes: stateDeadline.notes,
      additionalRequirements: [
        'Photo ID',
        'Proof of address',
        'Proof of ownership',
      ],
      notes: `Default requirements for ${county} County, ${state}. Contact county clerk to verify specific requirements.`,
    };
  }

  private mergeWithDefaults(state: string, county: string, partial: Partial<CountyRequirements>): CountyRequirements {
    const defaults = this.getDefaultRequirements(state, county);
    return { ...defaults, ...partial } as CountyRequirements;
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const countySurplusRequirementsService = new CountySurplusRequirementsService();
export default countySurplusRequirementsService;
