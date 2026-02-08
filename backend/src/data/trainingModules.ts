// ============================================
// COMPREHENSIVE TRAINING MODULES — MGR CAPITAL
// Real professional content for all tiers & roles
// Respects role-based visibility (shadow accounting protected)
// ============================================

import { EmployeeTier, UserRole } from "@prisma/client";

export interface TrainingModuleData {
  id: string;
  title: string;
  description: string;
  content: string;
  orderIndex: number;
  durationMinutes: number;
  requiredForTier: EmployeeTier | null;
  requiredForRole: UserRole | null;
  prerequisites: string[];
  hasQuiz: boolean;
  passingScore: number | null;
  isCertification: boolean;
  targetAudience: ("EMPLOYEE" | "ADMIN" | "FOUNDER" | "CHILD_COMPANY" | "HR" | "COMPLIANCE")[];
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
}

// ============================================
// TIER 1 — ASSOCIATE TRAINING (New Hires)
// ============================================

export const TIER_1_MODULES: TrainingModuleData[] = [
  {
    id: "mod-t1-001",
    title: "Welcome to Asset Recovery Services",
    description: "Industry overview, our mission, and how we help families recover what's rightfully theirs.",
    orderIndex: 1,
    durationMinutes: 20,
    requiredForTier: "TIER_1_ASSOCIATE",
    requiredForRole: null,
    prerequisites: [],
    hasQuiz: true,
    passingScore: 80,
    isCertification: false,
    targetAudience: ["EMPLOYEE"],
    content: `
# Welcome to Asset Recovery Services

## Our Mission

We help families and individuals recover funds they didn't know existed. When properties are sold at tax sales or foreclosure auctions, there's often money left over — and that money belongs to the former property owner.

**Our role:** Find these people, explain their rights, and handle the complex paperwork so they can focus on their lives.

## How the Industry Works

### The Surplus Fund Process

1. **Property Tax Sale or Foreclosure**
   - Property owners who fall behind on taxes or mortgage payments may have their property sold
   - The sale generates proceeds to pay off the debt

2. **Excess Proceeds (Surplus)**
   - Often, the sale generates MORE money than what was owed
   - This "extra" money legally belongs to the former owner

3. **The Problem**
   - Most people don't know this money exists
   - The claiming process is complicated
   - There are strict deadlines (varies by state)

4. **Our Solution**
   - We locate rightful claimants
   - Handle all documentation and filing
   - Only charge a fee if successful

## Legal & Ethical Framework

### We Are NOT:
- Attorneys (unless specifically licensed)
- Government employees
- Debt collectors
- Scam artists preying on vulnerable people

### We ARE:
- Professional asset recovery specialists
- Licensed where required by state
- Transparent about our services and fees
- Committed to ethical practices

## State-Specific Knowledge

Different states have different rules:

| State | Surplus Claim Deadline | Special Requirements |
|-------|------------------------|---------------------|
| California | 3 years (foreclosure) | Court petition required |
| Texas | 2 years (tax sale) | No phone solicitation for assignments |
| Florida | 120 days (tax deed) | PI license + attorney required |
| Georgia | 5 years | No third-party applications in many counties |
| Tennessee | Varies by county | Court petition may be required |

**Your job:** Know which state you're working in and follow its rules exactly.

## Professional Standards

### Communication Guidelines
- Always identify yourself and your company
- Never guarantee outcomes
- Never discuss specific dollar amounts
- Be patient with confused or upset clients
- Document everything

### Compliance Requirements
- Follow all TCPA calling time restrictions (8am-9pm local)
- Honor Do Not Call requests immediately
- Never use high-pressure tactics
- Always provide accurate, truthful information

## Your First 30 Days

### Week 1: Learning
- Complete all required training modules
- Shadow experienced team members
- Study state-specific requirements

### Week 2: Guided Practice
- Make calls with supervisor monitoring
- Practice documentation
- Handle simple client questions

### Week 3-4: Increasing Independence
- Manage your own case queue
- Regular check-ins with team lead
- Continue learning through experience

## Next Steps

Complete the quiz below, then proceed to "Client Communication Fundamentals."
    `,
    questions: [
      {
        question: "What happens when a property sells for more than what was owed?",
        options: [
          "The government keeps all the money",
          "The excess may belong to the former property owner",
          "The new buyer gets a refund",
          "The money is destroyed"
        ],
        correctAnswer: 1,
        explanation: "When a property sells for more than the debt owed, the surplus legally belongs to the former owner — and that's what we help people claim."
      },
      {
        question: "What is the surplus claim deadline in Texas for tax sales?",
        options: [
          "1 year",
          "2 years",
          "5 years",
          "No deadline"
        ],
        correctAnswer: 1,
        explanation: "Texas has a 2-year deadline from the sale date to file a petition for tax sale excess proceeds."
      },
      {
        question: "Which of the following describes what we do?",
        options: [
          "Collect debts from property owners",
          "Help people recover surplus funds from property sales",
          "Sell properties at auction",
          "Provide legal advice"
        ],
        correctAnswer: 1,
        explanation: "We help people recover surplus funds that may be owed to them after property sales."
      },
      {
        question: "What should you do if a client asks to be removed from your call list?",
        options: [
          "Call them again in a week",
          "Transfer to a supervisor to convince them",
          "Honor the request immediately",
          "Ignore and continue calling"
        ],
        correctAnswer: 2,
        explanation: "Always honor Do Not Call requests immediately. It's both a legal requirement and the right thing to do."
      }
    ]
  },

  {
    id: "mod-t1-002",
    title: "Client Communication Fundamentals",
    description: "How to speak with clients professionally, handle objections, and build trust.",
    orderIndex: 2,
    durationMinutes: 30,
    requiredForTier: "TIER_1_ASSOCIATE",
    requiredForRole: null,
    prerequisites: ["mod-t1-001"],
    hasQuiz: true,
    passingScore: 80,
    isCertification: false,
    targetAudience: ["EMPLOYEE"],
    content: `
# Client Communication Fundamentals

## The Human Element

Remember: You're often calling people during difficult times. They may have lost a home, dealt with a death in the family, or faced financial hardship. Lead with empathy.

## The Professional Introduction

### Your Opening

> "Hi, is this [Name]? This is [Your Name] with [Company Name]. I'm calling because we found records showing there may be unclaimed funds from a property sale at [address]. Is this a good time to talk for a moment?"

### Why This Works

1. **You ask permission** - "Is this a good time?" shows respect
2. **You're specific** - Mentioning the address proves this isn't random
3. **You're honest** - "may be unclaimed funds" doesn't promise anything
4. **You're brief** - Gets to the point without wasting time

## Active Listening

### The 80/20 Rule
- Listen 80% of the time
- Talk 20% of the time

### Listening Techniques
- Let them finish speaking before responding
- Ask clarifying questions
- Reflect back what you heard: "So you're saying..."
- Take notes on key points

## Building Trust

### Trust Builders
- Be consistent in what you say
- Follow through on promises
- Be honest about uncertainties
- Acknowledge their concerns

### Trust Breakers
- Overpromising
- Rushing them
- Being vague or evasive
- Talking over them

## Handling Common Objections

### "How did you get my information?"

> "Property sales are public record. We research these records to find people who may be owed money and reach out to help."

### "This sounds like a scam."

> "I completely understand the concern. Here's what I'd suggest: Look up our company online, check with the county clerk's office to verify the sale happened, and take your time. We don't charge anything upfront — you only pay us if we're successful in recovering funds for you."

### "I need to think about it."

> "Absolutely — take all the time you need. Would it be helpful if I sent some information to your email? That way you can review it when it's convenient."

### "How much money is there?"

> "The amount depends on what the county has on file. I can look into the specifics, but I want to be upfront that I can't give you exact numbers until we research your case further."

### "Why should I use you instead of doing it myself?"

> "You absolutely can do it yourself — it's your right. The process involves gathering documentation, filing petitions, and sometimes court appearances. Many people choose to work with us because we handle all that paperwork and know the process, but it's completely up to you."

## Tone & Delivery

### Do's
- Speak clearly and at a moderate pace
- Smile (it comes through in your voice)
- Sound natural, not scripted
- Match their energy level

### Don'ts
- Sound rushed or impatient
- Use a fake or overly enthusiastic tone
- Mumble or speak too quietly
- Read directly from a script

## Difficult Conversations

### Upset Clients
- Let them vent without interrupting
- Acknowledge their feelings: "I understand this is frustrating"
- Offer solutions or next steps
- Stay calm even if they don't

### Confused Clients
- Slow down
- Use simpler terms
- Offer to explain again
- Check for understanding: "Does that make sense?"

### Grieving Families
- Be extra patient and gentle
- Acknowledge the situation: "I'm sorry for your loss"
- Offer to call back another time
- Handle heir matters sensitively

## Documentation

After every call, document:
1. Date and time
2. Who you spoke with
3. Key points discussed
4. Any commitments made
5. Next steps required
6. Overall disposition (interested, not interested, call back, etc.)

Good notes make good cases.

## Quiz Time

Complete the quiz to continue.
    `,
    questions: [
      {
        question: "How much of the time should you be listening versus talking?",
        options: [
          "50% listening, 50% talking",
          "80% listening, 20% talking",
          "20% listening, 80% talking",
          "Listen only when asked questions"
        ],
        correctAnswer: 1,
        explanation: "The 80/20 rule: Listen 80% of the time and talk 20%. This builds trust and shows you care about their situation."
      },
      {
        question: "A client says 'This sounds like a scam.' What's the best response?",
        options: [
          "Hang up immediately",
          "Get defensive and argue",
          "Acknowledge their concern and suggest ways they can verify",
          "Promise them a specific amount of money to prove it's real"
        ],
        correctAnswer: 2,
        explanation: "Acknowledge their concern, suggest they verify (company lookup, county records), and remind them there's no upfront cost."
      },
      {
        question: "When a client asks how much money is involved, you should:",
        options: [
          "Give them an exact figure from your system",
          "Estimate based on similar cases",
          "Explain you can't give exact numbers without more research",
          "Refuse to discuss money at all"
        ],
        correctAnswer: 2,
        explanation: "Be honest that amounts depend on county records and require research. Never quote specific numbers."
      },
      {
        question: "What should you do after every client call?",
        options: [
          "Immediately call the next person",
          "Take a 15-minute break",
          "Document the call with key details and next steps",
          "Email your supervisor"
        ],
        correctAnswer: 2,
        explanation: "Document every call with date, who you spoke to, key points, and next steps. Good notes make good cases."
      }
    ]
  },

  {
    id: "mod-t1-003",
    title: "Compliance Essentials",
    description: "Legal requirements, prohibited practices, and how to stay compliant in every interaction.",
    orderIndex: 3,
    durationMinutes: 45,
    requiredForTier: "TIER_1_ASSOCIATE",
    requiredForRole: null,
    prerequisites: ["mod-t1-002"],
    hasQuiz: true,
    passingScore: 90,
    isCertification: true,
    targetAudience: ["EMPLOYEE"],
    content: `
# Compliance Essentials

**⚠️ THIS IS CRITICAL TRAINING**

This module requires 90% to pass. Compliance violations can result in fines, legal action, and termination.

## Why Compliance Matters

1. **Protects Clients** - People deserve truthful, accurate information
2. **Protects the Company** - Violations can result in lawsuits and penalties
3. **Protects You** - Following rules keeps you employed and out of legal trouble
4. **Builds Trust** - Ethical practices build a sustainable business

## TCPA — Telephone Consumer Protection Act

### Calling Time Restrictions
- **Allowed:** 8:00 AM to 9:00 PM (client's local time)
- **Never:** Before 8 AM or after 9 PM
- **Check:** What time zone is the client in?

### Do Not Call Compliance
- Honor all DNC requests immediately
- Document when someone asks to be removed
- Never call them again
- Scrub lists against the National DNC Registry

### Caller ID Requirements
- Always display accurate caller ID
- Never spoof or hide your number
- Number must be callable for callback

### Consent
- For autodialed/prerecorded calls: Prior express consent required
- Manual dialing: More flexibility, but still respect preferences

### Penalties
- $500 per violation (minimum)
- $1,500 per willful violation
- Class action lawsuits possible

## FDCPA — Fair Debt Collection Practices Act

Even though we're not debt collectors, some principles apply:

### Prohibited Practices
- No harassment, threats, or abusive language
- No false or misleading representations
- No unfair or unconscionable practices

### Communication Standards
- Identify yourself clearly
- State the purpose of the call
- Be truthful about everything

## State-Specific Regulations

### Texas
- **Critical:** Cannot solicit assignments via phone or in-person
- Assignments must be in writing
- Assignee must pay 80% of claim value
- Maximum 125% return on investment

### Florida
- Surplus trustees need PI license + attorney
- Minimum 12 months experience required
- $500,000 insurance/bond requirement

### California
- "Personal knowledge" ID verification not allowed
- Court petition required for foreclosure surplus
- 3-year deadline from foreclosure sale

### Georgia
- Many counties won't accept third-party applications
- Power of Attorney typically not recognized
- Must work through licensed Georgia attorney

## Prohibited Statements

### Never Say:

❌ "You're guaranteed to get money"
❌ "You'll receive at least $X"
❌ "You need to act now or you'll lose it"
❌ "Our lawyers will sue the county"
❌ "This is a limited time offer"
❌ "Everyone else has already signed up"
❌ "You have no other options"

### Always Say:

✅ "There may be funds available"
✅ "Amounts depend on what the county has"
✅ "Take your time to decide"
✅ "You can verify this independently"
✅ "There's no obligation"
✅ "You can do this yourself if you prefer"

## Recording & Documentation

### Call Recording Consent
- One-party consent states: Only you need to know
- Two-party consent states: Must inform the client
- When in doubt: "This call may be recorded for quality purposes"

### Two-Party Consent States
California, Connecticut, Florida, Illinois, Maryland, Massachusetts, Michigan, Montana, Nevada, New Hampshire, Pennsylvania, Washington

### Documentation Requirements
- Keep records of all communications
- Note dates, times, and content
- Preserve for required retention periods
- Never alter or destroy records inappropriately

## Recognizing Red Flags

### In Your Own Behavior
- Feeling pressure to "close" at any cost
- Tempted to exaggerate or stretch the truth
- Rushing clients who need time
- Skipping documentation steps

### In Client Situations
- Elder abuse concerns
- Exploitation by family members
- Mental capacity concerns
- Signs of distress or confusion

**If something feels wrong, stop and escalate to your supervisor.**

## Consequences of Violations

### For the Company
- Regulatory fines ($500-$50,000+ per violation)
- Lawsuits and legal fees
- License revocation
- Reputation damage

### For You
- Immediate termination
- Personal legal liability possible
- Industry blacklisting
- Criminal charges in severe cases

## Daily Compliance Checklist

Before each call:
□ Verified calling time is 8 AM - 9 PM client's time
□ Checked DNC list
□ Prepared compliant script
□ Ready to document the call

During the call:
□ Identified myself and company
□ No guarantees or specific amounts
□ No pressure or urgency
□ Gave truthful information only

After the call:
□ Documented accurately
□ Noted any concerns
□ Updated case status
□ Escalated issues if needed

## Quiz

This quiz requires 90% to pass. Take your time.
    `,
    questions: [
      {
        question: "What are the allowed calling hours under TCPA?",
        options: [
          "7 AM to 10 PM",
          "8 AM to 9 PM client's local time",
          "9 AM to 8 PM",
          "Any time during business days"
        ],
        correctAnswer: 1,
        explanation: "TCPA allows calls between 8:00 AM and 9:00 PM in the client's local time zone."
      },
      {
        question: "In Texas, how can you solicit assignments for surplus claims?",
        options: [
          "Phone calls only",
          "In-person visits only",
          "Written solicitation only (not phone or in-person)",
          "Any method you prefer"
        ],
        correctAnswer: 2,
        explanation: "Texas law prohibits soliciting assignments via phone or in-person. Assignments must come through written contact."
      },
      {
        question: "Which statement is COMPLIANT?",
        options: [
          "You're guaranteed at least $5,000",
          "You need to sign today or lose this opportunity",
          "There may be funds available from your property sale",
          "Everyone in your neighborhood has already signed up"
        ],
        correctAnswer: 2,
        explanation: "'There may be funds available' is compliant because it's truthful and makes no guarantees."
      },
      {
        question: "Which states require two-party consent for call recording?",
        options: [
          "Texas, Georgia, Tennessee",
          "California, Florida, Illinois",
          "New York, New Jersey, Ohio",
          "All states require two-party consent"
        ],
        correctAnswer: 1,
        explanation: "California, Florida, and Illinois (among others) require two-party consent for recording calls."
      },
      {
        question: "What should you do if you suspect elder abuse or exploitation?",
        options: [
          "Continue the call normally",
          "Try to close the deal faster",
          "Stop and escalate to your supervisor",
          "Ignore it - not your business"
        ],
        correctAnswer: 2,
        explanation: "If you suspect abuse, exploitation, or any red flags, stop and escalate to your supervisor immediately."
      }
    ]
  },

  {
    id: "mod-t1-004",
    title: "Using the Case Management System",
    description: "Navigate your dashboard, manage cases, update statuses, and track your progress.",
    orderIndex: 4,
    durationMinutes: 25,
    requiredForTier: "TIER_1_ASSOCIATE",
    requiredForRole: null,
    prerequisites: ["mod-t1-003"],
    hasQuiz: true,
    passingScore: 80,
    isCertification: false,
    targetAudience: ["EMPLOYEE"],
    content: `
# Using the Case Management System

## Your Dashboard

When you log in, you'll see your personalized dashboard with:

### Key Metrics
- **Your Tier** - Current level and progress to next
- **Commission Rate** - Your current earning percentage
- **Active Cases** - How many you're working
- **Conversion Rate** - Percentage of cases that result in success

### Case Queue
- Cases assigned to you
- Sorted by priority/status
- Quick actions available

### Training Progress
- Modules completed
- Required modules remaining
- Quiz scores

## Case Statuses Explained

Understanding case flow is critical:

### NEW
- Fresh lead, no contact yet
- **Your action:** Make initial outreach
- **Goal:** Connect with the client

### CONTACTED
- You've reached the client
- **Your action:** Explain the opportunity
- **Goal:** Get them interested

### INTERESTED
- Client wants to proceed
- **Your action:** Send document portal link
- **Goal:** Get documents signed

### DOCS_PENDING
- Waiting for client signatures
- **Your action:** Follow up if needed
- **Goal:** Get documents completed

### DOCS_SIGNED
- All documents received
- **Your action:** Monitor, answer questions
- **Processing team takes over**

### FILED
- Claim submitted to county/court
- **Your action:** Keep client informed
- **Waiting for processing**

### AWAITING_FUNDS
- Claim approved, waiting for payment
- **Your action:** Update client on timeline
- **Almost done!**

### PAID
- Funds received and distributed
- **Case complete!**
- **Commission earned**

### REJECTED / DEAD
- Case couldn't proceed
- Various reasons (no surplus, missed deadline, client withdrew)

## Working Your Cases

### Daily Workflow

**Morning:**
1. Check for new cases assigned
2. Review pending follow-ups
3. Prioritize by urgency/opportunity

**Throughout the Day:**
4. Make outreach calls
5. Update case notes after each interaction
6. Move cases through statuses as appropriate

**End of Day:**
7. Ensure all calls are documented
8. Set follow-up reminders
9. Update any pending items

### Adding Notes

Every interaction needs a note:
- Click on the case
- Select "Add Note"
- Include: Date, what happened, next steps
- Be specific and factual

**Good Note:**
> "2/8 - Spoke with John. Explained opportunity. He's interested but wants to discuss with wife. Will call back Friday. Sending info packet via email."

**Bad Note:**
> "Called. Said maybe."

### Updating Status

Move cases forward as they progress:
1. Click on the case
2. Select new status
3. Add note explaining the change
4. System automatically timestamps

## Your Earnings

### Commission Display
- See your rate for each case
- Track earnings by month
- View payment history

### How You Earn
- Percentage of successful recoveries
- Rate increases with tier advancement
- Paid after client receives funds

### Tracking Progress
- Monitor conversion rates
- See tier requirements
- Track toward promotion

## Scripts & Resources

### Available Scripts
- Initial call script
- Voicemail script
- Follow-up script
- Objection handlers
- Email templates
- SMS templates

### How to Use
1. Open "Scripts" from your dashboard
2. Select the appropriate script
3. Personalize with client details
4. Practice until natural

## Getting Help

### Technical Issues
- Use the support ticket system
- Describe the problem clearly
- Include screenshots if possible

### Case Questions
- Ask your team lead
- Check the knowledge base
- Use team chat for quick questions

### Compliance Concerns
- Escalate immediately to supervisor
- Document everything
- Don't proceed if uncertain

## Quiz

Test your knowledge of the system.
    `,
    questions: [
      {
        question: "What status should a case be in when the client has signed all documents?",
        options: [
          "CONTACTED",
          "INTERESTED",
          "DOCS_SIGNED",
          "FILED"
        ],
        correctAnswer: 2,
        explanation: "DOCS_SIGNED means all documents have been completed. The processing team then takes over."
      },
      {
        question: "What should every case note include?",
        options: [
          "Just the outcome",
          "Date, what happened, and next steps",
          "Only positive information",
          "Your opinion of the client"
        ],
        correctAnswer: 1,
        explanation: "Every note should include the date, what happened during the interaction, and clear next steps."
      },
      {
        question: "When do you earn commission on a case?",
        options: [
          "When the client signs",
          "When the claim is filed",
          "When the client receives their funds",
          "When you make first contact"
        ],
        correctAnswer: 2,
        explanation: "Commission is earned after the client receives their funds — success-based compensation."
      },
      {
        question: "What's the first thing you should do each morning?",
        options: [
          "Check social media",
          "Check for new cases and pending follow-ups",
          "Update your profile",
          "Complete training modules"
        ],
        correctAnswer: 1,
        explanation: "Start each day by reviewing your cases — check for new assignments and prioritize follow-ups."
      }
    ]
  },

  {
    id: "mod-t1-005",
    title: "Document Fundamentals",
    description: "Understanding the documents clients sign, proper handling, and verification basics.",
    orderIndex: 5,
    durationMinutes: 35,
    requiredForTier: "TIER_1_ASSOCIATE",
    requiredForRole: null,
    prerequisites: ["mod-t1-004"],
    hasQuiz: true,
    passingScore: 85,
    isCertification: false,
    targetAudience: ["EMPLOYEE"],
    content: `
# Document Fundamentals

## Why Documents Matter

Proper documentation is the foundation of every successful case. Without correct, signed documents, claims cannot proceed.

## Core Documents

### 1. Service Agreement
**What it is:** The contract between us and the client

**Key elements:**
- Client's name and contact information
- Property address/description
- Our services described
- Fee structure (percentage of recovery)
- Timeline expectations
- Cancellation rights

**Important:** Clients must understand and agree to terms BEFORE signing.

### 2. Authorization to Act
**What it is:** Gives us permission to act on client's behalf

**Allows us to:**
- Research their claim
- Communicate with government agencies
- Access relevant records
- File necessary petitions

### 3. Affidavit of Identity
**What it is:** Sworn statement confirming who the client is

**Required information:**
- Full legal name
- Date of birth
- Current address
- Relationship to property
- Signature (often notarized)

### 4. Heir Affidavit (when applicable)
**What it is:** For cases involving deceased property owners

**Establishes:**
- Relationship to deceased
- Right to inherit
- Other potential heirs
- Often requires notarization

## The Client Portal

### How It Works
1. We send a secure link to the client
2. Client creates account or logs in
3. Documents are presented for review
4. Client signs electronically
5. Signed documents stored securely

### What Clients See
- Clear explanation of each document
- Ability to review before signing
- Progress tracker
- Contact information for questions

### Your Role
- Send the portal link
- Explain how to use it
- Answer questions about documents
- Follow up if signatures stall

## Identity Verification

### Why It Matters
- Prevents fraud
- Ensures right person claims funds
- Required by law in many cases

### Acceptable ID Documents
- State driver's license
- State ID card
- US passport
- Military ID

### Not Acceptable
- Social Security card alone
- Birth certificate alone
- Credit cards
- Utility bills

### Verification Process
1. Client provides ID copy
2. Compare name to property records
3. Verify address matches
4. Check for inconsistencies
5. Escalate concerns immediately

## Notarization Requirements

### What Notarization Does
- Third-party verification of identity
- Confirms documents signed willingly
- Creates official record

### When Required
- Affidavits (in most states)
- Certain court filings
- Heir documentation
- State-specific requirements

### Remote Online Notarization (RON)
- Client connects via video call
- Notary verifies identity
- Documents signed electronically
- Notary applies digital seal

### Our Notary Services
- Integrated into client portal
- Available for most states
- Convenient for clients

## Document Handling Best Practices

### Security
- Never share client documents inappropriately
- Use only secure systems
- Don't store documents locally
- Log out when stepping away

### Accuracy
- Verify all information matches
- Check for complete signatures
- Ensure dates are correct
- Confirm notarization where required

### Organization
- Documents attached to correct case
- Named clearly
- Status updated promptly
- Nothing left pending without reason

## Common Issues

### Missing Information
- Client left fields blank
- Signature missing
- Date incorrect
- **Solution:** Request correction, don't guess

### Mismatched Names
- Document says "John Smith" but ID says "John A. Smith"
- **Solution:** Must match exactly. Have client correct.

### Expired ID
- Client's license is expired
- **Solution:** Need current valid ID

### Reluctant Clients
- Don't want to provide ID
- **Solution:** Explain it's required and protects them

## Quiz

Test your document knowledge.
    `,
    questions: [
      {
        question: "What document gives us permission to act on the client's behalf?",
        options: [
          "Service Agreement",
          "Authorization to Act",
          "Affidavit of Identity",
          "Power of Attorney"
        ],
        correctAnswer: 1,
        explanation: "The Authorization to Act specifically grants permission to research claims, communicate with agencies, and file petitions."
      },
      {
        question: "Which of these is an acceptable form of ID?",
        options: [
          "Social Security card",
          "Birth certificate",
          "State driver's license",
          "Utility bill"
        ],
        correctAnswer: 2,
        explanation: "A state driver's license (current and valid) is an acceptable form of government-issued photo ID."
      },
      {
        question: "What should you do if a client's document name doesn't exactly match their ID?",
        options: [
          "Accept it anyway",
          "Change the document yourself",
          "Have the client correct the document",
          "Ignore the discrepancy"
        ],
        correctAnswer: 2,
        explanation: "Names must match exactly. Have the client make the correction — never alter documents yourself."
      },
      {
        question: "Why is notarization required for some documents?",
        options: [
          "To make them look official",
          "Third-party verification of identity and willingness",
          "It's just company policy",
          "To slow down the process"
        ],
        correctAnswer: 1,
        explanation: "Notarization provides independent verification that the person is who they claim and signed willingly."
      }
    ]
  }
];

