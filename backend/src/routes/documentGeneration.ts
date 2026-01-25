/**
 * Document Generation Routes — MGR CAPITAL ASSISTANCE
 * Voice-to-document generation with PDF output
 */

import { Router } from "express";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { authenticate } from "../middleware/authMiddleware.js";
import { logger } from "../utils/logger.js";

const router = Router();

type DocumentType =
  | "demand-letter"
  | "motion"
  | "affidavit"
  | "contract"
  | "notice"
  | "memo"
  | "power-of-attorney"
  | "subpoena"
  | "settlement-agreement";

interface GenerateRequest {
  voiceText: string;
  type: DocumentType;
  userId?: string;
  metadata?: Record<string, string>;
}

// Document templates
const TEMPLATES: Record<DocumentType, (text: string, date: string) => string> = {
  "demand-letter": (text, date) => `
DEMAND LETTER

Date: ${date}

RE: Formal Demand

To Whom It May Concern:

${text}

This letter serves as formal demand for immediate action. Please respond within thirty (30) days of receipt of this letter.

Failure to respond or comply may result in further legal action.

Respectfully,

_________________________
[Signature]
MGR Capital Assistance
  `.trim(),

  motion: (text, date) => `
IN THE COURT OF ____________

CASE NO.: ____________

MOTION

Comes now the undersigned and respectfully moves this Honorable Court as follows:

${text}

WHEREFORE, the undersigned respectfully requests that this Court grant the relief requested herein.

Respectfully submitted,

Date: ${date}

_________________________
[Attorney/Party Name]
  `.trim(),

  affidavit: (text, date) => `
AFFIDAVIT

STATE OF ____________
COUNTY OF ____________

Before me, the undersigned authority, personally appeared ____________, who being duly sworn, deposes and states as follows:

${text}

FURTHER AFFIANT SAYETH NOT.

_________________________
[Affiant Signature]

SWORN TO AND SUBSCRIBED before me this _____ day of ____________, 20___.

_________________________
Notary Public
My Commission Expires: ____________
  `.trim(),

  contract: (text, date) => `
AGREEMENT

This Agreement is entered into as of ${date}.

PARTIES:
[Party 1 Name] ("Party A")
[Party 2 Name] ("Party B")

RECITALS:
${text}

TERMS AND CONDITIONS:

1. The parties agree to the terms set forth herein.
2. This Agreement shall be binding upon the parties and their successors.
3. This Agreement constitutes the entire understanding between the parties.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

_________________________     _________________________
Party A                       Party B
  `.trim(),

  notice: (text, date) => `
NOTICE

Date: ${date}

TO: [Recipient Name/Address]

RE: Formal Notice

Please take notice that:

${text}

This notice is provided in accordance with applicable law and regulations.

Please govern yourself accordingly.

Respectfully,

_________________________
[Name]
[Title]
  `.trim(),

  memo: (text, date) => `
LEGAL MEMORANDUM

TO: [Recipient]
FROM: [Author]
DATE: ${date}
RE: Legal Analysis

QUESTION PRESENTED:

BRIEF ANSWER:

FACTS:
${text}

ANALYSIS:

CONCLUSION:

_________________________
[Attorney Name]
  `.trim(),

  "power-of-attorney": (text, date) => `
LIMITED POWER OF ATTORNEY

Date: ${date}

KNOW ALL PERSONS BY THESE PRESENTS:

I, _________________________ ("Principal"), of legal age and sound mind, do hereby appoint _________________________ ("Agent") as my true and lawful attorney-in-fact.

PURPOSE AND SCOPE:

${text}

This Limited Power of Attorney is granted solely for the purpose of recovering surplus funds, tax sale overages, and related unclaimed property on my behalf.

POWERS GRANTED:

1. To execute any documents necessary for the recovery of surplus funds
2. To communicate with government agencies, courts, and financial institutions
3. To receive and endorse checks payable to the Principal
4. To negotiate and settle claims on my behalf

LIMITATIONS:

This power of attorney does not authorize the Agent to:
- Make healthcare decisions
- Make gifts of the Principal's property
- Change beneficiary designations
- Create or modify trusts

DURATION:

This power of attorney shall remain in effect until revoked in writing by the Principal or upon completion of the stated purpose.

IN WITNESS WHEREOF, I have executed this Limited Power of Attorney on the date first written above.

_________________________
Principal Signature

_________________________
Printed Name

STATE OF _____________
COUNTY OF ____________

Subscribed and sworn before me this _____ day of ____________, 20___.

_________________________
Notary Public
My Commission Expires: ____________
  `.trim(),

  subpoena: (text, date) => `
SUBPOENA

Date: ${date}

TO: _________________________

YOU ARE HEREBY COMMANDED to appear before the _________________________ Court located at _________________________ on the _____ day of ____________, 20___ at _____ o'clock ___.m.

PURPOSE:

${text}

YOU ARE FURTHER COMMANDED to bring with you the following documents and records:

1. _________________________
2. _________________________
3. _________________________

FAILURE TO COMPLY with this subpoena may result in contempt of court charges and other penalties as provided by law.

WITNESS my hand and the seal of said Court on the date first written above.

_________________________
Clerk of Court / Attorney

_________________________
Case Number

_________________________
Court Seal
  `.trim(),

  "settlement-agreement": (text, date) => `
SETTLEMENT AGREEMENT AND RELEASE

Date: ${date}

This Settlement Agreement and Release ("Agreement") is entered into by and between:

Party A: _________________________
Party B: _________________________

(collectively, the "Parties")

RECITALS:

WHEREAS, a dispute has arisen between the Parties regarding surplus funds recovery;

WHEREAS, the Parties desire to resolve all disputes and claims between them;

NOW, THEREFORE, in consideration of the mutual covenants and agreements set forth herein, the Parties agree as follows:

1. SETTLEMENT AMOUNT

${text}

2. RELEASE OF CLAIMS

Upon receipt of the Settlement Amount, the Parties mutually release and forever discharge each other from any and all claims, demands, damages, actions, and causes of action arising out of or related to the matters described herein.

3. CONFIDENTIALITY

The terms of this Agreement shall remain confidential and shall not be disclosed to any third party except as required by law.

4. NO ADMISSION OF LIABILITY

This Agreement is a compromise of disputed claims and shall not be construed as an admission of liability by any Party.

5. ENTIRE AGREEMENT

This Agreement constitutes the entire understanding between the Parties and supersedes all prior negotiations, representations, and agreements.

6. GOVERNING LAW

This Agreement shall be governed by the laws of the State of _____________.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above.

_________________________          _________________________
Party A Signature                   Party B Signature

_________________________          _________________________
Printed Name                        Printed Name

_________________________          _________________________
Date                                Date
  `.trim(),
};

