// ============================================
// EMPLOYEE AI SERVICE — MGR CAPITAL ASSISTANCE
// Production-ready employee management and coaching
// ============================================

import { CaseStatus, EmployeeTier, CommunicationType } from "@prisma/client";
import prisma from "../lib/prisma.js";

// ============================================
// CALL SCRIPTS — Human, Simple, Compliant
// ============================================

interface CallScript {
  name: string;
  type: CommunicationType;
  caseStatus: CaseStatus;
  content: string;
  complianceNotes: string;
  prohibitedWords: string[];
  requiredPhrases: string[];
}

const CALL_SCRIPTS: CallScript[] = [
  // ----------------------------------------
  // INITIAL CONTACT SCRIPTS
  // ----------------------------------------
  {
    name: "Initial Contact - First Call",
    type: "CALL",
    caseStatus: "NEW",
    content: `Hey, is this [CLIENT NAME]?

[Wait for response]

My name is [YOUR NAME], I'm with MGR Capital Assistance.

I'm reaching out because your property at [PROPERTY ADDRESS] was recently sold by the county, and in some cases there's money left over that the owner can still claim.

I'm not here to sell you anything — I just help people understand what's available and handle the paperwork if they decide to move forward.

If you'd like, I can check your case and let you know what it looks like. There's no upfront cost.

[If interested]
Great! I just need to verify a few things to make sure I'm talking to the right person.

[If not interested]
No problem at all. If you change your mind or have any questions, you can always reach us. Have a great day!`,
    complianceNotes: "Never mention specific dollar amounts. Never use legal jargon. Keep it human and simple.",
    prohibitedWords: ["surplus", "overage", "excess proceeds", "guaranteed", "promise", "lawsuit", "attorney", "lawyer"],
    requiredPhrases: ["no upfront cost", "money left over"]
  },
  {
    name: "Initial Contact - Voicemail",
    type: "CALL",
    caseStatus: "NEW",
    content: `Hey [CLIENT NAME], this is [YOUR NAME] with MGR Capital Assistance.

I'm reaching out about your property at [PROPERTY ADDRESS] that was recently sold by the county.

There may be some money from that sale that you could still claim, and I'd like to help you look into it. There's no cost upfront.

Give me a call back when you get a chance at [YOUR PHONE NUMBER].

Again, this is [YOUR NAME] with MGR Capital Assistance. Thanks, and have a great day!`,
    complianceNotes: "Keep voicemails brief. Don't mention amounts. Leave callback number clearly.",
    prohibitedWords: ["surplus", "overage", "guaranteed", "thousands"],
    requiredPhrases: ["no cost upfront"]
  },

  // ----------------------------------------
  // FOLLOW-UP SCRIPTS
  // ----------------------------------------
  {
    name: "Follow-Up - Second Contact",
    type: "CALL",
    caseStatus: "CONTACTED",
    content: `Hey [CLIENT NAME], this is [YOUR NAME] from MGR Capital Assistance. We spoke [a few days ago / last week] about your property at [PROPERTY ADDRESS].

I wanted to follow up and see if you had any questions or if you'd like to move forward with looking into your case.

[If questions]
Of course, what would you like to know?

[If ready]
Great! The next step is really simple. I'll send you a link to our secure portal where you can review your information and sign a few documents. Once that's done, our team handles everything else.

[If not ready]
No problem. Take your time. I'll send you my contact info in case you want to reach out later.`,
    complianceNotes: "Be patient. Don't pressure. Answer questions simply without technical details.",
    prohibitedWords: ["hurry", "limited time", "running out", "legal", "court"],
    requiredPhrases: []
  },

  // ----------------------------------------
  // DOCUMENT FOLLOW-UP
  // ----------------------------------------
  {
    name: "Document Status - Awaiting Signature",
    type: "CALL",
    caseStatus: "DOCS_PENDING",
    content: `Hey [CLIENT NAME], this is [YOUR NAME] from MGR Capital Assistance.

I'm checking in because I see we sent you some documents to review and sign, and I wanted to make sure everything looked okay.

Did you have a chance to look them over?

[If no]
No problem. Would you like me to walk you through what they say? They're pretty straightforward.

[If yes but hesitant]
I totally understand if you have questions. What can I help clarify?

[If having technical issues]
Let me help you with that. Can you tell me what screen you're seeing?

[If completed]
Perfect! Thank you so much. Our team will take it from here. You'll get updates through your portal, and you can always reach out if you have questions.`,
    complianceNotes: "Help with portal issues. Don't pressure for signature. Be patient.",
    prohibitedWords: ["legal", "binding", "lawsuit"],
    requiredPhrases: []
  },

  // ----------------------------------------
  // STATUS UPDATE SCRIPTS
  // ----------------------------------------
  {
    name: "Status Update - Filed",
    type: "CALL",
    caseStatus: "FILED",
    content: `Hey [CLIENT NAME], this is [YOUR NAME] from MGR Capital Assistance.

I wanted to give you a quick update on your case. We've submitted everything to the county and now we're waiting for them to process it.

This part usually takes a bit of time — every county is different — but we're keeping an eye on it and will let you know as soon as there's any news.

Do you have any questions in the meantime?

[If questions about timeline]
I know it's hard to wait, but the county has its own process. We'll follow up with them if we don't hear back in a reasonable time.

[If no questions]
Great! We'll be in touch soon. Have a good one!`,
    complianceNotes: "Don't give specific timelines. Counties vary widely. Manage expectations.",
    prohibitedWords: ["guaranteed", "weeks", "days", "promise"],
    requiredPhrases: []
  },
  {
    name: "Status Update - Funds Approved",
    type: "CALL",
    caseStatus: "AWAITING_FUNDS",
    content: `Hey [CLIENT NAME], this is [YOUR NAME] from MGR Capital Assistance — and I have some good news!

The county has approved your case, and we're now waiting for them to send the funds. Once we receive them, we'll process everything and get your portion to you right away.

[If questions about amount]
I don't have the exact final number yet — that gets confirmed when the funds come through. But we'll send you a full breakdown once everything is processed.

[If questions about timeline]
It depends on the county, but we usually see funds within a few weeks after approval. We'll let you know as soon as we receive them.

Any other questions?

[Close]
Great! Congratulations, and we'll be in touch soon.`,
    complianceNotes: "Don't give specific amounts until funds received. Don't promise dates.",
    prohibitedWords: ["exact amount", "definitely", "guarantee"],
    requiredPhrases: ["good news"]
  }
];