// ============================================
// TIER 2 — SPECIALIST TRAINING
// ============================================

export const TIER_2_MODULES: TrainingModuleData[] = [
  {
    id: "mod-t2-001",
    title: "Advanced Client Communication",
    description: "Handling complex situations, difficult conversations, and building long-term relationships.",
    orderIndex: 10,
    durationMinutes: 40,
    requiredForTier: "TIER_2_SPECIALIST",
    requiredForRole: null,
    prerequisites: ["mod-t1-005"],
    hasQuiz: true,
    passingScore: 85,
    isCertification: false,
    targetAudience: ["EMPLOYEE"],
    content: `
# Advanced Client Communication

## Moving Beyond Basics

As a Tier 2 Specialist, you've mastered the fundamentals. Now we build on that foundation with advanced techniques.

## Complex Client Situations

### Multiple Heirs

When property belonged to someone deceased with multiple heirs:

**Challenges:**
- Need all heirs to agree (usually)
- Family disputes may exist
- Contact information may be limited
- Legal relationships need verification

**Your approach:**
1. Identify the "lead" heir — the one coordinating
2. Explain what's needed from each party
3. Be patient — family dynamics are complex
4. Document all heir interactions separately
5. Escalate disputes to supervisor

### Corporate/Business Owners

Properties owned by LLCs, corporations, or partnerships:

**Challenges:**
- Need authorized signer
- Operating agreements may restrict
- Business may be dissolved
- Multiple owners possible

**Your approach:**
1. Identify who can sign for the entity
2. Request documentation of authority
3. Verify entity is in good standing
4. May need registered agent contact

### Deceased Owner, No Will

Intestate succession cases:

**Challenges:**
- State law determines heirs
- May need probate
- Multiple potential claimants
- More documentation required

**Your approach:**
1. Explain the situation honestly
2. May need death certificate
3. May need probate documents
4. Often requires attorney involvement
5. Be patient — these take longer

## Difficult Conversations

### Delivering Bad News

Sometimes claims don't work out:
- No actual surplus existed
- Deadline has passed
- Prior liens consume all funds
- Another party has valid claim

**How to handle:**
> "I have some disappointing news. After researching your case, [explain situation]. I know this isn't what you hoped to hear. I'm sorry we couldn't help in this case."

### Managing Expectations

If a case is taking longer than expected:
> "I want to give you an update. These processes sometimes move slowly because [explain reason]. Based on what we're seeing, it may be [realistic timeframe]. I'll keep you informed as things progress."

### Upset Clients

De-escalation techniques:
1. Let them express frustration fully
2. Acknowledge their feelings
3. Don't get defensive
4. Focus on what you CAN do
5. If needed: "Let me have a supervisor follow up with you"

## Building Referral Relationships

Happy clients can refer others:

### After Success
> "I'm glad we could help you. If you know anyone else who's been through a property sale and might have funds available, feel free to have them reach out."

### Never Pressure
- Don't ask multiple times
- Don't offer incentives (compliance issue)
- A simple mention is enough

## Multi-Channel Communication

### When to Use What

**Phone:** Complex discussions, initial contact, sensitive matters
**Email:** Sending documents, written records, detailed information
**Text (if permitted):** Quick updates, reminders, simple questions

### Professional Standards

All channels:
- Identify yourself
- Keep it professional
- Document the interaction
- Respond within 24 hours

## Empathy in Action

### The Empathy Formula

1. **Acknowledge** — "I hear what you're saying..."
2. **Validate** — "That must be frustrating..."
3. **Assist** — "Here's what we can do..."

### Phrases That Work

- "I understand this is a lot to take in."
- "Your concern makes complete sense."
- "Let me see what I can do to help."
- "I appreciate you sharing that with me."

### Phrases to Avoid

- "Calm down."
- "You're overreacting."
- "There's nothing I can do."
- "That's not my job."

## Quiz

Test your advanced communication skills.
    `,
    questions: [
      {
        question: "When dealing with multiple heirs, what's your first step?",
        options: [
          "Get all heirs on a conference call immediately",
          "Identify the 'lead' heir who will coordinate",
          "Choose the heir you think is most reliable",
          "Skip the other heirs and work with just one"
        ],
        correctAnswer: 1,
        explanation: "Identify a lead heir to coordinate the process. This makes communication manageable while ensuring all parties are involved."
      },
      {
        question: "When delivering bad news to a client, you should:",
        options: [
          "Avoid their calls",
          "Blame someone else",
          "Explain honestly and express genuine regret",
          "Promise to make it up to them somehow"
        ],
        correctAnswer: 2,
        explanation: "Be honest about the situation, explain clearly what happened, and express genuine regret. Don't make promises you can't keep."
      },
      {
        question: "What is the empathy formula order?",
        options: [
          "Assist, Acknowledge, Validate",
          "Acknowledge, Validate, Assist",
          "Validate, Assist, Acknowledge",
          "Assist, Validate, Acknowledge"
        ],
        correctAnswer: 1,
        explanation: "Acknowledge their situation, Validate their feelings, then Assist with what you can do."
      },
      {
        question: "When is it appropriate to ask for referrals?",
        options: [
          "On the first call",
          "After a successful case, with one simple mention",
          "Every time you speak with them",
          "Never — it's against policy"
        ],
        correctAnswer: 1,
        explanation: "After successfully helping someone, a simple mention that they can refer others is appropriate. Never pressure or incentivize."
      }
    ]
  },

  {
    id: "mod-t2-002",
    title: "State-Specific Procedures",
    description: "Deep dive into claim processes for each state we serve.",
    orderIndex: 11,
    durationMinutes: 60,
    requiredForTier: "TIER_2_SPECIALIST",
    requiredForRole: null,
    prerequisites: ["mod-t2-001"],
    hasQuiz: true,
    passingScore: 85,
    isCertification: true,
    targetAudience: ["EMPLOYEE"],
    content: `
# State-Specific Procedures

## Why State Knowledge Matters

Each state has different:
- Laws governing surplus funds
- Deadlines for claiming
- Required documentation
- Processes and forms
- Restrictions on asset locators

Knowing these details makes you more effective and keeps us compliant.

## California

### Types of Surplus
1. **Tax Sale Excess Proceeds** (R&T Code 4674-4675)
   - Excess over $150 after taxes/fees
   - Priority: Lienholders first, then title holders

2. **Foreclosure Surplus** (Civil Code 2924k)
   - From non-judicial foreclosure sales
   - Court petition required

### Deadlines
- **Tax Sale:** 1 year from deed recordation
- **Foreclosure:** 3 years from sale date

### Process
1. Identify surplus with county
2. File petition with Superior Court
3. Submit required documentation
4. Court hearing may be required
5. Order of distribution issued
6. Funds disbursed

### Special Requirements
- Court petition required for foreclosure
- "Personal knowledge" ID verification not allowed
- Surplus over $150 threshold for tax sales

## Texas

### Types of Surplus
1. **Tax Sale Excess Proceeds** (Tax Code 34.04)
   - Minimum $25 surplus after liens/costs
   - Court petition required

### Deadlines
- **2 years** from sale date to file petition

### Process
1. Wait 36 days after funds deposited (for assignments)
2. File petition with county district court
3. Submit documentation
4. Court determines distribution
5. Funds disbursed

### Critical Restrictions
- **No phone or in-person solicitation for assignments**
- Assignments must be in writing
- Assignor must receive 80% minimum
- Maximum 125% return for assignee
- Violations = repayment + attorney fees

### Mortgage Foreclosure
- No specific statute
- Submit claim to trustee/administrator

## Florida

### Regulatory Framework
- Most regulated state for surplus recovery
- Chapter 45 (Foreclosure Surplus)
- Chapter 197 (Tax Deed Surplus)

### Surplus Trustee Requirements
- 12+ months experience in surplus recovery
- Class "A" Private Investigator license
- $500,000 liability insurance/bond
- Full-time Florida-licensed attorney

### Compensation Structure
- 2% cost advance upon court order
- 10% service charge upon successful disbursement

### Tax Deed Surplus (197.582)
- 120 days from Notice to submit claim
- 1 year before funds go to state
- Notarized claim required

### Foreclosure Surplus (45.032)
- Surplus Trustee appointment process
- Court oversight required
- Strict documentation requirements

## Georgia

### Types of Surplus
- **Tax Sale Overages** (O.C.G.A. 48-4-5)
- Notice required within 30 days of sale

### Deadlines
- **5 years** from tax sale date
- After 5 years: Funds transfer to state

### Critical Restrictions
- Many counties reject third-party applications
- Must use Georgia-licensed attorney
- Power of Attorney NOT recognized
- Tax Commissioner won't deal with asset locators

### Process (after transfer to state)
1. File interpleader action
2. Court order required
3. Must go through probate for deceased owners

## Tennessee

### Types of Surplus
- Foreclosure surplus (21-1-803)
- Tax sale overages

### Process
- Court may order surplus paid to debtor/creditors
- Accounting filed with Chancery clerk
- Former homeowner has first right

### Foreclosure Types
- Both judicial and non-judicial allowed
- Non-judicial: ~1 month after 120-day waiting period

### County Variations
- Shelby County: Trustee handles
- Davidson County: Different process
- Always verify with specific county

## Multi-State Considerations

### When Working Multiple States
1. Know which state's rules apply
2. Adjust timeline expectations
3. Use correct forms and processes
4. Be aware of licensing requirements
5. Escalate uncertain situations

### Client in State A, Property in State B
- Property state rules govern
- May need local attorney
- Documentation requirements of property state

## Quiz

Test your state-specific knowledge.
    `,
    questions: [
      {
        question: "In Texas, what's the deadline to file for tax sale excess proceeds?",
        options: [
          "1 year from sale date",
          "2 years from sale date",
          "3 years from sale date",
          "5 years from sale date"
        ],
        correctAnswer: 1,
        explanation: "Texas gives 2 years from the sale date to file a petition for tax sale excess proceeds."
      },
      {
        question: "What special license does Florida require for surplus trustees?",
        options: [
          "Real estate license",
          "Class A Private Investigator license",
          "Law degree",
          "Certified public accountant"
        ],
        correctAnswer: 1,
        explanation: "Florida requires surplus trustees to have a Class 'A' Private Investigator license plus other requirements."
      },
      {
        question: "In Texas, what is prohibited when obtaining surplus assignments?",
        options: [
          "Written solicitation",
          "Phone or in-person solicitation",
          "Email contact",
          "Mail contact"
        ],
        correctAnswer: 1,
        explanation: "Texas law specifically prohibits soliciting assignments via phone or in-person contact."
      },
      {
        question: "How long do Georgia surplus funds sit before transferring to the state?",
        options: [
          "1 year",
          "2 years",
          "3 years",
          "5 years"
        ],
        correctAnswer: 3,
        explanation: "Georgia allows 5 years from the tax sale date before unclaimed funds transfer to the state."
      },
      {
        question: "In California foreclosure cases, what's the claim deadline?",
        options: [
          "1 year from sale",
          "2 years from sale",
          "3 years from sale",
          "5 years from sale"
        ],
        correctAnswer: 2,
        explanation: "California foreclosure surplus claims must be filed within 3 years of the foreclosure sale date."
      }
    ]
  }
];

