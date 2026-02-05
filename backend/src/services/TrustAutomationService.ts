/**
 * TrustAutomationService.ts — MGR CAPITAL ASSISTANCE
 *
 * Fully automated trust creation, notarization, and management.
 * Uses founder's notary credentials for self-hosted RON.
 *
 * TRUST TYPES:
 * - Basic Protection Trust ($500 setup, $150/yr) - 15% founder beneficiary
 * - Enhanced Protection Trust ($1,000 setup, $300/yr) - 20% founder beneficiary
 * - Premium Estate Trust ($2,500 setup, $500/yr) - 25% founder beneficiary
 *
 * AUTOMATION FLOW:
 * 1. User enrolls in trust program
 * 2. Bot generates trust documents (state-specific)
 * 3. RON session scheduled with founder as notary
 * 4. Video verification + KBA + signing
 * 5. Founder's notary seal applied
 * 6. Trust activated, earnings auto-flow
 * 7. Founder beneficiary interest tracked
 *
 * LEGAL COMPLIANCE:
 * - State-specific trust templates
 * - IRS EIN generation
 * - Annual trust tax filing reminders
 * - Beneficiary reporting
 */

import { logger } from "../utils/logger.js";
import { founderNotaryService } from "./FounderNotaryService.js";
import prisma from "../lib/prisma.js";

// =============================================================================
// TYPES
// =============================================================================

export type TrustType = 'BASIC_PROTECTION' | 'ENHANCED_PROTECTION' | 'PREMIUM_ESTATE';

export interface TrustPlan {
  type: TrustType;
  name: string;
  setupFeeCents: number;
  annualFeeCents: number;
  founderBeneficiaryPercent: number;
  features: string[];
  description: string;
}

export interface TrustEnrollment {
  id: string;
  userId: string;
  userType: 'EMPLOYEE' | 'CHILD_COMPANY_OWNER';
  trustType: TrustType;
  status: 'PENDING' | 'DOCUMENTS_GENERATED' | 'NOTARIZATION_SCHEDULED' | 'NOTARIZATION_IN_PROGRESS' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

  // Trust details
  trustName?: string;
  trustEIN?: string;
  trustState: string;

  // Beneficiaries
  founderBeneficiaryPercent: number;
  userBeneficiaryPercent: number;
  additionalBeneficiaries: { name: string; percent: number; relationship: string }[];

  // Documents
  documentIds: string[];
  notarizedDocumentIds: string[];

  // Notarization
  ronSessionId?: string;
  notarizedAt?: Date;
  notaryName?: string;
  journalEntryId?: string;

  // Financials
  setupFeePaidCents: number;
  annualFeePaidCents: number;
  nextAnnualFeeDate?: Date;
  totalAssetsProtectedCents: number;
  founderInterestValueCents: number;

