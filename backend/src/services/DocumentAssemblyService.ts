// ============================================
// DOCUMENT ASSEMBLY SERVICE — MGR CAPITAL ASSISTANCE
// Bulk document generation from templates
// State-specific variations, auto-population
// Real PDF generation via pdf-lib
// ============================================

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";
import { botSubscriptionService, ACTION_COSTS } from "./BotSubscriptionService.js";
import logger from "../utils/logger.js";
import fs from "fs/promises";
import path from "path";

import prisma from "../lib/prisma.js";

// Generated docs output directory
const GENERATED_DIR = path.resolve("generated-documents");

// Document types and their templates
const DOC_TEMPLATES: Record<string, {
  name: string;
  requiredFields: string[];
  stateVariations: boolean;
}> = {
  CLAIM_LETTER: {
    name: "Surplus Funds Claim Letter",
    requiredFields: ["ownerName", "propertyAddress", "county", "state", "surplusAmount", "caseNumber"],
    stateVariations: true,
  },
  LIMITED_POA: {
    name: "Limited Power of Attorney",
    requiredFields: ["ownerName", "agentName", "propertyAddress", "county", "state"],
    stateVariations: true,
  },
  CLIENT_SERVICE_AGREEMENT: {
    name: "Client Service Agreement",
    requiredFields: ["clientName", "feePercent", "propertyAddress", "surplusAmount"],
    stateVariations: false,
  },
  ASSIGNMENT_AGREEMENT: {
    name: "Assignment of Surplus Funds",
    requiredFields: ["ownerName", "assigneeName", "propertyAddress", "county", "surplusAmount"],
    stateVariations: true,
  },
  CLOSING_STATEMENT: {
    name: "Closing Statement",
    requiredFields: ["clientName", "surplusAmount", "feeAmount", "netAmount", "propertyAddress"],
    stateVariations: false,
  },
  FILING_PACKET: {
    name: "County Filing Packet",
    requiredFields: ["ownerName", "propertyAddress", "county", "state", "caseNumber", "surplusAmount"],
    stateVariations: true,
  },
};

// State-specific filing requirements
const STATE_REQUIREMENTS: Record<string, {
  notarization: boolean;
  witnesses: number;
  additionalDocs: string[];
  filingMethod: string;
}> = {
  TX: { notarization: true, witnesses: 0, additionalDocs: ["AFFIDAVIT_OF_IDENTITY"], filingMethod: "online" },
  FL: { notarization: true, witnesses: 2, additionalDocs: ["NOTARIZED_AFFIDAVIT"], filingMethod: "mail" },
  CA: { notarization: false, witnesses: 0, additionalDocs: [], filingMethod: "online" },
  GA: { notarization: true, witnesses: 0, additionalDocs: ["PROOF_OF_OWNERSHIP"], filingMethod: "in_person" },
  OH: { notarization: false, witnesses: 0, additionalDocs: [], filingMethod: "mail" },
  NY: { notarization: true, witnesses: 1, additionalDocs: ["PROOF_OF_IDENTITY"], filingMethod: "online" },
};

interface AssemblyResult {
  caseId: string;
  documentsGenerated: GeneratedDoc[];
  totalCostCents: number;
  stateRequirements: typeof STATE_REQUIREMENTS[string] | null;
  missingInfo: string[];
}

interface GeneratedDoc {
  type: string;
  name: string;
  status: "generated" | "missing_fields" | "error";
  missingFields?: string[];
  url?: string;
}

class DocumentAssemblyService {
  private initialized = false;

  private async ensureOutputDir(): Promise<void> {
    if (this.initialized) return;
    try {
      await fs.mkdir(GENERATED_DIR, { recursive: true });
      this.initialized = true;
    } catch {
      // Directory already exists
      this.initialized = true;
    }
  }