// ============================================
// TIER 3 — SENIOR SPECIALIST TRAINING
// ============================================

export const TIER_3_MODULES: TrainingModuleData[] = [
  {
    id: "mod-t3-001",
    title: "Complex Case Management",
    description: "Handling high-value cases, multiple parties, and unusual situations.",
    orderIndex: 20,
    durationMinutes: 45,
    requiredForTier: "TIER_3_SENIOR_SPECIALIST",
    requiredForRole: null,
    prerequisites: ["mod-t2-002"],
    hasQuiz: true,
    passingScore: 85,
    isCertification: false,
    targetAudience: ["EMPLOYEE"],
    content: `
# Complex Case Management

## Senior Specialist Expectations

As a Tier 3 Senior Specialist, you handle our most challenging cases:
- High-value claims
- Multi-party situations
- Contested claims
- Complex documentation needs
- Cases requiring escalation support

## High-Value Case Protocols

### Definition
Cases with potential recovery significantly above average require special handling.

### Enhanced Procedures
1. **Verification First** — Extra due diligence on all parties
2. **Documentation Excellence** — Every detail perfect
3. **Communication Frequency** — More regular updates
4. **Supervisor Awareness** — Keep leadership informed
5. **Expedited Processing** — Priority handling internally

### Risk Considerations
- Higher stakes = more scrutiny
- Fraud attempts more likely
- Competition from other locators possible
- Client expectations higher

## Multi-Party Situations

### Deceased Owner with Multiple Heirs

**Typical scenario:** Property owner died, three adult children as heirs

**Steps:**
1. Identify all heirs through probate records
2. Verify each heir's identity separately
3. Obtain authorization from each
4. One heir may be appointed representative
5. Distribution according to inheritance

**Common issues:**
- One heir won't sign
- Heirs disagree on fees
- Unknown heirs discovered later

### Business Entity Owners

**Typical scenario:** LLC owned the property, now dissolved

**Steps:**
1. Research entity status with Secretary of State
2. Identify members/managers at time of sale
3. Obtain operating agreement if possible
4. Verify who can sign
5. May need legal dissolution documents

### Competing Claims

**Typical scenario:** Multiple parties claim the same funds

**Our role:**
- Gather documentation from our client
- Submit our client's claim properly
- Let the court/county decide
- We don't adjudicate disputes

## Unusual Documentation

### Foreign Documents
- May need certified translation
- Authentication requirements vary
- Allow extra processing time

### Old Documents
- Estates from decades ago
- Records may be incomplete
- Creative research sometimes needed
- Genealogical research may help

### Lost Documents
- Guide client on replacements
- Know which agencies issue what
- Vital records, court records, etc.

## Escalation Protocols

### When to Escalate

**Immediately:**
- Suspected fraud
- Legal threats received
- Compliance concerns
- Media/PR potential

**Promptly:**
- Client complaints
- Unusual circumstances
- Large value cases
- Multi-jurisdiction issues

### How to Escalate
1. Document the situation
2. Notify your supervisor
3. Provide relevant case details
4. Suggest next steps if obvious
5. Follow up as directed

## Mentoring Junior Staff

As a Senior Specialist, you may assist with:
- Answering questions from new hires
- Demonstrating best practices
- Reviewing case handling
- Sharing institutional knowledge

Remember: How you handle things sets the standard.

## Quality Metrics

### What We Measure
- Case completion rate
- Time to close
- Client satisfaction
- Documentation accuracy
- Compliance record

### Your Targets
Higher expectations at Tier 3:
- Conversion rate above 35%
- Minimal rejected filings
- Zero compliance violations
- Positive client feedback

## Quiz

Test your senior-level knowledge.
    `,
    questions: [
      {
        question: "When handling a high-value case, what's the first priority?",
        options: [
          "Close it as fast as possible",
          "Extra verification and due diligence",
          "Get the signature immediately",
          "Negotiate a higher fee"
        ],
        correctAnswer: 1,
        explanation: "High-value cases require extra verification first. The stakes are higher and scrutiny is greater."
      },
      {
        question: "When multiple parties claim the same funds, what is our role?",
        options: [
          "Decide who's right",
          "Get all parties to agree",
          "Submit our client's claim properly and let the court decide",
          "Withdraw from the case"
        ],
        correctAnswer: 2,
        explanation: "We submit our client's claim with proper documentation. Courts or counties adjudicate competing claims."
      },
      {
        question: "What requires immediate escalation?",
        options: [
          "A client asking for an update",
          "Suspected fraud",
          "A case taking longer than expected",
          "Missing one document"
        ],
        correctAnswer: 1,
        explanation: "Suspected fraud, legal threats, compliance concerns, and potential PR issues require immediate escalation."
      },
      {
        question: "What conversion rate is expected of Tier 3 specialists?",
        options: [
          "Above 15%",
          "Above 25%",
          "Above 35%",
          "Above 50%"
        ],
        correctAnswer: 2,
        explanation: "Tier 3 Senior Specialists are expected to maintain conversion rates above 35%."
      }
    ]
  }
];