// ============================================
// TEXT/SMS TEMPLATES
// ============================================

const TEXT_TEMPLATES: CallScript[] = [
  {
    name: "Initial Text - Introduction",
    type: "TEXT",
    caseStatus: "NEW",
    content: `Hi [CLIENT NAME], this is [YOUR NAME] from MGR Capital Assistance. I'm reaching out about your property at [PROPERTY ADDRESS] - there may be money from the county sale you can still claim. No upfront cost. Can I give you a quick call to explain?`,
    complianceNotes: "Keep under 160 characters if possible. Be clear who you are.",
    prohibitedWords: ["surplus", "overage", "thousands"],
    requiredPhrases: ["no upfront cost"]
  },
  {
    name: "Follow-Up Text",
    type: "TEXT",
    caseStatus: "CONTACTED",
    content: `Hi [CLIENT NAME], following up from MGR Capital Assistance about your property. Let me know if you have questions or want to move forward. - [YOUR NAME]`,
    complianceNotes: "Brief and friendly. Include your name.",
    prohibitedWords: [],
    requiredPhrases: []
  },
  {
    name: "Document Reminder Text",
    type: "TEXT",
    caseStatus: "DOCS_PENDING",
    content: `Hi [CLIENT NAME], just checking in - saw the documents are still waiting for your signature. Let me know if you need any help! - [YOUR NAME] @ MGR Capital`,
    complianceNotes: "Gentle reminder, not pushy.",
    prohibitedWords: ["urgent", "hurry", "deadline"],
    requiredPhrases: []
  },
  {
    name: "Portal Link Text",
    type: "TEXT",
    caseStatus: "CONTACTED",
    content: `Hi [CLIENT NAME], here's your secure portal link to review and sign documents: [PORTAL_LINK]. Let me know if you have questions! - [YOUR NAME]`,
    complianceNotes: "Portal links only, no document attachments via text.",
    prohibitedWords: [],
    requiredPhrases: ["secure portal"]
  }
];

