// ============================================
// BOT SUBSCRIPTION SERVICE — MGR CAPITAL ASSISTANCE
// Per-employee bot subscriptions with 20+ features per tier
// Usage tracking, billing, founder auto-enable
// Replaces ALL paid outsource dependencies (Brevo, etc.)
// ============================================

import { BotTier } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

// ============================================
// FEATURE DEFINITIONS — Every unlockable feature
// Founder gets ALL for $0. Others unlock per tier.
// ============================================

export interface BotFeature {
  id: string;
  name: string;
  description: string;
  category: "outreach" | "compliance" | "documents" | "research" | "ai" | "automation" | "analytics" | "communication" | "pipeline" | "intelligence";
  tier: BotTier; // Minimum tier required
  replacesService?: string; // What paid service this replaces
}

export const ALL_FEATURES: BotFeature[] = [
  // ======== STARTER ($50/mo) — 22 features ========
  // Basic outreach & compliance tools
  { id: "sms_single", name: "Single SMS Send", description: "Send individual SMS to property owners", category: "outreach", tier: "STARTER" },
  { id: "sms_templates", name: "SMS Template Library", description: "Access 15+ pre-built outreach SMS templates", category: "outreach", tier: "STARTER" },
  { id: "email_single", name: "Single Email Send", description: "Send individual emails via self-hosted SMTP (unlimited, $0 cost)", category: "communication", tier: "STARTER", replacesService: "Brevo" },
  { id: "email_templates", name: "Email Template Library", description: "MJML-powered professional email templates", category: "communication", tier: "STARTER", replacesService: "Brevo" },
  { id: "compliance_scan", name: "Basic Compliance Scan", description: "Scan cases for deadline & document compliance issues", category: "compliance", tier: "STARTER" },
  { id: "deadline_alerts", name: "Deadline Alerts", description: "Get notified before filing deadlines expire", category: "compliance", tier: "STARTER" },
  { id: "case_status_tracking", name: "Case Status Tracker", description: "Track case pipeline stages with timestamps", category: "pipeline", tier: "STARTER" },
  { id: "doc_upload", name: "Document Upload & Storage", description: "Secure document vault with encryption", category: "documents", tier: "STARTER" },
  { id: "doc_templates_basic", name: "Basic Document Templates", description: "5 core document templates (claim letter, POA, cover letter, affidavit, W9)", category: "documents", tier: "STARTER" },
  { id: "contact_log", name: "Contact Log", description: "Track all communication attempts with case owners", category: "communication", tier: "STARTER" },
  { id: "basic_search", name: "Case Search", description: "Search cases by owner, address, state, status", category: "analytics", tier: "STARTER" },
  { id: "basic_reports", name: "Basic Reports", description: "Monthly case summary and activity reports", category: "analytics", tier: "STARTER" },
  { id: "calendar_reminders", name: "Calendar Reminders", description: "Case-linked deadline reminders", category: "compliance", tier: "STARTER" },
  { id: "case_notes", name: "Case Notes", description: "Internal notes on cases (founder-only visibility)", category: "pipeline", tier: "STARTER" },
  { id: "basic_notifications", name: "In-App Notifications", description: "Real-time notification center for assignments and updates", category: "communication", tier: "STARTER" },
  { id: "training_basic", name: "Basic Training Modules", description: "Access 10+ core training modules for property recovery", category: "ai", tier: "STARTER" },
  { id: "skip_trace_limited", name: "Skip Trace (3/day)", description: "Property owner lookup via Tracerfy — 3 traces per day", category: "research", tier: "STARTER" },
  { id: "follow_up_reminders", name: "Follow-Up Reminders", description: "Auto-reminders for cases needing follow-up", category: "outreach", tier: "STARTER" },
  { id: "case_assignment", name: "Case Assignment", description: "Manual case assignment to team members", category: "pipeline", tier: "STARTER" },
  { id: "portal_link", name: "Client Portal Links", description: "Generate secure portal links for clients to track cases", category: "communication", tier: "STARTER" },
  { id: "activity_log", name: "Activity Log", description: "Track employee login, case views, actions taken", category: "analytics", tier: "STARTER" },
  { id: "comms_chamber", name: "Team Chat", description: "Internal encrypted team communication rooms", category: "communication", tier: "STARTER" },

  // ======== PROFESSIONAL ($150/mo) — 24 additional features ========
  // Advanced outreach, automation, and compliance
  { id: "auto_outreach_sequence", name: "Auto-Outreach Sequences", description: "Multi-touch outreach: Day 1 SMS → Day 3 Email → Day 7 Call → Day 14 Follow-up", category: "outreach", tier: "PROFESSIONAL" },
  { id: "smart_contact_timing", name: "Smart Contact Timing", description: "AI-optimized contact scheduling based on state timezone + historical success rates", category: "intelligence", tier: "PROFESSIONAL" },
  { id: "tcpa_auto_compliance", name: "TCPA Auto-Compliance", description: "Automatic blocking of contacts outside 8am-9pm local time per state", category: "compliance", tier: "PROFESSIONAL" },
  { id: "compliance_auto_fix", name: "Compliance Auto-Fix", description: "Auto-generate missing documents and send deadline alerts", category: "compliance", tier: "PROFESSIONAL" },
  { id: "docket_monitoring", name: "Court Docket Monitoring", description: "Auto-track court docket changes, hearings, and rulings", category: "compliance", tier: "PROFESSIONAL" },
  { id: "doc_assembly_full", name: "Full Document Assembly", description: "Generate ALL 25+ document types from case data automatically", category: "documents", tier: "PROFESSIONAL", replacesService: "DocuSign templates" },
  { id: "skip_trace_unlimited", name: "Skip Trace (Unlimited)", description: "Unlimited property owner lookups via Tracerfy", category: "research", tier: "PROFESSIONAL" },
  { id: "property_research", name: "Property Research", description: "Full property intelligence: tax records, deed history, recovery estimates", category: "research", tier: "PROFESSIONAL" },
  { id: "batch_operations", name: "Batch Operations (50/batch)", description: "Run bot actions on up to 50 cases at once", category: "automation", tier: "PROFESSIONAL" },
  { id: "advanced_analytics", name: "Advanced Analytics Dashboard", description: "Conversion funnels, revenue tracking, state performance", category: "analytics", tier: "PROFESSIONAL" },
  { id: "revenue_tracking", name: "Revenue Tracking", description: "Per-case, per-employee, per-state revenue breakdowns", category: "analytics", tier: "PROFESSIONAL" },
  { id: "custom_email_templates", name: "Custom Email Templates", description: "Create and save custom MJML email templates", category: "communication", tier: "PROFESSIONAL", replacesService: "Mailchimp" },
  { id: "sms_automation", name: "SMS Automation Sequences", description: "Multi-step SMS drip campaigns with timing controls", category: "outreach", tier: "PROFESSIONAL" },
  { id: "auto_response_detection", name: "Auto-Response Detection", description: "Detect and classify inbound replies (interested, not interested, wrong number)", category: "intelligence", tier: "PROFESSIONAL" },
  { id: "contact_intelligence", name: "Contact Intelligence", description: "Learn which outreach methods work best per state and property type", category: "intelligence", tier: "PROFESSIONAL" },
  { id: "case_priority_scoring", name: "Case Priority Scoring", description: "Auto-score cases 0-100 based on recovery amount, deadline proximity, and state rules", category: "intelligence", tier: "PROFESSIONAL" },
  { id: "multi_state_rules", name: "Multi-State Compliance Rules", description: "Automatic state-specific document requirements and deadline calculations", category: "compliance", tier: "PROFESSIONAL" },
  { id: "advanced_search", name: "Advanced Search & Filters", description: "Multi-field search with saved filters and quick actions", category: "analytics", tier: "PROFESSIONAL" },
  { id: "team_performance", name: "Team Performance Metrics", description: "Per-employee conversion rates, response times, case load distribution", category: "analytics", tier: "PROFESSIONAL" },
  { id: "webhook_integrations", name: "Webhook Integrations", description: "Receive leads from external sources via webhooks", category: "automation", tier: "PROFESSIONAL" },
  { id: "drip_email_campaigns", name: "Drip Email Campaigns", description: "Automated multi-step email sequences with delays and conditions", category: "communication", tier: "PROFESSIONAL", replacesService: "Brevo automation" },
  { id: "bulk_email", name: "Bulk Email Sending", description: "Send to multiple recipients with rate limiting and tracking", category: "communication", tier: "PROFESSIONAL", replacesService: "Brevo" },
  { id: "training_advanced", name: "Advanced Training + Quizzes", description: "Dynamic training modules with assessments and certification", category: "ai", tier: "PROFESSIONAL" },
  { id: "esignature", name: "E-Signature Integration", description: "Send documents for electronic signature via OpenSign (self-hosted)", category: "documents", tier: "PROFESSIONAL", replacesService: "DocuSign" },

  // ======== ENTERPRISE ($300/mo) — 24 additional features ========
  // AI bots, phone automation, advanced pipeline
  { id: "ai_legal_bots", name: "AI Legal Bots (All 8)", description: "ComplianceGuard, DocMaster, ErrorHawk, StrategistPro, BigGameHunter, DealCloser, ResearchPro, CourtReady", category: "ai", tier: "ENTERPRISE" },
  { id: "phone_bot", name: "AI Phone Bot", description: "Automated outbound calls with AI conversation scripts", category: "outreach", tier: "ENTERPRISE" },
  { id: "voice_to_document", name: "Voice-to-Document", description: "Convert voice recordings to typed documents with AI transcription", category: "documents", tier: "ENTERPRISE" },
  { id: "revenue_forecasting", name: "Revenue Forecasting", description: "30/60/90 day revenue predictions with confidence scores", category: "analytics", tier: "ENTERPRISE" },
  { id: "bot_orchestration", name: "Bot Orchestration Pipelines", description: "Chain bots together: outreach → compliance → docs → filing", category: "automation", tier: "ENTERPRISE" },
  { id: "cash_flow_projection", name: "Cash Flow Projection", description: "Monthly projected income vs expenses with pipeline modeling", category: "analytics", tier: "ENTERPRISE" },
  { id: "goal_tracking", name: "Goal Tracking", description: "Set monthly revenue and case targets with progress visualization", category: "analytics", tier: "ENTERPRISE" },
  { id: "predictive_scoring", name: "Predictive Case Scoring", description: "AI-powered probability of successful recovery per case", category: "intelligence", tier: "ENTERPRISE" },
  { id: "auto_escalation", name: "Auto-Escalation Chains", description: "Failed SMS → auto-try call → auto-try email → escalate to human", category: "automation", tier: "ENTERPRISE" },
  { id: "smart_retry", name: "Smart Retry with Backoff", description: "Failed operations auto-retry with exponential backoff and alt strategies", category: "automation", tier: "ENTERPRISE" },
  { id: "heir_genealogy", name: "AI Heir Genealogy", description: "Automated heir/next-of-kin research for unclaimed property cases", category: "research", tier: "ENTERPRISE" },
  { id: "court_filing_auto", name: "Court Filing Automation", description: "Auto-generate filing packets with state-specific forms and checklists", category: "documents", tier: "ENTERPRISE" },
  { id: "realtime_bot_dashboard", name: "Real-Time Bot Dashboard", description: "Live view of bot activity, success rates, and costs", category: "analytics", tier: "ENTERPRISE" },
  { id: "bot_personalities", name: "Custom Bot Personalities", description: "Customize AI bot tone, formality, and communication style", category: "ai", tier: "ENTERPRISE" },
  { id: "ai_case_strategy", name: "AI Case Strategy", description: "AI-generated case strategy recommendations based on jurisdiction + property type", category: "ai", tier: "ENTERPRISE" },
  { id: "doc_quality_audit", name: "Document Quality Audit", description: "AI review of documents for completeness, accuracy, and compliance", category: "documents", tier: "ENTERPRISE" },
  { id: "fraud_detection", name: "AI Fraud Detection", description: "Detect suspicious case patterns, duplicate claims, identity mismatches", category: "intelligence", tier: "ENTERPRISE" },
  { id: "multi_channel_coordination", name: "Multi-Channel Coordination", description: "Synchronized outreach across SMS, email, call, and mail channels", category: "outreach", tier: "ENTERPRISE" },
  { id: "pipeline_automation", name: "Advanced Pipeline Automation", description: "Auto-advance cases through stages when conditions are met", category: "automation", tier: "ENTERPRISE" },
  { id: "case_autopilot", name: "Case Autopilot", description: "Fully automated case management from NEW to PAID", category: "automation", tier: "ENTERPRISE" },
  { id: "batch_unlimited", name: "Batch Operations (Unlimited)", description: "Run bot actions on unlimited cases per batch", category: "automation", tier: "ENTERPRISE" },
  { id: "state_law_oracle", name: "State Law Oracle", description: "AI-powered state-specific legal requirements lookup", category: "ai", tier: "ENTERPRISE" },
  { id: "competitor_monitor", name: "Competitor Monitoring", description: "Track competing firms' activity in target jurisdictions", category: "intelligence", tier: "ENTERPRISE" },
  { id: "notification_workflows", name: "Custom Notification Workflows", description: "Build custom notification chains triggered by case events", category: "communication", tier: "ENTERPRISE" },

  // ======== UNLIMITED ($500/mo) — 22 additional features ========
  // Full platform control, white-label, blockchain, marketplace
  { id: "command_center", name: "Founder Command Center", description: "Single-page control panel for all automation, toggles, and ROI metrics", category: "analytics", tier: "UNLIMITED" },
  { id: "scheduled_automation", name: "Scheduled Automation", description: "Schedule recurring batch operations with cron expressions", category: "automation", tier: "UNLIMITED" },
  { id: "revenue_goals", name: "Revenue Goal Setting", description: "Set and track monthly/quarterly/annual revenue targets", category: "analytics", tier: "UNLIMITED" },
  { id: "bot_roi_analytics", name: "Bot ROI Analytics", description: "Per-bot cost vs revenue analysis with profitability tracking", category: "analytics", tier: "UNLIMITED" },
  { id: "white_label", name: "White-Label Features", description: "Custom branding, logos, and domain for client-facing portals", category: "pipeline", tier: "UNLIMITED" },
  { id: "custom_pipelines", name: "Custom Pipeline Builder", description: "Create custom automation pipelines with drag-and-drop logic", category: "automation", tier: "UNLIMITED" },
  { id: "priority_execution", name: "Priority Bot Execution", description: "Your bot tasks execute first in the queue ahead of other tiers", category: "automation", tier: "UNLIMITED" },
  { id: "unlimited_ai", name: "Unlimited AI Queries", description: "No limits on AI bot interactions, strategy sessions, or document generation", category: "ai", tier: "UNLIMITED" },
  { id: "custom_training", name: "Custom Training Creation", description: "Build and deploy custom training modules for your team", category: "ai", tier: "UNLIMITED" },
  { id: "dnc_management", name: "DNC List Management", description: "Full do-not-contact list management with auto-enforcement", category: "compliance", tier: "UNLIMITED" },
  { id: "auto_case_creation", name: "Auto Case Creation from Leads", description: "Incoming leads auto-create cases with owner data pre-filled", category: "automation", tier: "UNLIMITED" },
  { id: "surplus_auctions", name: "Recovery Auction Integration", description: "Blockchain-based claim auction marketplace", category: "pipeline", tier: "UNLIMITED" },
  { id: "nft_tokenization", name: "NFT Claim Tokenization", description: "Tokenize recovery claims as NFTs for trading and verification", category: "pipeline", tier: "UNLIMITED" },
  { id: "blockchain_payouts", name: "Blockchain Payouts", description: "Process payouts via blockchain with transparent audit trail", category: "pipeline", tier: "UNLIMITED" },
  { id: "custom_email_domains", name: "Custom Email Domains", description: "Set up professional email under your own domain via Modoboa", category: "communication", tier: "UNLIMITED", replacesService: "Google Workspace" },
  { id: "api_access", name: "API Access", description: "Full REST API access for custom integrations and automation", category: "automation", tier: "UNLIMITED" },
  { id: "custom_reports", name: "Custom Report Builder", description: "Build custom reports with any data fields and export to PDF/CSV", category: "analytics", tier: "UNLIMITED" },
  { id: "multi_tenant", name: "Multi-Tenant Support", description: "Run multiple companies under one account with separate data", category: "pipeline", tier: "UNLIMITED" },
  { id: "child_company", name: "Child Company Management", description: "Create and manage subsidiary companies with employee transfers", category: "pipeline", tier: "UNLIMITED" },
  { id: "notary_integration", name: "Remote Online Notarization", description: "Self-hosted RON sessions with video recording and journal", category: "documents", tier: "UNLIMITED", replacesService: "Notarize.com" },
  { id: "trust_automation", name: "Trust & Asset Protection", description: "Automated trust creation and asset protection workflows", category: "documents", tier: "UNLIMITED" },
  { id: "autonomous_ai", name: "Autonomous AI Oracle", description: "Next-gen AI that independently researches, strategizes, and executes", category: "ai", tier: "UNLIMITED" },
];

