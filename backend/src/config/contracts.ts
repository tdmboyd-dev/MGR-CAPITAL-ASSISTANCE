// ============================================
// CONTRACT AGREEMENTS — MGR CAPITAL ASSISTANCE
// Plain, simple, professional contracts
// ============================================

/**
 * Contract Types
 */
export enum ContractType {
  EMPLOYEE_AGREEMENT = "EMPLOYEE_AGREEMENT",
  CONTRACTOR_AGREEMENT = "CONTRACTOR_AGREEMENT",
  NDA = "NDA",
  NON_COMPETE = "NON_COMPETE",
  CODE_OF_CONDUCT = "CODE_OF_CONDUCT",
  DATA_PROTECTION = "DATA_PROTECTION",
  CHILD_COMPANY_AGREEMENT = "CHILD_COMPANY_AGREEMENT",
}

/**
 * Violation Types
 */
export enum ViolationType {
  MISCONDUCT = "MISCONDUCT",
  POLICY_BREACH = "POLICY_BREACH",
  DATA_BREACH = "DATA_BREACH",
  CLIENT_COMPLAINT = "CLIENT_COMPLAINT",
  NO_SHOW = "NO_SHOW",
  FRAUD = "FRAUD",
  INSUBORDINATION = "INSUBORDINATION",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
}

/**
 * Ban Severity Levels
 */
export enum BanSeverity {
  WARNING = "WARNING",           // No pay reduction
  MINOR = "MINOR",               // 10% pay reduction
  MODERATE = "MODERATE",         // 25% pay reduction
  SEVERE = "SEVERE",             // 50% pay reduction
  TERMINATION = "TERMINATION",   // 100% forfeiture + ban
}

/**
 * Pay Reduction Percentages by Severity
 */
export const PAY_REDUCTION: Record<BanSeverity, number> = {
  [BanSeverity.WARNING]: 0,
  [BanSeverity.MINOR]: 10,
  [BanSeverity.MODERATE]: 25,
  [BanSeverity.SEVERE]: 50,
  [BanSeverity.TERMINATION]: 100,
};

/**
 * Violation to Severity Mapping (Default)
 */
export const VIOLATION_SEVERITY: Record<ViolationType, BanSeverity> = {
  [ViolationType.MISCONDUCT]: BanSeverity.MINOR,
  [ViolationType.POLICY_BREACH]: BanSeverity.MINOR,
  [ViolationType.DATA_BREACH]: BanSeverity.SEVERE,
  [ViolationType.CLIENT_COMPLAINT]: BanSeverity.WARNING,
  [ViolationType.NO_SHOW]: BanSeverity.MINOR,
  [ViolationType.FRAUD]: BanSeverity.TERMINATION,
  [ViolationType.INSUBORDINATION]: BanSeverity.MODERATE,
  [ViolationType.UNAUTHORIZED_ACCESS]: BanSeverity.SEVERE,
};

// ============================================
// CONTRACT TEMPLATES — Plain & Professional
// ============================================