// ============================================
// TIER 4 — TEAM LEADER TRAINING
// ============================================

export const TIER_4_MODULES: TrainingModuleData[] = [
  {
    id: "mod-t4-001",
    title: "Team Leadership Excellence",
    description: "Managing teams, coaching performance, and driving results.",
    orderIndex: 30,
    durationMinutes: 60,
    requiredForTier: "TIER_4_TEAM_LEADER",
    requiredForRole: null,
    prerequisites: ["mod-t3-001"],
    hasQuiz: true,
    passingScore: 85,
    isCertification: true,
    targetAudience: ["EMPLOYEE"],
    content: `
# Team Leadership Excellence

## Transition to Leadership

Congratulations on reaching Tier 4. Your role now expands beyond personal production to include:
- Coaching and developing team members
- Monitoring team performance
- Ensuring compliance across your team
- Resolving issues before escalation
- Representing the team to leadership

## Leadership Fundamentals

### Lead by Example
- Your standards become the team's standards
- Maintain your own case quality
- Follow all procedures meticulously
- Stay positive and solution-focused

### Build Trust
- Be consistent in your actions
- Follow through on commitments
- Be available when needed
- Protect your team when appropriate

### Communicate Clearly
- Set clear expectations
- Provide regular feedback
- Listen actively
- Address issues directly

## Performance Management

### Daily Monitoring
- Review team dashboards
- Identify who needs support
- Recognize strong performance
- Address issues early

### One-on-One Meetings
**Weekly with each team member:**
- Review their metrics
- Discuss challenges
- Celebrate wins
- Set goals for the week

### Coaching Conversations
**When someone is struggling:**
1. Ask before telling
2. Focus on specific behaviors
3. Seek to understand root causes
4. Agree on action steps
5. Follow up consistently

**Sample approach:**
> "I noticed your conversion rate dipped this week. What do you think is contributing to that?"

### Documentation
- Keep notes on team member performance
- Document coaching conversations
- Record both positives and concerns
- This supports fair decisions

## Compliance Oversight

### Your Responsibility
As team leader, you're accountable for team compliance:
- Monitor call quality
- Review documentation
- Address issues immediately
- Escalate serious concerns

### Regular Audits
- Listen to recorded calls
- Review case notes
- Check documentation completeness
- Verify procedure following

### When Issues Arise
1. Address privately with the individual
2. Provide clear corrective guidance
3. Document the conversation
4. Follow up on improvement
5. Escalate if pattern continues

## Developing Your Team

### Identifying Potential
Look for team members who:
- Consistently perform
- Help others succeed
- Embrace feedback
- Demonstrate leadership qualities

### Growth Opportunities
- Assign stretch assignments
- Include in special projects
- Provide visibility to leadership
- Recommend for advancement

### Training Gaps
- Identify skill deficiencies
- Recommend specific modules
- Provide hands-on coaching
- Track improvement

## Team Dynamics

### Building Culture
- Foster collaboration over competition
- Celebrate team wins
- Address negativity promptly
- Create psychological safety

### Conflict Resolution
When team members clash:
1. Meet with each privately first
2. Understand perspectives
3. Bring together if appropriate
4. Focus on solutions
5. Monitor going forward

### Managing Up
Keep your leadership informed:
- Regular status updates
- Early warning on issues
- Proposed solutions, not just problems
- Recognition requests for team

## Metrics That Matter

### Team-Level Metrics
- Total cases processed
- Team conversion rate
- Average days to close
- Compliance score
- Client satisfaction

### Individual Metrics
- Personal production
- Coaching time invested
- Team member development
- Issue resolution

## Quiz

Test your leadership knowledge.
    `,
    questions: [
      {
        question: "How often should you have one-on-one meetings with each team member?",
        options: [
          "Monthly",
          "Weekly",
          "Quarterly",
          "Only when there's a problem"
        ],
        correctAnswer: 1,
        explanation: "Weekly one-on-ones allow you to review metrics, discuss challenges, and provide regular guidance."
      },
      {
        question: "When coaching a struggling team member, what should you do first?",
        options: [
          "Tell them what they're doing wrong",
          "Put them on a performance improvement plan",
          "Ask questions to understand the root cause",
          "Reassign their cases"
        ],
        correctAnswer: 2,
        explanation: "Ask before telling. Understanding the root cause helps you provide relevant support."
      },
      {
        question: "What are you accountable for regarding team compliance?",
        options: [
          "Nothing — that's HR's job",
          "Only your own compliance",
          "Monitoring, addressing issues, and escalating concerns",
          "Firing anyone who makes a mistake"
        ],
        correctAnswer: 2,
        explanation: "Team leaders are accountable for monitoring compliance, addressing issues, and escalating serious concerns."
      },
      {
        question: "How should you handle conflict between team members?",
        options: [
          "Let them work it out themselves",
          "Meet with each privately first, understand perspectives, then bring together if appropriate",
          "Pick the side you agree with",
          "Ignore it unless it affects work"
        ],
        correctAnswer: 1,
        explanation: "Meet privately first to understand each perspective, then bring together to focus on solutions."
      }
    ]
  }
];