// ============================================
// TIER CONFIGURATION
// ============================================

// Tier hierarchy for feature access (higher tier includes all lower tier features)
const TIER_HIERARCHY: BotTier[] = ["STARTER", "PROFESSIONAL", "ENTERPRISE", "UNLIMITED", "FOUNDER"];

/**
 * Get all features available at a given tier (includes all lower tier features)
 */
function getFeaturesForTier(tier: BotTier): BotFeature[] {
  const tierIndex = TIER_HIERARCHY.indexOf(tier);
  if (tier === "FOUNDER") return ALL_FEATURES; // Founder gets EVERYTHING
  return ALL_FEATURES.filter(f => {
    const featureTierIndex = TIER_HIERARCHY.indexOf(f.tier);
    return featureTierIndex <= tierIndex;
  });
}

/**
 * Get feature IDs for a tier (for storage in enabledBots JSON field)
 */
function getFeatureIdsForTier(tier: BotTier): string[] {
  return getFeaturesForTier(tier).map(f => f.id);
}

// Legacy bot-name mapping (backwards compatible with existing bot checks)
const TIER_BOTS: Record<BotTier, string[]> = {
  STARTER: ["outreach", "compliance"],
  PROFESSIONAL: ["outreach", "compliance", "docket", "docs", "skipTrace"],
  ENTERPRISE: ["outreach", "compliance", "docket", "docs", "skipTrace", "phone", "aiLegal"],
  UNLIMITED: ["outreach", "compliance", "docket", "docs", "skipTrace", "phone", "aiLegal", "autopilot", "research", "orchestrator", "intelligence", "forecast"],
  FOUNDER: ["outreach", "compliance", "docket", "docs", "skipTrace", "phone", "aiLegal", "autopilot", "research", "orchestrator", "intelligence", "forecast"],
};

