// ============================================
// TRAINING AI SERVICE — MGR CAPITAL ASSISTANCE
// Production-ready employee training system
// ============================================

import { PrismaClient, EmployeeTier, TrainingModuleStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================
// TRAINING MODULES — Full Content
// ============================================

interface TrainingModuleData {
  id: string;
  title: string;
  description: string;
  content: string;
  orderIndex: number;
  requiredForTier: EmployeeTier | null;
  prerequisites: string[];
  hasQuiz: boolean;
  passingScore: number | null;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
}

const TRAINING_MODULES: TrainingModuleData[] = [
  // ----------------------------------------
  // MODULE 1: Introduction
  // ----------------------------------------
  {
    id: "mod-001",
    title: "Introduction to MGR Capital Assistance",
    description: "What we do, how we speak to clients, and how your role fits into the bigger picture.",
    orderIndex: 1,
    requiredForTier: null,
    prerequisites: [],
    hasQuiz: true,
    passingScore: 80,
    content: `
# Welcome to MGR Capital Assistance

## What We Do

We help people access money they may be entitled to after their property is sold by the county or state.

Here's how it works in simple terms:

1. **A property is sold** - When someone doesn't pay their property taxes, the county eventually sells the property to recover the taxes owed.

2. **Sometimes there's extra money** - If the property sells for more than what was owed in taxes, that extra money belongs to the previous owner.

3. **People don't know about it** - Most people don't realize this money exists or don't know how to claim it.

4. **We help them get it** - We reach out to these people, explain the opportunity, handle all the paperwork, and help them claim what's rightfully theirs.

## Our Values

- **We help people** - We're not selling anything. We're helping people access money they may not even know exists.
- **We're transparent** - No upfront costs. We only get paid if we're successful.
- **We're professional** - We treat every client with respect and handle their case with care.
- **We keep it simple** - Legal processes can be confusing. We make it easy for our clients.

## Your Role

As a member of our team, your job is to:

1. **Connect with clients** - Make the initial contact and explain what we do in simple, human terms.
2. **Guide them through the process** - Help them understand each step.
3. **Follow the scripts** - Our scripts are designed to be compliant and effective.
4. **Update case notes** - Keep records of your interactions.
5. **Stay within boundaries** - There are things you can and cannot say. We'll cover these in detail.

## What You DON'T Do

- You don't handle legal filings
- You don't discuss specific dollar amounts
- You don't give legal advice
- You don't promise outcomes

Your focus is on the human connection - making people feel comfortable and helped.

## Next Steps

Complete this module's quiz, then move on to "Client Call Basics" to learn how to speak with clients effectively.
    `,
    questions: [
      {
        question: "What happens when a property is sold for more than the taxes owed?",
        options: [
          "The county keeps the extra money",
          "The extra money goes to the new owner",
          "The extra money may belong to the previous owner",
          "The money is donated to charity"
        ],
        correctAnswer: 2,
        explanation: "When a property sells for more than the taxes owed, the surplus may belong to the previous owner, and that's what we help people claim."
      },
      {
        question: "Does MGR Capital Assistance charge upfront fees?",
        options: [
          "Yes, a small processing fee",
          "Yes, depending on the case value",
          "No, we only get paid if we're successful",
          "No, our services are completely free"
        ],
        correctAnswer: 2,
        explanation: "We don't charge upfront fees. We only receive a fee if we successfully help the client recover their funds."
      },
      {
        question: "What is your primary role as an employee?",
        options: [
          "Filing legal documents",
          "Connecting with clients and guiding them through the process",
          "Calculating surplus amounts",
          "Negotiating with counties"
        ],
        correctAnswer: 1,
        explanation: "Your role is focused on the human connection - reaching out to clients and helping them understand the process."
      },
      {
        question: "Which of the following should you discuss with clients?",
        options: [
          "Specific dollar amounts they'll receive",
          "Legal strategies we use",
          "The simple steps to move forward",
          "Our internal commission structure"
        ],
        correctAnswer: 2,
        explanation: "Keep conversations focused on simple next steps. Never discuss dollar amounts, legal strategy, or internal business details."
      }
    ]
  },

  // ----------------------------------------
  // MODULE 2: Client Call Basics
  // ----------------------------------------
  {
    id: "mod-002",
    title: "Client Call Basics",
    description: "How to introduce yourself, explain the opportunity, and keep it human and simple.",
    orderIndex: 2,
    requiredForTier: null,
    prerequisites: ["mod-001"],
    hasQuiz: true,
    passingScore: 80,
    content: `
# Client Call Basics

## The Golden Rule

**Be human, not salesy.**

You're not trying to convince anyone of anything. You're simply letting them know about an opportunity and offering to help.

## Your Opening

Here's how to introduce yourself:

> "Hey, is this [Name]? My name is [Your Name], I'm with MGR Capital Assistance.
>
> I'm reaching out because your property at [address] was recently sold by the county, and in some cases there's money left over that the owner can still claim.
>
> I'm not here to sell you anything — I just help people understand what's available and handle the paperwork if they decide to move forward.
>
> If you'd like, I can check your case and let you know what it looks like. There's no upfront cost."

## Why This Works

1. **You identify yourself clearly** - No confusion about who's calling
2. **You reference their specific property** - Shows this is about them, not a random sales call
3. **You explain simply** - No jargon, no confusion
4. **You remove pressure** - "I'm not here to sell you anything"
5. **You offer to help** - Not push, not convince - help

## Common Responses and How to Handle Them

### "How did you get my number?"
> "Your property records are public information. When a property is sold by the county, that information is available. I just wanted to reach out in case you weren't aware there might be money available."

### "Is this a scam?"
> "I totally understand the concern. We're a legitimate company - you can look us up. And there's no cost upfront - we only receive a fee if we're successful in helping you. You can also verify with the county that surplus funds exist."

### "How much money is it?"
> "I don't have exact numbers right now - every case is different and depends on what the county has on record. What I can do is check into it and let you know what we find."

### "I'm not interested."
> "No problem at all. If you change your mind or have any questions later, feel free to reach out. Have a great day!"

## What to NEVER Say

- Never mention specific dollar amounts
- Never guarantee any outcome
- Never pressure or create urgency
- Never use words like "lawsuit," "attorney," or "legal action"
- Never mention "surplus," "overage," or industry terms
- Never discuss what you earn or how you're paid

## The Tone

- Conversational, like you're talking to a neighbor
- Helpful, not pushy
- Patient and understanding
- Honest and straightforward

## Practice Exercise

Before your first call, read the script out loud 10 times. Get comfortable with it so it sounds natural, not rehearsed.

## Next Steps

Complete the quiz, then proceed to "Compliance & Boundaries" to learn what you can and cannot say.
    `,
    questions: [
      {
        question: "What's the best way to start a call with a potential client?",
        options: [
          "Jump straight into how much money they could get",
          "Introduce yourself and reference their specific property",
          "Ask if they want to make some quick money",
          "Explain your company's history and credentials"
        ],
        correctAnswer: 1,
        explanation: "Always introduce yourself clearly and reference their specific property so they know this isn't a random sales call."
      },
      {
        question: "A client asks 'How much money is it?' How should you respond?",
        options: [
          "Tell them the exact surplus amount from your system",
          "Estimate based on similar cases",
          "Explain you don't have exact numbers and offer to look into it",
          "Avoid the question and change the subject"
        ],
        correctAnswer: 2,
        explanation: "Never mention specific amounts. Explain that every case is different and you can check into it for them."
      },
      {
        question: "If a client says 'This sounds like a scam,' what should you do?",
        options: [
          "Get defensive and argue",
          "Hang up immediately",
          "Acknowledge their concern and explain you're legitimate with no upfront costs",
          "Promise them guaranteed money to prove it's real"
        ],
        correctAnswer: 2,
        explanation: "Acknowledge their concern calmly, explain that you're legitimate, there are no upfront costs, and they can verify everything themselves."
      },
      {
        question: "Which word should you NEVER use with clients?",
        options: [
          "Property",
          "County",
          "Surplus",
          "Help"
        ],
        correctAnswer: 2,
        explanation: "Never use industry terms like 'surplus,' 'overage,' or 'excess proceeds' with clients. Keep language simple and human."
      }
    ]
  },

  // ----------------------------------------
  // MODULE 3: Compliance & Boundaries
  // ----------------------------------------
  {
    id: "mod-003",
    title: "Compliance & Boundaries",
    description: "What you can say, what you cannot say, and how to protect the company and the client.",
    orderIndex: 3,
    requiredForTier: null,
    prerequisites: ["mod-002"],
    hasQuiz: true,
    passingScore: 90,
    content: `
# Compliance & Boundaries

This is the most important module. Read it carefully.

## Why Boundaries Matter

1. **Protect the client** - People deserve accurate information, not false promises
2. **Protect the company** - Non-compliant statements can create legal issues
3. **Protect yourself** - Following guidelines keeps you in good standing

## Things You CANNOT Say

### Never Promise Outcomes
❌ "You're definitely getting money"
❌ "This is guaranteed"
❌ "You'll receive at least $X"
❌ "I promise this will work out"

✅ Instead: "There may be money available, and we'll help you find out."

### Never Mention Specific Amounts
❌ "There's $15,000 waiting for you"
❌ "You could get around $10,000"
❌ "Similar cases usually get $5,000"

✅ Instead: "I don't have exact numbers - every case is different."

### Never Discuss Legal Strategy
❌ "We file a motion with the court"
❌ "Our lawyers will handle it"
❌ "The legal process takes about 3 months"

✅ Instead: "Our team handles all the paperwork and filings."

### Never Create Urgency or Pressure
❌ "You need to act now"
❌ "The deadline is coming up fast"
❌ "If you don't sign today, you'll miss out"

✅ Instead: "Take your time and let me know if you have questions."

### Never Use Industry Terms
❌ "Surplus funds"
❌ "Overages"
❌ "Excess proceeds"
❌ "Tax lien surplus"

✅ Instead: "Money left over from the sale"

## Things You CAN Say

- "There may be money available from when your property was sold"
- "We help people access money they might not know exists"
- "There's no cost unless we're successful"
- "We handle all the paperwork"
- "You can take your time to decide"
- "Feel free to verify this with the county"

## When You're Not Sure

If a client asks something you're not sure how to answer:

> "That's a great question. Our team handles the technical side — my job is just to help you through the steps. Let me make a note and have someone follow up with more details."

This is always acceptable. It's honest, helpful, and keeps you within boundaries.

## Red Flags to Avoid

If you find yourself:
- Estimating amounts
- Promising timelines
- Explaining legal procedures
- Feeling pressured to say more

**STOP. Reset. Return to the script.**

## Daily Checklist

Before each call, remind yourself:
□ I will not mention specific amounts
□ I will not promise outcomes
□ I will not create urgency
□ I will keep it human and simple
□ I will stick to the script

## Consequences of Non-Compliance

Violations may result in:
- Additional training requirements
- Reduced case assignments
- Termination in serious cases

This isn't to scare you - it's to emphasize that these rules exist for good reasons and must be followed.

## Next Steps

Complete the quiz (90% required to pass). Then move on to "Using Your Office" to learn the system.
    `,
    questions: [
      {
        question: "A client asks 'Can you guarantee I'll get the money?' What's the correct response?",
        options: [
          "Yes, we have a 95% success rate",
          "I can't guarantee anything, but there may be money available",
          "Absolutely, we always succeed",
          "Probably, most cases work out"
        ],
        correctAnswer: 1,
        explanation: "Never guarantee outcomes. Explain that there may be money available and you'll help them find out."
      },
      {
        question: "Which phrase is compliant?",
        options: [
          "There's $12,000 in surplus waiting for you",
          "You need to sign today before the deadline",
          "We'll file a lawsuit on your behalf",
          "There may be money left over from the sale"
        ],
        correctAnswer: 3,
        explanation: "The only compliant phrase is 'There may be money left over from the sale.' It's accurate and doesn't promise amounts, create urgency, or discuss legal procedures."
      },
      {
        question: "What should you do if you don't know how to answer a client's question?",
        options: [
          "Make up an answer that sounds good",
          "Say 'Our team handles the technical side - let me make a note'",
          "Change the subject quickly",
          "Promise to get them an exact answer by tomorrow"
        ],
        correctAnswer: 1,
        explanation: "If unsure, acknowledge it and explain that the technical team handles those details. Never make things up."
      },
      {
        question: "Why do compliance boundaries exist?",
        options: [
          "To make your job harder",
          "To limit how much money clients can get",
          "To protect the client, company, and yourself",
          "To slow down the process"
        ],
        correctAnswer: 2,
        explanation: "Boundaries exist to protect everyone - clients get accurate information, the company avoids legal issues, and you stay in good standing."
      },
      {
        question: "Which word should you use instead of 'surplus'?",
        options: [
          "Overages",
          "Excess proceeds",
          "Money left over from the sale",
          "Tax lien funds"
        ],
        correctAnswer: 2,
        explanation: "Use simple, plain language like 'money left over from the sale' instead of industry terms."
      }
    ]
  },

  // ----------------------------------------
  // MODULE 4: Using Your Office
  // ----------------------------------------
  {
    id: "mod-004",
    title: "Using Your Office",
    description: "How to navigate the employee portal, manage cases, and track your progress.",
    orderIndex: 4,
    requiredForTier: null,
    prerequisites: ["mod-003"],
    hasQuiz: true,
    passingScore: 80,
    content: `
# Using Your Office

Your Employee Office is where you manage your day-to-day work. Let's walk through it.

## Dashboard Overview

When you log in, you'll see:

1. **Your Stats** - Your rank, commission rate, and earnings
2. **My Cases** - Cases assigned to you
3. **Training** - Training modules and progress
4. **Earnings** - Your commission history

## My Cases

This is where you'll spend most of your time.

### Case List
- See all cases assigned to you
- Each case shows: Client name, property address, status
- Click on a case to see details

### Case Statuses
- **New** - Fresh case, needs first contact
- **Contacted** - You've reached the client
- **Docs Pending** - Waiting for client signatures
- **Docs Signed** - Documents completed, in processing
- **Filed** - Claim submitted to county
- **Awaiting Funds** - Approved, waiting for disbursement
- **Paid** - Complete!

### What You Do at Each Stage

**New**
→ Call the client using the script
→ Log the outcome
→ If interested, move to Contacted

**Contacted**
→ Send portal link
→ Follow up if needed
→ Help with questions

**Docs Pending**
→ Check on signature status
→ Answer client questions
→ Remind if needed (gently)

**Docs Signed and beyond**
→ Update client on status when they ask
→ No active work needed - our team handles it

## Adding Notes

After every interaction:
1. Click on the case
2. Add a note with:
   - Date and time
   - What happened
   - Next steps
   - Any client concerns

Good notes = smooth handoffs and better tracking.

## Scripts & Tools

Your Office has scripts for every situation:
- Initial call script
- Follow-up script
- Voicemail script
- Text templates
- Email templates

**Always use the provided scripts.** They're designed to be effective and compliant.

## Checking Your Earnings

- View your commission for each case
- See your monthly total
- Track your progress toward next tier

Remember: Your displayed rate shows what you earn. Focus on helping clients and the earnings follow.

## Daily Routine

1. **Check your cases** - See what needs attention
2. **Prioritize new cases** - Fresh leads first
3. **Follow up on pending** - Check docs status
4. **Update notes** - After every interaction
5. **Review scripts** - Stay sharp

## Getting Help

If you need help:
- Check your training materials first
- Ask your team leader
- Contact support for technical issues

## Next Steps

Complete the quiz. Congratulations - after this, you've completed core training!
    `,
    questions: [
      {
        question: "What should you do after every client interaction?",
        options: [
          "Nothing, just move to the next case",
          "Add a note with date, outcome, and next steps",
          "Send an email to your manager",
          "Update the client's contact info"
        ],
        correctAnswer: 1,
        explanation: "Always add notes after interactions. Include what happened, when, and what's next."
      },
      {
        question: "When a case is in 'Docs Signed' status, what should you do?",
        options: [
          "Call the client daily for updates",
          "Start the legal filing process",
          "Update the client if they ask - our team handles the rest",
          "Close the case"
        ],
        correctAnswer: 2,
        explanation: "After documents are signed, our internal team handles processing. Your role is just to update the client if they reach out."
      },
      {
        question: "Where should you find call scripts?",
        options: [
          "Write your own based on experience",
          "Use the scripts provided in your Office",
          "Copy from other employees",
          "Search online for examples"
        ],
        correctAnswer: 1,
        explanation: "Always use the provided scripts in your Office. They're designed to be compliant and effective."
      },
      {
        question: "What's the first thing you should do each day?",
        options: [
          "Check your earnings",
          "Update your profile",
          "Check your cases to see what needs attention",
          "Complete additional training"
        ],
        correctAnswer: 2,
        explanation: "Start each day by reviewing your cases. See what's new, what needs follow-up, and prioritize your work."
      }
    ]
  }
];

// ============================================
// TRAINING SERVICE CLASS
// ============================================

export class TrainingService {
  // ----------------------------------------
  // MODULE MANAGEMENT
  // ----------------------------------------

  /**
   * Get all training modules
   */
  getAllModules(): Array<{
    id: string;
    title: string;
    description: string;
    orderIndex: number;
    hasQuiz: boolean;
    passingScore: number | null;
  }> {
    return TRAINING_MODULES.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      orderIndex: m.orderIndex,
      hasQuiz: m.hasQuiz,
      passingScore: m.passingScore
    }));
  }

  /**
   * Get full module content
   */
  getModule(moduleId: string): TrainingModuleData | null {
    return TRAINING_MODULES.find(m => m.id === moduleId) || null;
  }

  /**
   * Get module content (without quiz answers)
   */
  getModuleForEmployee(moduleId: string): {
    id: string;
    title: string;
    description: string;
    content: string;
    hasQuiz: boolean;
    passingScore: number | null;
    questions: Array<{
      question: string;
      options: string[];
    }>;
  } | null {
    const module = this.getModule(moduleId);
    if (!module) return null;

    return {
      id: module.id,
      title: module.title,
      description: module.description,
      content: module.content,
      hasQuiz: module.hasQuiz,
      passingScore: module.passingScore,
      questions: module.questions.map(q => ({
        question: q.question,
        options: q.options
      }))
    };
  }

  // ----------------------------------------
  // PROGRESS TRACKING
  // ----------------------------------------

  /**
   * Get employee's training progress
   */
  async getEmployeeProgress(employeeId: string): Promise<Array<{
    moduleId: string;
    title: string;
    status: TrainingModuleStatus;
    progress: number;
    bestScore: number | null;
    completedAt: Date | null;
  }>> {
    // Get or create progress records
    const progress = await prisma.employeeTrainingProgress.findMany({
      where: { employeeId },
      include: { module: true }
    });

    // Build progress map
    const progressMap = new Map(progress.map(p => [p.moduleId, p]));

    // Return all modules with progress
    return TRAINING_MODULES.map(module => {
      const prog = progressMap.get(module.id);
      return {
        moduleId: module.id,
        title: module.title,
        status: prog?.status || this.calculateStatus(module, progressMap),
        progress: prog?.progress || 0,
        bestScore: prog?.bestScore || null,
        completedAt: prog?.completedAt || null
      };
    });
  }

  /**
   * Calculate module status based on prerequisites
   */
  private calculateStatus(
    module: TrainingModuleData,
    progressMap: Map<string, any>
  ): TrainingModuleStatus {
    // Check if prerequisites are completed
    for (const prereq of module.prerequisites) {
      const prereqProgress = progressMap.get(prereq);
      if (!prereqProgress || prereqProgress.status !== "COMPLETED") {
        return "LOCKED";
      }
    }
    return "AVAILABLE";
  }

  /**
   * Start a module
   */
  async startModule(employeeId: string, moduleId: string): Promise<boolean> {
    const module = this.getModule(moduleId);
    if (!module) return false;

    // Check prerequisites
    for (const prereq of module.prerequisites) {
      const progress = await prisma.employeeTrainingProgress.findUnique({
        where: {
          employeeId_moduleId: { employeeId, moduleId: prereq }
        }
      });
      if (!progress || progress.status !== "COMPLETED") {
        return false; // Prerequisites not met
      }
    }

    // Create or update progress
    await prisma.employeeTrainingProgress.upsert({
      where: {
        employeeId_moduleId: { employeeId, moduleId }
      },
      create: {
        employeeId,
        moduleId,
        status: "IN_PROGRESS",
        startedAt: new Date()
      },
      update: {
        status: "IN_PROGRESS",
        startedAt: new Date()
      }
    });

    return true;
  }

  /**
   * Submit quiz answers
   */
  async submitQuiz(
    employeeId: string,
    moduleId: string,
    answers: number[]
  ): Promise<{
    passed: boolean;
    score: number;
    required: number;
    feedback: Array<{
      questionIndex: number;
      correct: boolean;
      explanation: string;
    }>;
  }> {
    const module = this.getModule(moduleId);
    if (!module || !module.hasQuiz) {
      throw new Error("Module not found or has no quiz");
    }

    // Score the quiz
    let correct = 0;
    const feedback: Array<{
      questionIndex: number;
      correct: boolean;
      explanation: string;
    }> = [];

    for (let i = 0; i < module.questions.length; i++) {
      const question = module.questions[i];
      const isCorrect = answers[i] === question.correctAnswer;

      if (isCorrect) correct++;

      feedback.push({
        questionIndex: i,
        correct: isCorrect,
        explanation: question.explanation
      });
    }

    const score = Math.round((correct / module.questions.length) * 100);
    const passed = score >= (module.passingScore || 80);

    // Update progress
    const progress = await prisma.employeeTrainingProgress.findUnique({
      where: {
        employeeId_moduleId: { employeeId, moduleId }
      }
    });

    await prisma.employeeTrainingProgress.upsert({
      where: {
        employeeId_moduleId: { employeeId, moduleId }
      },
      create: {
        employeeId,
        moduleId,
        status: passed ? "COMPLETED" : "IN_PROGRESS",
        quizAttempts: 1,
        bestScore: score,
        passedAt: passed ? new Date() : null,
        completedAt: passed ? new Date() : null
      },
      update: {
        status: passed ? "COMPLETED" : "IN_PROGRESS",
        quizAttempts: { increment: 1 },
        bestScore: Math.max(progress?.bestScore || 0, score),
        passedAt: passed && !progress?.passedAt ? new Date() : undefined,
        completedAt: passed && !progress?.completedAt ? new Date() : undefined
      }
    });

    // Check if all modules completed
    if (passed) {
      await this.checkTrainingCompletion(employeeId);
    }

    return {
      passed,
      score,
      required: module.passingScore || 80,
      feedback
    };
  }

  /**
   * Check if employee has completed all required training
   */
  private async checkTrainingCompletion(employeeId: string): Promise<void> {
    const progress = await prisma.employeeTrainingProgress.findMany({
      where: { employeeId, status: "COMPLETED" }
    });

    const completedModules = new Set(progress.map(p => p.moduleId));
    const allRequired = TRAINING_MODULES.filter(m => !m.requiredForTier);

    const allCompleted = allRequired.every(m => completedModules.has(m.id));

    if (allCompleted) {
      await prisma.user.update({
        where: { id: employeeId },
        data: { trainingCompleted: true }
      });
    }
  }

  // ----------------------------------------
  // ADMIN FUNCTIONS
  // ----------------------------------------

  /**
   * Get training statistics (ADMIN/FOUNDER)
   */
  async getTrainingStatistics(): Promise<{
    totalEmployees: number;
    completedTraining: number;
    inProgress: number;
    notStarted: number;
    averageScore: number;
    moduleCompletion: Record<string, number>;
  }> {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      include: {
        trainingProgress: true
      }
    });

    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let totalScore = 0;
    let scoreCount = 0;
    const moduleCompletion: Record<string, number> = {};

    for (const emp of employees) {
      if (emp.trainingCompleted) {
        completed++;
      } else if (emp.trainingProgress.length > 0) {
        inProgress++;
      } else {
        notStarted++;
      }

      for (const prog of emp.trainingProgress) {
        if (prog.bestScore) {
          totalScore += prog.bestScore;
          scoreCount++;
        }
        if (prog.status === "COMPLETED") {
          moduleCompletion[prog.moduleId] = (moduleCompletion[prog.moduleId] || 0) + 1;
        }
      }
    }

    return {
      totalEmployees: employees.length,
      completedTraining: completed,
      inProgress,
      notStarted,
      averageScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
      moduleCompletion
    };
  }

  /**
   * Reset employee training progress (ADMIN)
   */
  async resetProgress(employeeId: string): Promise<void> {
    await prisma.employeeTrainingProgress.deleteMany({
      where: { employeeId }
    });

    await prisma.user.update({
      where: { id: employeeId },
      data: { trainingCompleted: false }
    });
  }
}

export const trainingService = new TrainingService();