// ============================================
// HR ROLE TRAINING
// ============================================

export const HR_MODULES: TrainingModuleData[] = [
  {
    id: "mod-hr-001",
    title: "HR Portal & Employee Management",
    description: "Managing employee records, onboarding, and HR responsibilities.",
    orderIndex: 40,
    durationMinutes: 45,
    requiredForTier: null,
    requiredForRole: "HR" as any,
    prerequisites: ["mod-t1-004"],
    hasQuiz: true,
    passingScore: 85,
    isCertification: false,
    targetAudience: ["HR"],
    content: `
# HR Portal & Employee Management

## Your Role in HR

As an HR team member, you're responsible for:
- Employee onboarding and offboarding
- Training compliance monitoring
- Employee relations support
- Record keeping and documentation
- Policy administration

## Employee Onboarding

### Before Day One
1. Create employee account in system
2. Assign initial training modules
3. Set up access permissions
4. Prepare welcome materials
5. Notify team leader

### First Day
1. Welcome and orientation
2. System login setup
3. Training assignments explained
4. Introduce to team
5. Review expectations

### First Week
1. Monitor training progress
2. Check in daily
3. Answer questions
4. Verify documentation complete
5. Confirm access working

## Training Compliance

### Your Dashboard
The HR portal shows:
- Overall training completion rates
- Overdue training by employee
- Upcoming deadlines
- Module pass/fail rates

### Managing Compliance
1. Send reminders for overdue training
2. Escalate repeated non-completion
3. Track new hire progress closely
4. Report to leadership regularly

### Training Issues
When an employee repeatedly fails:
1. Review their quiz attempts
2. Consider one-on-one support
3. Assign remedial modules
4. Document interventions
5. Escalate if no improvement

## Employee Records

### What We Track
- Personal information
- Employment dates
- Role and tier history
- Training records
- Performance notes
- Disciplinary actions

### Privacy Requirements
- Access only what's needed
- Never share unnecessarily
- Secure storage only
- Follow retention policies

## Employee Relations

### Common Issues
- Training difficulties
- Interpersonal conflicts
- Policy questions
- Accommodation requests
- Concerns or complaints

### Your Approach
1. Listen without judgment
2. Document the concern
3. Explain relevant policies
4. Involve appropriate parties
5. Follow up on resolution

## Offboarding

### When an Employee Leaves
1. Disable system access immediately
2. Recover any equipment
3. Complete exit documentation
4. Conduct exit interview if possible
5. Update records
6. Notify relevant parties

### Access Revocation
Time-sensitive! Access should be disabled:
- Same day for terminations
- Last working day for resignations

## Reporting

### Regular Reports
- Weekly: Training compliance summary
- Monthly: Employee metrics overview
- Quarterly: Comprehensive review

### What Leadership Needs
- Trends, not just numbers
- Issues and resolutions
- Recommendations
- Proactive insights

## Quiz

Test your HR knowledge.
    `,
    questions: [
      {
        question: "When should an employee's system access be disabled after termination?",
        options: [
          "Within a week",
          "Same day",
          "After paperwork is complete",
          "Never — keep for records"
        ],
        correctAnswer: 1,
        explanation: "Access should be disabled the same day as termination for security and compliance."
      },
      {
        question: "What should you do when an employee repeatedly fails training?",
        options: [
          "Immediately terminate",
          "Ignore it — they'll figure it out",
          "Review attempts, provide support, document, escalate if no improvement",
          "Let their manager handle it alone"
        ],
        correctAnswer: 2,
        explanation: "Follow a progressive approach: review, support, document, and escalate if improvement doesn't occur."
      },
      {
        question: "What's your first step when an employee raises a concern?",
        options: [
          "Tell them company policy",
          "Listen without judgment and document",
          "Refer them to their manager",
          "Investigate immediately"
        ],
        correctAnswer: 1,
        explanation: "Always listen without judgment first and document the concern before taking any action."
      },
      {
        question: "What should HR reports include beyond just numbers?",
        options: [
          "Just numbers is fine",
          "Trends, issues, resolutions, and recommendations",
          "Employee names only",
          "Nothing — reports aren't important"
        ],
        correctAnswer: 1,
        explanation: "Effective reports include trends, issues and their resolutions, and proactive recommendations."
      }
    ]
  }
];