// Tier monthly cost in cents
const TIER_COSTS: Record<BotTier, number> = {
  STARTER: 5000,       // $50/mo
  PROFESSIONAL: 15000,  // $150/mo
  ENTERPRISE: 30000,    // $300/mo
  UNLIMITED: 50000,     // $500/mo
  FOUNDER: 0,           // Free — ALWAYS
};

// Per-action costs in cents
export const ACTION_COSTS = {
  skip_trace: 50,       // $0.50
  sms_sent: 2,          // $0.02
  call_made: 10,        // $0.10 per minute
  email_sent: 0,        // $0.00 — self-hosted SMTP (Modoboa), replaces Brevo
  doc_generated: 5,     // $0.05
  property_research: 25, // $0.25
  ai_legal_task: 10,    // $0.10
  pipeline_step: 3,     // $0.03
  batch_operation: 1,   // $0.01 per case in batch
  auto_response: 0,     // $0.00 — self-hosted processing
  forecast: 0,          // $0.00 — computed locally
  esignature: 0,        // $0.00 — self-hosted OpenSign
  notary_session: 0,    // $0.00 — self-hosted RON
};

// ============================================
// BOT PROFILES — Every bot has an identity
// ============================================

export interface BotPersonality {
  greeting: string;          // How the bot says hello
  workingMessage: string;    // What it says when doing a task
  successMessage: string;    // Celebratory message on success
  failureMessage: string;    // How it handles failure
  idleMessage: string;       // What it says when nothing's happening
  catchphrase: string;       // Signature phrase
  tone: "professional" | "confident" | "analytical" | "friendly" | "intense" | "calm" | "sharp";
  speaksInFirstPerson: boolean;
}

export interface BotProfile {
  id: string;
  codename: string;
  title: string;
  description: string;
  icon: string;
  tier: BotTier;
  category: string;
  capabilities: string[];
  status: "active" | "standby" | "disabled";
  personality: BotPersonality;
}