export const CONTRACT_TEMPLATES: Record<ContractType, {
  title: string;
  sections: { heading: string; content: string }[];
}> = {
  [ContractType.EMPLOYEE_AGREEMENT]: {
    title: "Employee Agreement",
    sections: [
      {
        heading: "1. Employment",
        content: "You agree to work for MGR Capital Assistance as an independent contractor. Your role, compensation, and responsibilities are defined by your assigned tier and position.",
      },
      {
        heading: "2. Compensation",
        content: "You will receive commission based on your tier level. Payments are made after case completion and fund disbursement. MGR Capital reserves the right to adjust pay for violations.",
      },
      {
        heading: "3. Confidentiality",
        content: "You will not share client information, case details, company processes, or proprietary systems with anyone outside the organization. This obligation continues after termination.",
      },
      {
        heading: "4. Conduct",
        content: "You agree to act professionally, follow company policies, and represent MGR Capital with integrity. Violations may result in pay reduction or termination.",
      },
      {
        heading: "5. Termination",
        content: "Either party may end this agreement with written notice. Upon termination, pending pay may be reduced based on circumstances. Fraud results in full forfeiture.",
      },
      {
        heading: "6. Agreement",
        content: "By signing, you confirm you have read, understood, and agree to all terms. This agreement is binding and governed by applicable law.",
      },
    ],
  },

  [ContractType.CONTRACTOR_AGREEMENT]: {
    title: "Contractor Agreement",
    sections: [
      {
        heading: "1. Services",
        content: "You agree to provide services to MGR Capital Assistance as an independent contractor. You are not an employee and are responsible for your own taxes and insurance.",
      },
      {
        heading: "2. Payment",
        content: "Payment is based on completed work as defined by your agreement with your supervising company. MGR Capital takes 50% of all fees. Remaining 50% goes to your company.",
      },
      {
        heading: "3. Confidentiality",
        content: "All client data, case information, and company systems are confidential. Unauthorized disclosure is grounds for immediate termination and legal action.",
      },
      {
        heading: "4. Standards",
        content: "You will maintain professional standards, complete work on time, and communicate promptly. Failure to meet standards may result in reduced pay or contract termination.",
      },
      {
        heading: "5. Termination",
        content: "This agreement may be terminated by either party. Upon termination for cause, pending payments may be reduced or forfeited based on severity.",
      },
    ],
  },

  [ContractType.NDA]: {
    title: "Non-Disclosure Agreement",
    sections: [
      {
        heading: "1. Confidential Information",
        content: "All client data, case details, financial information, business processes, and proprietary systems are confidential. This includes anything not publicly available.",
      },
      {
        heading: "2. Obligations",
        content: "You will not disclose, copy, or use confidential information for any purpose other than your work for MGR Capital. You will protect this information as you would your own.",
      },
      {
        heading: "3. Duration",
        content: "This agreement remains in effect during your engagement and for 5 years after termination. Trade secrets are protected indefinitely.",
      },
      {
        heading: "4. Breach",
        content: "Unauthorized disclosure will result in immediate termination, forfeiture of pending pay, and potential legal action for damages.",
      },
    ],
  },

  [ContractType.NON_COMPETE]: {
    title: "Non-Compete Agreement",
    sections: [
      {
        heading: "1. Restriction",
        content: "For 12 months after leaving MGR Capital, you agree not to work for or start a competing surplus recovery business in the same geographic area.",
      },
      {
        heading: "2. Scope",
        content: "This applies to tax surplus recovery, foreclosure surplus recovery, and related services. It does not restrict unrelated employment.",
      },
      {
        heading: "3. Client Solicitation",
        content: "You agree not to solicit or service any MGR Capital clients for 24 months after termination.",
      },
      {
        heading: "4. Enforcement",
        content: "Violation may result in legal action and recovery of damages. This agreement is enforceable to the fullest extent permitted by law.",
      },
    ],
  },

  [ContractType.CODE_OF_CONDUCT]: {
    title: "Code of Conduct",
    sections: [
      {
        heading: "1. Professionalism",
        content: "Treat all clients, colleagues, and partners with respect. Communicate clearly and promptly. Represent MGR Capital with integrity at all times.",
      },
      {
        heading: "2. Honesty",
        content: "Be truthful in all dealings. Do not misrepresent services, timelines, or outcomes. Report errors immediately.",
      },
      {
        heading: "3. Compliance",
        content: "Follow all applicable laws, regulations, and company policies. When in doubt, ask before acting.",
      },
      {
        heading: "4. Conflicts",
        content: "Disclose any conflicts of interest. Do not accept gifts or payments from clients beyond standard compensation.",
      },
      {
        heading: "5. Violations",
        content: "Violations will be reviewed and may result in warnings, pay reduction, or termination based on severity.",
      },
    ],
  },

  [ContractType.DATA_PROTECTION]: {
    title: "Data Protection Agreement",
    sections: [
      {
        heading: "1. Data Handling",
        content: "Client data must be stored securely and accessed only for work purposes. Never store client data on personal devices without encryption.",
      },
      {
        heading: "2. Access",
        content: "Only access data you need for your assigned tasks. Do not share login credentials. Report suspicious activity immediately.",
      },
      {
        heading: "3. Transmission",
        content: "Use only approved, secure methods to transmit client data. Never send sensitive information via personal email or unsecured channels.",
      },
      {
        heading: "4. Breach Response",
        content: "Report any data breach or suspected breach immediately. Failure to report is itself a violation. Data breaches may result in severe penalties.",
      },
    ],
  },

  [ContractType.CHILD_COMPANY_AGREEMENT]: {
    title: "Child Company Agreement",
    sections: [
      {
        heading: "1. Relationship",
        content: "Your company operates under the MGR Capital umbrella. You maintain your brand identity while following MGR Capital standards and systems.",
      },
      {
        heading: "2. Revenue",
        content: "Case revenue is split per your tier agreement. Platform fees (email, tools, leads) are split 50/50 between your company and MGR Capital.",
      },
      {
        heading: "3. Standards",
        content: "Your company must maintain MGR Capital compliance standards. Client complaints and violations affect your standing.",
      },
      {
        heading: "4. Employees",
        content: "You may hire contractors under your company. They must sign agreements and follow all MGR Capital policies. You are responsible for their conduct.",
      },
      {
        heading: "5. Termination",
        content: "This agreement may be terminated by either party with 30 days notice. Violations may result in immediate termination. Cases in progress will be reassigned.",
      },
    ],
  },
};