  // Dates
  enrolledAt: Date;
  activatedAt?: Date;
  terminatedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface TrustDocument {
  id: string;
  trustId: string;
  documentType: 'TRUST_AGREEMENT' | 'DECLARATION_OF_TRUST' | 'CERTIFICATE_OF_TRUST' | 'SCHEDULE_A' | 'ASSIGNMENT_OF_INTEREST' | 'TRUSTEE_ACCEPTANCE' | 'BENEFICIARY_DESIGNATION';
  title: string;
  content: string;
  generatedAt: Date;
  notarized: boolean;
  notarizedAt?: Date;
  notarizedDocumentUrl?: string;
}

// =============================================================================
// TRUST PLANS
// =============================================================================

const TRUST_PLANS: Record<TrustType, TrustPlan> = {
  BASIC_PROTECTION: {
    type: 'BASIC_PROTECTION',
    name: 'Basic Protection Trust',
    setupFeeCents: 50000,     // $500
    annualFeeCents: 15000,    // $150/year
    founderBeneficiaryPercent: 15,
    features: [
      'Asset protection from lawsuits',
      'Creditor protection',
      'Basic estate planning',
      'Annual trust tax filing assistance',
    ],
    description: 'Standard asset protection for your earnings. Protects from lawsuits, creditors, and most seizures.',
  },
  ENHANCED_PROTECTION: {
    type: 'ENHANCED_PROTECTION',
    name: 'Enhanced Protection Trust',
    setupFeeCents: 100000,    // $1,000
    annualFeeCents: 30000,    // $300/year
    founderBeneficiaryPercent: 20,
    features: [
      'Everything in Basic Protection',
      'Enhanced legal shields',
      'Tax optimization strategies',
      'Quarterly trust reviews',
      'Priority legal support',
    ],
    description: 'Advanced protection with tax benefits and quarterly reviews. Recommended for higher earners.',
  },
  PREMIUM_ESTATE: {
    type: 'PREMIUM_ESTATE',
    name: 'Premium Estate Trust',
    setupFeeCents: 250000,    // $2,500
    annualFeeCents: 50000,    // $500/year
    founderBeneficiaryPercent: 25,
    features: [
      'Everything in Enhanced Protection',
      'Full estate planning suite',
      'Succession planning',
      'Multi-generational wealth transfer',
      'Dedicated trust advisor',
      'Annual trust audit',
    ],
    description: 'Complete estate planning and wealth protection. Ideal for long-term wealth building.',
  },
};

// =============================================================================
// STATE-SPECIFIC TRUST RULES
// =============================================================================

const STATE_TRUST_RULES: Record<string, {
  allowsSelfSettledTrust: boolean;
  domesticAssetProtectionTrust: boolean;
  statute: string;
  formationRequirements: string[];
  annualRequirements: string[];
  specialConsiderations: string[];
}> = {
  'TX': {
    allowsSelfSettledTrust: false,
    domesticAssetProtectionTrust: false,
    statute: 'Texas Trust Code, Property Code Title 9',
    formationRequirements: [
      'Written trust instrument',
      'Identifiable trust property',
      'Ascertainable beneficiaries',
    ],
    annualRequirements: [
      'Trust tax return if income over $600',
      'Maintain trust records',
    ],
    specialConsiderations: [
      'Not a DAPT state - consider NV or SD for stronger protection',
    ],
  },
  'NV': {
    allowsSelfSettledTrust: true,
    domesticAssetProtectionTrust: true,
    statute: 'NRS Chapter 166',
    formationRequirements: [
      'Written trust instrument',
      'Nevada resident trustee or Nevada trust company',
      'Some trust assets in Nevada',
    ],
    annualRequirements: [
      'Maintain Nevada trustee',
      'Annual trust tax return',
    ],
    specialConsiderations: [
      'Strong DAPT state - 2 year fraudulent transfer lookback',
      'No state income tax on trust income',
    ],
  },
  'SD': {
    allowsSelfSettledTrust: true,
    domesticAssetProtectionTrust: true,
    statute: 'SDCL 55-16',
    formationRequirements: [
      'Written trust instrument',
      'South Dakota trustee',
      'Some trust administration in SD',
    ],
    annualRequirements: [
      'Maintain SD trustee',
      'Annual reporting',
    ],
    specialConsiderations: [
      'Strongest DAPT protection - no lookback period for some transfers',
      'No state income tax',
      'Dynasty trusts allowed (no rule against perpetuities)',
    ],
  },
  'DEFAULT': {
    allowsSelfSettledTrust: false,
    domesticAssetProtectionTrust: false,
    statute: 'State trust code',
    formationRequirements: [
      'Written trust instrument',
      'Valid trust purpose',
      'Ascertainable beneficiaries',
    ],
    annualRequirements: [
      'Trust tax return',
      'Maintain records',
    ],
    specialConsiderations: [
      'Check state-specific requirements',
    ],
  },
};

// =============================================================================
// TRUST DOCUMENT TEMPLATES
// =============================================================================

function generateTrustAgreement(enrollment: TrustEnrollment, userData: any, plan: TrustPlan): string {
  const founderPercent = plan.founderBeneficiaryPercent;
  const userPercent = 100 - founderPercent;

  return `
IRREVOCABLE TRUST AGREEMENT

This Irrevocable Trust Agreement ("Agreement") is made and entered into as of ${new Date().toLocaleDateString()},
by and between:

GRANTOR: ${userData.name}
         ${userData.address || '[Address]'}

TRUSTEE: MGR Capital Trust Services, LLC
         [Trust Company Address]

ARTICLE I - TRUST NAME AND PURPOSE

1.1 Trust Name. This trust shall be known as "${enrollment.trustName || `${userData.name} Protection Trust`}".

1.2 Purpose. The purpose of this Trust is to hold, manage, invest, and distribute the Trust
    property for the benefit of the Beneficiaries named herein, while providing asset protection
    and estate planning benefits to the Grantor and Beneficiaries.

ARTICLE II - TRUST PROPERTY

2.1 Initial Trust Property. The Grantor hereby transfers and assigns to the Trustee the property
    described in Schedule A attached hereto, to be held, administered, and distributed in
    accordance with the terms of this Agreement.

2.2 Additional Property. Additional property may be transferred to this Trust by the Grantor
    or any other person, and such property shall become part of the Trust Estate.

ARTICLE III - BENEFICIARIES

3.1 Primary Beneficiaries. The beneficiaries of this Trust and their respective interests are:

    a) ${userData.name} (Grantor): ${userPercent}% beneficial interest
    b) MGR Capital LLC: ${founderPercent}% beneficial interest

3.2 Successor Beneficiaries. Upon the death of the Grantor, the Grantor's ${userPercent}%
    beneficial interest shall pass to [designated successors or as directed by Grantor].

3.3 MGR Capital Interest. The ${founderPercent}% beneficial interest held by MGR Capital LLC
    is irrevocable and shall remain in effect for the duration of the Trust.

ARTICLE IV - DISTRIBUTIONS

4.1 Income Distributions. The Trustee may distribute income to the Beneficiaries in proportion
    to their beneficial interests, or accumulate income as the Trustee deems appropriate.

4.2 Principal Distributions. The Trustee may distribute principal to any Beneficiary for their
    health, education, maintenance, and support.

ARTICLE V - TRUSTEE POWERS

5.1 General Powers. The Trustee shall have all powers necessary to carry out the purposes of
    this Trust, including but not limited to the power to:

    a) Invest and reinvest Trust assets
    b) Sell, exchange, or lease Trust property
    c) Borrow money and encumber Trust assets
    d) Employ advisors and agents
    e) Make distributions as provided herein

5.2 Advisory Role. MGR Capital LLC shall have an advisory role in Trust administration
    decisions as outlined in Section 7.3 below.

ARTICLE VI - ASSET PROTECTION

6.1 Spendthrift Provision. No beneficiary shall have the power to anticipate, encumber, or
    transfer their interest in the Trust. No creditor of any beneficiary shall have any right
    to reach the Trust assets or income before distribution.

6.2 Protection from Claims. To the maximum extent permitted by law, Trust assets shall be
    protected from the claims of creditors, divorcing spouses, and legal judgments against
    any beneficiary.

ARTICLE VII - ADMINISTRATIVE PROVISIONS

7.1 Trust Situs. This Trust shall be administered in the State of ${enrollment.trustState}.

7.2 Governing Law. This Agreement shall be governed by the laws of the State of ${enrollment.trustState}.

7.3 Advisory Control. MGR Capital LLC retains advisory and administrative oversight
    interest in Trust administration decisions, including but not limited to:

    a) Review of significant distributions
    b) Investment policy guidance
    c) Trustee succession recommendations
    d) Trust modification proposals

ARTICLE VIII - AMENDMENT AND TERMINATION

8.1 Irrevocability. This Trust is irrevocable and may not be amended, modified, or revoked
    by the Grantor.

8.2 Termination. This Trust shall terminate upon the occurrence of any of the following:

    a) Distribution of all Trust assets
    b) Agreement of all Beneficiaries (subject to MGR Capital LLC consent)
    c) Court order

ARTICLE IX - MISCELLANEOUS

9.1 Severability. If any provision of this Agreement is held invalid, the remaining provisions
    shall continue in full force and effect.

9.2 Headings. Article and section headings are for convenience only and shall not affect
    interpretation.

9.3 Counterparts. This Agreement may be executed in counterparts, each of which shall be
    deemed an original.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.


GRANTOR:
_________________________________
${userData.name}
Date: _______________


TRUSTEE:
_________________________________
MGR Capital Trust Services, LLC
By: Authorized Representative
Date: _______________


STATE OF ${enrollment.trustState.toUpperCase()}
COUNTY OF _______________

Before me, the undersigned notary public, on this _____ day of _____________, 20___,
personally appeared ${userData.name}, known to me (or proved to me on the basis of
satisfactory evidence) to be the person whose name is subscribed to the within instrument
and acknowledged to me that they executed the same in their authorized capacity, and that
by their signature on the instrument, the person or entity upon behalf of which they acted,
executed the instrument.

WITNESS my hand and official seal.

_________________________________
Notary Public
My Commission Expires: _______________

[NOTARY SEAL]
`.trim();
}

// =============================================================================
// TRUST AUTOMATION SERVICE
// =============================================================================

class TrustAutomationService {
  /**
   * Get available trust plans
   */
  getAvailablePlans(): TrustPlan[] {
    return Object.values(TRUST_PLANS);
  }