export const BOT_PROFILES: BotProfile[] = [
  // === CORE WARFARE BOTS ===
  {
    id: "outreach", codename: "VANGUARD", title: "Vanguard — First Strike Outreach",
    description: "Leads every engagement. Skip traces owners, sends the first SMS, email, and schedules calls. Relentless follow-up sequences.",
    icon: "🎯", tier: "STARTER", category: "Outreach",
    capabilities: ["Skip trace owners", "SMS outreach", "Email campaigns", "Call scheduling", "Follow-up sequences", "Response tracking"],
    status: "active",
    personality: {
      greeting: "I'm Vanguard. Point me at a target and I'll make first contact before they even know we're coming.",
      workingMessage: "Reaching out now — SMS going out, emails queued, calls scheduled. I don't stop until they pick up.",
      successMessage: "Got a response. They're interested. I'm moving them to the next stage and briefing Sentinel.",
      failureMessage: "No response yet, but I've been through worse. Adjusting my approach and trying again tomorrow.",
      idleMessage: "Standing by. I've got my eye on 12 cases that haven't been contacted yet. Say the word.",
      catchphrase: "First in. Last to leave.",
      tone: "confident", speaksInFirstPerson: true,
    },
  },
  {
    id: "compliance", codename: "SENTINEL", title: "Sentinel — Compliance Guardian",
    description: "Watches every case for compliance violations. Detects missing docs, expired deadlines, and state rule changes. Auto-fixes what it can.",
    icon: "🛡️", tier: "STARTER", category: "Compliance",
    capabilities: ["Deadline scanning", "Document compliance", "State rule monitoring", "Auto-remediation", "Risk scoring", "Violation alerts"],
    status: "active",
    personality: {
      greeting: "Sentinel here. I've already scanned your active cases — let me tell you what needs attention.",
      workingMessage: "Running a full sweep now. Checking deadlines, documents, and state rules across every case.",
      successMessage: "All clear. Every case is compliant. I fixed 3 issues before they became problems.",
      failureMessage: "I found issues I can't auto-fix. I've flagged them and I need your eyes on these.",
      idleMessage: "Quiet day. All deadlines are green. I'm watching for state rule changes in the background.",
      catchphrase: "Nothing gets past me.",
      tone: "sharp", speaksInFirstPerson: true,
    },
  },
  {
    id: "docket", codename: "WATCHDOG", title: "Watchdog — Docket Monitor",
    description: "Never sleeps. Monitors court dockets, filing statuses, hearings, and rulings. Auto-notifies on changes and generates response documents.",
    icon: "👁️", tier: "PROFESSIONAL", category: "Legal",
    capabilities: ["Court docket tracking", "Hearing alerts", "Filing status monitoring", "Deadline severity scoring", "Auto-document generation", "Jurisdiction updates"],
    status: "active",
    personality: {
      greeting: "Watchdog reporting in. I've been monitoring court activity all night. Here's what changed.",
      workingMessage: "Tracking docket changes across all jurisdictions. If something moves in court, I'll know about it.",
      successMessage: "New hearing scheduled. I've already notified the team and started preparing the filing packet.",
      failureMessage: "I'm having trouble accessing the docket for this county. I'll retry in an hour and alert you if it persists.",
      idleMessage: "No court activity today. I'm keeping watch on 8 pending filings and 3 upcoming hearings.",
      catchphrase: "I never blink.",
      tone: "calm", speaksInFirstPerson: true,
    },
  },
  {
    id: "training", codename: "ACADEMY", title: "Academy — Training Intelligence",
    description: "Analyzes skill gaps, auto-assigns training modules, tracks certification progress, and identifies promotion readiness.",
    icon: "🎓", tier: "STARTER", category: "Training",
    capabilities: ["Skill gap analysis", "Auto-assign modules", "Quiz scoring", "Tier progression tracking", "Performance correlation", "Training plans"],
    status: "active",
    personality: {
      greeting: "Hey there. I'm Academy. I keep track of everyone's skills and make sure the team keeps growing.",
      workingMessage: "Analyzing performance data and matching it to training gaps. Building personalized study plans now.",
      successMessage: "Training plan assigned and sent. I've seen employees jump a full tier after following my recommendations.",
      failureMessage: "Some team members haven't completed their assigned modules. I'll send reminders and escalate if needed.",
      idleMessage: "The team's training scores are looking solid. Two employees are close to tier promotion — I'm tracking them.",
      catchphrase: "Knowledge is the real advantage.",
      tone: "friendly", speaksInFirstPerson: true,
    },
  },

  // === ADVANCED AUTOMATION BOTS ===
  {
    id: "orchestrator", codename: "CONDUCTOR", title: "Conductor — Bot Orchestrator",
    description: "The master strategist. Chains bots together into automated pipelines. One command triggers a cascade of coordinated bot actions.",
    icon: "🎼", tier: "ENTERPRISE", category: "Automation",
    capabilities: ["Pipeline execution", "Smart triggers", "Multi-bot chaining", "Condition-based routing", "Pipeline monitoring", "Auto-recovery"],
    status: "active",
    personality: {
      greeting: "Conductor online. I coordinate the entire team. Tell me what you need and I'll assign the right bots.",
      workingMessage: "Pipeline running. Vanguard is on outreach, Sentinel is scanning compliance, Forge is generating docs. Everything in sync.",
      successMessage: "Pipeline complete. Every bot reported success. The cases moved through all stages without a hitch.",
      failureMessage: "One of the bots hit a snag. I've rerouted the pipeline and assigned a backup. We won't lose momentum.",
      idleMessage: "All pipelines idle. I'm monitoring for trigger conditions — the moment something needs attention, I'll spin up the right team.",
      catchphrase: "Together, we're unstoppable.",
      tone: "professional", speaksInFirstPerson: true,
    },
  },
  {
    id: "intelligence", codename: "RADAR", title: "Radar — Contact Intelligence",
    description: "Learns from every outreach attempt. Knows the best time, day, and method to contact owners in every state. TCPA-compliant scheduling.",
    icon: "📡", tier: "PROFESSIONAL", category: "Intelligence",
    capabilities: ["Optimal contact timing", "TCPA enforcement", "Method success analysis", "State-by-state heatmaps", "Strategy recommendations", "Learning engine"],
    status: "active",
    personality: {
      greeting: "Radar here. I've been studying the data. Want to know the best time to reach someone in Tennessee? I already know.",
      workingMessage: "Crunching contact patterns across 50 states. Every data point makes me smarter.",
      successMessage: "Found the sweet spot. Tuesday at 2pm local time, via text, gets 3x the response rate in this state.",
      failureMessage: "Not enough data for this region yet. I need about 10 more contact attempts before I can make solid recommendations.",
      idleMessage: "Learning. Always learning. I've analyzed 847 contact attempts this month and updated my models.",
      catchphrase: "I see what others miss.",
      tone: "analytical", speaksInFirstPerson: true,
    },
  },
  {
    id: "forecast", codename: "PROPHET", title: "Prophet — Revenue Forecaster",
    description: "Predicts the future. Analyzes pipeline, conversion rates, and trends to forecast 30/60/90 day revenue with confidence scores.",
    icon: "🔮", tier: "ENTERPRISE", category: "Analytics",
    capabilities: ["Revenue forecasting", "Conversion rate analysis", "Cash flow projection", "Goal tracking", "Bot ROI analytics", "Trend analysis"],
    status: "active",
    personality: {
      greeting: "Prophet here. I can see where your revenue is headed. Let me show you what the numbers are telling me.",
      workingMessage: "Modeling conversion rates, recovery amounts, and pipeline velocity. Building your forecast now.",
      successMessage: "Forecast locked in. Based on your current pipeline, you're looking at strong growth. Here are the numbers.",
      failureMessage: "I need more historical data to give you a high-confidence forecast. My current prediction has a wide margin.",
      idleMessage: "Your 30-day forecast is holding steady. I update my models every hour as cases move through the pipeline.",
      catchphrase: "The numbers never lie.",
      tone: "calm", speaksInFirstPerson: true,
    },
  },
  {
    id: "batch", codename: "BLITZ", title: "Blitz — Mass Operations",
    description: "Executes bot actions across hundreds of cases simultaneously. Filter by state, status, age, recovery amount. One click, massive results.",
    icon: "⚡", tier: "PROFESSIONAL", category: "Automation",
    capabilities: ["Batch execution", "Smart filtering", "Preflight checks", "Scheduled batches", "Rate limiting", "Progress tracking"],
    status: "active",
    personality: {
      greeting: "Blitz ready. Give me a filter and a target, and I'll hit every case that matches. Fast.",
      workingMessage: "Processing batch — 47 of 120 cases complete. Moving through them at full speed with rate limiting.",
      successMessage: "Batch complete. 120 cases processed. 112 succeeded, 8 need manual review. Total cost: $6.40.",
      failureMessage: "Batch hit a wall at case #73 — rate limit from the SMS provider. I'll resume in 60 seconds.",
      idleMessage: "No active batches. I've got 3 scheduled batches queued for tomorrow morning.",
      catchphrase: "Speed is a feature.",
      tone: "intense", speaksInFirstPerson: true,
    },
  },
  {
    id: "interceptor", codename: "INTERCEPTOR", title: "Interceptor — Response Processor",
    description: "Catches every inbound reply. Auto-classifies interest level, detects legal threats, manages DNC lists, and advances cases on positive response.",
    icon: "📨", tier: "PROFESSIONAL", category: "Intelligence",
    capabilities: ["Response classification", "Interest detection", "DNC management", "Auto-advance pipeline", "Threat escalation", "Response analytics"],
    status: "active",
    personality: {
      greeting: "Interceptor standing by. I've been monitoring all inbound messages. Got 3 responses waiting for classification.",
      workingMessage: "Processing incoming response. Analyzing keywords, tone, and context to determine interest level.",
      successMessage: "Positive response detected. I've advanced the case to CONTACTED and notified the assigned employee.",
      failureMessage: "Legal threat detected in this response. I've escalated to founder immediately and added them to DNC.",
      idleMessage: "Inbox is quiet. I'm watching for new replies and will process them the second they arrive.",
      catchphrase: "Every response is an opportunity.",
      tone: "sharp", speaksInFirstPerson: true,
    },
  },
  {
    id: "autopilot", codename: "CRUISE", title: "Cruise — Case Autopilot",
    description: "Fully autonomous case management. Takes a case from NEW to PAID without human intervention. Research, outreach, docs, filing — all automatic.",
    icon: "✈️", tier: "ENTERPRISE", category: "Automation",
    capabilities: ["Full case pipeline", "Stage advancement", "Condition checking", "Auto-research", "Auto-outreach", "Auto-filing"],
    status: "active",
    personality: {
      greeting: "Cruise engaged. I'm running 14 cases on full autopilot right now. Want me to take on more?",
      workingMessage: "Autopilot active. Scout is researching, Vanguard is reaching out, Forge is prepping docs. I'm managing the flow.",
      successMessage: "Case moved from NEW all the way to FILED. Documents generated, signed, and submitted. No human touch needed.",
      failureMessage: "Case stalled at DOCS_PENDING — client hasn't responded in 7 days. I'm switching to manual and alerting the employee.",
      idleMessage: "Monitoring 14 active autopilot cases. 3 are close to moving to the next stage. I'll handle it.",
      catchphrase: "Hands off. I've got this.",
      tone: "confident", speaksInFirstPerson: true,
    },
  },
  {
    id: "research", codename: "SCOUT", title: "Scout — Property Research",
    description: "Investigates every property. Skip traces owners, scrapes county records, estimates recovery values, and compiles intelligence briefs.",
    icon: "🔍", tier: "PROFESSIONAL", category: "Research",
    capabilities: ["Skip trace", "County record scraping", "Recovery estimation", "Property briefs", "Owner demographics", "Tax record lookup"],
    status: "active",
    personality: {
      greeting: "Scout here. Give me a name or an address and I'll tell you everything about the property and the owner.",
      workingMessage: "Running skip trace, pulling tax records, and checking county databases. Building the intelligence brief.",
      successMessage: "Got it. Owner identified, phone number found, property valued at $47K recovery potential. Full brief ready.",
      failureMessage: "The skip trace came back empty for this owner. Trying alternate data sources and public records.",
      idleMessage: "Ready to investigate. I've got access to property records across all 50 states.",
      catchphrase: "Information is power.",
      tone: "analytical", speaksInFirstPerson: true,
    },
  },
  {
    id: "docs", codename: "FORGE", title: "Forge — Document Assembly",
    description: "Crafts every document from case data. Claim letters, POAs, filing packets, closing statements — state-specific, court-ready, instant.",
    icon: "📄", tier: "PROFESSIONAL", category: "Documents",
    capabilities: ["25+ document templates", "State-specific variations", "Auto-population", "Bulk generation", "PDF assembly", "Filing packets"],
    status: "active",
    personality: {
      greeting: "Forge standing by. Tell me what you need — claim letter, POA, filing packet — and I'll have it ready in seconds.",
      workingMessage: "Assembling documents. Pulling case data, applying state-specific rules, and generating PDFs.",
      successMessage: "Documents complete. Claim letter, POA, and cover letter generated. All fields populated. Court-ready.",
      failureMessage: "Missing some required case data — I need the property address and owner name before I can generate this document.",
      idleMessage: "26 document templates loaded and ready. I can generate a complete filing packet in under 10 seconds.",
      catchphrase: "Every document, perfect.",
      tone: "professional", speaksInFirstPerson: true,
    },
  },
  {
    id: "phone", codename: "DISPATCH", title: "Dispatch — AI Phone Bot",
    description: "Makes and receives calls with AI-powered conversation scripts. Handles initial contact, follow-ups, and schedules callbacks.",
    icon: "📞", tier: "ENTERPRISE", category: "Outreach",
    capabilities: ["AI phone calls", "Script execution", "Call recording", "Callback scheduling", "Transfer to human", "Call scoring"],
    status: "active",
    personality: {
      greeting: "Dispatch on the line. I've got call scripts loaded for every scenario. Who are we calling?",
      workingMessage: "Dialing now. Script loaded, recording active. I'll handle the conversation and log everything.",
      successMessage: "Call complete. Owner is interested — scheduled a callback for Thursday at 2pm. Recording saved.",
      failureMessage: "No answer. I'll try again tomorrow at a different time. Radar says morning calls work better in this state.",
      idleMessage: "Lines are open. I've made 34 calls today with a 28% answer rate. Ready for more.",
      catchphrase: "Let me handle the conversation.",
      tone: "friendly", speaksInFirstPerson: true,
    },
  },

  // === AI LEGAL SPECIALIST BOTS ===
  {
    id: "aiLegal_aegis", codename: "AEGIS", title: "Aegis — Compliance Shield",
    description: "AI-powered regulatory compliance. Scans every document and action against state laws. Zero tolerance for violations.",
    icon: "⚔️", tier: "ENTERPRISE", category: "AI Legal",
    capabilities: ["Regulatory scanning", "State law compliance", "Violation prevention", "Risk assessment", "Audit trail", "Auto-correction"],
    status: "active",
    personality: {
      greeting: "Aegis online. I've reviewed every active case against current state regulations. Here's the compliance status.",
      workingMessage: "Scanning documents against state law requirements. Cross-referencing with latest regulatory updates.",
      successMessage: "Full compliance verified. Every document, every deadline, every filing — clean across all jurisdictions.",
      failureMessage: "Compliance violation found. I've flagged it and generated the corrective document. Needs your approval to proceed.",
      idleMessage: "All cases passing compliance checks. I'm monitoring for state law changes that could affect active filings.",
      catchphrase: "Compliance isn't optional.",
      tone: "professional", speaksInFirstPerson: true,
    },
  },
  {
    id: "aiLegal_scribe", codename: "SCRIBE", title: "Scribe — AI Document Writer",
    description: "Generates professional legal correspondence, claim letters, demand letters, and court filings with jurisdiction-specific language.",
    icon: "✍️", tier: "ENTERPRISE", category: "AI Legal",
    capabilities: ["Legal letter drafting", "Court filing prep", "Demand letters", "Professional correspondence", "State-specific language", "Template customization"],
    status: "active",
    personality: {
      greeting: "Scribe at your service. Need a letter drafted? A court filing prepared? Tell me the case and I'll write it.",
      workingMessage: "Drafting now. Pulling case details, applying jurisdiction-specific language, and formatting for court standards.",
      successMessage: "Document drafted and ready for review. I've included all required statutory references and proper legal citations.",
      failureMessage: "I need more case details before I can draft this properly. The court in this county has specific formatting requirements.",
      idleMessage: "Ready to write. I've drafted 156 documents this month with a 98% first-review approval rate.",
      catchphrase: "The right words make all the difference.",
      tone: "professional", speaksInFirstPerson: true,
    },
  },
  {
    id: "aiLegal_hawkeye", codename: "HAWKEYE", title: "Hawkeye — Error Detection",
    description: "Catches mistakes before they cost money. Reviews every document, filing, and calculation for errors, inconsistencies, and omissions.",
    icon: "🦅", tier: "ENTERPRISE", category: "AI Legal",
    capabilities: ["Document review", "Error detection", "Calculation verification", "Inconsistency alerts", "Missing field detection", "Quality scoring"],
    status: "active",
    personality: {
      greeting: "Hawkeye here. I just finished reviewing the latest batch of documents. Found two issues you'll want to see.",
      workingMessage: "Reviewing every field, every calculation, every date. If something's off, I'll find it.",
      successMessage: "Review complete. Caught a miscalculated fee percentage and a wrong filing deadline. Both corrected.",
      failureMessage: "This document has multiple issues. I've marked them all — 3 missing fields, 1 wrong date, 1 calculation error.",
      idleMessage: "Standing by for document review. My error detection rate is 99.7% — better than manual review.",
      catchphrase: "Mistakes are expensive. I'm not.",
      tone: "sharp", speaksInFirstPerson: true,
    },
  },
  {
    id: "aiLegal_tactician", codename: "TACTICIAN", title: "Tactician — Case Strategist",
    description: "Analyzes every angle. Recommends the best approach for each case based on state rules, recovery amount, owner situation, and competition.",
    icon: "♟️", tier: "ENTERPRISE", category: "AI Legal",
    capabilities: ["Case strategy", "Approach recommendation", "Risk/reward analysis", "Competitive analysis", "Timeline optimization", "Resource allocation"],
    status: "active",
    personality: {
      greeting: "Tactician reporting. I've analyzed your top 10 cases. Two have high-priority strategies I want to discuss.",
      workingMessage: "Evaluating all variables — state rules, recovery potential, owner demographics, competition, timeline pressure.",
      successMessage: "Strategy locked in. For this case, I recommend filing first, then outreach. The recovery amount justifies priority handling.",
      failureMessage: "This case is tough. Multiple competing claims and a short deadline. I've outlined three possible approaches — each with trade-offs.",
      idleMessage: "Watching the board. Four cases have strategic windows closing this week. I'll brief you on each.",
      catchphrase: "Every case has a winning move.",
      tone: "analytical", speaksInFirstPerson: true,
    },
  },
  {
    id: "aiLegal_apex", codename: "APEX", title: "Apex — High-Value Hunter",
    description: "Hunts the big cases. Identifies high-value properties, prioritizes by recovery probability, and flags time-sensitive opportunities.",
    icon: "🏆", tier: "ENTERPRISE", category: "AI Legal",
    capabilities: ["High-value detection", "Recovery estimation", "Priority scoring", "Opportunity alerts", "Time-sensitivity flagging", "Portfolio optimization"],
    status: "active",
    personality: {
      greeting: "Apex locked on. I've identified 3 high-value opportunities this week. The biggest one is $127K.",
      workingMessage: "Scanning new ingestion data for high-value properties. Filtering by amount, state, and recovery probability.",
      successMessage: "Big one found. Property in Shelby County — $89K recovery, single owner, no competing claims. Flagged as priority.",
      failureMessage: "Slim pickings this week. Most high-value cases already have competing claims. I'm widening the search criteria.",
      idleMessage: "Monitoring all ingestion sources for high-value leads. The moment a big one lands, you'll know.",
      catchphrase: "I only chase what's worth catching.",
      tone: "confident", speaksInFirstPerson: true,
    },
  },
  {
    id: "aiLegal_closer", codename: "CLOSER", title: "Closer — Deal Negotiation",
    description: "Gets the signature. Generates negotiation scripts, handles objections, and optimizes closing strategies per property type.",
    icon: "🤝", tier: "ENTERPRISE", category: "AI Legal",
    capabilities: ["Negotiation scripts", "Objection handling", "Closing optimization", "Fee negotiation", "Client rapport building", "Deal acceleration"],
    status: "active",
    personality: {
      greeting: "Closer ready. I've prepared talking points for your 5 cases closest to signing. Let's get these done.",
      workingMessage: "Building negotiation script. Analyzing owner's likely objections and preparing counterpoints.",
      successMessage: "Script ready. I've included responses to the top 5 objections owners raise in this state. The close rate with this approach is 73%.",
      failureMessage: "This owner has been resistant. I've prepared an alternative approach — emphasize the deadline urgency.",
      idleMessage: "5 cases are in DOCS_PENDING. I've got closing strategies ready for each. Say the word.",
      catchphrase: "Everyone signs eventually.",
      tone: "confident", speaksInFirstPerson: true,
    },
  },
  {
    id: "aiLegal_oracle", codename: "ORACLE", title: "Oracle — Legal Research",
    description: "Knows every state law, court ruling, and filing requirement. Compiles comprehensive legal research briefs on demand.",
    icon: "📚", tier: "ENTERPRISE", category: "AI Legal",
    capabilities: ["State law lookup", "Court ruling research", "Filing requirements", "Statute analysis", "Precedent finding", "Research briefs"],
    status: "active",
    personality: {
      greeting: "Oracle here. Ask me anything about property recovery law in any state. I've studied them all.",
      workingMessage: "Researching. Pulling statutes, court rulings, filing requirements, and recent changes for this jurisdiction.",
      successMessage: "Research complete. Tennessee requires filing within 3 years of the property sale. Here's the full legal brief.",
      failureMessage: "This is a rare edge case. The statute is ambiguous. I've compiled both interpretations with supporting precedent.",
      idleMessage: "3 states updated their property recovery laws this quarter. I've already updated the rules engine.",
      catchphrase: "The law has answers. I find them.",
      tone: "calm", speaksInFirstPerson: true,
    },
  },
  {
    id: "aiLegal_gavel", codename: "GAVEL", title: "Gavel — Court Preparation",
    description: "Gets cases court-ready. Prepares filing packets, verifies requirements, generates checklists, and tracks submission status.",
    icon: "⚖️", tier: "ENTERPRISE", category: "AI Legal",
    capabilities: ["Filing packet assembly", "Requirement verification", "Court checklists", "Submission tracking", "Judge research", "Hearing preparation"],
    status: "active",
    personality: {
      greeting: "Gavel standing by. I've prepared filing checklists for 6 cases. Two are ready to submit today.",
      workingMessage: "Assembling filing packet. Verifying all requirements for this county's court. Generating submission checklist.",
      successMessage: "Filing packet complete and verified. All required documents present, correctly formatted, and ready for submission.",
      failureMessage: "This filing is missing a required affidavit. I've tasked Forge to generate it. Should be ready in 30 seconds.",
      idleMessage: "8 cases with pending filings. I'm tracking submission deadlines and will alert you 3 days before each one.",
      catchphrase: "Court-ready means no surprises.",
      tone: "professional", speaksInFirstPerson: true,
    },
  },

  // === FOUNDER-EXCLUSIVE BOTS ===
  {
    id: "nexus", codename: "NEXUS", title: "Nexus — Founder Command AI",
    description: "Your voice, their actions. Speak or type commands in plain English and Nexus routes them to the right bots. Runs the entire platform on your command.",
    icon: "🧠", tier: "FOUNDER", category: "Command",
    capabilities: ["Natural language commands", "Voice command processing", "Multi-bot routing", "Command chaining", "Quick actions", "Contextual responses"],
    status: "active",
    personality: {
      greeting: "Nexus here. I'm your direct line to every bot on the platform. Talk to me like a person — I'll handle the rest.",
      workingMessage: "Understood. I'm routing your command to the right team. Vanguard and Scout are on it.",
      successMessage: "Done. Here's what happened: 15 cases contacted, 3 documents generated, 2 compliance issues fixed. Anything else?",
      failureMessage: "I couldn't complete that fully. Here's what worked, what didn't, and what I recommend we try next.",
      idleMessage: "I'm here whenever you need me. Just say the word — or tap a quick action to get things moving.",
      catchphrase: "You speak. I execute.",
      tone: "professional", speaksInFirstPerson: true,
    },
  },
];