// ============================================
// EMAIL TEMPLATES
// ============================================

const EMAIL_TEMPLATES: CallScript[] = [
  {
    name: "Welcome Email",
    type: "EMAIL",
    caseStatus: "CONTACTED",
    content: `Subject: Your Case with MGR Capital Assistance

Hi [CLIENT NAME],

Thank you for speaking with me today. I'm glad I could explain how we help people access money that may be available after a property sale.

Here's what happens next:

1. You'll receive a link to our secure client portal
2. Review your information and the documents
3. Sign electronically (just a few taps)
4. Our team handles everything else

There's no cost unless we're successful in helping you. If you have any questions, just reply to this email or call me directly.

Looking forward to working with you!

Best,
[YOUR NAME]
MGR Capital Assistance
[PHONE]`,
    complianceNotes: "Professional but warm. Clear next steps. No amounts.",
    prohibitedWords: ["surplus", "overage", "legal strategy"],
    requiredPhrases: ["no cost unless we're successful"]
  },
  {
    name: "Document Ready Email",
    type: "EMAIL",
    caseStatus: "DOCS_PENDING",
    content: `Subject: Your Documents Are Ready to Review

Hi [CLIENT NAME],

Your documents are ready for review and signature in your client portal.

To access them:
1. Click here: [PORTAL_LINK]
2. Review each document
3. Sign electronically

This should only take a few minutes. Once you've signed, our team will handle the rest.

Questions? Just reply to this email or give me a call.

Best,
[YOUR NAME]
MGR Capital Assistance`,
    complianceNotes: "Clear instructions. Make it easy.",
    prohibitedWords: [],
    requiredPhrases: []
  },
  {
    name: "Status Update Email - Filed",
    type: "EMAIL",
    caseStatus: "FILED",
    content: `Subject: Update: Your Case Has Been Filed

Hi [CLIENT NAME],

Good news — we've submitted your case to the county. Here's what happens now:

The county will review everything and process the claim. This can take some time (every county is different), but we're monitoring it and will update you as soon as we hear anything.

You can check your status anytime in your portal: [PORTAL_LINK]

Thanks for your patience, and feel free to reach out if you have questions.

Best,
[YOUR NAME]
MGR Capital Assistance`,
    complianceNotes: "Manage expectations. Don't promise timelines.",
    prohibitedWords: ["weeks", "days", "guarantee"],
    requiredPhrases: []
  }
];

// ============================================
// EMPLOYEE SERVICE CLASS
// ============================================

export class EmployeeService {
  // ----------------------------------------
  // SCRIPTS
  // ----------------------------------------

  /**
   * Get script for case status and communication type
   */
  getScript(caseStatus: CaseStatus, type: CommunicationType): CallScript | null {
    const allScripts = [...CALL_SCRIPTS, ...TEXT_TEMPLATES, ...EMAIL_TEMPLATES];
    return allScripts.find(s => s.caseStatus === caseStatus && s.type === type) || null;
  }

  /**
   * Get all scripts for a case status
   */
  getScriptsForStatus(caseStatus: CaseStatus): CallScript[] {
    const allScripts = [...CALL_SCRIPTS, ...TEXT_TEMPLATES, ...EMAIL_TEMPLATES];
    return allScripts.filter(s => s.caseStatus === caseStatus);
  }

  /**
   * Get all available scripts
   */
  getAllScripts(): CallScript[] {
    return [...CALL_SCRIPTS, ...TEXT_TEMPLATES, ...EMAIL_TEMPLATES];
  }

  /**
   * Personalize script with case data
   */
  personalizeScript(
    script: CallScript,
    variables: Record<string, string>
  ): string {
    let content = script.content;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `[${key}]`;
      content = content.split(placeholder).join(value);
    }