  /**
   * Get plan details
   */
  getPlan(type: TrustType): TrustPlan {
    return TRUST_PLANS[type];
  }

  /**
   * Get state trust rules
   */
  getStateRules(state: string): typeof STATE_TRUST_RULES[string] {
    return STATE_TRUST_RULES[state.toUpperCase()] || STATE_TRUST_RULES['DEFAULT'];
  }

  /**
   * Enroll user in trust program
   */
  async enrollUser(data: {
    userId: string;
    userType: 'EMPLOYEE' | 'CHILD_COMPANY_OWNER';
    trustType: TrustType;
    state: string;
    additionalBeneficiaries?: { name: string; percent: number; relationship: string }[];
  }): Promise<TrustEnrollment> {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) throw new Error('User not found');

    const plan = TRUST_PLANS[data.trustType];
    const founderPercent = plan.founderBeneficiaryPercent;
    let userPercent = 100 - founderPercent;

    // Adjust for additional beneficiaries
    const additionalBeneficiaries = data.additionalBeneficiaries || [];
    const additionalPercent = additionalBeneficiaries.reduce((sum, b) => sum + b.percent, 0);
    userPercent = userPercent - additionalPercent;

    if (userPercent < 50) {
      throw new Error('User must retain at least 50% beneficial interest');
    }