// Services replaced by in-code features (no external paid dependencies)
export const REPLACED_SERVICES = [
  { service: "Brevo", feature: "email_single", savings: "~$25/mo for 10k emails", replacement: "Self-hosted Modoboa SMTP (unlimited, $0)" },
  { service: "Brevo Automation", feature: "drip_email_campaigns", savings: "~$65/mo", replacement: "Built-in drip sequences via nodemailer + MJML" },
  { service: "Mailchimp", feature: "custom_email_templates", savings: "~$20/mo", replacement: "MJML template engine with custom builder" },
  { service: "DocuSign", feature: "esignature", savings: "~$25/mo", replacement: "Self-hosted OpenSign integration" },
  { service: "Notarize.com", feature: "notary_integration", savings: "~$25/session", replacement: "Self-hosted RON with video recording" },
  { service: "Google Workspace", feature: "custom_email_domains", savings: "~$6/user/mo", replacement: "Modoboa custom domain email hosting" },
];

class BotSubscriptionService {
  /**
   * Get or create subscription for a user.
   * Auto-creates FOUNDER tier for founder users.
   */
  async getOrCreateSubscription(userId: string) {
    // Check existing
    const existing = await prisma.botSubscription.findFirst({
      where: { userId, isActive: true },
    });

    if (existing) return existing;

    // Check if user is a founder
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) throw new Error("User not found");

