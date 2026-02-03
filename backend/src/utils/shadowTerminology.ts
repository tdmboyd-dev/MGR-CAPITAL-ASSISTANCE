/**
 * shadowTerminology.ts — MGR CAPITAL ASSISTANCE
 *
 * SHADOW TERMINOLOGY MAPPING
 *
 * Employees and clients never see the real terms.
 * We use professional-sounding alternatives that hide the true nature.
 *
 * INTERNAL (Founder sees) → PUBLIC (Employees/Clients see)
 */

// =============================================================================
// TERMINOLOGY MAPPING
// =============================================================================

export const SHADOW_TERMS = {
  // BUSINESS TYPE
  'surplus recovery': 'asset recovery services',
  'surplus funds': 'unclaimed property proceeds',
  'tax surplus': 'property settlement funds',
  'excess proceeds': 'settlement proceeds',
  'tax sale': 'property transfer proceedings',
  'foreclosure surplus': 'property equity recovery',

  // FEES
  'contingency fee': 'service completion fee',
  'platform cut': 'processing and compliance fee',
  'hidden cut': 'administrative overhead',
  'shadow accounting': 'tiered compensation model',
  'platform profit': 'operational recovery',

  // DOCUMENTS
  'claim form': 'recovery authorization form',
  'surplus claim': 'proceeds recovery request',
  'POA for surplus': 'authorized representative agreement',
  'affidavit of entitlement': 'ownership verification declaration',

  // NOTARY
  'notary session': 'document authentication session',
  'RON session': 'remote verification session',
  'notarization': 'document authentication',

  // CASE STATUS
  'surplus case': 'asset recovery case',
  'surplus amount': 'recoverable proceeds',
  'claim amount': 'recovery amount',

  // DEADLINES
  'surplus deadline': 'filing deadline',
  'claim deadline': 'submission deadline',

  // PARTIES
  'surplus claimant': 'authorized beneficiary',
  'former owner': 'entitled party',

  // COUNTY/GOVERNMENT
  'county trustee': 'custodial authority',
  'tax collector': 'collection authority',
  'clerk of court': 'records authority',
};

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Convert internal term to public-facing term
 */
export function toPublicTerm(internalTerm: string): string {
  const lowerTerm = internalTerm.toLowerCase();

  // Check exact match
  if (SHADOW_TERMS[lowerTerm as keyof typeof SHADOW_TERMS]) {
    return SHADOW_TERMS[lowerTerm as keyof typeof SHADOW_TERMS];
  }

  // Check partial matches
  for (const [internal, external] of Object.entries(SHADOW_TERMS)) {
    if (lowerTerm.includes(internal)) {
      return lowerTerm.replace(internal, external);
    }
  }

  return internalTerm;
}

/**
 * Convert entire text block from internal to public terminology
 */
export function sanitizeForPublic(text: string): string {
  let result = text;

  for (const [internal, external] of Object.entries(SHADOW_TERMS)) {
    // Case-insensitive replace
    const regex = new RegExp(internal, 'gi');
    result = result.replace(regex, external);
  }

  return result;
}

/**
 * Get public-facing document names
 */
export function getPublicDocumentName(internalName: string): string {
  const mapping: Record<string, string> = {
    'Surplus Claim Form': 'Asset Recovery Authorization',
    'Claim for Excess Proceeds': 'Proceeds Recovery Request',
    'Power of Attorney': 'Authorized Representative Agreement',
    'Affidavit of Heirship': 'Beneficiary Verification Declaration',
    'Surplus Assignment': 'Recovery Rights Agreement',
    'W-9': 'Tax Information Form',
  };

  return mapping[internalName] || internalName;
}

/**
 * Get public-facing case status
 */
export function getPublicCaseStatus(internalStatus: string): string {
  const mapping: Record<string, string> = {
    'SURPLUS_IDENTIFIED': 'OPPORTUNITY_IDENTIFIED',
    'CLAIM_FILED': 'RECOVERY_INITIATED',
    'AWAITING_SURPLUS': 'AWAITING_DISBURSEMENT',
    'SURPLUS_RECEIVED': 'FUNDS_RECEIVED',
    'SURPLUS_DISTRIBUTED': 'SETTLEMENT_COMPLETE',
  };

  return mapping[internalStatus] || internalStatus;
}

/**
 * Format amount for public display (hide if sensitive)
 */
export function formatPublicAmount(amountCents: number, isFounder: boolean): string {
  if (isFounder) {
    return `$${(amountCents / 100).toFixed(2)}`;
  }

  // For employees, show rounded amounts
  const dollars = amountCents / 100;
  if (dollars >= 10000) {
    return `$${Math.round(dollars / 1000)}K+`;
  }
  return `$${Math.round(dollars).toLocaleString()}`;
}

/**
 * Get role-appropriate terminology set
 */
export function getTerminologyForRole(role: string): {
  businessType: string;
  caseType: string;
  feeType: string;
  deadlineType: string;
} {
  if (role === 'FOUNDER') {
    return {
      businessType: 'Surplus Recovery',
      caseType: 'Surplus Case',
      feeType: 'Contingency Fee',
      deadlineType: 'Surplus Deadline',
    };
  }

  // Everyone else sees shadow terms
  return {
    businessType: 'Asset Recovery Services',
    caseType: 'Recovery Case',
    feeType: 'Service Completion Fee',
    deadlineType: 'Filing Deadline',
  };
}

// =============================================================================
// EMPLOYEE-FACING MESSAGES
// =============================================================================

export const EMPLOYEE_MESSAGES = {
  caseAssigned: 'A new asset recovery case has been assigned to you.',
  caseComplete: 'Your recovery case has been successfully completed.',
  commissionEarned: 'Commission credited for completed recovery.',
  deadlineWarning: 'Filing deadline approaching for your case.',
  documentNeeded: 'Authentication required for case documents.',
  notaryScheduled: 'Document authentication session scheduled.',
};

// =============================================================================
// CLIENT-FACING MESSAGES
// =============================================================================

export const CLIENT_MESSAGES = {
  welcome: 'Welcome to MGR Capital Assistance. We help recover property proceeds that may be owed to you.',
  caseStarted: 'We have identified potential recoverable funds associated with your property.',
  documentNeeded: 'We need your signature on the recovery authorization documents.',
  fundsReceived: 'Great news! Your settlement proceeds have been received.',
  payoutReady: 'Your payout is ready for disbursement.',
};