// ============================================
// COMPLIANCE ROLE TRAINING
// ============================================

export const COMPLIANCE_MODULES: TrainingModuleData[] = [
  {
    id: "mod-comp-001",
    title: "Compliance Monitoring & Oversight",
    description: "Monitoring employee compliance, auditing processes, and maintaining standards.",
    orderIndex: 50,
    durationMinutes: 60,
    requiredForTier: null,
    requiredForRole: "COMPLIANCE" as any,
    prerequisites: ["mod-t1-003"],
    hasQuiz: true,
    passingScore: 90,
    isCertification: true,
    targetAudience: ["COMPLIANCE"],
    content: `
# Compliance Monitoring & Oversight

## The Compliance Function

As a Compliance team member, you protect the company and our clients by:
- Monitoring adherence to regulations
- Auditing processes and communications
- Investigating potential violations
- Training and advising staff
- Maintaining documentation

## Regulatory Framework

### Key Regulations We Follow
1. **TCPA** — Calling practices
2. **FDCPA** — Fair practices
3. **State-specific laws** — Varies by location
4. **Consumer protection laws** — General practices

### Staying Current
- Subscribe to regulatory updates
- Participate in industry groups
- Review legal bulletins
- Attend compliance training

## Monitoring Activities

### Call Monitoring
**What to listen for:**
- Proper identification
- No prohibited statements
- No guarantees or pressure
- Accurate information
- Professional tone

**Red flags:**
- Specific dollar amounts mentioned
- Urgency or pressure tactics
- Inaccurate claims
- Unprofessional behavior

### Documentation Review
**Check for:**
- Complete and accurate forms
- Proper signatures
- Required disclosures
- Correct processes followed

### Process Audits
**Verify:**
- Calling times respected
- DNC lists honored
- Consent obtained where required
- Records maintained properly

## Handling Violations

### Minor Issues
- Coaching by supervisor
- Additional training assigned
- Documented for reference

### Moderate Issues
- Formal warning
- Remedial training required
- Increased monitoring

### Serious Violations
- Immediate escalation
- Potential suspension
- Investigation launched
- Documentation critical

### Documentation
All compliance actions must be documented:
- What happened
- When it occurred
- What action was taken
- Follow-up completed

## Investigation Process

### When an Issue is Reported
1. Secure relevant records immediately
2. Interview involved parties
3. Gather objective evidence
4. Document findings
5. Determine appropriate action
6. Report to leadership

### Objectivity
- Don't prejudge
- Gather facts before conclusions
- Treat all parties fairly
- Document everything

## Training & Prevention

### Proactive Compliance
Best compliance is prevention:
- Regular training refreshers
- Compliance tips in communications
- Positive reinforcement
- Clear expectations

### Training Assessment
- Identify common failure points
- Recommend curriculum updates
- Develop targeted content
- Track effectiveness

## Reporting

### Regular Reports
- Violation trends
- Audit findings
- Risk assessments
- Recommendations

### Escalation Protocols
Know when and how to escalate:
- Serious violations: Immediately
- Patterns: Promptly
- Recommendations: Regularly

## Quiz

This quiz requires 90% to pass.
    `,
    questions: [
      {
        question: "What's the first step when a compliance issue is reported?",
        options: [
          "Terminate the employee",
          "Secure relevant records immediately",
          "Wait to see if it happens again",
          "Interview the reporter"
        ],
        correctAnswer: 1,
        explanation: "First priority is securing relevant records to preserve evidence before any investigation."
      },
      {
        question: "What should you listen for when monitoring calls?",
        options: [
          "How fast they talk",
          "Proper ID, no prohibited statements, no pressure, accurate info",
          "If they make the sale",
          "Their personal opinions"
        ],
        correctAnswer: 1,
        explanation: "Monitor for proper identification, no prohibited statements, no pressure tactics, and accurate information."
      },
      {
        question: "What's the best form of compliance?",
        options: [
          "Strict punishment",
          "Prevention through training and clear expectations",
          "Constant monitoring",
          "Random audits"
        ],
        correctAnswer: 1,
        explanation: "Prevention through proactive training, clear expectations, and positive reinforcement is most effective."
      },
      {
        question: "When should serious violations be escalated?",
        options: [
          "At the end of the week",
          "During the monthly report",
          "Immediately",
          "After gathering all evidence"
        ],
        correctAnswer: 2,
        explanation: "Serious violations require immediate escalation. Don't wait for perfect information."
      }
    ]
  }
];