// ============================================
// VIOLATION REASONS & CONSEQUENCES
// ============================================

export const VIOLATION_DETAILS: Record<ViolationType, {
  name: string;
  description: string;
  defaultSeverity: BanSeverity;
  payReduction: number;
  examples: string[];
}> = {
  [ViolationType.MISCONDUCT]: {
    name: "Misconduct",
    description: "Unprofessional behavior or actions",
    defaultSeverity: BanSeverity.MINOR,
    payReduction: 10,
    examples: [
      "Rude communication with clients",
      "Missing deadlines without notice",
      "Failure to follow procedures",
    ],
  },
  [ViolationType.POLICY_BREACH]: {
    name: "Policy Breach",
    description: "Violation of company policies",
    defaultSeverity: BanSeverity.MINOR,
    payReduction: 10,
    examples: [
      "Using unapproved communication methods",
      "Sharing internal documents",
      "Working outside assigned scope",
    ],
  },
  [ViolationType.DATA_BREACH]: {
    name: "Data Breach",
    description: "Unauthorized access or disclosure of data",
    defaultSeverity: BanSeverity.SEVERE,
    payReduction: 50,
    examples: [
      "Sharing client information externally",
      "Storing data on personal devices",
      "Failing to report security incidents",
    ],
  },
  [ViolationType.CLIENT_COMPLAINT]: {
    name: "Client Complaint",
    description: "Verified complaint from a client",
    defaultSeverity: BanSeverity.WARNING,
    payReduction: 0,
    examples: [
      "Poor communication",
      "Unmet expectations",
      "Delayed responses",
    ],
  },
  [ViolationType.NO_SHOW]: {
    name: "No-Show",
    description: "Failure to appear or respond",
    defaultSeverity: BanSeverity.MINOR,
    payReduction: 10,
    examples: [
      "Missing scheduled meetings",
      "Unresponsive for 48+ hours",
      "Abandoning assigned tasks",
    ],
  },
  [ViolationType.FRAUD]: {
    name: "Fraud",
    description: "Intentional deception for personal gain",
    defaultSeverity: BanSeverity.TERMINATION,
    payReduction: 100,
    examples: [
      "Falsifying documents",
      "Stealing client funds",
      "Creating fake records",
    ],
  },
  [ViolationType.INSUBORDINATION]: {
    name: "Insubordination",
    description: "Refusal to follow legitimate instructions",
    defaultSeverity: BanSeverity.MODERATE,
    payReduction: 25,
    examples: [
      "Refusing assigned tasks",
      "Undermining leadership",
      "Repeated defiance of policies",
    ],
  },
  [ViolationType.UNAUTHORIZED_ACCESS]: {
    name: "Unauthorized Access",
    description: "Accessing systems or data without permission",
    defaultSeverity: BanSeverity.SEVERE,
    payReduction: 50,
    examples: [
      "Viewing cases not assigned to you",
      "Using others' credentials",
      "Bypassing security controls",
    ],
  },
};
