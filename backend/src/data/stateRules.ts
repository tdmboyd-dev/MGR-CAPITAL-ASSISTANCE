// ============================================
// STATE SURPLUS FUND RULES DATABASE
// Production-ready legal rules for all 50 states
// ============================================

import { DocumentType } from "@prisma/client";

export interface StateRuleData {
  stateCode: string;
  stateName: string;
  surplusFundLaw: string;
  claimPeriodDays: number;
  redemptionPeriodDays: number | null;
  interestRate: number | null;
  requiredDocuments: DocumentType[];
  filingFee: number | null;
  filingMethod: "mail" | "electronic" | "in-person" | "any";
  filingAddress: string | null;
  deadlineCalculation: string;
  specialRequirements: string | null;
  restrictions: string | null;
  sourceUrl: string | null;
  /** Maximum recovery agent fee percentage allowed by state law (null = no cap) */
  feeCapPercent: number | null;
  /** Maximum flat fee in cents allowed by state law (null = no flat cap) */
  feeCapFlatCents: number | null;
  /** Source statute for fee cap */
  feeCapStatute: string | null;
}

// ============================================
// STATE FEE CAP ENFORCEMENT ENGINE
// Auto-limits contingency fees per state law
// ============================================

/**
 * Enforce state fee cap on a given fee percentage.
 * Returns the capped fee percent and whether a cap was applied.
 */
export function enforceStateFeeCap(
  stateCode: string,
  requestedFeePercent: number,
  surplusAmountCents: number
): {
  effectiveFeePercent: number;
  wasCapped: boolean;
  capReason: string | null;
  maxAllowedCents: number | null;
} {
  const rule = getStateRule(stateCode);
  if (!rule) {
    return { effectiveFeePercent: requestedFeePercent, wasCapped: false, capReason: null, maxAllowedCents: null };
  }

  let effectiveFeePercent = requestedFeePercent;
  let wasCapped = false;
  let capReason: string | null = null;
  let maxAllowedCents: number | null = null;

  // Check percentage cap
  if (rule.feeCapPercent !== null && requestedFeePercent > rule.feeCapPercent) {
    effectiveFeePercent = rule.feeCapPercent;
    wasCapped = true;
    capReason = `${rule.stateName} caps recovery agent fees at ${rule.feeCapPercent}% (${rule.feeCapStatute})`;
  }

  // Check flat cap (e.g., TX $1,000 max, CA $2,500 max)
  if (rule.feeCapFlatCents !== null) {
    const feeAtCurrentPercent = Math.round((surplusAmountCents * effectiveFeePercent) / 100);
    if (feeAtCurrentPercent > rule.feeCapFlatCents) {
      // Reduce percentage to fit within flat cap
      effectiveFeePercent = Math.floor((rule.feeCapFlatCents / surplusAmountCents) * 10000) / 100;
      if (effectiveFeePercent < 0) effectiveFeePercent = 0;
      wasCapped = true;
      maxAllowedCents = rule.feeCapFlatCents;
      capReason = `${rule.stateName} caps recovery agent fees at $${(rule.feeCapFlatCents / 100).toFixed(2)} (${rule.feeCapStatute})`;
    }
  }

  return { effectiveFeePercent, wasCapped, capReason, maxAllowedCents };
}

/**
 * Get all states with fee caps for admin display
 */
export function getStatesWithFeeCaps(): Array<{
  stateCode: string;
  stateName: string;
  feeCapPercent: number | null;
  feeCapFlatCents: number | null;
  feeCapStatute: string | null;
}> {
  return STATE_RULES
    .filter(r => r.feeCapPercent !== null || r.feeCapFlatCents !== null)
    .map(r => ({
      stateCode: r.stateCode,
      stateName: r.stateName,
      feeCapPercent: r.feeCapPercent,
      feeCapFlatCents: r.feeCapFlatCents,
      feeCapStatute: r.feeCapStatute,
    }));
}