// ============================================
// ADMIN ROLE TRAINING
// ============================================

export const ADMIN_MODULES: TrainingModuleData[] = [
  {
    id: "mod-admin-001",
    title: "Administrative Functions",
    description: "Managing cases, users, and system administration.",
    orderIndex: 60,
    durationMinutes: 45,
    requiredForTier: null,
    requiredForRole: "ADMIN",
    prerequisites: ["mod-t1-004"],
    hasQuiz: true,
    passingScore: 80,
    isCertification: false,
    targetAudience: ["ADMIN"],
    content: `
# Administrative Functions

## Admin Role Overview

As an Administrator, you have elevated access to:
- User management
- Case oversight
- Reporting and analytics
- Configuration settings
- Support functions

## User Management

### Creating Users
1. Navigate to User Management
2. Click "Add User"
3. Enter required information
4. Assign appropriate role
5. Set initial permissions
6. Send welcome credentials

### Managing Existing Users
- Activate/deactivate accounts
- Reset passwords
- Update roles and permissions
- View activity history
- Manage team assignments

### Role Permissions
Each role has specific access:
- **Employee:** Own cases, training, earnings
- **Team Lead:** Team oversight added
- **HR:** Employee management added
- **Compliance:** Monitoring tools added
- **Admin:** Full operational access

## Case Management

### Case Overview
View all cases across the organization:
- Filter by status, assignee, date, value
- Bulk actions available
- Export capabilities

### Case Assignment
Assign or reassign cases:
- Consider workload balance
- Match skills to case complexity
- Document reason for reassignment

### Case Escalation
Handle escalated cases:
- Review the situation
- Determine appropriate action
- Document resolution
- Follow up as needed

## Reporting

### Available Reports
- Performance dashboards
- Case pipeline reports
- Conversion analytics
- Compliance summaries
- Training completion

### Creating Reports
1. Select report type
2. Set date range and filters
3. Choose display format
4. Export or schedule

### Sharing Reports
- Generate links for stakeholders
- Schedule automated delivery
- Set appropriate permissions

## System Configuration

### Settings You Can Manage
- Email templates
- Status definitions
- Assignment rules
- Notification preferences

### What Requires Higher Access
- Commission structures
- Fee calculations
- Financial settings
- These are FOUNDER-level

## Support Functions

### Employee Support
- Answer system questions
- Resolve access issues
- Clarify procedures
- Escalate complex problems

### Client Escalations
When cases escalate to admin:
1. Review the history
2. Understand the issue
3. Determine resolution
4. Communicate clearly
5. Document outcome

## Quiz

Test your admin knowledge.
    `,
    questions: [
      {
        question: "When reassigning a case, what should you consider?",
        options: [
          "Just pick randomly",
          "Workload balance and matching skills to complexity",
          "Give to the newest employee",
          "Keep all cases together"
        ],
        correctAnswer: 1,
        explanation: "Consider workload balance and match employee skills to case complexity for best results."
      },
      {
        question: "Which settings require FOUNDER-level access?",
        options: [
          "Email templates",
          "Status definitions",
          "Commission structures and fee calculations",
          "Notification preferences"
        ],
        correctAnswer: 2,
        explanation: "Financial settings like commission structures and fee calculations are FOUNDER-level only."
      },
      {
        question: "What's the first step when handling a client escalation?",
        options: [
          "Blame the original employee",
          "Offer a refund immediately",
          "Review the history and understand the issue",
          "Transfer to someone else"
        ],
        correctAnswer: 2,
        explanation: "First review the history and understand the full issue before determining resolution."
      },
      {
        question: "What should you do after resolving any support issue?",
        options: [
          "Nothing — it's resolved",
          "Document the outcome",
          "Email the CEO",
          "Take a break"
        ],
        correctAnswer: 1,
        explanation: "Always document resolutions for future reference and consistency."
      }
    ]
  }
];

// ============================================
// FOUNDER-ONLY TRAINING (INCLUDES SHADOW ACCOUNTING)
// ============================================