    return content;
  }

  // ----------------------------------------
  // COMPLIANCE
  // ----------------------------------------

  /**
   * Check if text contains prohibited words
   */
  checkCompliance(text: string, caseStatus: CaseStatus): {
    compliant: boolean;
    violations: string[];
    warnings: string[];
  } {
    const scripts = this.getScriptsForStatus(caseStatus);
    const prohibitedWords = [...new Set(scripts.flatMap(s => s.prohibitedWords))];

    const violations: string[] = [];
    const warnings: string[] = [];
    const lowerText = text.toLowerCase();

    for (const word of prohibitedWords) {
      if (lowerText.includes(word.toLowerCase())) {
        violations.push(`Prohibited word detected: "${word}"`);
      }
    }

    // Additional compliance checks
    const warningPatterns = [
      { pattern: /\$\d+/, message: "Avoid mentioning specific dollar amounts" },
      { pattern: /guarantee/i, message: "Never guarantee outcomes" },
      { pattern: /promise/i, message: "Avoid making promises" },
      { pattern: /attorney|lawyer|legal/i, message: "Avoid legal terminology" },
      { pattern: /\d+\s*(days?|weeks?)/i, message: "Avoid specific timelines" }
    ];

    for (const { pattern, message } of warningPatterns) {
      if (pattern.test(text)) {
        warnings.push(message);
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
      warnings
    };
  }

  // ----------------------------------------
  // COACHING & SCORING
  // ----------------------------------------

  /**
   * Score a call based on criteria
   */
  async scoreCall(
    employeeId: string,
    scores: {
      clarity: number;      // 1-10: How clear was the communication
      compliance: number;   // 1-10: Adherence to scripts and rules
      tone: number;         // 1-10: Friendly, human, professional
      effectiveness: number; // 1-10: Did it achieve the goal
    },
    feedback?: string,
    recordingUrl?: string
  ): Promise<void> {
    const { clarity, compliance, tone, effectiveness } = scores;
    const overall = Math.round((clarity + compliance + tone + effectiveness) / 4);

    await prisma.callScore.create({
      data: {
        employeeId,
        clarityScore: clarity,
        complianceScore: compliance,
        toneScore: tone,
        effectivenessScore: effectiveness,
        overallScore: overall,
        feedback,
        recordingUrl
      }
    });
  }

  /**
   * Get employee's average scores
   */
  async getEmployeeScores(employeeId: string): Promise<{
    averageClarity: number;
    averageCompliance: number;
    averageTone: number;
    averageEffectiveness: number;
    overallAverage: number;
    totalCalls: number;
  }> {
    const scores = await prisma.callScore.findMany({
      where: { employeeId }
    });

    if (scores.length === 0) {
      return {
        averageClarity: 0,
        averageCompliance: 0,
        averageTone: 0,
        averageEffectiveness: 0,
        overallAverage: 0,
        totalCalls: 0
      };
    }

    const sum = scores.reduce(
      (acc, s) => ({
        clarity: acc.clarity + s.clarityScore,
        compliance: acc.compliance + s.complianceScore,
        tone: acc.tone + s.toneScore,
        effectiveness: acc.effectiveness + s.effectivenessScore,
        overall: acc.overall + s.overallScore
      }),
      { clarity: 0, compliance: 0, tone: 0, effectiveness: 0, overall: 0 }
    );

    const count = scores.length;

    return {
      averageClarity: Math.round((sum.clarity / count) * 10) / 10,
      averageCompliance: Math.round((sum.compliance / count) * 10) / 10,
      averageTone: Math.round((sum.tone / count) * 10) / 10,
      averageEffectiveness: Math.round((sum.effectiveness / count) * 10) / 10,
      overallAverage: Math.round((sum.overall / count) * 10) / 10,
      totalCalls: count
    };
  }

  /**
   * Generate coaching feedback based on scores
   */
  generateCoachingFeedback(scores: {
    clarity: number;
    compliance: number;
    tone: number;
    effectiveness: number;
  }): string[] {
    const feedback: string[] = [];

    if (scores.clarity < 7) {
      feedback.push("Work on speaking more clearly and explaining things in simpler terms.");
      feedback.push("Practice the scripts out loud to get more comfortable with the flow.");
    }

    if (scores.compliance < 7) {
      feedback.push("Review the compliance guidelines and prohibited words list.");
      feedback.push("Stick closer to the approved scripts, especially for sensitive topics.");
    }

    if (scores.tone < 7) {
      feedback.push("Focus on being more conversational and less scripted-sounding.");
      feedback.push("Remember: you're helping people, not selling to them.");
    }

    if (scores.effectiveness < 7) {
      feedback.push("Work on moving conversations toward clear next steps.");
      feedback.push("Ask more questions to understand client concerns.");
    }

    if (feedback.length === 0) {
      feedback.push("Great job! Keep up the excellent work.");
    }

    return feedback;
  }

  // ----------------------------------------
  // NEXT ACTIONS
  // ----------------------------------------

  /**
   * Get suggested next action for a case (employee-safe)
   */
  getSuggestedAction(caseStatus: CaseStatus): {
    action: string;
    script: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  } {
    const actions: Record<CaseStatus, { action: string; script: string; priority: "HIGH" | "MEDIUM" | "LOW" }> = {
      NEW: {
        action: "Make initial contact call",
        script: "Initial Contact - First Call",
        priority: "HIGH"
      },
      CONTACTED: {
        action: "Follow up and send portal link",
        script: "Follow-Up - Second Contact",
        priority: "MEDIUM"
      },
      DOCS_PENDING: {
        action: "Check on document signatures",
        script: "Document Status - Awaiting Signature",
        priority: "MEDIUM"
      },
      DOCS_SIGNED: {
        action: "No action needed - processing internally",
        script: "",
        priority: "LOW"
      },
      FILED: {
        action: "Update client on status",
        script: "Status Update - Filed",
        priority: "LOW"
      },
      AWAITING_FUNDS: {
        action: "Share good news with client",
        script: "Status Update - Funds Approved",
        priority: "MEDIUM"
      },
      PAID: {
        action: "Case complete - no action needed",
        script: "",
        priority: "LOW"
      },
      CLOSED: {
        action: "Case closed",
        script: "",
        priority: "LOW"
      },
      REJECTED: {
        action: "Escalate to supervisor",
        script: "",
        priority: "HIGH"
      }
    };

    return actions[caseStatus] || {
      action: "Contact supervisor for guidance",
      script: "",
      priority: "MEDIUM"
    };
  }

  // ----------------------------------------
  // EMPLOYEE STATS (DISPLAYED VALUES)
  // ----------------------------------------

  /**
   * Get employee dashboard data (uses DISPLAYED rates, not actual)
   */
  async getEmployeeDashboard(employeeId: string): Promise<{
    name: string;
    tier: string;
    displayedRate: string;
    casesAssigned: number;
    casesThisMonth: number;
    displayedEarningsThisMonth: string;
    displayedLifetimeEarnings: string;
  }> {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      include: {
        assignedCases: true,
        ledgerEntries: true
      }
    });

    if (!employee || employee.role !== "EMPLOYEE") {
      throw new Error("Employee not found");
    }

    // Get commission plan for displayed rate
    const plan = employee.employeeTier
      ? await prisma.commissionPlan.findUnique({
          where: { tier: employee.employeeTier }
        })
      : null;

    // Calculate displayed earnings (what employee sees)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthEntries = employee.ledgerEntries.filter(
      e => e.type === "COMMISSION" && e.createdAt >= startOfMonth
    );

    // IMPORTANT: Use displayedRate from ledger, not actualRate
    const displayedMonthEarnings = monthEntries.reduce((sum, e) => {
      // Calculate what employee SEES (not actual)
      const displayedAmount = e.displayedRate
        ? Math.round((e.amountCents * e.displayedRate) / (e.actualRate || 1))
        : e.amountCents;
      return sum + displayedAmount;
    }, 0);

    const allCommissions = employee.ledgerEntries.filter(e => e.type === "COMMISSION");
    const displayedLifetime = allCommissions.reduce((sum, e) => {
      const displayedAmount = e.displayedRate
        ? Math.round((e.amountCents * e.displayedRate) / (e.actualRate || 1))
        : e.amountCents;
      return sum + displayedAmount;
    }, 0);

    // Count cases this month
    const casesThisMonth = employee.assignedCases.filter(
      c => c.createdAt >= startOfMonth
    ).length;

    return {
      name: employee.name,
      tier: plan?.tierDisplayName || "Tier 1 — Associate",
      displayedRate: `${plan?.displayedRatePercent || 20}%`,
      casesAssigned: employee.assignedCases.length,
      casesThisMonth,
      displayedEarningsThisMonth: `$${(displayedMonthEarnings / 100).toLocaleString()}`,
      displayedLifetimeEarnings: `$${(displayedLifetime / 100).toLocaleString()}`
    };
  }
}

export const employeeService = new EmployeeService();