export const STATE_RULES: StateRuleData[] = [
  {
    stateCode: "AL",
    stateName: "Alabama",
    surplusFundLaw: "Code of Alabama § 40-10-28. Any excess funds remaining after tax sale must be held by the county and claimable by former owner.",
    claimPeriodDays: 1095, // 3 years
    redemptionPeriodDays: 365,
    interestRate: 12,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 5000, // $50.00
    filingMethod: "mail",
    filingAddress: null, // County-specific
    deadlineCalculation: "3 years from date of tax sale. Redemption period is 1 year from sale date.",
    specialRequirements: "Must provide proof of ownership at time of sale. Heir claims require probate documentation.",
    restrictions: "Surplus under $25 may be retained by county.",
    sourceUrl: "https://law.justia.com/codes/alabama/title-40/chapter-10/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "AK",
    stateName: "Alaska",
    surplusFundLaw: "AS 29.45.440. Surplus proceeds from property tax foreclosure sale payable to former owner.",
    claimPeriodDays: 730, // 2 years
    redemptionPeriodDays: null,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 2500,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "2 years from date of tax foreclosure sale.",
    specialRequirements: "Borough-specific procedures may apply.",
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/alaska/title-29/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "AZ",
    stateName: "Arizona",
    surplusFundLaw: "A.R.S. § 42-18303. Excess proceeds from tax lien sale held by county treasurer.",
    claimPeriodDays: 730,
    redemptionPeriodDays: 180,
    interestRate: 16,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER", "PROPERTY_DEED"],
    filingFee: 0,
    filingMethod: "any",
    filingAddress: null,
    deadlineCalculation: "2 years from date excess proceeds became available.",
    specialRequirements: "Must file verified claim with county treasurer.",
    restrictions: "Claims under $10 may be denied.",
    sourceUrl: "https://www.azleg.gov/ars/42/18303.htm",
    feeCapPercent: 30,
    feeCapFlatCents: null,
    feeCapStatute: "A.R.S. § 42-18303 — 30% maximum"
  },
  {
    stateCode: "AR",
    stateName: "Arkansas",
    surplusFundLaw: "A.C.A. § 26-37-202. Surplus funds from tax sale payable to former owner upon application.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 365,
    interestRate: 10,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 2000,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax sale deed confirmation.",
    specialRequirements: "Commissioner of State Lands handles some surplus claims.",
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/arkansas/title-26/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "CA",
    stateName: "California",
    surplusFundLaw: "Revenue & Taxation Code § 4675. Excess proceeds distributed to parties of interest.",
    claimPeriodDays: 365,
    redemptionPeriodDays: null,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER", "MOTION"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "1 year from recordation of tax deed to purchaser.",
    specialRequirements: "Must file claim with county tax collector. Court petition may be required for disputes.",
    restrictions: "Priority given to former owner, then lienholders in order of priority.",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=4675",
    feeCapPercent: 5,
    feeCapFlatCents: 250000,
    feeCapStatute: "Rev. & Tax Code § 4675 — $2,500 or 5% max"
  },
  {
    stateCode: "CO",
    stateName: "Colorado",
    surplusFundLaw: "C.R.S. § 39-11-151. Surplus funds from tax lien sale payable to owner of record.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 1095,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from issuance of treasurer's deed.",
    specialRequirements: "Must provide proof of ownership interest.",
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/colorado/title-39/",
    feeCapPercent: 20,
    feeCapFlatCents: null,
    feeCapStatute: "C.R.S. § 39-11-151 — 20% maximum"
  },
  {
    stateCode: "CT",
    stateName: "Connecticut",
    surplusFundLaw: "C.G.S. § 12-157. Surplus from tax sale paid to former owner.",
    claimPeriodDays: 2190, // 6 years
    redemptionPeriodDays: 365,
    interestRate: 18,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "6 years from date of tax sale.",
    specialRequirements: "Municipality-specific procedures apply.",
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/connecticut/title-12/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "DE",
    stateName: "Delaware",
    surplusFundLaw: "9 Del. C. § 8772. Excess proceeds from tax sale held by county.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 60,
    interestRate: 15,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of sale.",
    specialRequirements: "Kent, New Castle, and Sussex counties have different procedures.",
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/delaware/title-9/",
    feeCapPercent: 10,
    feeCapFlatCents: 100000,
    feeCapStatute: "9 Del. C. § 8772 — 10% or $1,000 max"
  },
  {
    stateCode: "FL",
    stateName: "Florida",
    surplusFundLaw: "F.S. § 197.582. Surplus funds from tax deed sale payable to former owner and subordinate lienholders.",
    claimPeriodDays: 3650, // 10 years
    redemptionPeriodDays: null,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER", "MOTION"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "10 years from date of tax deed sale. After 10 years, funds escheat to county.",
    specialRequirements: "Clerk of Court holds surplus. May require court order for disbursement.",
    restrictions: "Processing fee may be deducted from surplus.",
    sourceUrl: "http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0100-0199/0197/Sections/0197.582.html",
    feeCapPercent: 12,
    feeCapFlatCents: null,
    feeCapStatute: "F.S. § 28.2401(3) — 12% maximum"
  },
  {
    stateCode: "GA",
    stateName: "Georgia",
    surplusFundLaw: "O.C.G.A. § 48-4-5. Excess funds from tax sale payable to former owner upon petition.",
    claimPeriodDays: 1825, // 5 years
    redemptionPeriodDays: 365,
    interestRate: 20,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER", "MOTION"],
    filingFee: 7500,
    filingMethod: "in-person",
    filingAddress: null,
    deadlineCalculation: "5 years from date of tax sale. One-year redemption period from date of sale.",
    specialRequirements: "Must file petition in Superior Court. Court hearing required.",
    restrictions: "Attorney representation recommended for court proceedings.",
    sourceUrl: "https://law.justia.com/codes/georgia/title-48/chapter-4/",
    feeCapPercent: 5,
    feeCapFlatCents: null,
    feeCapStatute: "O.C.G.A. § 48-4-5 — 5% max (some counties)"
  },
  {
    stateCode: "HI",
    stateName: "Hawaii",
    surplusFundLaw: "HRS § 231-61. Surplus from tax sale held by Director of Finance.",
    claimPeriodDays: 1825,
    redemptionPeriodDays: 365,
    interestRate: 12,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "5 years from date of sale.",
    specialRequirements: "Must file claim with county director of finance.",
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/hawaii/title-14/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "ID",
    stateName: "Idaho",
    surplusFundLaw: "Idaho Code § 63-1009. Excess funds from tax deed sale payable to former owner.",
    claimPeriodDays: 730,
    redemptionPeriodDays: 365,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "2 years from date tax deed is issued.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://legislature.idaho.gov/statutesrules/idstat/Title63/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "IL",
    stateName: "Illinois",
    surplusFundLaw: "35 ILCS 200/21-355. Surplus from tax sale held by county.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 730,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax deed. Redemption period varies by property type.",
    specialRequirements: "Residential property has 2.5-year redemption. Other property has 2-year redemption.",
    restrictions: null,
    sourceUrl: "https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=596",
    feeCapPercent: 15,
    feeCapFlatCents: null,
    feeCapStatute: "35 ILCS 200/21-355 — 15% maximum"
  },
  {
    stateCode: "IN",
    stateName: "Indiana",
    surplusFundLaw: "IC 6-1.1-24-7. Surplus from tax sale distributed to persons with interest.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 365,
    interestRate: 10,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax sale.",
    specialRequirements: "Must file petition with county auditor.",
    restrictions: null,
    sourceUrl: "https://iga.in.gov/legislative/laws/2021/ic/titles/006",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "IA",
    stateName: "Iowa",
    surplusFundLaw: "Iowa Code § 446.19A. Excess proceeds from tax sale paid to former owner.",
    claimPeriodDays: 730,
    redemptionPeriodDays: 548,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "2 years from date tax deed is issued.",
    specialRequirements: "1.5-year redemption period from date of sale.",
    restrictions: null,
    sourceUrl: "https://www.legis.iowa.gov/law/iowaCode/sections?codeChapter=446",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "KS",
    stateName: "Kansas",
    surplusFundLaw: "K.S.A. 79-2804. Surplus from tax sale held by county treasurer.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 730,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax sale deed.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://www.ksrevisor.org/statutes/chapters/ch79/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "KY",
    stateName: "Kentucky",
    surplusFundLaw: "KRS 426.526. Surplus from tax sale paid to former owner after court order.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 365,
    interestRate: 12,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER", "MOTION"],
    filingFee: 5000,
    filingMethod: "in-person",
    filingAddress: null,
    deadlineCalculation: "3 years from date of sale. Court action required.",
    specialRequirements: "Must file motion in circuit court.",
    restrictions: null,
    sourceUrl: "https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=39282",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "LA",
    stateName: "Louisiana",
    surplusFundLaw: "La. R.S. 47:2196. Surplus from tax sale to be paid to former owner.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 1095,
    interestRate: 12,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax sale adjudication.",
    specialRequirements: "Parish-specific procedures. Some parishes hold annual sales.",
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/louisiana/title-47/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "ME",
    stateName: "Maine",
    surplusFundLaw: "36 M.R.S. § 943. Surplus from tax lien foreclosure paid to former owner.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 548,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of foreclosure.",
    specialRequirements: "Must file claim with municipality.",
    restrictions: null,
    sourceUrl: "https://legislature.maine.gov/statutes/36/title36sec943.html",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "MD",
    stateName: "Maryland",
    surplusFundLaw: "Md. Code, Tax-Property § 14-844. Surplus from tax sale held by collector.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 180,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date surplus deposited with collector.",
    specialRequirements: "Different rules for Baltimore City.",
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/maryland/tax-property/",
    feeCapPercent: 10,
    feeCapFlatCents: null,
    feeCapStatute: "Md. Tax-Property § 14-844 — 10% maximum"
  },
  {
    stateCode: "MA",
    stateName: "Massachusetts",
    surplusFundLaw: "M.G.L. c. 60 § 65. Surplus from tax sale held by municipality.",
    claimPeriodDays: 2190,
    redemptionPeriodDays: 180,
    interestRate: 16,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "6 years from date of sale.",
    specialRequirements: "Must file petition with Land Court for surplus over $10,000.",
    restrictions: null,
    sourceUrl: "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter60",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "MI",
    stateName: "Michigan",
    surplusFundLaw: "MCL 211.78t. Surplus from tax foreclosure auction payable to former owner.",
    claimPeriodDays: 730,
    redemptionPeriodDays: null,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "Must claim within 21 days of sale, or file circuit court action within 2 years.",
    specialRequirements: "Recent court decisions (Rafaeli) expanded owner rights to surplus.",
    restrictions: null,
    sourceUrl: "https://www.legislature.mi.gov/mileg.aspx?page=getObject&objectName=mcl-211-78t",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "MN",
    stateName: "Minnesota",
    surplusFundLaw: "Minn. Stat. § 281.25. Surplus from tax forfeiture sale paid to former owner.",
    claimPeriodDays: 2190,
    redemptionPeriodDays: 1095,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "6 years from date of forfeiture. 3-year redemption period.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://www.revisor.mn.gov/statutes/cite/281.25",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "MS",
    stateName: "Mississippi",
    surplusFundLaw: "Miss. Code Ann. § 27-45-27. Surplus from tax sale paid to former owner upon application.",
    claimPeriodDays: 730,
    redemptionPeriodDays: 730,
    interestRate: 15,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "2 years from date tax deed matures.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/mississippi/title-27/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "MO",
    stateName: "Missouri",
    surplusFundLaw: "RSMo § 140.230. Excess proceeds from tax sale held by county collector.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 365,
    interestRate: 10,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax sale.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://revisor.mo.gov/main/OneSection.aspx?section=140.230",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "MT",
    stateName: "Montana",
    surplusFundLaw: "MCA 15-17-323. Surplus from tax deed sale paid to former owner.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 1095,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax deed issuance.",
    specialRequirements: "3-year redemption period from date of tax lien.",
    restrictions: null,
    sourceUrl: "https://leg.mt.gov/bills/mca/title_0150/chapter_0170/part_0030/section_0230/0150-0170-0030-0230.html",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "NE",
    stateName: "Nebraska",
    surplusFundLaw: "Neb. Rev. Stat. § 77-1912. Surplus from tax sale paid to former owner.",
    claimPeriodDays: 730,
    redemptionPeriodDays: 1095,
    interestRate: 14,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "2 years from date of tax deed.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://nebraskalegislature.gov/laws/statutes.php?statute=77-1912",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "NV",
    stateName: "Nevada",
    surplusFundLaw: "NRS 361.610. Excess proceeds from tax sale held by county treasurer.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 1095,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax deed.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://www.leg.state.nv.us/nrs/NRS-361.html",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "NH",
    stateName: "New Hampshire",
    surplusFundLaw: "RSA 80:88. Surplus from tax sale paid to former owner.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 730,
    interestRate: 18,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax collector's deed.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://www.gencourt.state.nh.us/rsa/html/V/80/80-88.htm",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "NJ",
    stateName: "New Jersey",
    surplusFundLaw: "N.J.S.A. 54:5-113. Surplus from tax sale foreclosure payable to former owner.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 730,
    interestRate: 18,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax sale foreclosure.",
    specialRequirements: "Must file claim with municipality.",
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/new-jersey/title-54/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "NM",
    stateName: "New Mexico",
    surplusFundLaw: "NMSA 7-38-70. Excess proceeds from tax sale paid to former owner.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 1095,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of sale.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://nmonesource.com/nmos/nmsa/en/item/4340/index.do",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "NY",
    stateName: "New York",
    surplusFundLaw: "RPTL § 1136. Surplus from tax sale foreclosure held by county.",
    claimPeriodDays: 1460, // 4 years
    redemptionPeriodDays: 730,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER", "MOTION"],
    filingFee: 4500,
    filingMethod: "in-person",
    filingAddress: null,
    deadlineCalculation: "4 years from date of tax deed. Court petition required.",
    specialRequirements: "Must file petition in Supreme Court or County Court. NYC has different procedures.",
    restrictions: null,
    sourceUrl: "https://www.nysenate.gov/legislation/laws/RPT/1136",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "NC",
    stateName: "North Carolina",
    surplusFundLaw: "N.C.G.S. § 105-374. Surplus from tax foreclosure sale paid to former owner.",
    claimPeriodDays: 3650,
    redemptionPeriodDays: null,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "10 years from date of foreclosure sale.",
    specialRequirements: "Must file claim with county tax collector.",
    restrictions: null,
    sourceUrl: "https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_105/GS_105-374.pdf",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "ND",
    stateName: "North Dakota",
    surplusFundLaw: "N.D.C.C. 57-28-20. Surplus from tax deed sale held by county.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 1095,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax deed.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://www.ndlegis.gov/cencode/t57c28.pdf",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "OH",
    stateName: "Ohio",
    surplusFundLaw: "ORC 5721.20. Surplus from tax foreclosure sale distributed to former owner.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: null,
    interestRate: 18,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER", "MOTION"],
    filingFee: 7500,
    filingMethod: "in-person",
    filingAddress: null,
    deadlineCalculation: "3 years from date of judicial sale. Court filing required.",
    specialRequirements: "Must file motion with Common Pleas Court.",
    restrictions: null,
    sourceUrl: "https://codes.ohio.gov/ohio-revised-code/section-5721.20",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "OK",
    stateName: "Oklahoma",
    surplusFundLaw: "68 O.S. § 3131. Surplus from tax sale paid to former owner.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 730,
    interestRate: 8,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax deed.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/oklahoma/title-68/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "OR",
    stateName: "Oregon",
    surplusFundLaw: "ORS 312.120. Surplus from tax foreclosure sale held by county.",
    claimPeriodDays: 1825,
    redemptionPeriodDays: 730,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "5 years from date of foreclosure.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://www.oregonlegislature.gov/bills_laws/ors/ors312.html",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "PA",
    stateName: "Pennsylvania",
    surplusFundLaw: "72 P.S. § 5860.205. Surplus from tax sale distributed to owner and lienholders.",
    claimPeriodDays: 1825,
    redemptionPeriodDays: 270,
    interestRate: 10,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER", "MOTION"],
    filingFee: 5000,
    filingMethod: "in-person",
    filingAddress: null,
    deadlineCalculation: "5 years from date of tax sale. Court petition required.",
    specialRequirements: "Must file petition in Court of Common Pleas. Different procedures for Philadelphia.",
    restrictions: null,
    sourceUrl: "https://www.legis.state.pa.us/cfdocs/legis/li/uconsCheck.cfm?yr=1947&sessInd=0&act=542",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "RI",
    stateName: "Rhode Island",
    surplusFundLaw: "R.I. Gen. Laws § 44-9-27. Surplus from tax sale paid to former owner.",
    claimPeriodDays: 1825,
    redemptionPeriodDays: 365,
    interestRate: 16,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "5 years from date of tax sale.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://law.justia.com/codes/rhode-island/title-44/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "SC",
    stateName: "South Carolina",
    surplusFundLaw: "S.C. Code Ann. § 12-51-130. Surplus from tax sale paid to former owner.",
    claimPeriodDays: 1825,
    redemptionPeriodDays: 365,
    interestRate: 8,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "5 years from date of tax sale.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://www.scstatehouse.gov/code/t12c051.php",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "SD",
    stateName: "South Dakota",
    surplusFundLaw: "SDCL 10-25-1. Surplus from tax deed sale held by county.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 180,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax deed.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://sdlegislature.gov/Statutes/Codified_Laws/DisplayStatute.aspx?Type=Statute&Statute=10-25-1",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "TN",
    stateName: "Tennessee",
    surplusFundLaw: "T.C.A. § 67-5-2702. Surplus from tax sale paid to former owner upon petition.",
    claimPeriodDays: 3650,
    redemptionPeriodDays: 365,
    interestRate: 10,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER", "MOTION"],
    filingFee: 10000,
    filingMethod: "in-person",
    filingAddress: null,
    deadlineCalculation: "10 years from date of tax sale. Court petition required.",
    specialRequirements: "Must file petition in Chancery Court or Circuit Court. Interpleader action may be required.",
    restrictions: "Processing fees may be deducted.",
    sourceUrl: "https://law.justia.com/codes/tennessee/title-67/chapter-5/part-27/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "TX",
    stateName: "Texas",
    surplusFundLaw: "Tex. Tax Code § 34.04. Surplus from tax sale held by clerk and payable to former owner.",
    claimPeriodDays: 730,
    redemptionPeriodDays: 730,
    interestRate: 25,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER", "MOTION"],
    filingFee: 5000,
    filingMethod: "in-person",
    filingAddress: null,
    deadlineCalculation: "2 years from date of tax deed. Court order required for disbursement.",
    specialRequirements: "Must file petition with district court. 2-year redemption for homestead/agricultural.",
    restrictions: "6-month redemption for non-homestead.",
    sourceUrl: "https://statutes.capitol.texas.gov/Docs/TX/htm/TX.34.htm",
    feeCapPercent: 25,
    feeCapFlatCents: 100000,
    feeCapStatute: "Tex. Prop. Code § 34.015 — 25% or $1,000 max"
  },
  {
    stateCode: "UT",
    stateName: "Utah",
    surplusFundLaw: "Utah Code § 59-2-1351.1. Surplus from tax sale paid to former owner.",
    claimPeriodDays: 1825,
    redemptionPeriodDays: null,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "5 years from date of tax sale.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://le.utah.gov/xcode/Title59/Chapter2/59-2-S1351.1.html",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "VT",
    stateName: "Vermont",
    surplusFundLaw: "32 V.S.A. § 5260. Surplus from tax sale held by town.",
    claimPeriodDays: 2190,
    redemptionPeriodDays: 365,
    interestRate: 12,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "6 years from date of tax sale.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://legislature.vermont.gov/statutes/section/32/133/05260",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "VA",
    stateName: "Virginia",
    surplusFundLaw: "Va. Code § 58.1-3967. Surplus from tax sale paid to former owner.",
    claimPeriodDays: 730,
    redemptionPeriodDays: 730,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "2 years from date of tax sale deed.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://law.lis.virginia.gov/vacode/title58.1/chapter39/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "WA",
    stateName: "Washington",
    surplusFundLaw: "RCW 84.64.080. Surplus from tax foreclosure sale paid to former owner.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: null,
    interestRate: 12,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax deed.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://app.leg.wa.gov/rcw/default.aspx?cite=84.64.080",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "WV",
    stateName: "West Virginia",
    surplusFundLaw: "W. Va. Code § 11A-3-64. Surplus from tax sale paid to former owner.",
    claimPeriodDays: 1095,
    redemptionPeriodDays: 548,
    interestRate: 12,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "3 years from date of tax deed.",
    specialRequirements: "18-month redemption period from date of sale.",
    restrictions: null,
    sourceUrl: "https://www.wvlegislature.gov/WVCODE/ChapterEntire.cfm?chap=11a&art=3",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "WI",
    stateName: "Wisconsin",
    surplusFundLaw: "Wis. Stat. § 75.36. Surplus from tax deed sale paid to former owner.",
    claimPeriodDays: 730,
    redemptionPeriodDays: 730,
    interestRate: null,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "2 years from date of tax deed.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://docs.legis.wisconsin.gov/statutes/statutes/75/36",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "WY",
    stateName: "Wyoming",
    surplusFundLaw: "Wyo. Stat. § 39-13-108. Surplus from tax sale held by county.",
    claimPeriodDays: 1460,
    redemptionPeriodDays: 1460,
    interestRate: 15,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: null,
    deadlineCalculation: "4 years from date of tax deed. 4-year redemption period.",
    specialRequirements: null,
    restrictions: null,
    sourceUrl: "https://wyoleg.gov/statutes/compress/title39.pdf",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  },
  {
    stateCode: "DC",
    stateName: "District of Columbia",
    surplusFundLaw: "D.C. Code § 47-1382. Surplus from tax sale held by District.",
    claimPeriodDays: 2190,
    redemptionPeriodDays: 180,
    interestRate: 18,
    requiredDocuments: ["AFFIDAVIT", "LIMITED_POA", "CLIENT_ID", "COVER_LETTER"],
    filingFee: 0,
    filingMethod: "mail",
    filingAddress: "Office of Tax and Revenue, 1101 4th Street SW, Washington, DC 20024",
    deadlineCalculation: "6 years from date of tax sale.",
    specialRequirements: "Must file claim with Office of Tax and Revenue.",
    restrictions: null,
    sourceUrl: "https://code.dccouncil.us/us/dc/council/code/titles/47/chapters/13A/",
    feeCapPercent: null,
    feeCapFlatCents: null,
    feeCapStatute: null
  }
];

export function getStateRule(stateCode: string): StateRuleData | undefined {
  return STATE_RULES.find(rule => rule.stateCode === stateCode);
}

export function calculateDeadline(stateCode: string, saleDate: Date): Date | null {
  const rule = getStateRule(stateCode);
  if (!rule) return null;

  const deadline = new Date(saleDate);
  deadline.setDate(deadline.getDate() + rule.claimPeriodDays);
  return deadline;
}

export function calculateRedemptionDeadline(stateCode: string, saleDate: Date): Date | null {
  const rule = getStateRule(stateCode);
  if (!rule || !rule.redemptionPeriodDays) return null;

  const deadline = new Date(saleDate);
  deadline.setDate(deadline.getDate() + rule.redemptionPeriodDays);
  return deadline;
}

export function getRequiredDocuments(stateCode: string): DocumentType[] {
  const rule = getStateRule(stateCode);
  return rule?.requiredDocuments || [];
}