  /**
   * Generate ALL required docs for a case in one call
   */
  async assembleDocPackage(caseId: string, employeeId?: string): Promise<AssemblyResult> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        assignedEmployee: { select: { id: true, name: true } },
        stateRule: true,
      },
    });

    if (!caseData) throw new Error(`Case ${caseId} not found`);

    const actingUserId = employeeId || caseData.assignedEmployeeId;
    if (actingUserId) {
      const canUse = await botSubscriptionService.canUseBot(actingUserId, "docs");
      if (!canUse) {
        throw new Error("User does not have document bot access. Subscribe to PROFESSIONAL tier or above.");
      }
    }

    const documentsGenerated: GeneratedDoc[] = [];
    let totalCostCents = 0;
    const missingInfo: string[] = [];

    // Gather case data for template population
    const templateData = {
      ownerName: caseData.client?.name || caseData.previousOwner || "",
      clientName: caseData.client?.name || "",
      agentName: "MGR Capital Assistance",
      propertyAddress: caseData.propertyAddress || "",
      county: caseData.county || "",
      state: caseData.state || "",
      surplusAmount: caseData.surplusAmountCents ? `$${(caseData.surplusAmountCents / 100).toLocaleString()}` : "",
      caseNumber: caseData.courtCaseNumber || caseData.internalCode,
      feePercent: caseData.feePercent ? `${caseData.feePercent}%` : "35%",
      feeAmount: caseData.surplusAmountCents && caseData.feePercent
        ? `$${((caseData.surplusAmountCents * (caseData.feePercent / 100)) / 100).toLocaleString()}`
        : "",
      netAmount: caseData.surplusAmountCents && caseData.feePercent
        ? `$${((caseData.surplusAmountCents * (1 - caseData.feePercent / 100)) / 100).toLocaleString()}`
        : "",
      assigneeName: "MGR Capital Assistance LLC",
      date: new Date().toLocaleDateString("en-US"),
    };

    // Determine which documents to generate
    const docsToGenerate = this.getRequiredDocs(caseData.status, caseData.state);

    for (const docType of docsToGenerate) {
      const template = DOC_TEMPLATES[docType];
      if (!template) continue;

      // Check for missing fields
      const missingFields = template.requiredFields.filter(
        field => !templateData[field as keyof typeof templateData]
      );

      if (missingFields.length > 0) {
        documentsGenerated.push({
          type: docType,
          name: template.name,
          status: "missing_fields",
          missingFields,
        });
        missingInfo.push(...missingFields.map(f => `${template.name}: missing ${f}`));
        continue;
      }

      try {
        const { url, fileSize } = await this.generateDocument(docType, templateData, caseData.state);

        const cost = ACTION_COSTS.doc_generated;
        totalCostCents += cost;

        documentsGenerated.push({
          type: docType,
          name: template.name,
          status: "generated",
          url,
        });

        // Create document record in database
        await prisma.document.create({
          data: {
            caseId,
            type: docType as any,
            status: "DRAFT",
            fileName: `${docType.toLowerCase()}_${templateData.caseNumber}.pdf`,
            fileUrl: url,
            fileSize,
            mimeType: "application/pdf",
            uploadedById: actingUserId || caseData.assignedEmployeeId!,
          },
        });

        if (actingUserId) {
          await botSubscriptionService.logUsage(actingUserId, "docs", "doc_generated", cost, caseId, { docType });
        }
      } catch (error: any) {
        documentsGenerated.push({
          type: docType,
          name: template.name,
          status: "error",
          missingFields: [error.message],
        });
      }
    }

    const stateReqs = STATE_REQUIREMENTS[caseData.state] || null;

    // Log to OpsInsight
    const successCount = documentsGenerated.filter(d => d.status === "generated").length;
    await prisma.opsInsight.create({
      data: {
        type: "CASE_RECOMMENDATION",
        priority: "LOW",
        title: `Document package assembled: ${caseData.internalCode}`,
        summary: `Generated ${successCount}/${documentsGenerated.length} documents. Cost: $${(totalCostCents / 100).toFixed(2)}`,
        details: { caseId, documentsGenerated, stateRequirements: stateReqs } as any,
        plainEnglish: `Generated ${successCount} documents for case ${caseData.internalCode}${missingInfo.length > 0 ? `. Missing info: ${missingInfo.join(", ")}` : "."}`,
        recommendations: missingInfo.length > 0 ? [`Gather missing information: ${missingInfo.join(", ")}`] : [],
        relatedCaseIds: [caseId],
        relatedUserIds: actingUserId ? [actingUserId] : [],
        relatedAlertIds: [],
        sourceBot: "documentAssembly",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { caseId, documentsGenerated, totalCostCents, stateRequirements: stateReqs, missingInfo };
  }

  /**
   * Generate a single document
   */
  async generateSingleDoc(caseId: string, docType: string, employeeId?: string): Promise<GeneratedDoc> {
    const result = await this.assembleDocPackage(caseId, employeeId);
    const doc = result.documentsGenerated.find(d => d.type === docType);
    if (!doc) throw new Error(`Document type ${docType} not found in assembly result`);
    return doc;
  }

  /**
   * Get state-specific requirements
   */
  getStateRequirements(state: string) {
    return STATE_REQUIREMENTS[state] || {
      notarization: false,
      witnesses: 0,
      additionalDocs: [],
      filingMethod: "mail",
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private getRequiredDocs(status: string, state: string): string[] {
    const baseDocs = ["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA", "CLAIM_LETTER"];

    if (status === "DOCS_SIGNED" || status === "FILED") {
      baseDocs.push("FILING_PACKET", "ASSIGNMENT_AGREEMENT");
    }

    if (status === "AWAITING_FUNDS" || status === "PAID") {
      baseDocs.push("CLOSING_STATEMENT");
    }

    return baseDocs;
  }

  /**
   * Generate a real PDF document using pdf-lib
   */
  private async generateDocument(
    docType: string,
    data: Record<string, string>,
    state: string
  ): Promise<{ url: string; fileSize: number }> {
    await this.ensureOutputDir();

    const template = DOC_TEMPLATES[docType];
    const stateReqs = STATE_REQUIREMENTS[state];
    const content = this.buildDocumentContent(docType, data, state);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const pageWidth = 612; // Letter size
    const pageHeight = 792;
    const margin = 72; // 1 inch
    const fontSize = 11;
    const lineHeight = 16;
    const maxWidth = pageWidth - margin * 2;

    // Split content into lines, wrapping long text
    const lines = this.wrapText(content, font, fontSize, maxWidth);
    const linesPerPage = Math.floor((pageHeight - margin * 2 - 40) / lineHeight);
    const pageCount = Math.ceil(lines.length / linesPerPage);

    for (let pageNum = 0; pageNum < pageCount; pageNum++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const startLine = pageNum * linesPerPage;
      const endLine = Math.min(startLine + linesPerPage, lines.length);

      let y = pageHeight - margin;

      for (let i = startLine; i < endLine; i++) {
        const line = lines[i];
        const isHeader = line === line.toUpperCase() && line.length < 60 && line.trim().length > 0;
        const isSectionDivider = line.startsWith("---");

        if (isSectionDivider) {
          // Draw a horizontal line
          page.drawLine({
            start: { x: margin, y },
            end: { x: pageWidth - margin, y },
            thickness: 0.5,
            color: rgb(0.6, 0.6, 0.6),
          });
          y -= lineHeight;
          continue;
        }

        page.drawText(line, {
          x: margin,
          y,
          size: isHeader ? 13 : fontSize,
          font: isHeader ? boldFont : font,
          color: rgb(0, 0, 0),
        });

        y -= lineHeight;
      }

      // Footer
      page.drawText(`Page ${pageNum + 1} of ${pageCount}`, {
        x: pageWidth / 2 - 30,
        y: 30,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText("MGR Capital Assistance — Confidential", {
        x: margin,
        y: 30,
        size: 8,
        font,
        color: rgb(0.7, 0.7, 0.7),
      });
    }

    // Signature block on last page if applicable
    if (docType !== "CLOSING_STATEMENT") {
      const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
      this.addSignatureBlock(lastPage, font, boldFont, data, margin);
    }

    const pdfBytes = await pdfDoc.save();
    const fileSize = pdfBytes.length;

    // Save to filesystem
    const timestamp = Date.now();
    const filename = `${docType.toLowerCase()}_${data.caseNumber}_${timestamp}.pdf`;
    const filePath = path.join(GENERATED_DIR, filename);
    await fs.writeFile(filePath, pdfBytes);

    const url = `/api/documents/generated/${filename}`;

    logger.info(`Generated PDF document: ${docType}`, {
      state,
      caseNumber: data.caseNumber,
      filename,
      fileSize,
      pages: pageCount,
    });

    return { url, fileSize };
  }

  /**
   * Build document text content from type + data
   */
  private buildDocumentContent(docType: string, data: Record<string, string>, state: string): string {
    const stateReqs = STATE_REQUIREMENTS[state];
    const lines: string[] = [];

    switch (docType) {
      case "CLAIM_LETTER":
        lines.push("SURPLUS FUNDS CLAIM LETTER");
        lines.push("");
        lines.push(`Date: ${data.date}`);
        lines.push(`Case Number: ${data.caseNumber}`);
        lines.push("");
        lines.push(`${data.county} County Clerk of Courts`);
        lines.push(`State of ${state}`);
        lines.push("");
        lines.push("RE: Claim for Surplus Funds");
        lines.push(`Property: ${data.propertyAddress}`);
        lines.push(`Surplus Amount: ${data.surplusAmount}`);
        lines.push("");
        lines.push("---");
        lines.push("");
        lines.push("Dear Sir or Madam,");
        lines.push("");
        lines.push(`This letter serves as a formal claim for surplus funds in the amount of ${data.surplusAmount} resulting from the foreclosure sale of the above-referenced property.`);
        lines.push("");
        lines.push(`The claimant, ${data.ownerName}, was the owner of record of the property located at ${data.propertyAddress}, ${data.county} County, ${state} at the time of the foreclosure sale.`);
        lines.push("");
        lines.push(`The undersigned, MGR Capital Assistance, acting as authorized agent for ${data.ownerName} pursuant to the attached Limited Power of Attorney, hereby requests disbursement of the surplus funds to the claimant.`);
        lines.push("");
        lines.push("Enclosed with this claim are the following supporting documents:");
        lines.push("  1. Limited Power of Attorney");
        lines.push("  2. Copy of government-issued identification");
        lines.push("  3. Proof of prior ownership");
        if (stateReqs?.notarization) lines.push("  4. Notarized affidavit of identity");
        if (stateReqs?.additionalDocs.length) {
          stateReqs.additionalDocs.forEach((doc, i) => {
            lines.push(`  ${5 + i}. ${doc.replace(/_/g, " ")}`);
          });
        }
        lines.push("");
        lines.push("Please process this claim at your earliest convenience. Should you require any additional information or documentation, please contact our office.");
        lines.push("");
        lines.push("Respectfully submitted,");
        break;

      case "LIMITED_POA":
        lines.push("LIMITED POWER OF ATTORNEY");
        lines.push("");
        lines.push(`State of ${state}`);
        lines.push(`County of ${data.county}`);
        lines.push("");
        lines.push("---");
        lines.push("");
        lines.push("KNOW ALL PERSONS BY THESE PRESENTS:");
        lines.push("");
        lines.push(`I, ${data.ownerName} (hereinafter "Principal"), of ${data.county} County, ${state}, do hereby appoint ${data.agentName} (hereinafter "Agent") as my true and lawful attorney-in-fact for the following limited purposes:`);
        lines.push("");
        lines.push("1. To file claims for surplus funds on my behalf with any court, county clerk, or government agency in connection with the foreclosure sale of the following property:");
        lines.push(`   Property: ${data.propertyAddress}`);
        lines.push(`   County: ${data.county}, ${state}`);
        lines.push("");
        lines.push("2. To execute, sign, and deliver any documents necessary to recover said surplus funds.");
        lines.push("");
        lines.push("3. To receive and disburse surplus funds on my behalf in accordance with the terms of the Client Service Agreement between the parties.");
        lines.push("");
        lines.push("4. To communicate with courts, clerks, and other parties regarding the claim.");
        lines.push("");
        lines.push("This Power of Attorney is LIMITED to the purposes described above and shall expire upon the earlier of: (a) disbursement of all surplus funds, (b) one year from the date of execution, or (c) written revocation by the Principal.");
        lines.push("");
        if (stateReqs?.witnesses && stateReqs.witnesses > 0) {
          lines.push(`This document requires ${stateReqs.witnesses} witness(es) per ${state} state law.`);
          lines.push("");
        }
        if (stateReqs?.notarization) {
          lines.push(`This document must be notarized per ${state} state law.`);
          lines.push("");
        }
        lines.push("IN WITNESS WHEREOF, I have executed this Limited Power of Attorney on this date.");
        break;

      case "CLIENT_SERVICE_AGREEMENT":
        lines.push("CLIENT SERVICE AGREEMENT");
        lines.push("");
        lines.push(`Date: ${data.date}`);
        lines.push("");
        lines.push("---");
        lines.push("");
        lines.push("This Client Service Agreement ('Agreement') is entered into between:");
        lines.push("");
        lines.push(`Client: ${data.clientName}`);
        lines.push(`Service Provider: MGR Capital Assistance LLC ('Company')`);
        lines.push("");
        lines.push(`Property Address: ${data.propertyAddress}`);
        lines.push(`Estimated Surplus Amount: ${data.surplusAmount}`);
        lines.push("");
        lines.push("1. SERVICES");
        lines.push("The Company agrees to provide the following services:");
        lines.push("  a. Research and identify surplus funds from foreclosure sales");
        lines.push("  b. Prepare and file all necessary claim documentation");
        lines.push("  c. Communicate with courts and government agencies on Client's behalf");
        lines.push("  d. Process disbursement of recovered funds");
        lines.push("");
        lines.push("2. COMPENSATION");
        lines.push(`The Company's fee shall be ${data.feePercent} of the total surplus funds recovered.`);
        lines.push(`Estimated fee based on known surplus: ${data.surplusAmount} x ${data.feePercent}`);
        lines.push("No fees shall be charged if no surplus funds are recovered.");
        lines.push("");
        lines.push("3. CLIENT OBLIGATIONS");
        lines.push("The Client agrees to:");
        lines.push("  a. Provide accurate personal and property information");
        lines.push("  b. Execute necessary documents (Power of Attorney, claim forms)");
        lines.push("  c. Respond to requests for information in a timely manner");
        lines.push("  d. Not engage other parties for the same claim during this Agreement");
        lines.push("");
        lines.push("4. TERM AND TERMINATION");
        lines.push("This Agreement shall remain in effect until the surplus funds are recovered and distributed, or until terminated by either party with 30 days written notice.");
        lines.push("");
        lines.push("5. NO GUARANTEE");
        lines.push("The Company makes no guarantee of recovery. Results depend on court processes, eligibility, and available surplus amounts.");
        break;

      case "ASSIGNMENT_AGREEMENT":
        lines.push("ASSIGNMENT OF SURPLUS FUNDS");
        lines.push("");
        lines.push(`Date: ${data.date}`);
        lines.push(`County: ${data.county}`);
        lines.push("");
        lines.push("---");
        lines.push("");
        lines.push(`For valuable consideration, the receipt and sufficiency of which is hereby acknowledged, ${data.ownerName} ("Assignor") hereby assigns, transfers, and conveys to ${data.assigneeName} ("Assignee") the right to collect surplus funds in the amount of ${data.surplusAmount} arising from the foreclosure sale of the property located at:`);
        lines.push("");
        lines.push(`${data.propertyAddress}`);
        lines.push(`${data.county} County`);
        lines.push("");
        lines.push("This assignment is subject to the terms and conditions set forth in the Client Service Agreement between the parties.");
        lines.push("");
        lines.push("The Assignee shall disburse the net proceeds to the Assignor after deduction of the agreed-upon service fee.");
        break;

      case "CLOSING_STATEMENT":
        lines.push("CLOSING STATEMENT");
        lines.push("");
        lines.push(`Date: ${data.date}`);
        lines.push("");
        lines.push("---");
        lines.push("");
        lines.push(`Client: ${data.clientName}`);
        lines.push(`Property: ${data.propertyAddress}`);
        lines.push("");
        lines.push("FINANCIAL SUMMARY");
        lines.push("");
        lines.push(`Gross Surplus Funds Recovered:    ${data.surplusAmount}`);
        lines.push(`Service Fee:                      ${data.feeAmount}`);
        lines.push(`Net Amount to Client:             ${data.netAmount}`);
        lines.push("");
        lines.push("---");
        lines.push("");
        lines.push("By signing below, the Client acknowledges receipt of the above net amount and confirms that the Company has fulfilled its obligations under the Client Service Agreement.");
        lines.push("");
        lines.push("All matters related to this surplus funds recovery are hereby considered closed and settled.");
        break;

      case "FILING_PACKET":
        lines.push("COUNTY FILING PACKET");
        lines.push("");
        lines.push(`Case Number: ${data.caseNumber}`);
        lines.push(`Date: ${data.date}`);
        lines.push(`County: ${data.county}, ${state}`);
        lines.push("");
        lines.push("---");
        lines.push("");
        lines.push("FILING CHECKLIST");
        lines.push("");
        lines.push(`[  ] Claim Letter — Surplus amount: ${data.surplusAmount}`);
        lines.push("[  ] Limited Power of Attorney (executed)");
        lines.push("[  ] Copy of government-issued ID");
        lines.push("[  ] Proof of prior ownership");
        if (stateReqs?.notarization) lines.push("[  ] Notarized affidavit");
        if (stateReqs?.additionalDocs.length) {
          stateReqs.additionalDocs.forEach(doc => {
            lines.push(`[  ] ${doc.replace(/_/g, " ")}`);
          });
        }
        lines.push("");
        lines.push(`Filing Method: ${stateReqs?.filingMethod?.toUpperCase() || "MAIL"}`);
        if (stateReqs?.witnesses && stateReqs.witnesses > 0) {
          lines.push(`Witnesses Required: ${stateReqs.witnesses}`);
        }
        lines.push("");
        lines.push("PROPERTY INFORMATION");
        lines.push(`Owner: ${data.ownerName}`);
        lines.push(`Address: ${data.propertyAddress}`);
        lines.push(`County: ${data.county}`);
        lines.push(`State: ${state}`);
        lines.push(`Surplus Amount: ${data.surplusAmount}`);
        break;

      default:
        lines.push(DOC_TEMPLATES[docType]?.name?.toUpperCase() || docType);
        lines.push("");
        lines.push(`Date: ${data.date}`);
        lines.push(`Case: ${data.caseNumber}`);
        break;
    }

    return lines.join("\n");
  }

  /**
   * Wrap text to fit within maxWidth
   */
  private wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    const result: string[] = [];
    const paragraphs = text.split("\n");

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        result.push("");
        continue;
      }

      const words = paragraph.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width > maxWidth && currentLine) {
          result.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        result.push(currentLine);
      }
    }

    return result;
  }

  /**
   * Add signature block to a page
   */
  private addSignatureBlock(page: PDFPage, font: PDFFont, boldFont: PDFFont, data: Record<string, string>, margin: number): void {
    const y = 140;

    page.drawLine({
      start: { x: margin, y: y + 5 },
      end: { x: margin + 200, y: y + 5 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    page.drawText(data.ownerName || "Principal", { x: margin, y: y - 10, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText(`Date: _______________`, { x: margin, y: y - 25, size: 10, font, color: rgb(0, 0, 0) });

    page.drawLine({
      start: { x: 350, y: y + 5 },
      end: { x: 550, y: y + 5 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    page.drawText("MGR Capital Assistance LLC", { x: 350, y: y - 10, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText(`Date: ${data.date}`, { x: 350, y: y - 25, size: 10, font, color: rgb(0, 0, 0) });
  }
}

export const documentAssemblyService = new DocumentAssemblyService();
export default documentAssemblyService;