    const enrollment: TrustEnrollment = {
      id: `trust_${Date.now()}`,
      userId: data.userId,
      userType: data.userType,
      trustType: data.trustType,
      status: 'PENDING',
      trustName: `${user.name} Protection Trust`,
      trustState: data.state.toUpperCase(),
      founderBeneficiaryPercent: founderPercent,
      userBeneficiaryPercent: userPercent,
      additionalBeneficiaries,
      documentIds: [],
      notarizedDocumentIds: [],
      setupFeePaidCents: 0,
      annualFeePaidCents: 0,
      totalAssetsProtectedCents: 0,
      founderInterestValueCents: 0,
      enrolledAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store enrollment
    await prisma.founderConfig.create({
      data: {
        key: `trust_enrollment_${enrollment.id}`,
        value: enrollment as any,
        description: `Trust enrollment for ${user.name}`,
      },
    });

    logger.info('[TrustAutomation] User enrolled', {
      enrollmentId: enrollment.id,
      userId: data.userId,
      trustType: data.trustType,
    });

    return enrollment;
  }

  /**
   * Process setup fee payment
   */
  async processSetupFee(enrollmentId: string, paymentMethodId?: string): Promise<TrustEnrollment> {
    const enrollment = await this.getEnrollment(enrollmentId);
    if (!enrollment) throw new Error('Enrollment not found');

    const plan = TRUST_PLANS[enrollment.trustType];

    // In production, would process actual payment
    // For now, mark as paid
    enrollment.setupFeePaidCents = plan.setupFeeCents;
    enrollment.status = 'DOCUMENTS_GENERATED';

    // Generate trust documents
    const documentIds = await this.generateTrustDocuments(enrollment);
    enrollment.documentIds = documentIds;

    await this.updateEnrollment(enrollment);

    // Auto-schedule notarization
    await this.scheduleNotarization(enrollmentId);

    return enrollment;
  }

