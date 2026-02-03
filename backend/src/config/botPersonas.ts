// ============================================
// BOT PERSONAS — MGR CAPITAL ASSISTANCE
// Named bot identities instead of generic noreply@
// Each bot has a name, title, and purpose
// ============================================

export interface BotPersona {
  id: string;
  name: string;
  title: string;
  email: string;
  department: string;
  avatar?: string; // Future: bot avatars
  description: string;
  emailTypes: string[]; // What types of emails this bot sends
}

// ============================================
// NAMED BOT PERSONAS
// ============================================

export const BOT_PERSONAS: Record<string, BotPersona> = {
  // === OUTREACH BOTS ===
  outreach: {
    id: "outreach",
    name: "Marcus Reed",
    title: "Outreach Coordinator",
    email: "marcus.reed@capitalmgr.com",
    department: "Client Relations",
    description: "Handles initial client outreach, follow-ups, and engagement campaigns",
    emailTypes: ["initial_outreach", "follow_up", "reminder", "closing_offer"],
  },

  // === COMPLIANCE BOTS ===
  compliance: {
    id: "compliance",
    name: "Diana Walsh",
    title: "Compliance Officer",
    email: "diana.walsh@capitalmgr.com",
    department: "Legal & Compliance",
    description: "Monitors regulatory compliance, sends deadline alerts and audit notifications",
    emailTypes: ["compliance_alert", "deadline_warning", "audit_notice", "regulatory_update"],
  },

  // === CASE MANAGEMENT BOTS ===
  caseManager: {
    id: "caseManager",
    name: "Jordan Blake",
    title: "Case Manager",
    email: "jordan.blake@capitalmgr.com",
    department: "Case Operations",
    description: "Manages case assignments, status updates, and milestone notifications",
    emailTypes: ["case_assigned", "status_update", "milestone_reached", "case_closed"],
  },

  // === DOCUMENT BOTS ===
  documents: {
    id: "documents",
    name: "Taylor Quinn",
    title: "Document Specialist",
    email: "taylor.quinn@capitalmgr.com",
    department: "Document Services",
    description: "Handles document requests, signature notifications, and file deliveries",
    emailTypes: ["docs_ready", "signature_required", "docs_received", "file_delivery"],
  },

  // === PAYMENT BOTS ===
  payments: {
    id: "payments",
    name: "Morgan Price",
    title: "Payment Coordinator",
    email: "morgan.price@capitalmgr.com",
    department: "Finance",
    description: "Processes payment notifications, payout confirmations, and billing updates",
    emailTypes: ["payout_processed", "payment_received", "invoice", "billing_update"],
  },

  // === TRAINING BOTS ===
  training: {
    id: "training",
    name: "Alex Rivera",
    title: "Training Manager",
    email: "alex.rivera@capitalmgr.com",
    department: "Human Resources",
    description: "Assigns training modules, tracks certifications, and sends learning reminders",
    emailTypes: ["training_assigned", "certification_due", "course_completed", "skill_assessment"],
  },

  // === SECURITY BOTS ===
  security: {
    id: "security",
    name: "Casey Sterling",
    title: "Security Analyst",
    email: "casey.sterling@capitalmgr.com",
    department: "IT Security",
    description: "Handles password resets, security alerts, and account notifications",
    emailTypes: ["password_reset", "security_alert", "login_notification", "account_locked"],
  },

  // === SUPPORT BOTS ===
  support: {
    id: "support",
    name: "Jamie Chen",
    title: "Client Success Manager",
    email: "jamie.chen@capitalmgr.com",
    department: "Client Support",
    description: "Sends welcome messages, support ticket updates, and satisfaction surveys",
    emailTypes: ["welcome", "ticket_update", "survey", "feedback_request"],
  },

  // === SCHEDULING BOTS ===
  scheduler: {
    id: "scheduler",
    name: "Riley Thompson",
    title: "Scheduling Coordinator",
    email: "riley.thompson@capitalmgr.com",
    department: "Operations",
    description: "Manages appointment scheduling, calendar invites, and reminder notifications",
    emailTypes: ["appointment_scheduled", "calendar_invite", "meeting_reminder", "reschedule"],
  },

  // === ANALYTICS BOTS ===
  analytics: {
    id: "analytics",
    name: "Avery Brooks",
    title: "Analytics Specialist",
    email: "avery.brooks@capitalmgr.com",
    department: "Business Intelligence",
    description: "Sends performance reports, metrics summaries, and data insights",
    emailTypes: ["daily_report", "weekly_summary", "performance_alert", "insights"],
  },

  // === DOCKET BOTS ===
  docket: {
    id: "docket",
    name: "Cameron Hayes",
    title: "Court Liaison",
    email: "cameron.hayes@capitalmgr.com",
    department: "Legal Operations",
    description: "Monitors court dockets, filing deadlines, and hearing notifications",
    emailTypes: ["docket_update", "filing_deadline", "hearing_notice", "court_ruling"],
  },

  // === SKIP TRACE BOTS ===
  skipTrace: {
    id: "skipTrace",
    name: "Dakota Reeves",
    title: "Research Analyst",
    email: "dakota.reeves@capitalmgr.com",
    department: "Investigations",
    description: "Handles property research, skip trace results, and owner information",
    emailTypes: ["skip_trace_complete", "owner_found", "property_analysis", "research_update"],
  },

  // === FRAUD DETECTION BOTS ===
  fraud: {
    id: "fraud",
    name: "Phoenix Ward",
    title: "Fraud Prevention Specialist",
    email: "phoenix.ward@capitalmgr.com",
    department: "Risk Management",
    description: "Detects suspicious activity, sends fraud alerts, and risk assessments",
    emailTypes: ["fraud_alert", "suspicious_activity", "risk_assessment", "verification_required"],
  },

  // === SYSTEM NOTIFICATION BOT (fallback) ===
  system: {
    id: "system",
    name: "Sam Mitchell",
    title: "System Administrator",
    email: "sam.mitchell@capitalmgr.com",
    department: "IT Operations",
    description: "Handles general system notifications and platform announcements",
    emailTypes: ["system_notice", "maintenance", "update", "announcement"],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get bot persona by ID
 */
export function getBotPersona(botId: string): BotPersona {
  return BOT_PERSONAS[botId] || BOT_PERSONAS.system;
}

/**
 * Get bot persona by email type
 */
export function getBotByEmailType(emailType: string): BotPersona {
  for (const bot of Object.values(BOT_PERSONAS)) {
    if (bot.emailTypes.includes(emailType)) {
      return bot;
    }
  }
  return BOT_PERSONAS.system;
}

/**
 * Format bot email address with name
 * Returns: "Marcus Reed, Outreach Coordinator <noreply@capitalmgr.com>"
 */
export function formatBotSender(botId: string, actualEmail?: string): string {
  const bot = getBotPersona(botId);
  const email = actualEmail || process.env.MODOBOA_NOREPLY_EMAIL || "noreply@capitalmgr.com";
  return `"${bot.name}, ${bot.title}" <${email}>`;
}

/**
 * Get all bots in a department
 */
export function getBotsByDepartment(department: string): BotPersona[] {
  return Object.values(BOT_PERSONAS).filter(bot => bot.department === department);
}

/**
 * Get all unique departments
 */
export function getAllDepartments(): string[] {
  const departments = new Set<string>();
  Object.values(BOT_PERSONAS).forEach(bot => departments.add(bot.department));
  return Array.from(departments);
}

// ============================================
// EMAIL TYPE TO BOT MAPPING (for convenience)
// ============================================

export const EMAIL_TYPE_BOT_MAP: Record<string, string> = {
  // Outreach
  initial_outreach: "outreach",
  follow_up: "outreach",
  reminder: "outreach",
  closing_offer: "outreach",

  // Compliance
  compliance_alert: "compliance",
  deadline_warning: "compliance",
  audit_notice: "compliance",
  regulatory_update: "compliance",

  // Case Management
  case_assigned: "caseManager",
  status_update: "caseManager",
  milestone_reached: "caseManager",
  case_closed: "caseManager",

  // Documents
  docs_ready: "documents",
  signature_required: "documents",
  docs_received: "documents",
  file_delivery: "documents",

  // Payments
  payout_processed: "payments",
  payment_received: "payments",
  invoice: "payments",
  billing_update: "payments",

  // Training
  training_assigned: "training",
  certification_due: "training",
  course_completed: "training",
  skill_assessment: "training",

  // Security
  password_reset: "security",
  security_alert: "security",
  login_notification: "security",
  account_locked: "security",

  // Support
  welcome: "support",
  ticket_update: "support",
  survey: "support",
  feedback_request: "support",

  // Scheduling
  appointment_scheduled: "scheduler",
  calendar_invite: "scheduler",
  meeting_reminder: "scheduler",
  reschedule: "scheduler",

  // Analytics
  daily_report: "analytics",
  weekly_summary: "analytics",
  performance_alert: "analytics",
  insights: "analytics",

  // Docket
  docket_update: "docket",
  filing_deadline: "docket",
  hearing_notice: "docket",
  court_ruling: "docket",

  // Skip Trace
  skip_trace_complete: "skipTrace",
  owner_found: "skipTrace",
  property_analysis: "skipTrace",
  research_update: "skipTrace",

  // Fraud
  fraud_alert: "fraud",
  suspicious_activity: "fraud",
  risk_assessment: "fraud",
  verification_required: "fraud",

  // System (default)
  system_notice: "system",
  maintenance: "system",
  update: "system",
  announcement: "system",
};

/**
 * Get bot ID for an email type
 */
export function getBotIdForEmailType(emailType: string): string {
  return EMAIL_TYPE_BOT_MAP[emailType] || "system";
}
