/**
 * SEED DATA — MGR CAPITAL ASSISTANCE
 *
 * This file creates demo/seed data for development and testing.
 *
 * DEMO DATA IDENTIFICATION (ID prefix convention):
 * All demo data uses specific ID prefixes so the DemoDataService can identify
 * and automatically clean them up when real data arrives:
 *
 * - Demo tenant ID: "tenant_mgr_capital"
 * - Demo user IDs: "user_founder_", "user_admin_", "user_employee_", "user_client_"
 * - Demo case IDs: "case_"
 * - Demo source IDs: "source_"
 * - Demo state rule IDs: "staterule_"
 * - Demo county rule IDs: "countyrule_"
 * - Demo training module IDs: "training_"
 * - Demo commission plan IDs: "commission_"
 * - Demo bot subscription IDs: "botsub_"
 * - Demo deadline IDs: "deadline_"
 * - Demo communication IDs: "comm_"
 * - Demo ledger entry IDs: "ledger_"
 * - Demo question IDs: "question_"
 *
 * When real data is created (IDs without these prefixes), the DemoDataService
 * will automatically detect and clean up the demo data.
 *
 * @see backend/src/services/DemoDataService.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing data in correct order (respecting foreign keys)
  console.log('Clearing existing data...');

  await prisma.communication.deleteMany();
  await prisma.deadline.deleteMany();
  await prisma.document.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.employeeTrainingProgress.deleteMany();
  await prisma.trainingQuestion.deleteMany();
  await prisma.trainingModule.deleteMany();
  await prisma.botUsageLog.deleteMany();
  await prisma.botSubscription.deleteMany();
  await prisma.case.deleteMany();
  await prisma.countyRule.deleteMany();
  await prisma.stateRule.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // Hash password for all users
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ============================================
  // TENANT
  // ============================================
  console.log('Creating tenant...');

  const tenant = await prisma.tenant.create({
    data: {
      id: 'tenant_mgr_capital',
      name: 'MGR Capital',
      slug: 'mgr-capital',
      domain: 'mgrcapital.com',
      isActive: true,
      plan: 'enterprise',
      maxUsers: 500,
      maxCases: 10000,
      settings: {
        features: ['ai_bots', 'training', 'analytics', 'notary'],
        branding: {
          primaryColor: '#1a365d',
          secondaryColor: '#2d3748',
          accentColor: '#3182ce',
        },
      },
    },
  });

  // ============================================
  // USERS
  // ============================================
  console.log('Creating users...');

  // FOUNDER
  const founder = await prisma.user.create({
    data: {
      id: 'user_founder_001',
      email: 'marcus@mgrcapital.com',
      passwordHash,
      role: 'FOUNDER',
      name: 'Marcus Richardson',
      phone: '+1-615-555-0100',
      address: '100 Capital Drive',
      city: 'Nashville',
      state: 'TN',
      zipCode: '37203',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      lastLoginAt: new Date(),
    },
  });

  // ADMINS (2)
  const admin1 = await prisma.user.create({
    data: {
      id: 'user_admin_001',
      email: 'jennifer.chen@mgrcapital.com',
      passwordHash,
      role: 'ADMIN',
      name: 'Jennifer Chen',
      phone: '+1-615-555-0101',
      address: '200 Admin Lane',
      city: 'Nashville',
      state: 'TN',
      zipCode: '37203',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
  });

  const admin2 = await prisma.user.create({
    data: {
      id: 'user_admin_002',
      email: 'robert.thompson@mgrcapital.com',
      passwordHash,
      role: 'ADMIN',
      name: 'Robert Thompson',
      phone: '+1-615-555-0102',
      address: '201 Admin Lane',
      city: 'Nashville',
      state: 'TN',
      zipCode: '37203',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      lastLoginAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    },
  });

  // EMPLOYEES (5 at different tiers)
  const employee1 = await prisma.user.create({
    data: {
      id: 'user_employee_001',
      email: 'sarah.williams@mgrcapital.com',
      passwordHash,
      role: 'EMPLOYEE',
      name: 'Sarah Williams',
      phone: '+1-615-555-0201',
      address: '301 Recovery Blvd',
      city: 'Nashville',
      state: 'TN',
      zipCode: '37210',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      employeeTier: 'TIER_5_EXECUTIVE_PARTNER',
      hireDate: new Date('2022-03-15'),
      trainingCompleted: true,
      lastLoginAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    },
  });

  const employee2 = await prisma.user.create({
    data: {
      id: 'user_employee_002',
      email: 'michael.johnson@mgrcapital.com',
      passwordHash,
      role: 'EMPLOYEE',
      name: 'Michael Johnson',
      phone: '+1-615-555-0202',
      address: '302 Recovery Blvd',
      city: 'Nashville',
      state: 'TN',
      zipCode: '37210',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      employeeTier: 'TIER_4_TEAM_LEADER',
      hireDate: new Date('2023-01-10'),
      trainingCompleted: true,
      teamLeaderId: employee1.id,
      lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  });

  const employee3 = await prisma.user.create({
    data: {
      id: 'user_employee_003',
      email: 'amanda.garcia@mgrcapital.com',
      passwordHash,
      role: 'EMPLOYEE',
      name: 'Amanda Garcia',
      phone: '+1-512-555-0301',
      address: '450 Congress Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      employeeTier: 'TIER_3_SENIOR_SPECIALIST',
      hireDate: new Date('2023-06-01'),
      trainingCompleted: true,
      teamLeaderId: employee2.id,
      lastLoginAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
  });

  const employee4 = await prisma.user.create({
    data: {
      id: 'user_employee_004',
      email: 'david.martinez@mgrcapital.com',
      passwordHash,
      role: 'EMPLOYEE',
      name: 'David Martinez',
      phone: '+1-305-555-0401',
      address: '789 Biscayne Blvd',
      city: 'Miami',
      state: 'FL',
      zipCode: '33132',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      employeeTier: 'TIER_2_SPECIALIST',
      hireDate: new Date('2024-02-15'),
      trainingCompleted: true,
      teamLeaderId: employee2.id,
      lastLoginAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    },
  });

  const employee5 = await prisma.user.create({
    data: {
      id: 'user_employee_005',
      email: 'emily.brown@mgrcapital.com',
      passwordHash,
      role: 'EMPLOYEE',
      name: 'Emily Brown',
      phone: '+1-404-555-0501',
      address: '123 Peachtree St',
      city: 'Atlanta',
      state: 'GA',
      zipCode: '30303',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      employeeTier: 'TIER_1_ASSOCIATE',
      hireDate: new Date('2025-01-05'),
      trainingCompleted: false,
      teamLeaderId: employee3.id,
      lastLoginAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  });

  // CLIENTS (3)
  const client1 = await prisma.user.create({
    data: {
      id: 'user_client_001',
      email: 'james.wilson@email.com',
      passwordHash,
      role: 'CLIENT',
      name: 'James Wilson',
      phone: '+1-615-555-1001',
      address: '456 Oak Street',
      city: 'Memphis',
      state: 'TN',
      zipCode: '38103',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      ssn4: '4532',
      dateOfBirth: new Date('1978-05-22'),
    },
  });

  const client2 = await prisma.user.create({
    data: {
      id: 'user_client_002',
      email: 'patricia.davis@email.com',
      passwordHash,
      role: 'CLIENT',
      name: 'Patricia Davis',
      phone: '+1-713-555-2001',
      address: '789 Houston Way',
      city: 'Houston',
      state: 'TX',
      zipCode: '77002',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      ssn4: '7891',
      dateOfBirth: new Date('1965-11-08'),
    },
  });

  const client3 = await prisma.user.create({
    data: {
      id: 'user_client_003',
      email: 'richard.moore@email.com',
      passwordHash,
      role: 'CLIENT',
      name: 'Richard Moore',
      phone: '+1-407-555-3001',
      address: '321 Orange Blossom Trail',
      city: 'Orlando',
      state: 'FL',
      zipCode: '32801',
      isActive: true,
      emailVerified: true,
      tenantId: tenant.id,
      ssn4: '2156',
      dateOfBirth: new Date('1982-03-14'),
    },
  });

  // ============================================
  // STATE RULES (5 states)
  // ============================================
  console.log('Creating state rules...');

  const stateRuleTN = await prisma.stateRule.create({
    data: {
      id: 'staterule_tn',
      stateCode: 'TN',
      stateName: 'Tennessee',
      surplusFundLaw: 'Tennessee Code Annotated § 67-5-2701 et seq. - Tax Sale Surplus Funds',
      claimPeriodDays: 365,
      redemptionPeriodDays: 365,
      interestRate: 10.0,
      requiredDocuments: ['CLIENT_SERVICE_AGREEMENT', 'LIMITED_POA', 'AFFIDAVIT', 'CLIENT_ID'],
      filingFee: 5000, // $50.00
      filingMethod: 'mail',
      filingAddress: 'County Clerk Office, respective county courthouse',
      deadlineCalculation: 'One year from the date of tax sale. Must file claim with County Clerk before deadline.',
      specialRequirements: 'Affidavit must be notarized. Limited POA requires two witnesses.',
      restrictions: 'Claims must be filed in the county where the property is located.',
      lastVerified: new Date('2025-01-15'),
      sourceUrl: 'https://law.justia.com/codes/tennessee/2023/title-67/chapter-5/part-27/',
      notes: 'Tennessee is a tax lien state with 1-year redemption period.',
      isActive: true,
    },
  });

  const stateRuleTX = await prisma.stateRule.create({
    data: {
      id: 'staterule_tx',
      stateCode: 'TX',
      stateName: 'Texas',
      surplusFundLaw: 'Texas Tax Code § 34.03 - Excess Proceeds',
      claimPeriodDays: 730, // 2 years
      redemptionPeriodDays: 180,
      interestRate: 25.0, // Texas has high penalty rates
      requiredDocuments: ['CLIENT_SERVICE_AGREEMENT', 'LIMITED_POA', 'AFFIDAVIT', 'CLIENT_ID', 'W9_FORM'],
      filingFee: 7500, // $75.00
      filingMethod: 'electronic',
      filingAddress: 'Texas Comptroller of Public Accounts, Unclaimed Property Division',
      deadlineCalculation: 'Two years from the date of tax sale. Electronic filing preferred.',
      specialRequirements: 'W-9 required for tax reporting. Affidavit must include property description.',
      restrictions: 'Must prove ownership chain through heirship if original owner is deceased.',
      lastVerified: new Date('2025-01-10'),
      sourceUrl: 'https://statutes.capitol.texas.gov/Docs/TX/htm/TX.34.htm',
      notes: 'Texas has one of the highest redemption interest rates in the country.',
      isActive: true,
    },
  });

  const stateRuleFL = await prisma.stateRule.create({
    data: {
      id: 'staterule_fl',
      stateCode: 'FL',
      stateName: 'Florida',
      surplusFundLaw: 'Florida Statutes § 197.582 - Distribution of Surplus',
      claimPeriodDays: 120,
      redemptionPeriodDays: null, // Florida has a different system
      interestRate: 18.0,
      requiredDocuments: ['CLIENT_SERVICE_AGREEMENT', 'LIMITED_POA', 'MOTION', 'CLIENT_ID'],
      filingFee: 10000, // $100.00
      filingMethod: 'in-person',
      filingAddress: 'Circuit Court Clerk, respective county',
      deadlineCalculation: '120 days from issuance of tax deed. Court motion required.',
      specialRequirements: 'Must file a motion with the Circuit Court. Attorney representation recommended for large claims.',
      restrictions: 'Surplus under $500 may be claimed administratively; larger amounts require court motion.',
      lastVerified: new Date('2025-01-12'),
      sourceUrl: 'http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0100-0199/0197/Sections/0197.582.html',
      notes: 'Florida requires court involvement for most surplus claims.',
      isActive: true,
    },
  });

  const stateRuleGA = await prisma.stateRule.create({
    data: {
      id: 'staterule_ga',
      stateCode: 'GA',
      stateName: 'Georgia',
      surplusFundLaw: 'Official Code of Georgia Annotated § 48-4-5 - Excess Funds',
      claimPeriodDays: 1095, // 3 years
      redemptionPeriodDays: 365,
      interestRate: 20.0,
      requiredDocuments: ['CLIENT_SERVICE_AGREEMENT', 'LIMITED_POA', 'AFFIDAVIT', 'CLIENT_ID', 'HEIRSHIP_CHART'],
      filingFee: 5000, // $50.00
      filingMethod: 'mail',
      filingAddress: 'Tax Commissioner, respective county',
      deadlineCalculation: 'Three years from the date of tax sale. Claim with Tax Commissioner.',
      specialRequirements: 'Heirship affidavit required if claimant is heir. Notarized documents required.',
      restrictions: 'Georgia has a complex heirship verification process.',
      lastVerified: new Date('2025-01-08'),
      sourceUrl: 'https://law.justia.com/codes/georgia/2023/title-48/chapter-4/article-1/section-48-4-5/',
      notes: 'Georgia has a longer claim period but strict documentation requirements.',
      isActive: true,
    },
  });

  const stateRuleCA = await prisma.stateRule.create({
    data: {
      id: 'staterule_ca',
      stateCode: 'CA',
      stateName: 'California',
      surplusFundLaw: 'California Revenue and Taxation Code § 4675 - Excess Proceeds',
      claimPeriodDays: 365,
      redemptionPeriodDays: null,
      interestRate: null, // Varies by county
      requiredDocuments: ['CLIENT_SERVICE_AGREEMENT', 'LIMITED_POA', 'AFFIDAVIT', 'CLIENT_ID', 'PROPERTY_DEED'],
      filingFee: 15000, // $150.00
      filingMethod: 'mail',
      filingAddress: 'County Treasurer-Tax Collector, respective county',
      deadlineCalculation: 'One year from recordation of tax deed. Claim with County Treasurer-Tax Collector.',
      specialRequirements: 'Requires proof of former ownership interest. Documentary stamp tax may apply.',
      restrictions: 'California has county-specific requirements. Contact county for exact procedures.',
      lastVerified: new Date('2025-01-05'),
      sourceUrl: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=4675&lawCode=RTC',
      notes: 'California varies significantly by county. LA County has online filing.',
      isActive: true,
    },
  });

  // ============================================
  // COUNTY RULES
  // ============================================
  console.log('Creating county rules...');

  await prisma.countyRule.createMany({
    data: [
      {
        id: 'countyrule_tn_davidson',
        stateCode: 'TN',
        countyName: 'Davidson',
        clerkName: 'Howard Gentry',
        clerkPhone: '+1-615-862-6080',
        clerkEmail: 'clerks-office@nashville.gov',
        clerkAddress: '1 Public Square, Suite 102, Nashville, TN 37201',
        localFilingFee: 5500, // Slightly higher
        localFilingMethod: 'mail',
        localRequirements: 'Davidson County requires certified mail for surplus claims.',
        notes: 'Nashville-Davidson metro government has unified services.',
        isActive: true,
      },
      {
        id: 'countyrule_tx_harris',
        stateCode: 'TX',
        countyName: 'Harris',
        clerkName: 'Teneshia Hudspeth',
        clerkPhone: '+1-713-274-8600',
        clerkEmail: 'countyclerk@harriscountytx.gov',
        clerkAddress: '201 Caroline St, Houston, TX 77002',
        localFilingFee: 7500,
        localFilingMethod: 'electronic',
        localRequirements: 'Harris County uses online portal for claims. Registration required.',
        notes: 'Largest county in Texas. High volume of tax sales.',
        isActive: true,
      },
      {
        id: 'countyrule_fl_orange',
        stateCode: 'FL',
        countyName: 'Orange',
        clerkName: 'Tiffany Moore Russell',
        clerkPhone: '+1-407-836-2060',
        clerkEmail: 'cfcc-info@ocfl.net',
        clerkAddress: '425 N Orange Ave, Orlando, FL 32801',
        localFilingFee: 10000,
        localFilingMethod: 'in-person',
        localRequirements: 'Orange County requires court filing for all surplus claims over $1,000.',
        notes: 'High tourism area, many tax deed sales from investment properties.',
        isActive: true,
      },
      {
        id: 'countyrule_tn_knox',
        stateCode: 'TN',
        countyName: 'Knox',
        clerkName: 'Charles Susano III',
        clerkPhone: '+1-865-215-2385',
        clerkEmail: 'chancery.clerk@knoxcounty.org',
        clerkAddress: '400 Main St, Knoxville, TN 37902',
        localFilingFee: 5000,
        localFilingMethod: 'mail',
        localRequirements: 'Knox County accepts surplus claims via certified mail.',
        notes: 'Knoxville metro area, moderate volume of tax sales.',
        isActive: true,
      },
      {
        id: 'countyrule_ga_fulton',
        stateCode: 'GA',
        countyName: 'Fulton',
        clerkName: 'Che Alexander',
        clerkPhone: '+1-404-612-4500',
        clerkEmail: 'clerk@fultoncountyga.gov',
        clerkAddress: '136 Pryor St SW, Atlanta, GA 30303',
        localFilingFee: 7500,
        localFilingMethod: 'electronic',
        localRequirements: 'Fulton County uses electronic filing system.',
        notes: 'Atlanta metro, high volume of tax sales.',
        isActive: true,
      },
      {
        id: 'countyrule_ga_cobb',
        stateCode: 'GA',
        countyName: 'Cobb',
        clerkName: 'Connie Taylor',
        clerkPhone: '+1-770-528-1300',
        clerkEmail: 'clerkofcourt@cobbcounty.org',
        clerkAddress: '70 Haynes St, Marietta, GA 30090',
        localFilingFee: 6500,
        localFilingMethod: 'mail',
        localRequirements: 'Cobb County requires notarized affidavit.',
        notes: 'Marietta metro area.',
        isActive: true,
      },
      {
        id: 'countyrule_ca_losangeles',
        stateCode: 'CA',
        countyName: 'Los Angeles',
        clerkName: 'Michael J. Villalobos',
        clerkPhone: '+1-213-974-1411',
        clerkEmail: 'ttcinfo@ttc.lacounty.gov',
        clerkAddress: '225 N Hill St, Los Angeles, CA 90012',
        localFilingFee: 15000,
        localFilingMethod: 'electronic',
        localRequirements: 'LA County requires court petition for surplus claims.',
        notes: 'Largest county in California, complex process.',
        isActive: true,
      },
      {
        id: 'countyrule_tn_shelby',
        stateCode: 'TN',
        countyName: 'Shelby',
        clerkName: 'Halbert Sullivan Jr',
        clerkPhone: '+1-901-222-3500',
        clerkEmail: 'clerksoffice@shelbycountytn.gov',
        clerkAddress: '140 Adams Ave, Memphis, TN 38103',
        localFilingFee: 5500,
        localFilingMethod: 'mail',
        localRequirements: 'Shelby County requires certified mail.',
        notes: 'Memphis metro area.',
        isActive: true,
      },
      {
        id: 'countyrule_tx_dallas',
        stateCode: 'TX',
        countyName: 'Dallas',
        clerkName: 'John Warren',
        clerkPhone: '+1-214-653-7131',
        clerkEmail: 'districtclerk@dallascounty.org',
        clerkAddress: '600 Commerce St, Dallas, TX 75202',
        localFilingFee: 7000,
        localFilingMethod: 'electronic',
        localRequirements: 'Dallas County uses online filing portal.',
        notes: 'Second largest county in Texas.',
        isActive: true,
      },
      {
        id: 'countyrule_fl_miamidade',
        stateCode: 'FL',
        countyName: 'Miami-Dade',
        clerkName: 'Juan Fernandez-Barquin',
        clerkPhone: '+1-305-275-1155',
        clerkEmail: 'clerkinfo@miamidade.gov',
        clerkAddress: '73 W Flagler St, Miami, FL 33130',
        localFilingFee: 12000,
        localFilingMethod: 'electronic',
        localRequirements: 'Miami-Dade requires court petition.',
        notes: 'Largest county in Florida.',
        isActive: true,
      },
    ],
  });

  // ============================================
  // CASES (10 at various statuses)
  // ============================================
  console.log('Creating cases...');

  const cases = await Promise.all([
    // Case 1: NEW
    prisma.case.create({
      data: {
        id: 'case_001',
        internalCode: 'MGR-2025-00001',
        caseNumber: 'TN-DAV-2025-001',
        status: 'NEW',
        tenantId: tenant.id,
        clientId: client1.id,
        assignedEmployeeId: employee5.id,
        state: 'TN',
        county: 'Davidson',
        propertyAddress: '1234 Main Street, Nashville, TN 37203',
        parcelNumber: '092-15-0-123.00',
        saleDate: new Date('2024-12-15'),
        previousOwner: 'Wilson Family Trust',
        surplusAmountCents: 2500000, // $25,000
        feePercent: 30,
        estimatedFeeCents: 750000, // $7,500
        redemptionDeadline: new Date('2025-12-15'),
        filingDeadline: new Date('2025-12-15'),
        source: 'county_scraper',
        priority: 8,
        notes: 'High value case. Client contacted us directly.',
      },
    }),

    // Case 2: CONTACTED
    prisma.case.create({
      data: {
        id: 'case_002',
        internalCode: 'MGR-2025-00002',
        caseNumber: 'TX-HAR-2025-001',
        status: 'CONTACTED',
        tenantId: tenant.id,
        clientId: client2.id,
        assignedEmployeeId: employee3.id,
        state: 'TX',
        county: 'Harris',
        propertyAddress: '5678 Houston Ave, Houston, TX 77002',
        parcelNumber: 'HAR-2024-45678',
        saleDate: new Date('2024-11-20'),
        previousOwner: 'Patricia Davis',
        surplusAmountCents: 1850000, // $18,500
        feePercent: 35,
        estimatedFeeCents: 647500,
        contactedAt: new Date('2025-01-20'),
        redemptionDeadline: new Date('2026-11-20'),
        filingDeadline: new Date('2026-11-20'),
        source: 'outreach_campaign',
        priority: 7,
      },
    }),

    // Case 3: DOCS_PENDING
    prisma.case.create({
      data: {
        id: 'case_003',
        internalCode: 'MGR-2025-00003',
        caseNumber: 'FL-ORA-2025-001',
        status: 'DOCS_PENDING',
        tenantId: tenant.id,
        clientId: client3.id,
        assignedEmployeeId: employee4.id,
        state: 'FL',
        county: 'Orange',
        propertyAddress: '910 International Dr, Orlando, FL 32819',
        parcelNumber: 'ORA-2024-91011',
        saleDate: new Date('2024-10-05'),
        previousOwner: 'Richard Moore',
        surplusAmountCents: 3200000, // $32,000
        feePercent: 30,
        estimatedFeeCents: 960000,
        contactedAt: new Date('2025-01-10'),
        docsRequestedAt: new Date('2025-01-15'),
        redemptionDeadline: new Date('2025-02-02'),
        filingDeadline: new Date('2025-02-02'),
        source: 'referral',
        priority: 9,
        notes: 'Urgent - short deadline!',
      },
    }),

    // Case 4: DOCS_SIGNED
    prisma.case.create({
      data: {
        id: 'case_004',
        internalCode: 'MGR-2025-00004',
        caseNumber: 'GA-FUL-2025-001',
        status: 'DOCS_SIGNED',
        tenantId: tenant.id,
        clientId: client1.id,
        assignedEmployeeId: employee2.id,
        state: 'GA',
        county: 'Fulton',
        propertyAddress: '1212 Peachtree Rd, Atlanta, GA 30309',
        parcelNumber: 'FUL-2024-12122',
        saleDate: new Date('2024-09-10'),
        previousOwner: 'Wilson Family Trust',
        surplusAmountCents: 4500000, // $45,000
        feePercent: 30,
        estimatedFeeCents: 1350000,
        contactedAt: new Date('2024-12-01'),
        docsRequestedAt: new Date('2024-12-15'),
        docsSignedAt: new Date('2025-01-05'),
        redemptionDeadline: new Date('2027-09-10'),
        filingDeadline: new Date('2027-09-10'),
        source: 'county_scraper',
        priority: 6,
      },
    }),

    // Case 5: FILED
    prisma.case.create({
      data: {
        id: 'case_005',
        internalCode: 'MGR-2024-00089',
        caseNumber: 'TN-SHE-2024-089',
        status: 'FILED',
        tenantId: tenant.id,
        clientId: client2.id,
        assignedEmployeeId: employee1.id,
        state: 'TN',
        county: 'Shelby',
        propertyAddress: '3456 Elvis Presley Blvd, Memphis, TN 38116',
        parcelNumber: 'SHE-2024-34567',
        saleDate: new Date('2024-06-01'),
        previousOwner: 'Davis Estate',
        surplusAmountCents: 6800000, // $68,000
        feePercent: 30,
        estimatedFeeCents: 2040000,
        contactedAt: new Date('2024-07-15'),
        docsRequestedAt: new Date('2024-08-01'),
        docsSignedAt: new Date('2024-08-20'),
        filedAt: new Date('2024-09-15'),
        claimNumber: 'CLM-2024-SHE-00234',
        redemptionDeadline: new Date('2025-06-01'),
        filingDeadline: new Date('2025-06-01'),
        source: 'county_scraper',
        priority: 5,
      },
    }),

    // Case 6: AWAITING_FUNDS
    prisma.case.create({
      data: {
        id: 'case_006',
        internalCode: 'MGR-2024-00075',
        caseNumber: 'TX-DAL-2024-075',
        status: 'AWAITING_FUNDS',
        tenantId: tenant.id,
        clientId: client3.id,
        assignedEmployeeId: employee1.id,
        state: 'TX',
        county: 'Dallas',
        propertyAddress: '7890 Commerce St, Dallas, TX 75201',
        parcelNumber: 'DAL-2024-78901',
        saleDate: new Date('2024-04-15'),
        previousOwner: 'Moore Properties LLC',
        surplusAmountCents: 12500000, // $125,000
        feePercent: 25,
        estimatedFeeCents: 3125000,
        contactedAt: new Date('2024-05-01'),
        docsRequestedAt: new Date('2024-05-15'),
        docsSignedAt: new Date('2024-06-01'),
        filedAt: new Date('2024-07-01'),
        fundsReceivedAt: null,
        claimNumber: 'CLM-2024-DAL-00567',
        courtCaseNumber: 'DC-2024-CV-45678',
        redemptionDeadline: new Date('2026-04-15'),
        filingDeadline: new Date('2026-04-15'),
        source: 'referral',
        priority: 10,
        notes: 'Large case - expected disbursement Q1 2025',
      },
    }),

    // Case 7: PAID
    prisma.case.create({
      data: {
        id: 'case_007',
        internalCode: 'MGR-2024-00045',
        caseNumber: 'FL-MIA-2024-045',
        status: 'PAID',
        tenantId: tenant.id,
        clientId: client1.id,
        assignedEmployeeId: employee1.id,
        state: 'FL',
        county: 'Miami-Dade',
        propertyAddress: '2345 Collins Ave, Miami Beach, FL 33139',
        parcelNumber: 'MIA-2024-23456',
        saleDate: new Date('2024-02-01'),
        previousOwner: 'Wilson Family Trust',
        surplusAmountCents: 8900000, // $89,000
        feePercent: 30,
        estimatedFeeCents: 2670000,
        actualFeeCents: 2670000,
        clientPayoutCents: 6230000,
        contactedAt: new Date('2024-03-01'),
        docsRequestedAt: new Date('2024-03-15'),
        docsSignedAt: new Date('2024-04-01'),
        filedAt: new Date('2024-05-01'),
        fundsReceivedAt: new Date('2024-10-15'),
        fundsDisbursedAt: new Date('2024-10-20'),
        paidAt: new Date('2024-10-20'),
        claimNumber: 'CLM-2024-MIA-00123',
        courtCaseNumber: 'MC-2024-CV-12345',
        redemptionDeadline: new Date('2024-06-01'),
        filingDeadline: new Date('2024-06-01'),
        source: 'county_scraper',
        priority: 0,
        recoveryAmountCents: 8900000,
      },
    }),

    // Case 8: CLOSED
    prisma.case.create({
      data: {
        id: 'case_008',
        internalCode: 'MGR-2024-00032',
        caseNumber: 'CA-LA-2024-032',
        status: 'CLOSED',
        tenantId: tenant.id,
        clientId: client2.id,
        assignedEmployeeId: employee2.id,
        state: 'CA',
        county: 'Los Angeles',
        propertyAddress: '6789 Sunset Blvd, Los Angeles, CA 90028',
        parcelNumber: 'LA-2024-67890',
        saleDate: new Date('2023-11-01'),
        previousOwner: 'Davis Family Trust',
        surplusAmountCents: 15000000, // $150,000
        feePercent: 25,
        estimatedFeeCents: 3750000,
        actualFeeCents: 3750000,
        clientPayoutCents: 11250000,
        contactedAt: new Date('2023-12-01'),
        docsRequestedAt: new Date('2023-12-15'),
        docsSignedAt: new Date('2024-01-01'),
        filedAt: new Date('2024-02-01'),
        fundsReceivedAt: new Date('2024-08-01'),
        fundsDisbursedAt: new Date('2024-08-05'),
        paidAt: new Date('2024-08-05'),
        closedAt: new Date('2024-08-10'),
        claimNumber: 'CLM-2024-LA-00089',
        courtCaseNumber: 'LA-2024-CV-78901',
        source: 'referral',
        priority: 0,
        recoveryAmountCents: 15000000,
      },
    }),

    // Case 9: REJECTED
    prisma.case.create({
      data: {
        id: 'case_009',
        internalCode: 'MGR-2024-00098',
        caseNumber: 'GA-COB-2024-098',
        status: 'REJECTED',
        tenantId: tenant.id,
        clientId: client3.id,
        assignedEmployeeId: employee4.id,
        state: 'GA',
        county: 'Cobb',
        propertyAddress: '111 Town Center Dr, Marietta, GA 30060',
        parcelNumber: 'COB-2024-11111',
        saleDate: new Date('2024-08-01'),
        previousOwner: 'Unknown Previous Owner',
        surplusAmountCents: 950000, // $9,500
        feePercent: 35,
        estimatedFeeCents: 332500,
        contactedAt: new Date('2024-09-01'),
        docsRequestedAt: new Date('2024-09-15'),
        docsSignedAt: new Date('2024-10-01'),
        filedAt: new Date('2024-10-15'),
        source: 'county_scraper',
        priority: 0,
        rejectionReason: 'Unable to verify client ownership. Missing heirship documentation.',
      },
    }),

    // Case 10: NEW (High priority)
    prisma.case.create({
      data: {
        id: 'case_010',
        internalCode: 'MGR-2025-00005',
        caseNumber: 'TN-KNO-2025-005',
        status: 'NEW',
        tenantId: tenant.id,
        clientId: client2.id,
        assignedEmployeeId: employee3.id,
        state: 'TN',
        county: 'Knox',
        propertyAddress: '222 Market Square, Knoxville, TN 37902',
        parcelNumber: 'KNO-2025-22222',
        saleDate: new Date('2025-01-10'),
        previousOwner: 'Davis Investment Group',
        surplusAmountCents: 7500000, // $75,000
        feePercent: 30,
        estimatedFeeCents: 2250000,
        redemptionDeadline: new Date('2026-01-10'),
        filingDeadline: new Date('2026-01-10'),
        source: 'outreach_campaign',
        priority: 9,
        notes: 'New high-value lead. Fast-track for contact.',
      },
    }),
  ]);

  // ============================================
  // BOT SUBSCRIPTIONS
  // ============================================
  console.log('Creating bot subscriptions...');

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  await Promise.all([
    // Employee 1: ENTERPRISE tier
    prisma.botSubscription.create({
      data: {
        id: 'botsub_001',
        userId: employee1.id,
        tier: 'ENTERPRISE',
        isActive: true,
        enabledBots: ['outreach', 'compliance', 'docket', 'docs', 'skip_trace', 'phone', 'ai_legal'],
        monthlyCostCents: 30000, // $300
        startDate: new Date('2024-06-01'),
        nextBillingDate: nextMonth,
        totalChargedCents: 240000, // 8 months
      },
    }),

    // Employee 2: PROFESSIONAL tier
    prisma.botSubscription.create({
      data: {
        id: 'botsub_002',
        userId: employee2.id,
        tier: 'PROFESSIONAL',
        isActive: true,
        enabledBots: ['outreach', 'compliance', 'docket', 'docs', 'skip_trace'],
        monthlyCostCents: 15000, // $150
        startDate: new Date('2024-09-01'),
        nextBillingDate: nextMonth,
        totalChargedCents: 75000, // 5 months
      },
    }),

    // Employee 3: PROFESSIONAL tier
    prisma.botSubscription.create({
      data: {
        id: 'botsub_003',
        userId: employee3.id,
        tier: 'PROFESSIONAL',
        isActive: true,
        enabledBots: ['outreach', 'compliance', 'docket', 'docs', 'skip_trace'],
        monthlyCostCents: 15000,
        startDate: new Date('2024-10-01'),
        nextBillingDate: nextMonth,
        totalChargedCents: 60000, // 4 months
      },
    }),

    // Employee 4: STARTER tier
    prisma.botSubscription.create({
      data: {
        id: 'botsub_004',
        userId: employee4.id,
        tier: 'STARTER',
        isActive: true,
        enabledBots: ['outreach', 'compliance'],
        monthlyCostCents: 5000, // $50
        startDate: new Date('2024-11-01'),
        nextBillingDate: nextMonth,
        totalChargedCents: 15000, // 3 months
      },
    }),

    // Employee 5: STARTER tier (new employee)
    prisma.botSubscription.create({
      data: {
        id: 'botsub_005',
        userId: employee5.id,
        tier: 'STARTER',
        isActive: true,
        enabledBots: ['outreach', 'compliance'],
        monthlyCostCents: 5000,
        startDate: new Date('2025-01-05'),
        nextBillingDate: nextMonth,
        totalChargedCents: 5000, // 1 month
      },
    }),
  ]);

  // ============================================
  // TRAINING MODULES (5 modules)
  // ============================================
  console.log('Creating training modules...');

  const module1 = await prisma.trainingModule.create({
    data: {
      id: 'training_001',
      title: 'Introduction to Tax Surplus Recovery',
      description: 'Learn the fundamentals of tax surplus recovery, including what surplus funds are, how they are created, and the legal basis for recovering them on behalf of former property owners.',
      content: `
# Introduction to Tax Surplus Recovery

## What Are Tax Surplus Funds?

Tax surplus funds (also known as overbid, excess proceeds, or overage) occur when a property is sold at a tax sale for more than the amount of delinquent taxes, penalties, and fees owed. The difference between the sale price and the tax debt becomes surplus funds.

## Key Concepts

### Tax Lien States vs Tax Deed States
- **Tax Lien States**: Investor purchases the lien, not the property. Owner has redemption period.
- **Tax Deed States**: Investor purchases the property directly at auction.

### Who Can Claim Surplus Funds?
1. Former property owners
2. Heirs of deceased former owners
3. Lienholders (in order of priority)

### The Recovery Process
1. Identify properties with surplus funds
2. Locate and contact former owners
3. Verify ownership/heirship
4. Execute service agreement
5. File claim with county/court
6. Collect and distribute funds

## Compliance Requirements
- Never misrepresent yourself as an attorney
- Clearly disclose all fees before signing
- Maintain accurate records
- Follow state-specific regulations

## Quiz Preparation
After completing this module, you should be able to:
- Define tax surplus funds
- Explain the difference between tax lien and tax deed states
- List who can claim surplus funds
- Describe the basic recovery process
      `,
      tenantId: tenant.id,
      orderIndex: 1,
      requiredForTier: 'TIER_1_ASSOCIATE',
      prerequisites: [],
      hasQuiz: true,
      passingScore: 80,
      sourceType: 'STATIC',
      isActive: true,
      isMandatory: true,
      isCertification: false,
      version: 1,
    },
  });

  const module2 = await prisma.trainingModule.create({
    data: {
      id: 'training_002',
      title: 'Client Communication and Outreach',
      description: 'Master the art of professional client communication, including initial outreach, phone scripts, objection handling, and maintaining compliance throughout the client relationship.',
      content: `
# Client Communication and Outreach

## Initial Contact Methods

### Direct Mail
- Must comply with USPS regulations
- Clear identification of company
- No misleading claims about amounts

### Phone Outreach
- Verify identity before discussing case details
- Use approved scripts
- Record calls for quality assurance

### Email Communication
- Professional templates
- Clear subject lines
- Easy opt-out options

## The First Call Script

"Hello, my name is [NAME] calling from MGR Capital. We're reaching out regarding property that was sold at a tax sale in [COUNTY], [STATE]. Our records indicate you may be entitled to surplus funds from this sale. Do you have a few minutes to discuss this?"

## Handling Objections

### "Is this a scam?"
"I understand your concern. We are a legitimate surplus recovery firm. You can verify us at [website] or contact [state agency]. We only get paid if we successfully recover funds for you."

### "What's the catch?"
"Our fee is [X]% of the recovered amount. You pay nothing upfront, and we only collect if successful. All fees are clearly disclosed in our service agreement."

## Compliance Reminders
- Never guarantee specific amounts
- Always disclose fees upfront
- Document all communications
- Respect do-not-call requests
      `,
      tenantId: tenant.id,
      orderIndex: 2,
      requiredForTier: 'TIER_1_ASSOCIATE',
      prerequisites: ['training_001'],
      hasQuiz: true,
      passingScore: 80,
      sourceType: 'STATIC',
      isActive: true,
      isMandatory: true,
      isCertification: false,
      version: 1,
    },
  });

  const module3 = await prisma.trainingModule.create({
    data: {
      id: 'training_003',
      title: 'Document Preparation and Filing',
      description: 'Learn how to prepare, review, and file all necessary documents for surplus recovery claims, including service agreements, POAs, affidavits, and state-specific filing requirements.',
      content: `
# Document Preparation and Filing

## Essential Documents

### 1. Client Service Agreement (CSA)
- Clearly states fee percentage
- Defines scope of services
- Includes cancellation terms
- Must be signed before any work begins

### 2. Limited Power of Attorney (LPOA)
- Grants authority to file on client's behalf
- Must be notarized in most states
- Specific to surplus recovery only
- Include expiration date

### 3. Affidavit of Claim
- Statement of ownership interest
- Must be notarized
- Include property description
- State relationship to former owner

### 4. Supporting Documentation
- Government-issued ID
- Proof of address
- Death certificates (if heir)
- Heirship affidavit (if applicable)

## State-Specific Requirements

### Tennessee
- Mail-based filing
- Notarized affidavit required
- Include property deed copy

### Texas
- Electronic filing preferred
- W-9 required
- Comptroller claim form

### Florida
- Court motion required for claims > $500
- Filing fee varies by county
- May need attorney for large claims

## Quality Checklist
Before filing, verify:
- [ ] All signatures present
- [ ] Notarization complete and valid
- [ ] Dates correct
- [ ] Property description matches records
- [ ] Filing fee included
- [ ] Sent via appropriate method
      `,
      tenantId: tenant.id,
      orderIndex: 3,
      requiredForTier: 'TIER_2_SPECIALIST',
      prerequisites: ['training_001', 'training_002'],
      hasQuiz: true,
      passingScore: 85,
      sourceType: 'STATIC',
      isActive: true,
      isMandatory: true,
      isCertification: false,
      version: 1,
    },
  });

  const module4 = await prisma.trainingModule.create({
    data: {
      id: 'training_004',
      title: 'Advanced Heirship and Probate Cases',
      description: 'Navigate complex heirship situations, understand probate procedures, and learn to handle cases involving deceased former owners and multiple heirs.',
      content: `
# Advanced Heirship and Probate Cases

## Understanding Heirship

### When Heirship Matters
- Original property owner is deceased
- No will or probate was filed
- Multiple potential heirs exist

### Heir Identification Process
1. Obtain death certificate
2. Research family tree
3. Verify no probate exists
4. Document all potential heirs
5. Obtain heirship affidavits from all parties

## Types of Heirship Documentation

### Small Estate Affidavit
- For estates under threshold (varies by state)
- Simpler process than probate
- Still requires documentation of heirs

### Affidavit of Heirship
- Sworn statement of family relationships
- Typically requires disinterested witnesses
- Must be notarized

### Heirship Chart
- Visual family tree
- Shows all potential heirs
- Indicates deceased individuals

## Common Challenges

### Multiple Heirs
- Each heir must sign agreements
- Splits can create conflicts
- May need mediation

### Unknown Heirs
- Skip tracing required
- May need to exclude and note in filing
- Document all search efforts

### Competing Claims
- Priority based on relationship
- Document your client's position
- Be prepared for county review

## Red Flags
- Unusual death circumstances
- Recent property transfers
- Competing recovery firms
- Uncooperative family members
      `,
      tenantId: tenant.id,
      orderIndex: 4,
      requiredForTier: 'TIER_3_SENIOR_SPECIALIST',
      prerequisites: ['training_003'],
      hasQuiz: true,
      passingScore: 85,
      sourceType: 'STATIC',
      isActive: true,
      isMandatory: false,
      isCertification: true,
      version: 1,
    },
  });

  const module5 = await prisma.trainingModule.create({
    data: {
      id: 'training_005',
      title: 'Team Leadership and Performance Management',
      description: 'Develop leadership skills for managing recovery specialists, including coaching, performance tracking, and building high-performing teams.',
      content: `
# Team Leadership and Performance Management

## Becoming a Team Leader

### Qualifications
- Tier 4 or higher
- Minimum 50 successful cases
- Training certification complete
- Demonstrated leadership potential

### Responsibilities
- Mentor new team members
- Review and approve filings
- Handle escalated client issues
- Track team performance
- Conduct coaching sessions

## Performance Metrics

### Key Performance Indicators (KPIs)
1. **Contact Rate**: Percentage of leads contacted within 24 hours
2. **Conversion Rate**: Leads converted to signed clients
3. **Filing Accuracy**: Claims filed without errors
4. **Recovery Rate**: Successfully recovered claims
5. **Client Satisfaction**: Post-recovery surveys

### Target Benchmarks
- Contact Rate: 95%+
- Conversion Rate: 25%+
- Filing Accuracy: 99%+
- Recovery Rate: 85%+
- Client Satisfaction: 4.5+/5.0

## Coaching Best Practices

### Regular Check-ins
- Weekly 1-on-1 meetings
- Review case pipeline
- Address challenges
- Set weekly goals

### Constructive Feedback
- Be specific and timely
- Focus on behaviors, not personality
- Offer solutions, not just criticism
- Recognize improvements

### Development Planning
- Identify skill gaps
- Assign relevant training
- Track progress
- Celebrate milestones

## Building Team Culture
- Lead by example
- Celebrate wins publicly
- Address issues privately
- Foster collaboration over competition
      `,
      tenantId: tenant.id,
      orderIndex: 5,
      requiredForTier: 'TIER_4_TEAM_LEADER',
      prerequisites: ['training_004'],
      hasQuiz: true,
      passingScore: 90,
      sourceType: 'STATIC',
      isActive: true,
      isMandatory: false,
      isCertification: true,
      version: 1,
    },
  });

  // Create training questions for modules
  console.log('Creating training questions...');

  await prisma.trainingQuestion.createMany({
    data: [
      // Module 1 questions
      {
        id: 'question_001',
        moduleId: module1.id,
        question: 'What are tax surplus funds?',
        options: [
          'Money owed by the property owner for back taxes',
          'The difference between the tax sale price and the amount owed',
          'A loan provided by the county for tax payments',
          'Interest charged on delinquent taxes',
        ],
        correctAnswer: 1,
        explanation: 'Tax surplus funds are created when a property sells at tax sale for more than the delinquent taxes, penalties, and fees owed.',
        orderIndex: 1,
      },
      {
        id: 'question_002',
        moduleId: module1.id,
        question: 'Who can legally claim tax surplus funds?',
        options: [
          'Only the county tax collector',
          'Anyone who finds the property listing',
          'Former property owners, their heirs, and lienholders',
          'Only licensed attorneys',
        ],
        correctAnswer: 2,
        explanation: 'Former property owners, their heirs, and lienholders (in priority order) can claim surplus funds.',
        orderIndex: 2,
      },
      {
        id: 'question_003',
        moduleId: module1.id,
        question: 'What is the main difference between tax lien and tax deed states?',
        options: [
          'Tax lien states have higher interest rates',
          'In tax lien states, investors buy the lien; in tax deed states, investors buy the property',
          'Tax deed states do not allow surplus recovery',
          'There is no difference',
        ],
        correctAnswer: 1,
        explanation: 'In tax lien states, investors purchase the lien with a redemption period. In tax deed states, the property itself is sold directly.',
        orderIndex: 3,
      },
      // Module 2 questions
      {
        id: 'question_004',
        moduleId: module2.id,
        question: 'When should you disclose the service fee to a potential client?',
        options: [
          'After they sign the agreement',
          'Only if they ask about it',
          'Upfront, before any agreement is signed',
          'When the funds are recovered',
        ],
        correctAnswer: 2,
        explanation: 'All fees must be clearly disclosed upfront before any service agreement is signed. This is both a legal and ethical requirement.',
        orderIndex: 1,
      },
      {
        id: 'question_005',
        moduleId: module2.id,
        question: 'How should you respond to a potential client who asks if this is a scam?',
        options: [
          'Hang up immediately',
          'Acknowledge their concern and offer ways to verify your legitimacy',
          'Tell them they will lose their money if they do not act now',
          'Refuse to answer and push for the sale',
        ],
        correctAnswer: 1,
        explanation: 'Acknowledge their concern professionally and offer verification methods like your website, state agency contact, or BBB listing.',
        orderIndex: 2,
      },
      // Module 3 questions
      {
        id: 'question_006',
        moduleId: module3.id,
        question: 'Which document grants you authority to file on behalf of the client?',
        options: [
          'Client Service Agreement',
          'Limited Power of Attorney',
          'Affidavit of Claim',
          'W-9 Form',
        ],
        correctAnswer: 1,
        explanation: 'The Limited Power of Attorney (LPOA) grants specific authority to act on behalf of the client for surplus recovery.',
        orderIndex: 1,
      },
      {
        id: 'question_007',
        moduleId: module3.id,
        question: 'What type of filing does Florida typically require for surplus claims over $500?',
        options: [
          'Mail-based administrative claim',
          'Electronic portal submission',
          'Court motion filing',
          'No filing required',
        ],
        correctAnswer: 2,
        explanation: 'Florida requires a court motion for most surplus claims over $500, which may require attorney involvement.',
        orderIndex: 2,
      },
    ],
  });

  // ============================================
  // SAMPLE COMMUNICATIONS
  // ============================================
  console.log('Creating sample communications...');

  await prisma.communication.createMany({
    data: [
      {
        id: 'comm_001',
        caseId: 'case_002',
        userId: employee3.id,
        type: 'CALL',
        direction: 'OUTBOUND',
        content: 'Initial outreach call. Spoke with Patricia Davis regarding surplus funds from Harris County property. She was receptive and requested information packet via email. Scheduled follow-up call for Friday.',
        duration: 480, // 8 minutes
        outcome: 'positive',
        nextAction: 'Send information packet and follow up Friday',
        createdAt: new Date('2025-01-20T14:30:00Z'),
      },
      {
        id: 'comm_002',
        caseId: 'case_002',
        userId: employee3.id,
        type: 'EMAIL',
        direction: 'OUTBOUND',
        subject: 'Information Package - Harris County Surplus Funds',
        content: 'Dear Patricia, Thank you for speaking with me today. As discussed, I have attached information about the surplus funds available from the sale of your former property. Please review and let me know if you have any questions. Best regards, Amanda Garcia',
        toAddress: 'patricia.davis@email.com',
        fromAddress: 'amanda.garcia@mgrcapital.com',
        createdAt: new Date('2025-01-20T15:00:00Z'),
      },
      {
        id: 'comm_003',
        caseId: 'case_003',
        userId: employee4.id,
        type: 'CALL',
        direction: 'OUTBOUND',
        content: 'Follow-up call about missing documents. Richard confirmed he will send ID copy and signed documents by EOD. Reminded him of the Feb 2nd deadline.',
        duration: 360, // 6 minutes
        outcome: 'positive',
        nextAction: 'Verify document receipt tomorrow',
        createdAt: new Date('2025-01-28T10:15:00Z'),
      },
      {
        id: 'comm_004',
        caseId: 'case_005',
        userId: employee1.id,
        type: 'EMAIL',
        direction: 'INBOUND',
        subject: 'RE: Claim Status Update',
        content: 'Thank you for the update. I appreciate you keeping me informed about my claim status. Please let me know when you hear back from the county.',
        toAddress: 'sarah.williams@mgrcapital.com',
        fromAddress: 'patricia.davis@email.com',
        createdAt: new Date('2025-01-25T09:30:00Z'),
      },
      {
        id: 'comm_005',
        caseId: 'case_001',
        userId: employee5.id,
        type: 'CALL',
        direction: 'OUTBOUND',
        content: 'Left voicemail for James Wilson regarding Davidson County surplus. Requested callback at his earliest convenience.',
        duration: 90, // 1.5 minutes
        outcome: 'voicemail',
        nextAction: 'Attempt contact again tomorrow',
        createdAt: new Date('2025-01-30T11:00:00Z'),
      },
    ],
  });

  // ============================================
  // DEADLINES
  // ============================================
  console.log('Creating deadlines...');

  await prisma.deadline.createMany({
    data: [
      {
        id: 'deadline_001',
        caseId: 'case_001',
        title: 'Filing Deadline',
        description: 'File claim with Davidson County Clerk before this date to preserve rights.',
        dueDate: new Date('2025-12-15'),
        reminderSent: false,
      },
      {
        id: 'deadline_002',
        caseId: 'case_003',
        title: 'URGENT: Filing Deadline',
        description: 'Orange County has 120-day deadline. Must file court motion ASAP.',
        dueDate: new Date('2025-02-02'),
        reminderSent: true,
      },
      {
        id: 'deadline_003',
        caseId: 'case_003',
        title: 'Document Collection',
        description: 'Collect signed POA and ID from client for filing.',
        dueDate: new Date('2025-01-31'),
        reminderSent: true,
      },
      {
        id: 'deadline_004',
        caseId: 'case_005',
        title: 'Redemption Period Ends',
        description: 'Tennessee 1-year redemption period expires.',
        dueDate: new Date('2025-06-01'),
        reminderSent: false,
      },
      {
        id: 'deadline_005',
        caseId: 'case_006',
        title: 'Follow up with Comptroller',
        description: 'Contact Texas Comptroller office for disbursement status.',
        dueDate: new Date('2025-02-10'),
        reminderSent: false,
      },
      {
        id: 'deadline_006',
        caseId: 'case_010',
        title: 'Initial Contact Deadline',
        description: 'Contact client within 48 hours of lead assignment.',
        dueDate: new Date('2025-02-05'),
        reminderSent: false,
      },
    ],
  });

  // ============================================
  // COMMISSION PLANS (Reference data)
  // ============================================
  console.log('Creating commission plans...');

  await prisma.commissionPlan.createMany({
    data: [
      {
        id: 'commission_tier1',
        tier: 'TIER_1_ASSOCIATE',
        tierDisplayName: 'Tier 1 - Associate',
        displayedRatePercent: 20,
        actualRatePercent: 10,
        casesRequired: 0,
        revenueRequired: 0,
        trainingRequired: true,
        isActive: true,
      },
      {
        id: 'commission_tier2',
        tier: 'TIER_2_SPECIALIST',
        tierDisplayName: 'Tier 2 - Specialist',
        displayedRatePercent: 40,
        actualRatePercent: 20,
        casesRequired: 10,
        revenueRequired: 5000000, // $50,000
        trainingRequired: true,
        isActive: true,
      },
      {
        id: 'commission_tier3',
        tier: 'TIER_3_SENIOR_SPECIALIST',
        tierDisplayName: 'Tier 3 - Senior Specialist',
        displayedRatePercent: 60,
        actualRatePercent: 30,
        casesRequired: 25,
        revenueRequired: 15000000, // $150,000
        trainingRequired: true,
        isActive: true,
      },
      {
        id: 'commission_tier4',
        tier: 'TIER_4_TEAM_LEADER',
        tierDisplayName: 'Tier 4 - Team Leader',
        displayedRatePercent: 80,
        actualRatePercent: 40,
        overridePercent: 5,
        casesRequired: 50,
        revenueRequired: 40000000, // $400,000
        trainingRequired: true,
        isActive: true,
      },
      {
        id: 'commission_tier5',
        tier: 'TIER_5_EXECUTIVE_PARTNER',
        tierDisplayName: 'Tier 5 - Executive Partner',
        displayedRatePercent: 100,
        actualRatePercent: 50,
        overridePercent: 10,
        casesRequired: 100,
        revenueRequired: 100000000, // $1,000,000
        trainingRequired: true,
        isActive: true,
      },
    ],
  });

  // ============================================
  // LEDGER ENTRIES (for paid cases)
  // ============================================
  console.log('Creating ledger entries...');

  await prisma.ledgerEntry.createMany({
    data: [
      // Case 007 - PAID
      {
        id: 'ledger_007_client',
        caseId: 'case_007',
        userId: client1.id,
        tenantId: tenant.id,
        type: 'CLIENT_PAYOUT',
        amountCents: 6230000,
        displayedAmountCents: 6230000,
        description: 'Client payout for Miami-Dade County surplus recovery',
        status: 'COMPLETED',
        isPaid: true,
        paidAt: new Date('2024-10-20'),
        paymentMethod: 'ACH',
        paymentRef: 'ACH-2024-10-20-001',
        completedAt: new Date('2024-10-20'),
      },
      {
        id: 'ledger_007_fee',
        caseId: 'case_007',
        userId: null,
        tenantId: tenant.id,
        type: 'COMPANY_FEE',
        amountCents: 2670000,
        displayedAmountCents: 2670000,
        description: 'Company fee - 30% of $89,000 recovery',
        status: 'COMPLETED',
        isPaid: true,
        paidAt: new Date('2024-10-20'),
        completedAt: new Date('2024-10-20'),
      },
      {
        id: 'ledger_007_commission',
        caseId: 'case_007',
        userId: employee1.id,
        tenantId: tenant.id,
        type: 'EMPLOYEE_COMMISSION',
        amountCents: 1335000, // 50% of fee (Tier 5)
        displayedAmountCents: 2670000, // Employee sees 100%
        description: 'Commission for case MGR-2024-00045',
        status: 'COMPLETED',
        tierAtTime: 'TIER_5_EXECUTIVE_PARTNER',
        displayedRate: 100,
        actualRate: 50,
        isPaid: true,
        paidAt: new Date('2024-10-25'),
        paymentMethod: 'Direct Deposit',
        paymentRef: 'DD-2024-10-25-003',
        completedAt: new Date('2024-10-25'),
      },
      // Case 008 - CLOSED
      {
        id: 'ledger_008_client',
        caseId: 'case_008',
        userId: client2.id,
        tenantId: tenant.id,
        type: 'CLIENT_PAYOUT',
        amountCents: 11250000,
        displayedAmountCents: 11250000,
        description: 'Client payout for LA County surplus recovery',
        status: 'COMPLETED',
        isPaid: true,
        paidAt: new Date('2024-08-05'),
        paymentMethod: 'Wire',
        paymentRef: 'WIRE-2024-08-05-002',
        completedAt: new Date('2024-08-05'),
      },
      {
        id: 'ledger_008_fee',
        caseId: 'case_008',
        userId: null,
        tenantId: tenant.id,
        type: 'COMPANY_FEE',
        amountCents: 3750000,
        displayedAmountCents: 3750000,
        description: 'Company fee - 25% of $150,000 recovery',
        status: 'COMPLETED',
        isPaid: true,
        paidAt: new Date('2024-08-05'),
        completedAt: new Date('2024-08-05'),
      },
      {
        id: 'ledger_008_commission',
        caseId: 'case_008',
        userId: employee2.id,
        tenantId: tenant.id,
        type: 'EMPLOYEE_COMMISSION',
        amountCents: 1500000, // 40% of fee (Tier 4)
        displayedAmountCents: 3000000, // Employee sees 80%
        description: 'Commission for case MGR-2024-00032',
        status: 'COMPLETED',
        tierAtTime: 'TIER_4_TEAM_LEADER',
        displayedRate: 80,
        actualRate: 40,
        isPaid: true,
        paidAt: new Date('2024-08-10'),
        paymentMethod: 'Direct Deposit',
        paymentRef: 'DD-2024-08-10-005',
        completedAt: new Date('2024-08-10'),
      },
    ],
  });

  // ============================================
  // EMPLOYEE TRAINING PROGRESS
  // ============================================
  console.log('Creating training progress records...');

  await prisma.employeeTrainingProgress.createMany({
    data: [
      // Employee 1 (Tier 5) - All complete
      { employeeId: employee1.id, moduleId: module1.id, status: 'COMPLETED', progress: 100, bestScore: 95, passedAt: new Date('2022-04-01'), completedAt: new Date('2022-04-01') },
      { employeeId: employee1.id, moduleId: module2.id, status: 'COMPLETED', progress: 100, bestScore: 92, passedAt: new Date('2022-04-15'), completedAt: new Date('2022-04-15') },
      { employeeId: employee1.id, moduleId: module3.id, status: 'COMPLETED', progress: 100, bestScore: 98, passedAt: new Date('2022-05-01'), completedAt: new Date('2022-05-01') },
      { employeeId: employee1.id, moduleId: module4.id, status: 'COMPLETED', progress: 100, bestScore: 90, passedAt: new Date('2022-06-01'), completedAt: new Date('2022-06-01') },
      { employeeId: employee1.id, moduleId: module5.id, status: 'COMPLETED', progress: 100, bestScore: 94, passedAt: new Date('2022-07-01'), completedAt: new Date('2022-07-01') },

      // Employee 2 (Tier 4) - Leadership in progress
      { employeeId: employee2.id, moduleId: module1.id, status: 'COMPLETED', progress: 100, bestScore: 88, passedAt: new Date('2023-02-01'), completedAt: new Date('2023-02-01') },
      { employeeId: employee2.id, moduleId: module2.id, status: 'COMPLETED', progress: 100, bestScore: 90, passedAt: new Date('2023-02-15'), completedAt: new Date('2023-02-15') },
      { employeeId: employee2.id, moduleId: module3.id, status: 'COMPLETED', progress: 100, bestScore: 92, passedAt: new Date('2023-03-01'), completedAt: new Date('2023-03-01') },
      { employeeId: employee2.id, moduleId: module4.id, status: 'COMPLETED', progress: 100, bestScore: 86, passedAt: new Date('2023-04-01'), completedAt: new Date('2023-04-01') },
      { employeeId: employee2.id, moduleId: module5.id, status: 'IN_PROGRESS', progress: 65, bestScore: null },

      // Employee 3 (Tier 3) - Working on advanced
      { employeeId: employee3.id, moduleId: module1.id, status: 'COMPLETED', progress: 100, bestScore: 85, passedAt: new Date('2023-07-01'), completedAt: new Date('2023-07-01') },
      { employeeId: employee3.id, moduleId: module2.id, status: 'COMPLETED', progress: 100, bestScore: 88, passedAt: new Date('2023-07-15'), completedAt: new Date('2023-07-15') },
      { employeeId: employee3.id, moduleId: module3.id, status: 'COMPLETED', progress: 100, bestScore: 90, passedAt: new Date('2023-08-01'), completedAt: new Date('2023-08-01') },
      { employeeId: employee3.id, moduleId: module4.id, status: 'IN_PROGRESS', progress: 45, bestScore: null },

      // Employee 4 (Tier 2) - Documents module in progress
      { employeeId: employee4.id, moduleId: module1.id, status: 'COMPLETED', progress: 100, bestScore: 82, passedAt: new Date('2024-03-01'), completedAt: new Date('2024-03-01') },
      { employeeId: employee4.id, moduleId: module2.id, status: 'COMPLETED', progress: 100, bestScore: 80, passedAt: new Date('2024-03-15'), completedAt: new Date('2024-03-15') },
      { employeeId: employee4.id, moduleId: module3.id, status: 'IN_PROGRESS', progress: 30, bestScore: null },

      // Employee 5 (Tier 1) - New, just started
      { employeeId: employee5.id, moduleId: module1.id, status: 'IN_PROGRESS', progress: 20, bestScore: null, startedAt: new Date('2025-01-10') },
      { employeeId: employee5.id, moduleId: module2.id, status: 'LOCKED', progress: 0 },
    ],
  });

  // ============================================
  // INGESTION SOURCES - For 24/7 Auto-Pull
  // ============================================
  console.log('Creating ingestion sources...');

  // Clear existing sources first
  await prisma.autopilotRun.deleteMany();
  await prisma.ingestionRecord.deleteMany();
  await prisma.ingestionBatch.deleteMany();
  await prisma.ingestionSource.deleteMany();

  await prisma.ingestionSource.createMany({
    data: [
      // Tennessee County Sources
      {
        id: 'source_tn_shelby',
        name: 'Shelby County TN - Tax Surplus',
        type: 'COUNTY_WEBSITE',
        state: 'TN',
        county: 'Shelby',
        url: 'https://shelbycountytrustee.com/186/Tax-Sale',
        frequency: 'daily',
        isActive: true,
        nextFetch: new Date(),
        parserConfig: { type: 'html_table', surplusIdentifier: 'excess', amountColumn: 'surplus' },
      },
      {
        id: 'source_tn_davidson',
        name: 'Davidson County TN - Tax Surplus',
        type: 'COUNTY_WEBSITE',
        state: 'TN',
        county: 'Davidson',
        url: 'https://www.nashville.gov/departments/trustee/property-taxes/delinquent-taxes',
        frequency: 'daily',
        isActive: true,
        nextFetch: new Date(),
        parserConfig: { type: 'html_table' },
      },
      // Texas County Sources
      {
        id: 'source_tx_harris',
        name: 'Harris County TX - Excess Proceeds',
        type: 'SURPLUS_PDF',
        state: 'TX',
        county: 'Harris',
        url: 'https://www.hctax.net/Property/TaxSales',
        frequency: 'daily',
        isActive: true,
        nextFetch: new Date(),
        parserConfig: { type: 'pdf_extract', stateCode: 'TX' },
      },
      {
        id: 'source_tx_dallas',
        name: 'Dallas County TX - Surplus Funds',
        type: 'SURPLUS_PDF',
        state: 'TX',
        county: 'Dallas',
        url: 'https://www.dallascounty.org/departments/tax/excess-funds.php',
        frequency: 'daily',
        isActive: true,
        nextFetch: new Date(),
        parserConfig: { type: 'pdf_extract', stateCode: 'TX' },
      },
      // Florida County Sources
      {
        id: 'source_fl_orange',
        name: 'Orange County FL - Tax Deed Surplus',
        type: 'COUNTY_WEBSITE',
        state: 'FL',
        county: 'Orange',
        url: 'https://www.occompt.com/tax-deed-surplus-funds/',
        frequency: 'daily',
        isActive: true,
        nextFetch: new Date(),
        parserConfig: { type: 'html_list', stateCode: 'FL' },
      },
      {
        id: 'source_fl_miami',
        name: 'Miami-Dade County FL - Surplus Funds',
        type: 'SURPLUS_PDF',
        state: 'FL',
        county: 'Miami-Dade',
        url: 'https://www.miamidade.gov/finance/tax-surplus.asp',
        frequency: 'daily',
        isActive: true,
        nextFetch: new Date(),
        parserConfig: { type: 'pdf_extract', stateCode: 'FL' },
      },
      // Georgia County Sources
      {
        id: 'source_ga_fulton',
        name: 'Fulton County GA - Tax Sale Surplus',
        type: 'COUNTY_WEBSITE',
        state: 'GA',
        county: 'Fulton',
        url: 'https://www.fultoncountytaxes.org/tax-sales',
        frequency: 'daily',
        isActive: true,
        nextFetch: new Date(),
        parserConfig: { type: 'html_table', stateCode: 'GA' },
      },
      // California County Sources
      {
        id: 'source_ca_la',
        name: 'Los Angeles County CA - Tax Defaulted Sales',
        type: 'SURPLUS_PDF',
        state: 'CA',
        county: 'Los Angeles',
        url: 'https://ttc.lacounty.gov/tax-defaulted-property-auctions/',
        frequency: 'daily',
        isActive: true,
        nextFetch: new Date(),
        parserConfig: { type: 'pdf_extract', stateCode: 'CA' },
      },
      // Bulk upload source (always available)
      {
        id: 'source_bulk_upload',
        name: 'Bulk File Upload',
        type: 'BULK_UPLOAD',
        state: 'ALL',
        frequency: null,
        isActive: true,
        parserConfig: { type: 'auto_detect' },
      },
      // Webhook source for partner leads
      {
        id: 'source_webhook_leads',
        name: 'Partner Lead Webhook',
        type: 'WEBHOOK',
        state: 'ALL',
        frequency: null,
        isActive: true,
        parserConfig: { type: 'json', autoAssign: true },
      },
      // Email inbox source
      {
        id: 'source_email_inbox',
        name: 'Email Lead Inbox',
        type: 'EMAIL_INBOX',
        state: 'ALL',
        frequency: 'every_30_min',
        isActive: true,
        nextFetch: new Date(),
        parserConfig: { type: 'email_parse', extractAttachments: true },
      },
    ],
  });

  // Create FounderConfig for auto-ingestion settings
  await prisma.founderConfig.upsert({
    where: { key: 'auto_ingestion_settings' },
    update: {},
    create: {
      key: 'auto_ingestion_settings',
      value: {
        enabled: true,
        autoAssignCases: true,
        minSurplusAmountCents: 100000, // $1,000 minimum
        highValueThresholdCents: 2500000, // $25,000 high value
        autoFileEnabled: false, // Founder must manually enable
        priorityStates: ['TN', 'TX', 'FL', 'GA'],
      },
      description: 'Autopilot ingestion settings - controls 24/7 case ingestion',
    },
  });

  console.log('Seed completed successfully!');
  console.log(`
Summary:
- 1 Tenant (MGR Capital)
- 11 Users (1 Founder, 2 Admins, 5 Employees, 3 Clients)
- 10 Cases (various statuses)
- 5 State Rules (TN, TX, FL, GA, CA)
- 3 County Rules
- 5 Bot Subscriptions
- 5 Training Modules with questions
- 11 Ingestion Sources (county websites, bulk upload, webhooks)
- Sample communications, deadlines, and ledger entries
  `);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