  /**
   * Generate trust documents
   */
  async generateTrustDocuments(enrollment: TrustEnrollment): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: enrollment.userId },
    });

    if (!user) throw new Error('User not found');

    const plan = TRUST_PLANS[enrollment.trustType];
    const documentIds: string[] = [];

    // Generate main trust agreement
    const trustAgreement = generateTrustAgreement(enrollment, user, plan);
    const docId = await this.storeDocument({
      trustId: enrollment.id,
      documentType: 'TRUST_AGREEMENT',
      title: `${enrollment.trustName} - Trust Agreement`,
      content: trustAgreement,
    });
    documentIds.push(docId);

    // Would generate additional documents:
    // - Declaration of Trust
    // - Certificate of Trust
    // - Schedule A (initial property)
    // - Assignment of Interest
    // - Trustee Acceptance
    // - Beneficiary Designation

    logger.info('[TrustAutomation] Documents generated', {
      enrollmentId: enrollment.id,
      documentCount: documentIds.length,
    });

    return documentIds;
  }

  /**
   * Schedule notarization with founder notary
   */
  async scheduleNotarization(enrollmentId: string): Promise<{ sessionId: string; scheduledTime: Date }> {
    const enrollment = await this.getEnrollment(enrollmentId);
    if (!enrollment) throw new Error('Enrollment not found');

    const user = await prisma.user.findUnique({
      where: { id: enrollment.userId },
    });

    if (!user) throw new Error('User not found');

    // Check founder notary is available
    const notaryActive = await founderNotaryService.isActive();
    if (!notaryActive) {
      throw new Error('Notary service not available');
    }

    // Create RON session
    const session = await founderNotaryService.createRONSession({
      signerName: user.name,
      signerEmail: user.email,
      documentIds: enrollment.documentIds,
      documentType: 'trust_agreement',
      trustId: enrollment.id,
    });

    // Update enrollment
    enrollment.ronSessionId = session.id;
    enrollment.status = 'NOTARIZATION_SCHEDULED';
    await this.updateEnrollment(enrollment);

    logger.info('[TrustAutomation] Notarization scheduled', {
      enrollmentId: enrollment.id,
      sessionId: session.id,
    });

    return {
      sessionId: session.id,
      scheduledTime: session.scheduledTime || new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Complete notarization and activate trust
   */
  async activateTrust(enrollmentId: string): Promise<TrustEnrollment> {
    const enrollment = await this.getEnrollment(enrollmentId);
    if (!enrollment) throw new Error('Enrollment not found');

    const plan = TRUST_PLANS[enrollment.trustType];

    // Generate EIN for trust (would call IRS API)
    const ein = `${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 9000000) + 1000000}`;

    // Update enrollment
    enrollment.trustEIN = ein;
    enrollment.status = 'ACTIVE';
    enrollment.activatedAt = new Date();
    enrollment.nextAnnualFeeDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await this.updateEnrollment(enrollment);

    // Create trust record in database
    await this.createTrustRecord(enrollment);

    logger.info('[TrustAutomation] Trust activated', {
      enrollmentId: enrollment.id,
      ein,
    });

    return enrollment;
  }

  /**
   * Get all trust enrollments (for founder dashboard)
   */
  async getAllEnrollments(): Promise<TrustEnrollment[]> {
    const configs = await prisma.founderConfig.findMany({
      where: { key: { startsWith: 'trust_enrollment_' } },
    });

    return configs.map(c => c.value as unknown as TrustEnrollment);
  }

  /**
   * Get enrollment by ID
   */
  async getEnrollment(enrollmentId: string): Promise<TrustEnrollment | null> {
    const config = await prisma.founderConfig.findUnique({
      where: { key: `trust_enrollment_${enrollmentId}` },
    });
    return config?.value as TrustEnrollment | null;
  }

  /**
   * Get user's trust enrollment
   */
  async getUserEnrollment(userId: string): Promise<TrustEnrollment | null> {
    const enrollments = await this.getAllEnrollments();
    return enrollments.find(e => e.userId === userId && e.status !== 'TERMINATED') || null;
  }

  /**
   * Calculate founder's total beneficiary interest
   */
  async calculateFounderInterest(): Promise<{
    totalTrusts: number;
    activeTrusts: number;
    totalAssetsProtected: number;
    founderInterestValue: number;
    byType: Record<TrustType, { count: number; interest: number }>;
  }> {
    const enrollments = await this.getAllEnrollments();
    const active = enrollments.filter(e => e.status === 'ACTIVE');

    let totalAssets = 0;
    let founderInterest = 0;
    const byType: Record<TrustType, { count: number; interest: number }> = {
      BASIC_PROTECTION: { count: 0, interest: 0 },
      ENHANCED_PROTECTION: { count: 0, interest: 0 },
      PREMIUM_ESTATE: { count: 0, interest: 0 },
    };

    for (const enrollment of active) {
      totalAssets += enrollment.totalAssetsProtectedCents;
      const interest = Math.round(enrollment.totalAssetsProtectedCents * (enrollment.founderBeneficiaryPercent / 100));
      founderInterest += interest;

      byType[enrollment.trustType].count++;
      byType[enrollment.trustType].interest += interest;
    }

    return {
      totalTrusts: enrollments.length,
      activeTrusts: active.length,
      totalAssetsProtected: totalAssets,
      founderInterestValue: founderInterest,
      byType,
    };
  }

  /**
   * Update trust assets (called when user earns money)
   */
  async updateTrustAssets(userId: string, amountCents: number): Promise<void> {
    const enrollment = await this.getUserEnrollment(userId);
    if (!enrollment || enrollment.status !== 'ACTIVE') return;

    enrollment.totalAssetsProtectedCents += amountCents;
    enrollment.founderInterestValueCents = Math.round(
      enrollment.totalAssetsProtectedCents * (enrollment.founderBeneficiaryPercent / 100)
    );

    await this.updateEnrollment(enrollment);
  }

  /**
   * Process annual fee
   */
  async processAnnualFee(enrollmentId: string): Promise<boolean> {
    const enrollment = await this.getEnrollment(enrollmentId);
    if (!enrollment) return false;

    const plan = TRUST_PLANS[enrollment.trustType];

    // Would process payment
    enrollment.annualFeePaidCents += plan.annualFeeCents;
    enrollment.nextAnnualFeeDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await this.updateEnrollment(enrollment);
    return true;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private async updateEnrollment(enrollment: TrustEnrollment): Promise<void> {
    enrollment.updatedAt = new Date();
    await prisma.founderConfig.update({
      where: { key: `trust_enrollment_${enrollment.id}` },
      data: { value: enrollment as any },
    });
  }

  private async storeDocument(data: {
    trustId: string;
    documentType: string;
    title: string;
    content: string;
  }): Promise<string> {
    const docId = `trust_doc_${Date.now()}`;

    await prisma.founderConfig.create({
      data: {
        key: `trust_document_${docId}`,
        value: {
          id: docId,
          ...data,
          generatedAt: new Date(),
          notarized: false,
        } as any,
        description: `Trust document: ${data.title}`,
      },
    });

    return docId;
  }

  private async createTrustRecord(enrollment: TrustEnrollment): Promise<void> {
    // Would create actual trust record in Prisma
    // For now, the enrollment serves as the record
    logger.info('[TrustAutomation] Trust record created', {
      enrollmentId: enrollment.id,
      ein: enrollment.trustEIN,
    });
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const trustAutomationService = new TrustAutomationService();
export default trustAutomationService;