/**
 * POST /api/documents/generate-from-voice
 * Generate a legal document from voice transcription
 */
router.post("/generate-from-voice", async (req, res) => {
  try {
    const { voiceText, type, userId, metadata } = req.body as GenerateRequest;

    if (!voiceText || !type) {
      return res.status(400).json({
        error: "Missing required fields: voiceText and type",
      });
    }

    if (!TEMPLATES[type]) {
      return res.status(400).json({
        error: `Invalid document type. Valid types: ${Object.keys(TEMPLATES).join(", ")}`,
      });
    }

    logger.info("Generating document from voice", { type, userId, textLength: voiceText.length });

    // Format date
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Process voice text (basic cleanup)
    const processedText = voiceText
      .replace(/\s+/g, " ")
      .replace(/new paragraph/gi, "\n\n")
      .replace(/new line/gi, "\n")
      .replace(/period/gi, ".")
      .replace(/comma/gi, ",")
      .replace(/colon/gi, ":")
      .replace(/semicolon/gi, ";")
      .trim();

    // Generate document content from template
    const content = TEMPLATES[type](processedText, date);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // A4 size in points
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 72; // 1 inch margins
    const fontSize = 12;
    const lineHeight = 18;

    // Split content into lines
    const maxWidth = pageWidth - margin * 2;
    const lines = wrapText(content, font, fontSize, maxWidth);

    // Calculate pages needed
    const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
    const pageCount = Math.ceil(lines.length / linesPerPage);

    // Create pages
    for (let pageNum = 0; pageNum < pageCount; pageNum++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const startLine = pageNum * linesPerPage;
      const endLine = Math.min(startLine + linesPerPage, lines.length);

      let y = pageHeight - margin;

      for (let i = startLine; i < endLine; i++) {
        const line = lines[i];

        // Check if this is a header line (all caps and short)
        const isHeader = line === line.toUpperCase() && line.length < 50 && line.trim().length > 0;

        page.drawText(line, {
          x: margin,
          y: y,
          size: isHeader ? 14 : fontSize,
          font: isHeader ? boldFont : font,
          color: rgb(0, 0, 0),
        });

        y -= lineHeight;
      }

      // Add page number
      page.drawText(`Page ${pageNum + 1} of ${pageCount}`, {
        x: pageWidth / 2 - 30,
        y: 30,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Add watermark
      page.drawText("Generated by MGR Capital Assistance", {
        x: margin,
        y: 30,
        size: 8,
        font: font,
        color: rgb(0.7, 0.7, 0.7),
      });
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    logger.info("Document generated successfully", {
      type,
      pages: pageCount,
      size: pdfBytes.length,
    });

    // Return PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${type}-${Date.now()}.pdf"`
    );
    res.send(Buffer.from(pdfBytes));
  } catch (error: any) {
    logger.error("Document generation failed", { error: error.message });
    res.status(500).json({ error: "Document generation failed" });
  }
});

/**
 * POST /api/documents/generate-preview
 * Generate document content preview (without PDF)
 */
router.post("/generate-preview", async (req, res) => {
  try {
    const { voiceText, type } = req.body as GenerateRequest;

    if (!voiceText || !type) {
      return res.status(400).json({
        error: "Missing required fields: voiceText and type",
      });
    }

    if (!TEMPLATES[type]) {
      return res.status(400).json({
        error: `Invalid document type`,
      });
    }

    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const processedText = voiceText
      .replace(/\s+/g, " ")
      .replace(/new paragraph/gi, "\n\n")
      .replace(/new line/gi, "\n")
      .trim();

    const content = TEMPLATES[type](processedText, date);

    res.json({
      success: true,
      content,
      type,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Preview generation failed", { error: error.message });
    res.status(500).json({ error: "Preview generation failed" });
  }
});

/**
 * GET /api/documents/templates
 * List available document templates
 */
router.get("/templates", (_req, res) => {
  const templates = Object.keys(TEMPLATES).map((key) => ({
    id: key,
    name: key
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  }));

  res.json({ templates });
});

// Helper: Wrap text to fit within max width
function wrapText(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number
): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }

    const words = paragraph.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);

      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

export default router;