export const FOUNDER_MODULES: TrainingModuleData[] = [
  {
    id: "mod-founder-001",
    title: "Business Operations & Financial Model",
    description: "Complete understanding of business financials, commission structures, and profitability.",
    orderIndex: 100,
    durationMinutes: 90,
    requiredForTier: null,
    requiredForRole: "FOUNDER",
    prerequisites: [],
    hasQuiz: true,
    passingScore: 100,
    isCertification: true,
    targetAudience: ["FOUNDER"],
    content: `
# Business Operations & Financial Model

**⚠️ FOUNDER EYES ONLY — HIGHLY CONFIDENTIAL**

This module contains sensitive business information that is not shared with employees.

## Revenue Model

### How We Earn
- Client pays a percentage of their recovered funds
- Industry standard: 25-35% contingency fee
- Our target: 30% of recovered funds

### Cost Structure
Employee compensation is a percentage of the fee we collect:
- What employees see: Their "commission rate"
- What we pay: Actual rate after our margin

### The Margin Model
Example on a $10,000 recovery at 30% fee:
- We collect: $3,000
- Employee sees: 40% rate = $1,200 "their share"
- We actually pay: 20% = $600
- Our margin: $2,400

This is standard business practice but is not discussed with employees.

## Displayed vs. Actual

### Commission Rates
| Tier | Displayed Rate | Actual Rate | Our Margin |
|------|----------------|-------------|------------|
| Tier 1 | 35% | 15% | 20% |
| Tier 2 | 40% | 20% | 20% |
| Tier 3 | 45% | 25% | 20% |
| Tier 4 | 50% | 30% | 20% |
| Tier 5 | 55% | 35% | 20% |

### Why This Model
- Motivates employees with perceived high rates
- Maintains sustainable margins
- Enables reinvestment in growth
- Industry standard practice

## Payout Processing

### The Flow
1. Client receives their funds
2. Our fee is deducted at source (or collected)
3. Employee's actual share calculated
4. Payout processed on schedule
5. Employee sees their "rate" applied

### What Employees See
- Their cases
- Their displayed commission rate
- Their earnings (calculated from actual rate)
- Progress toward tier advancement

### What They Don't See
- Our total revenue
- Actual vs. displayed rates
- Other employees' earnings
- Business-level financials

## Child Company Model

### Structure
You can create sub-companies under the main entity:
- They get their own branding
- They see their employees only
- They have their own commission structure

### Revenue Sharing
Parent company takes a percentage of child company revenue:
- Configurable per child company
- Hidden from child company employees
- Visible only to you and child company owner

## Financial Controls

### What You Control
- Commission structures
- Fee percentages
- Payout schedules
- Revenue share splits
- All financial settings

### Audit Trail
All financial changes are logged:
- Who made the change
- When it was made
- What was changed
- Previous and new values

## Ledger & Accounting

### Complete View
You see everything:
- All revenue coming in
- All payouts going out
- All margins and splits
- Historical financials

### Integration
- Export for accounting software
- API access if needed
- Automated reporting

## Key Metrics

### Health Indicators
- Total revenue
- Cost of revenue (payouts)
- Gross margin
- Case volume trends
- Conversion rates

### Warning Signs
- Declining conversion rates
- Increasing payout ratio
- Lower average case value
- High employee turnover

## Strategic Considerations

### Pricing Power
- Our fees vs. competition
- When to adjust
- Market positioning

### Scaling
- When to hire
- Capacity planning
- Margin preservation at scale

## Quiz

You must score 100% to complete this module.
    `,
    questions: [
      {
        question: "What is the margin model used for employee compensation?",
        options: [
          "Pay exactly what's displayed",
          "Displayed rate is higher than actual rate paid",
          "Pay more than displayed",
          "No margin on employee compensation"
        ],
        correctAnswer: 1,
        explanation: "The displayed rate shown to employees is higher than the actual rate paid. This creates sustainable margins."
      },
      {
        question: "What do employees NOT see in the system?",
        options: [
          "Their own cases",
          "Their displayed commission rate",
          "Business-level financials and actual rates",
          "Their training progress"
        ],
        correctAnswer: 2,
        explanation: "Employees cannot see business-level financials, actual vs. displayed rates, or other employees' earnings."
      },
      {
        question: "What happens with child company revenue?",
        options: [
          "Goes entirely to the child company",
          "Parent takes a configurable revenue share",
          "Split 50/50 always",
          "All goes to parent company"
        ],
        correctAnswer: 1,
        explanation: "Parent company takes a configurable percentage of child company revenue, hidden from child company employees."
      },
      {
        question: "What is tracked in the financial audit trail?",
        options: [
          "Nothing",
          "Only large changes",
          "Who, when, what was changed, and previous/new values",
          "Only commission changes"
        ],
        correctAnswer: 2,
        explanation: "All financial changes are logged with who, when, what, and the previous and new values."
      }
    ]
  },

  {
    id: "mod-founder-002",
    title: "Payout Management",
    description: "Managing payouts, payment processing, and financial operations.",
    orderIndex: 101,
    durationMinutes: 60,
    requiredForTier: null,
    requiredForRole: "FOUNDER",
    prerequisites: ["mod-founder-001"],
    hasQuiz: true,
    passingScore: 90,
    isCertification: false,
    targetAudience: ["FOUNDER"],
    content: `
# Payout Management

## Payout System Overview

As FOUNDER, you control all payment operations:
- When payouts are processed
- How amounts are calculated
- Payment methods
- Approval workflows

## Payout Queue

### Viewing Pending Payouts
The payout queue shows:
- Employee name
- Cases included
- Displayed amount (what they expect)
- Actual amount (what we pay)
- Payment method

### Approval Process
1. Review pending payouts
2. Verify case completions
3. Approve or hold individual payouts
4. Process approved payouts

### Holding Payouts
Reasons to hold:
- Pending verification
- Compliance review
- Client dispute
- Documentation issue

Always document the reason.

## Payment Methods

### Direct Deposit (ACH)
- Most common method
- 1-3 business day processing
- Requires bank info on file

### Check
- Alternative option
- Slower processing
- Physical mailing required

### Other Methods
- Wire transfer (special cases)
- Third-party payment processors

## Payout Schedules

### Options
- Weekly
- Bi-weekly
- Monthly
- Per-case (special arrangements)

### Considerations
- Cash flow management
- Employee expectations
- Processing costs
- Administrative burden

## The Math Behind Payouts

### Calculation Flow
1. Case paid: $10,000 recovered
2. Our fee: 30% = $3,000
3. Employee's actual rate: 20%
4. Employee payout: $3,000 × 20% = $600
5. Our margin: $2,400

### What Employee Sees
- Case recovery: $10,000
- Their rate: 40%
- Displayed earnings: $1,200
- Actual payout: $600
- They never see the discrepancy directly

### Reconciliation
The system handles this automatically:
- Tracks displayed vs. actual
- Calculates correctly
- Maintains audit trail

## Compliance Considerations

### Tax Documentation
- 1099s for contractors
- W-2s for employees
- State requirements vary

### Record Keeping
- Maintain payout records
- Keep supporting documentation
- Retention requirements (typically 7 years)

## Reporting

### Payout Reports
- By employee
- By time period
- By case type
- By status

### Financial Analysis
- Payout ratio trends
- Margin analysis
- Forecasting

## Quiz

Test your payout management knowledge.
    `,
    questions: [
      {
        question: "When should you hold a payout?",
        options: [
          "To save money",
          "Randomly for security",
          "For verification, compliance review, or documentation issues",
          "Never — always pay immediately"
        ],
        correctAnswer: 2,
        explanation: "Hold payouts only for legitimate reasons: pending verification, compliance review, disputes, or documentation issues."
      },
      {
        question: "What does the employee see vs. what's actually paid?",
        options: [
          "They see exact amount paid",
          "Displayed amount is higher than actual payout",
          "They see less than paid",
          "No display at all"
        ],
        correctAnswer: 1,
        explanation: "Employees see a displayed amount based on their displayed rate, which is higher than the actual payout."
      },
      {
        question: "How long should payout records be retained?",
        options: [
          "1 year",
          "3 years",
          "Typically 7 years",
          "Forever"
        ],
        correctAnswer: 2,
        explanation: "Financial records including payouts should typically be retained for 7 years for tax and legal purposes."
      }
    ]
  }
];

// ============================================
// CHILD COMPANY TRAINING
// ============================================

export const CHILD_COMPANY_MODULES: TrainingModuleData[] = [
  {
    id: "mod-child-001",
    title: "Child Company Operations",
    description: "Running your sub-company under the MGR Capital umbrella.",
    orderIndex: 110,
    durationMinutes: 45,
    requiredForTier: null,
    requiredForRole: null,
    prerequisites: [],
    hasQuiz: true,
    passingScore: 85,
    isCertification: false,
    targetAudience: ["CHILD_COMPANY"],
    content: `
# Child Company Operations

## Your Business Under Our Umbrella

As a Child Company, you operate your own business using our:
- Technology platform
- Training systems
- Compliance framework
- Processing infrastructure

## What You Control

### Your Team
- Hire your own employees
- Set their commission rates (within guidelines)
- Manage performance
- Handle HR matters

### Your Branding
- Your company name
- Your contact information
- Your client relationships

### Your Cases
- Your assigned territories or leads
- Your conversion responsibility
- Your client relationships

## What We Handle

### Infrastructure
- Technology platform
- Payment processing
- Document management
- Compliance monitoring

### Support
- Training content
- Legal compliance framework
- Processing and filing
- Escalation support

## Revenue Model

### Your Earnings
You earn from your team's successful recoveries:
- Set commission rates for your employees
- Your earnings = Fee collected minus employee pay minus platform fee

### Platform Fee
We take a percentage for platform and services:
- This covers technology, processing, support
- Rate is set in your agreement
- Transparent and predictable

### Example
$10,000 recovery, 30% fee = $3,000 collected
- Platform fee (15%): $450 to parent
- Employee payout: Based on your rates
- Your margin: The remainder

## Managing Your Team

### Hiring
You're responsible for your team:
- Recruit qualified people
- Run necessary background checks
- Onboard properly
- Ensure training completion

### Training
All employees must complete:
- Core training modules
- Compliance certification
- Any role-specific training

### Performance
Monitor and manage:
- Conversion rates
- Compliance scores
- Client satisfaction
- Productivity

## Compliance Requirements

### Your Responsibility
You're accountable for your team's compliance:
- Ensure training completion
- Monitor activities
- Address issues promptly
- Report serious concerns

### Our Oversight
Parent company monitors:
- Compliance scores
- Client complaints
- Training completion
- Financial accuracy

## Growth Path

### Expanding
As you grow:
- Add more employees
- Take on more cases
- Increase your capacity
- Improve your margins

### Metrics That Matter
- Conversion rate
- Case volume
- Employee retention
- Client satisfaction

## Quiz

Test your child company knowledge.
    `,
    questions: [
      {
        question: "What do you control as a Child Company?",
        options: [
          "The technology platform",
          "Your team, branding, and cases",
          "Parent company policies",
          "Industry regulations"
        ],
        correctAnswer: 1,
        explanation: "You control your team (hiring, rates, management), your branding, and your case relationships."
      },
      {
        question: "What does the platform fee cover?",
        options: [
          "Just technology",
          "Technology, processing, support, and compliance framework",
          "Only payment processing",
          "Nothing specific"
        ],
        correctAnswer: 1,
        explanation: "The platform fee covers technology, payment processing, support, and the compliance framework."
      },
      {
        question: "Who is responsible for your team's compliance?",
        options: [
          "Only the parent company",
          "The employees themselves",
          "You are accountable for your team's compliance",
          "No one specifically"
        ],
        correctAnswer: 2,
        explanation: "As the child company owner, you're accountable for ensuring your team maintains compliance."
      }
    ]
  }
];

// ============================================
// EXPORT ALL MODULES
// ============================================

export const ALL_TRAINING_MODULES: TrainingModuleData[] = [
  ...TIER_1_MODULES,
  ...TIER_2_MODULES,
  ...TIER_3_MODULES,
  ...TIER_4_MODULES,
  ...HR_MODULES,
  ...COMPLIANCE_MODULES,
  ...ADMIN_MODULES,
  ...FOUNDER_MODULES,
  ...CHILD_COMPANY_MODULES
];

// Get modules by audience
export function getModulesForAudience(audience: string): TrainingModuleData[] {
  return ALL_TRAINING_MODULES.filter(m =>
    m.targetAudience.includes(audience as any)
  );
}

// Get modules by tier
export function getModulesForTier(tier: EmployeeTier): TrainingModuleData[] {
  return ALL_TRAINING_MODULES.filter(m =>
    m.requiredForTier === tier || m.requiredForTier === null
  );
}

// Get modules by role
export function getModulesForRole(role: UserRole): TrainingModuleData[] {
  return ALL_TRAINING_MODULES.filter(m =>
    m.requiredForRole === role || m.requiredForRole === null
  );
}