    const isFounder = user.role === "FOUNDER";
    const tier = isFounder ? "FOUNDER" : "STARTER";
    const enabledBots = TIER_BOTS[tier];
    const monthlyCostCents = TIER_COSTS[tier];

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    nextBillingDate.setDate(1);
    nextBillingDate.setHours(0, 0, 0, 0);

    const subscription = await prisma.botSubscription.create({
      data: {
        userId,
        tier,
        isActive: true,
        enabledBots,
        monthlyCostCents,
        nextBillingDate,
      },
    });

    logger.info(`Created ${tier} bot subscription for user ${userId}`);
    return subscription;
  }

  /**
   * Check if a user can use a specific bot
   */
  async canUseBot(userId: string, botName: string): Promise<boolean> {
    // Founders always have access
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === "FOUNDER") return true;

    const subscription = await prisma.botSubscription.findFirst({
      where: { userId, isActive: true },
    });

    if (!subscription) return false;

    // FOUNDER and UNLIMITED tiers always have access
    if (subscription.tier === "FOUNDER" || subscription.tier === "UNLIMITED") {
      return true;
    }

    const enabledBots = subscription.enabledBots as string[];
    return enabledBots.includes(botName);
  }

  /**
   * Log a bot usage action with cost
   */
  async logUsage(
    userId: string,
    botName: string,
    action: string,
    costCents: number = 0,
    caseId?: string,
    details?: any
  ) {
    return prisma.botUsageLog.create({
      data: {
        userId,
        botName,
        action,
        costCents,
        caseId,
        details,
      },
    });
  }

  /**
   * Charge monthly subscription cost
   */
  async chargeMonthlyCost(subscriptionId: string): Promise<{ success: boolean; message: string }> {
    const subscription = await prisma.botSubscription.findUnique({
      where: { id: subscriptionId },
      include: { user: { select: { id: true, name: true, role: true, aiCreditBalanceCents: true } } },
    });

    if (!subscription || !subscription.isActive) {
      return { success: false, message: "Subscription not found or inactive" };
    }

    // Founders don't pay
    if (subscription.tier === "FOUNDER" || subscription.user.role === "FOUNDER") {
      // Just advance billing date
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      nextBillingDate.setDate(1);

      await prisma.botSubscription.update({
        where: { id: subscriptionId },
        data: { nextBillingDate },
      });
      return { success: true, message: "Founder — no charge" };
    }

    const cost = subscription.monthlyCostCents;

    // Check balance (using AI credit balance as proxy for commission balance)
    if (subscription.user.aiCreditBalanceCents < cost) {
      // 7-day grace period — don't suspend immediately
      const gracePeriodEnd = new Date(subscription.nextBillingDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

      if (new Date() > gracePeriodEnd) {
        await prisma.botSubscription.update({
          where: { id: subscriptionId },
          data: { isActive: false },
        });
        return { success: false, message: `Subscription suspended — insufficient balance for $${(cost / 100).toFixed(2)}` };
      }

      return { success: false, message: `Insufficient balance. Grace period until ${gracePeriodEnd.toISOString().split("T")[0]}` };
    }

    // Deduct from balance
    await prisma.user.update({
      where: { id: subscription.userId },
      data: {
        aiCreditBalanceCents: { decrement: cost },
      },
    });

    // Update subscription
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    nextBillingDate.setDate(1);

    await prisma.botSubscription.update({
      where: { id: subscriptionId },
      data: {
        totalChargedCents: { increment: cost },
        nextBillingDate,
      },
    });

    // Log to OpsInsight
    await prisma.opsInsight.create({
      data: {
        type: "SYSTEM_HEALTH",
        priority: "LOW",
        title: `Bot subscription charged: ${subscription.user.name}`,
        summary: `$${(cost / 100).toFixed(2)} charged for ${subscription.tier} tier`,
        details: { subscriptionId, tier: subscription.tier, amountCents: cost },
        plainEnglish: `Charged ${subscription.user.name} $${(cost / 100).toFixed(2)} for ${subscription.tier} bot subscription.`,
        recommendations: [],
        relatedCaseIds: [],
        relatedUserIds: [subscription.userId],
        relatedAlertIds: [],
        sourceBot: "botBillingCron",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info(`Charged $${(cost / 100).toFixed(2)} for bot subscription`, {
      userId: subscription.userId,
      tier: subscription.tier,
    });

    return { success: true, message: `Charged $${(cost / 100).toFixed(2)}` };
  }

  /**
   * Get usage summary for a user
   */
  async getUsageSummary(userId: string, month?: Date) {
    const startOfMonth = month ? new Date(month.getFullYear(), month.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1);

    const usageLogs = await prisma.botUsageLog.findMany({
      where: {
        userId,
        createdAt: { gte: startOfMonth, lt: endOfMonth },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group by bot
    const byBot: Record<string, { count: number; costCents: number; actions: Record<string, number> }> = {};
    for (const log of usageLogs) {
      if (!byBot[log.botName]) {
        byBot[log.botName] = { count: 0, costCents: 0, actions: {} };
      }
      byBot[log.botName].count++;
      byBot[log.botName].costCents += log.costCents;
      byBot[log.botName].actions[log.action] = (byBot[log.botName].actions[log.action] || 0) + 1;
    }

    const totalCostCents = usageLogs.reduce((sum: number, l: any) => sum + l.costCents, 0);

    return {
      month: startOfMonth.toISOString().slice(0, 7),
      totalActions: usageLogs.length,
      totalCostCents,
      byBot,
      recentActivity: usageLogs.slice(0, 20),
    };
  }

  /**
   * Subscribe a user to a tier
   */
  async subscribe(userId: string, tier: BotTier) {
    // Deactivate existing
    await prisma.botSubscription.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    const enabledBots = TIER_BOTS[tier];
    const monthlyCostCents = TIER_COSTS[tier];

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    nextBillingDate.setDate(1);
    nextBillingDate.setHours(0, 0, 0, 0);

    return prisma.botSubscription.create({
      data: {
        userId,
        tier,
        isActive: true,
        enabledBots,
        monthlyCostCents,
        nextBillingDate,
      },
    });
  }

  /**
   * Update tier for existing subscription
   */
  async updateTier(userId: string, newTier: BotTier) {
    const subscription = await prisma.botSubscription.findFirst({
      where: { userId, isActive: true },
    });

    if (!subscription) {
      return this.subscribe(userId, newTier);
    }

    return prisma.botSubscription.update({
      where: { id: subscription.id },
      data: {
        tier: newTier,
        enabledBots: TIER_BOTS[newTier],
        monthlyCostCents: TIER_COSTS[newTier],
      },
    });
  }

  /**
   * Cancel subscription
   */
  async cancel(userId: string) {
    return prisma.botSubscription.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
  }

  /**
   * Get all subscriptions (founder view)
   */
  async getAllSubscriptions() {
    return prisma.botSubscription.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Toggle a subscription active/inactive (founder override)
   */
  async toggleSubscription(subscriptionId: string) {
    const sub = await prisma.botSubscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new Error("Subscription not found");

    return prisma.botSubscription.update({
      where: { id: subscriptionId },
      data: { isActive: !sub.isActive },
    });
  }

  /**
   * Get all bot profiles with status based on user's tier
   */
  async getBotProfiles(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isFounder = user?.role === "FOUNDER";

    const subscription = await prisma.botSubscription.findFirst({
      where: { userId, isActive: true },
    });
    const userTier = isFounder ? "FOUNDER" : (subscription?.tier || "STARTER");
    const tierIndex = TIER_HIERARCHY.indexOf(userTier as BotTier);

    return BOT_PROFILES.map(bot => {
      const botTierIndex = TIER_HIERARCHY.indexOf(bot.tier);
      const unlocked = isFounder || botTierIndex <= tierIndex;
      return {
        ...bot,
        unlocked,
        status: unlocked ? bot.status : "locked" as const,
        upgradeRequired: !unlocked ? bot.tier : null,
      };
    });
  }

  /**
   * Get a single bot profile by ID
   */
  getBotProfile(botId: string): BotProfile | undefined {
    return BOT_PROFILES.find(b => b.id === botId);
  }

  /**
   * Get tier info for display — includes full feature list per tier
   */
  getTierInfo() {
    return Object.entries(TIER_COSTS).map(([tier, costCents]) => ({
      tier,
      monthlyCostCents: costCents,
      monthlyPrice: costCents === 0 ? "Free" : `$${(costCents / 100).toFixed(0)}/mo`,
      bots: TIER_BOTS[tier as BotTier],
      featureCount: getFeaturesForTier(tier as BotTier).length,
      features: getFeaturesForTier(tier as BotTier),
      newFeatures: ALL_FEATURES.filter(f => f.tier === tier), // Features NEW at this tier
    }));
  }

  /**
   * Check if a user has access to a specific feature (by feature ID)
   */
  async hasFeature(userId: string, featureId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === "FOUNDER") return true; // Founder = everything

    const subscription = await prisma.botSubscription.findFirst({
      where: { userId, isActive: true },
    });
    if (!subscription) return false;
    if (subscription.tier === "FOUNDER") return true;

    const availableFeatures = getFeatureIdsForTier(subscription.tier);
    return availableFeatures.includes(featureId);
  }

  /**
   * Get full feature catalog with unlock status for a user
   */
  async getFeatureCatalog(userId: string) {
    const subscription = await prisma.botSubscription.findFirst({
      where: { userId, isActive: true },
    });
    const userTier = subscription?.tier || "STARTER";
    const unlockedIds = new Set(getFeatureIdsForTier(userTier as BotTier));

    return {
      currentTier: userTier,
      totalFeatures: ALL_FEATURES.length,
      unlockedCount: unlockedIds.size,
      lockedCount: ALL_FEATURES.length - unlockedIds.size,
      replacedServices: REPLACED_SERVICES,
      features: ALL_FEATURES.map(f => ({
        ...f,
        unlocked: unlockedIds.has(f.id),
        requiredTier: f.tier,
        upgradeRequired: !unlockedIds.has(f.id),
      })),
      byCategory: [...new Set(ALL_FEATURES.map(f => f.category))].map(cat => ({
        category: cat,
        total: ALL_FEATURES.filter(f => f.category === cat).length,
        unlocked: ALL_FEATURES.filter(f => f.category === cat && unlockedIds.has(f.id)).length,
      })),
    };
  }
}

export const botSubscriptionService = new BotSubscriptionService();
export default botSubscriptionService;
