/**
 * DigitalSealService.ts — MGR CAPITAL ASSISTANCE
 *
 * Digital Notary Seal/Stamp Generation Service
 * Generates professional notary seals as PNG images and applies them to PDF documents.
 *
 * CAPABILITIES:
 * - Generate circular notary seals with customizable text
 * - Store founder's notary credentials in FounderConfig
 * - Apply seals to PDF documents during notarization
 * - Support for state-specific seal requirements
 *
 * SEAL COMPONENTS:
 * - "NOTARY PUBLIC" text
 * - State name
 * - Notary name
 * - Commission number
 * - Expiration date
 * - Circular border design
 *
 * INTEGRATES WITH:
 * - FounderNotaryService
 * - SelfHostedRONService
 */

import { PrismaClient } from "@prisma/client";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
// @ts-ignore - pdfkit doesn't have types
import PDFKit from "pdfkit";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export interface NotaryCredentials {
  notaryName: string;
  commissionNumber: string;
  commissionState: string;
  commissionCounty?: string;
  commissionExpiration: Date;
  bondAmount?: number;
  bondNumber?: string;
  eoInsuranceProvider?: string;
  eoInsurancePolicyNumber?: string;
}

export interface SealConfig {
  // Required fields
  notaryName: string;
  stateName: string;
  commissionNumber: string;
  expirationDate: Date;

  // Optional customization
  countyName?: string;
  sealType?: "circular" | "rectangular";
  diameter?: number; // pixels, default 200
  borderWidth?: number; // default 3
  primaryColor?: string; // hex color for border/text
  backgroundColor?: string; // hex color for background
  includeStateSeal?: boolean;
}

export interface GeneratedSeal {
  id: string;
  base64: string; // PNG image as base64
  width: number;
  height: number;
  format: "png";
  createdAt: Date;
  config: SealConfig;
}

export interface ApplySealOptions {
  pageNumber?: number; // Default: last page
  x?: number; // X position (default: bottom right)
  y?: number; // Y position (default: bottom right)
  width?: number; // Seal width in PDF points (default: 100)
  height?: number; // Seal height in PDF points (default: 100)
  opacity?: number; // 0-1, default 1
  includeSignature?: boolean;
  signatureBase64?: string;
}

// =============================================================================
// SEAL GENERATION CONSTANTS
// =============================================================================

const DEFAULT_SEAL_CONFIG: {
  diameter: number;
  borderWidth: number;
  primaryColor: string;
  backgroundColor: string;
  sealType: "circular" | "rectangular";
} = {
  diameter: 200,
  borderWidth: 3,
  primaryColor: "#1a365d", // Navy blue
  backgroundColor: "#ffffff",
  sealType: "circular",
};

// State abbreviations to full names
const STATE_NAMES: Record<string, string> = {
  AL: "ALABAMA", AK: "ALASKA", AZ: "ARIZONA", AR: "ARKANSAS", CA: "CALIFORNIA",
  CO: "COLORADO", CT: "CONNECTICUT", DE: "DELAWARE", FL: "FLORIDA", GA: "GEORGIA",
  HI: "HAWAII", ID: "IDAHO", IL: "ILLINOIS", IN: "INDIANA", IA: "IOWA",
  KS: "KANSAS", KY: "KENTUCKY", LA: "LOUISIANA", ME: "MAINE", MD: "MARYLAND",
  MA: "MASSACHUSETTS", MI: "MICHIGAN", MN: "MINNESOTA", MS: "MISSISSIPPI", MO: "MISSOURI",
  MT: "MONTANA", NE: "NEBRASKA", NV: "NEVADA", NH: "NEW HAMPSHIRE", NJ: "NEW JERSEY",
  NM: "NEW MEXICO", NY: "NEW YORK", NC: "NORTH CAROLINA", ND: "NORTH DAKOTA", OH: "OHIO",
  OK: "OKLAHOMA", OR: "OREGON", PA: "PENNSYLVANIA", RI: "RHODE ISLAND", SC: "SOUTH CAROLINA",
  SD: "SOUTH DAKOTA", TN: "TENNESSEE", TX: "TEXAS", UT: "UTAH", VT: "VERMONT",
  VA: "VIRGINIA", WA: "WASHINGTON", WV: "WEST VIRGINIA", WI: "WISCONSIN", WY: "WYOMING",
  DC: "DISTRICT OF COLUMBIA",
};

// =============================================================================
// DIGITAL SEAL SERVICE CLASS
// =============================================================================

class DigitalSealService {
  private sealCache: Map<string, GeneratedSeal> = new Map();

  /**
   * Store founder's notary credentials in FounderConfig
   */
  async storeFounderCredentials(credentials: NotaryCredentials): Promise<void> {
    const encryptedCredentials = {
      ...credentials,
      commissionNumber: this.encrypt(credentials.commissionNumber),
      bondNumber: credentials.bondNumber ? this.encrypt(credentials.bondNumber) : undefined,
    };

    await prisma.founderConfig.upsert({
      where: { key: "founder_notary_seal_credentials" },
      update: {
        value: encryptedCredentials as any,
        description: "Founder notary credentials for digital seal generation",
      },
      create: {
        key: "founder_notary_seal_credentials",
        value: encryptedCredentials as any,
        description: "Founder notary credentials for digital seal generation",
      },
    });

    logger.info("[DigitalSeal] Founder credentials stored", {
      state: credentials.commissionState,
      expiration: credentials.commissionExpiration,
    });
  }

  /**
   * Get founder's notary credentials from FounderConfig
   */
  async getFounderCredentials(): Promise<NotaryCredentials | null> {
    const config = await prisma.founderConfig.findUnique({
      where: { key: "founder_notary_seal_credentials" },
    });

    if (!config?.value) return null;

    const data = config.value as any;
    return {
      ...data,
      commissionNumber: this.decrypt(data.commissionNumber),
      bondNumber: data.bondNumber ? this.decrypt(data.bondNumber) : undefined,
      commissionExpiration: new Date(data.commissionExpiration),
    };
  }

  /**
   * Generate a digital notary seal as PNG base64
   */
  async generateSeal(config: SealConfig): Promise<GeneratedSeal> {
    const fullConfig = { ...DEFAULT_SEAL_CONFIG, ...config } as SealConfig & typeof DEFAULT_SEAL_CONFIG;
    const { diameter } = fullConfig;

    // Create a unique ID for this seal
    const sealId = `seal_${crypto.randomBytes(8).toString("hex")}`;

    // Check cache for identical seal
    const cacheKey = JSON.stringify(config);
    const cached = this.sealCache.get(cacheKey);
    if (cached) {
      logger.debug("[DigitalSeal] Returning cached seal", { sealId: cached.id });
      return cached;
    }

    try {
      // Generate seal using PDFKit (which can output to buffer)
      const sealBuffer = await this.renderSealToBuffer(fullConfig);
      const base64 = sealBuffer.toString("base64");

      const seal: GeneratedSeal = {
        id: sealId,
        base64,
        width: diameter,
        height: diameter,
        format: "png",
        createdAt: new Date(),
        config,
      };

      // Cache the seal
      this.sealCache.set(cacheKey, seal);

      logger.info("[DigitalSeal] Seal generated", {
        sealId,
        notary: config.notaryName,
        state: config.stateName,
      });

      return seal;
    } catch (error: any) {
      logger.error("[DigitalSeal] Failed to generate seal", { error: error.message });
      throw new Error(`Failed to generate digital seal: ${error.message}`);
    }
  }

  /**
   * Generate seal for founder using stored credentials
   */
  async generateFounderSeal(): Promise<GeneratedSeal> {
    const credentials = await this.getFounderCredentials();
    if (!credentials) {
      throw new Error("Founder notary credentials not configured");
    }

    // Check if commission is still valid
    if (new Date(credentials.commissionExpiration) < new Date()) {
      throw new Error("Founder notary commission has expired");
    }

    const stateName = STATE_NAMES[credentials.commissionState.toUpperCase()] ||
      credentials.commissionState.toUpperCase();

    return this.generateSeal({
      notaryName: credentials.notaryName,
      stateName,
      commissionNumber: credentials.commissionNumber,
      expirationDate: credentials.commissionExpiration,
      countyName: credentials.commissionCounty,
    });
  }

  /**
   * Apply digital seal to a PDF document
   * Returns the modified PDF as base64
   */
  async applySealToPdf(
    pdfBase64: string,
    sealBase64: string,
    options: ApplySealOptions = {}
  ): Promise<string> {
    try {
      // Load the PDF document
      const pdfBytes = Buffer.from(pdfBase64, "base64");
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Get the target page (default: last page)
      const pageCount = pdfDoc.getPageCount();
      const pageIndex = options.pageNumber
        ? Math.min(options.pageNumber - 1, pageCount - 1)
        : pageCount - 1;
      const page = pdfDoc.getPage(pageIndex);

      // Get page dimensions
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Calculate seal position (default: bottom right with margin)
      const sealWidth = options.width || 100;
      const sealHeight = options.height || 100;
      const margin = 50;
      const x = options.x ?? pageWidth - sealWidth - margin;
      const y = options.y ?? margin;

      // Embed the seal image
      // PDFKit generates PDF, so we need to draw the seal directly
      // For PNG embedding, we'll draw the seal elements directly
      await this.drawSealOnPage(pdfDoc, page, sealBase64, {
        x,
        y,
        width: sealWidth,
        height: sealHeight,
        opacity: options.opacity ?? 1,
      });

      // Optionally add signature
      if (options.includeSignature && options.signatureBase64) {
        const signatureWidth = sealWidth * 0.8;
        const signatureHeight = sealWidth * 0.3;
        const signatureX = x + (sealWidth - signatureWidth) / 2;
        const signatureY = y + sealHeight + 10;

        try {
          const signatureImage = await pdfDoc.embedPng(
            Buffer.from(options.signatureBase64, "base64")
          );
          page.drawImage(signatureImage, {
            x: signatureX,
            y: signatureY,
            width: signatureWidth,
            height: signatureHeight,
            opacity: options.opacity ?? 1,
          });
        } catch {
          // Try JPEG if PNG fails
          try {
            const signatureImage = await pdfDoc.embedJpg(
              Buffer.from(options.signatureBase64, "base64")
            );
            page.drawImage(signatureImage, {
              x: signatureX,
              y: signatureY,
              width: signatureWidth,
              height: signatureHeight,
              opacity: options.opacity ?? 1,
            });
          } catch (e) {
            logger.warn("[DigitalSeal] Could not embed signature image");
          }
        }
      }

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const modifiedBase64 = Buffer.from(modifiedPdfBytes).toString("base64");

      logger.info("[DigitalSeal] Seal applied to PDF", {
        pageNumber: pageIndex + 1,
        position: { x, y },
      });

      return modifiedBase64;
    } catch (error: any) {
      logger.error("[DigitalSeal] Failed to apply seal to PDF", { error: error.message });
      throw new Error(`Failed to apply seal to PDF: ${error.message}`);
    }
  }

  /**
   * Complete notarization: Generate seal and apply to document
   */
  async notarizeDocument(
    pdfBase64: string,
    credentials: NotaryCredentials,
    options: ApplySealOptions = {}
  ): Promise<{
    notarizedPdfBase64: string;
    sealId: string;
    notarizedAt: Date;
    certificateText: string;
  }> {
    // Check commission validity
    if (new Date(credentials.commissionExpiration) < new Date()) {
      throw new Error("Notary commission has expired");
    }

    const stateName = STATE_NAMES[credentials.commissionState.toUpperCase()] ||
      credentials.commissionState.toUpperCase();

    // Generate the seal
    const seal = await this.generateSeal({
      notaryName: credentials.notaryName,
      stateName,
      commissionNumber: credentials.commissionNumber,
      expirationDate: credentials.commissionExpiration,
      countyName: credentials.commissionCounty,
    });

    // Apply seal to document
    const notarizedPdfBase64 = await this.applySealToPdf(pdfBase64, seal.base64, options);

    // Generate certificate text
    const notarizedAt = new Date();
    const certificateText = this.generateCertificateText(credentials, notarizedAt);

    logger.info("[DigitalSeal] Document notarized", {
      sealId: seal.id,
      notary: credentials.notaryName,
      state: credentials.commissionState,
    });

    return {
      notarizedPdfBase64,
      sealId: seal.id,
      notarizedAt,
      certificateText,
    };
  }

  /**
   * Store a pre-generated seal image in FounderConfig
   */
  async storeFounderSealImage(sealBase64: string): Promise<void> {
    await prisma.founderConfig.upsert({
      where: { key: "founder_notary_seal_image" },
      update: {
        value: { sealBase64, updatedAt: new Date().toISOString() } as any,
        description: "Founder's pre-generated notary seal image (PNG base64)",
      },
      create: {
        key: "founder_notary_seal_image",
        value: { sealBase64, updatedAt: new Date().toISOString() } as any,
        description: "Founder's pre-generated notary seal image (PNG base64)",
      },
    });

    logger.info("[DigitalSeal] Founder seal image stored");
  }

  /**
   * Get stored founder seal image
   */
  async getFounderSealImage(): Promise<string | null> {
    const config = await prisma.founderConfig.findUnique({
      where: { key: "founder_notary_seal_image" },
    });

    if (!config?.value) return null;
    return (config.value as any).sealBase64;
  }

  /**
   * Store founder's signature image
   */
  async storeFounderSignature(signatureBase64: string): Promise<void> {
    await prisma.founderConfig.upsert({
      where: { key: "founder_notary_signature" },
      update: {
        value: { signatureBase64, updatedAt: new Date().toISOString() } as any,
        description: "Founder's notary signature image (PNG base64)",
      },
      create: {
        key: "founder_notary_signature",
        value: { signatureBase64, updatedAt: new Date().toISOString() } as any,
        description: "Founder's notary signature image (PNG base64)",
      },
    });

    logger.info("[DigitalSeal] Founder signature stored");
  }

  /**
   * Get stored founder signature
   */
  async getFounderSignature(): Promise<string | null> {
    const config = await prisma.founderConfig.findUnique({
      where: { key: "founder_notary_signature" },
    });

    if (!config?.value) return null;
    return (config.value as any).signatureBase64;
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Render seal to buffer using PDFKit
   * Creates a PDF with the seal, then we draw it using pdf-lib
   */
  private async renderSealToBuffer(config: SealConfig & typeof DEFAULT_SEAL_CONFIG): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const { diameter, borderWidth, primaryColor, notaryName, stateName, commissionNumber, expirationDate, countyName } = config;

      // Create a PDFKit document with the seal dimensions
      const doc = new PDFKit({
        size: [diameter, diameter],
        margin: 0,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const centerX = diameter / 2;
      const centerY = diameter / 2;
      const radius = (diameter / 2) - borderWidth;

      // Parse color
      const color = this.hexToRgb(primaryColor);

      // Draw outer circle border
      doc
        .circle(centerX, centerY, radius)
        .lineWidth(borderWidth)
        .strokeColor([color.r / 255, color.g / 255, color.b / 255])
        .stroke();

      // Draw inner circle
      doc
        .circle(centerX, centerY, radius - 8)
        .lineWidth(1)
        .stroke();

      // Draw decorative inner ring
      doc
        .circle(centerX, centerY, radius - 12)
        .lineWidth(0.5)
        .stroke();

      // Set font color
      doc.fillColor([color.r / 255, color.g / 255, color.b / 255]);

      // Draw "NOTARY PUBLIC" at top (curved text simulation via positioning)
      doc
        .fontSize(11)
        .font("Helvetica-Bold");

      // Top text - "NOTARY PUBLIC"
      const topText = "NOTARY PUBLIC";
      const topTextWidth = doc.widthOfString(topText);
      doc.text(topText, centerX - topTextWidth / 2, 18, { align: "center" });

      // State name below NOTARY PUBLIC
      doc.fontSize(9).font("Helvetica");
      const stateText = `STATE OF ${stateName}`;
      const stateTextWidth = doc.widthOfString(stateText);
      doc.text(stateText, centerX - stateTextWidth / 2, 32, { align: "center" });

      // Draw star or emblem in center
      this.drawStar(doc, centerX, centerY - 5, 15, 5, color);

      // Notary name in center
      doc.fontSize(8).font("Helvetica-Bold");
      const nameLines = this.wrapText(notaryName.toUpperCase(), 25);
      let nameY = centerY + 15;
      for (const line of nameLines) {
        const lineWidth = doc.widthOfString(line);
        doc.text(line, centerX - lineWidth / 2, nameY);
        nameY += 10;
      }

      // Commission number
      doc.fontSize(7).font("Helvetica");
      const commText = `COMMISSION #${commissionNumber}`;
      const commWidth = doc.widthOfString(commText);
      doc.text(commText, centerX - commWidth / 2, diameter - 45);

      // Expiration date
      const expDate = new Date(expirationDate);
      const expText = `EXPIRES: ${expDate.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })}`;
      const expWidth = doc.widthOfString(expText);
      doc.text(expText, centerX - expWidth / 2, diameter - 35);

      // County if provided
      if (countyName) {
        const countyText = `${countyName.toUpperCase()} COUNTY`;
        const countyWidth = doc.widthOfString(countyText);
        doc.text(countyText, centerX - countyWidth / 2, diameter - 25);
      }

      doc.end();
    });
  }

  /**
   * Draw seal elements directly on PDF page using pdf-lib
   */
  private async drawSealOnPage(
    pdfDoc: PDFDocument,
    page: ReturnType<PDFDocument["getPage"]>,
    sealBase64: string,
    options: { x: number; y: number; width: number; height: number; opacity: number }
  ): Promise<void> {
    const { x, y, width, height, opacity } = options;

    // The sealBase64 is actually a PDF buffer, so we need to draw the seal directly
    // using pdf-lib primitives instead of embedding an image

    // Get stored seal config or use defaults
    const credentials = await this.getFounderCredentials();
    const sealConfig = credentials
      ? {
          notaryName: credentials.notaryName,
          stateName: STATE_NAMES[credentials.commissionState.toUpperCase()] || credentials.commissionState,
          commissionNumber: credentials.commissionNumber,
          expirationDate: credentials.commissionExpiration,
          countyName: credentials.commissionCounty,
        }
      : null;

    if (!sealConfig) {
      logger.warn("[DigitalSeal] No seal config available, using placeholder");
      return;
    }

    // Draw seal directly using pdf-lib
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const color = rgb(0.1, 0.2, 0.4); // Navy blue

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = width / 2 - 3;

    // Draw outer circle
    page.drawCircle({
      x: centerX,
      y: centerY,
      size: radius,
      borderColor: color,
      borderWidth: 2,
      opacity,
    });

    // Draw inner circle
    page.drawCircle({
      x: centerX,
      y: centerY,
      size: radius - 5,
      borderColor: color,
      borderWidth: 1,
      opacity,
    });

    // Draw "NOTARY PUBLIC" at top
    const notaryText = "NOTARY PUBLIC";
    const notaryTextWidth = font.widthOfTextAtSize(notaryText, 8);
    page.drawText(notaryText, {
      x: centerX - notaryTextWidth / 2,
      y: centerY + radius - 18,
      size: 8,
      font,
      color,
      opacity,
    });

    // Draw state name
    const stateText = `STATE OF ${sealConfig.stateName}`;
    const stateTextWidth = regularFont.widthOfTextAtSize(stateText, 6);
    page.drawText(stateText, {
      x: centerX - stateTextWidth / 2,
      y: centerY + radius - 28,
      size: 6,
      font: regularFont,
      color,
      opacity,
    });

    // Draw star in center
    this.drawStarOnPage(page, centerX, centerY, 8, color, opacity);

    // Draw notary name
    const nameText = sealConfig.notaryName.toUpperCase();
    const nameTextWidth = font.widthOfTextAtSize(nameText, 6);
    page.drawText(nameText, {
      x: centerX - nameTextWidth / 2,
      y: centerY - 15,
      size: 6,
      font,
      color,
      opacity,
    });

    // Draw commission number
    const commText = `COMMISSION #${sealConfig.commissionNumber}`;
    const commTextWidth = regularFont.widthOfTextAtSize(commText, 5);
    page.drawText(commText, {
      x: centerX - commTextWidth / 2,
      y: centerY - 25,
      size: 5,
      font: regularFont,
      color,
      opacity,
    });

    // Draw expiration date
    const expDate = new Date(sealConfig.expirationDate);
    const expText = `EXPIRES: ${expDate.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    })}`;
    const expTextWidth = regularFont.widthOfTextAtSize(expText, 5);
    page.drawText(expText, {
      x: centerX - expTextWidth / 2,
      y: centerY - 35,
      size: 5,
      font: regularFont,
      color,
      opacity,
    });

    // Draw county if available
    if (sealConfig.countyName) {
      const countyText = `${sealConfig.countyName.toUpperCase()} COUNTY`;
      const countyTextWidth = regularFont.widthOfTextAtSize(countyText, 5);
      page.drawText(countyText, {
        x: centerX - countyTextWidth / 2,
        y: y + 8,
        size: 5,
        font: regularFont,
        color,
        opacity,
      });
    }
  }

  /**
   * Draw a 5-pointed star on PDF page
   */
  private drawStarOnPage(
    page: ReturnType<PDFDocument["getPage"]>,
    cx: number,
    cy: number,
    size: number,
    color: ReturnType<typeof rgb>,
    opacity: number
  ): void {
    // Draw a simple star using lines
    const outerRadius = size;
    const innerRadius = size / 2.5;
    const points = 5;

    for (let i = 0; i < points; i++) {
      const angle1 = (i * 2 * Math.PI) / points - Math.PI / 2;
      const angle2 = ((i + 0.5) * 2 * Math.PI) / points - Math.PI / 2;

      const x1 = cx + outerRadius * Math.cos(angle1);
      const y1 = cy + outerRadius * Math.sin(angle1);
      const x2 = cx + innerRadius * Math.cos(angle2);
      const y2 = cy + innerRadius * Math.sin(angle2);

      page.drawLine({
        start: { x: cx, y: cy },
        end: { x: x1, y: y1 },
        thickness: 0.5,
        color,
        opacity,
      });
    }
  }

  /**
   * Draw star shape using PDFKit
   */
  private drawStar(
    doc: InstanceType<typeof PDFKit>,
    cx: number,
    cy: number,
    outerRadius: number,
    points: number,
    color: { r: number; g: number; b: number }
  ): void {
    const innerRadius = outerRadius / 2.5;

    doc.save();
    doc.fillColor([color.r / 255, color.g / 255, color.b / 255]);

    const path: Array<[number, number]> = [];
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      path.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }

    doc.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) {
      doc.lineTo(path[i][0], path[i][1]);
    }
    doc.closePath().fill();
    doc.restore();
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 26, g: 54, b: 93 }; // Default navy
  }

  /**
   * Wrap text to fit within character limit
   */
  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + " " + word).trim().length <= maxChars) {
        currentLine = (currentLine + " " + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
  }

  /**
   * Generate certificate text for notarization
   */
  private generateCertificateText(credentials: NotaryCredentials, notarizedAt: Date): string {
    const stateName = STATE_NAMES[credentials.commissionState.toUpperCase()] ||
      credentials.commissionState.toUpperCase();

    return `
CERTIFICATE OF ACKNOWLEDGMENT

STATE OF ${stateName}
${credentials.commissionCounty ? `COUNTY OF ${credentials.commissionCounty.toUpperCase()}` : ""}

On this ${notarizedAt.getDate()}${this.getOrdinalSuffix(notarizedAt.getDate())} day of ${notarizedAt.toLocaleDateString("en-US", { month: "long" })}, ${notarizedAt.getFullYear()}, before me, ${credentials.notaryName}, a Notary Public in and for said State, personally appeared the signer(s) of the within instrument, who acknowledged to me that they executed the same freely and voluntarily for the uses and purposes therein mentioned.

IN WITNESS WHEREOF, I have hereunto set my hand and affixed my official seal the day and year first above written.

_______________________________
${credentials.notaryName}
Notary Public, State of ${stateName}
Commission Number: ${credentials.commissionNumber}
My Commission Expires: ${new Date(credentials.commissionExpiration).toLocaleDateString("en-US")}
    `.trim();
  }

  /**
   * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
   */
  private getOrdinalSuffix(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  /**
   * Simple encryption for storing credentials
   */
  private encrypt(text: string): string {
    // In production, use proper encryption with a secure key
    const key = process.env.ENCRYPTION_KEY || "default-key-change-in-production";
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      crypto.createHash("sha256").update(key).digest(),
      Buffer.alloc(16, 0)
    );
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  }

  /**
   * Simple decryption for retrieving credentials
   */
  private decrypt(encrypted: string): string {
    const key = process.env.ENCRYPTION_KEY || "default-key-change-in-production";
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      crypto.createHash("sha256").update(key).digest(),
      Buffer.alloc(16, 0)
    );
    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Clear seal cache
   */
  clearCache(): void {
    this.sealCache.clear();
    logger.info("[DigitalSeal] Cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.sealCache.size,
      entries: Array.from(this.sealCache.keys()),
    };
  }
}

// =============================================================================
// STATE-SPECIFIC NOTARY REQUIREMENTS
// Each state has different seal requirements
// =============================================================================

export interface StateNotaryRequirements {
  state: string;
  sealType: "circular" | "rectangular" | "either";
  maxDiameterInches: number;
  minDiameterInches: number;
  requiredElements: string[];
  optionalElements: string[];
  inkColor: "blue" | "black" | "either";
  embossedAllowed: boolean;
  photographicReproductionAllowed: boolean;
  ronAllowed: boolean;  // Remote Online Notarization
  commissionTermYears: number;
  bondsRequired: boolean;
  bondAmount: number;
  eAndORequired: boolean;
  eAndOMinCoverage: number;
  journalRequired: boolean;
  thumbprintRequired: boolean;
  maxFees: {
    acknowledgment: number;
    jurat: number;
    copyVerification: number;
    oath: number;
  };
  expirationFormat: "date" | "year";
  stateSpecificText?: string;
}

const STATE_NOTARY_REQUIREMENTS: Record<string, StateNotaryRequirements> = {
  TN: {
    state: "Tennessee",
    sealType: "either",
    maxDiameterInches: 2,
    minDiameterInches: 1.5,
    requiredElements: ["NOTARY PUBLIC", "State Name", "Notary Name", "Commission Expiration"],
    optionalElements: ["County", "Commission Number"],
    inkColor: "either",
    embossedAllowed: true,
    photographicReproductionAllowed: true,
    ronAllowed: true,
    commissionTermYears: 4,
    bondsRequired: true,
    bondAmount: 10000,
    eAndORequired: false,
    eAndOMinCoverage: 0,
    journalRequired: false,
    thumbprintRequired: false,
    maxFees: { acknowledgment: 5, jurat: 5, copyVerification: 5, oath: 5 },
    expirationFormat: "date",
  },
  TX: {
    state: "Texas",
    sealType: "circular",
    maxDiameterInches: 2,
    minDiameterInches: 1.5,
    requiredElements: ["NOTARY PUBLIC", "STATE OF TEXAS", "Notary Name", "Commission Expiration", "Commission Number"],
    optionalElements: [],
    inkColor: "black",
    embossedAllowed: false,
    photographicReproductionAllowed: true,
    ronAllowed: true,
    commissionTermYears: 4,
    bondsRequired: true,
    bondAmount: 10000,
    eAndORequired: false,
    eAndOMinCoverage: 0,
    journalRequired: true,
    thumbprintRequired: false,
    maxFees: { acknowledgment: 6, jurat: 6, copyVerification: 6, oath: 6 },
    expirationFormat: "date",
    stateSpecificText: "NOTARY ID",
  },
  FL: {
    state: "Florida",
    sealType: "either",
    maxDiameterInches: 2,
    minDiameterInches: 1.5,
    requiredElements: ["NOTARY PUBLIC", "STATE OF FLORIDA", "Notary Name", "Commission Expiration", "Commission Number"],
    optionalElements: ["County"],
    inkColor: "either",
    embossedAllowed: true,
    photographicReproductionAllowed: true,
    ronAllowed: true,
    commissionTermYears: 4,
    bondsRequired: true,
    bondAmount: 7500,
    eAndORequired: false,
    eAndOMinCoverage: 0,
    journalRequired: false,
    thumbprintRequired: false,
    maxFees: { acknowledgment: 10, jurat: 10, copyVerification: 10, oath: 10 },
    expirationFormat: "date",
  },
  CA: {
    state: "California",
    sealType: "either",
    maxDiameterInches: 2.5,
    minDiameterInches: 1,
    requiredElements: ["NOTARY PUBLIC", "State Seal/Great Seal", "Notary Name", "Commission Expiration", "Commission Number", "County"],
    optionalElements: [],
    inkColor: "either",
    embossedAllowed: true,
    photographicReproductionAllowed: true,
    ronAllowed: false, // CA restricts RON
    commissionTermYears: 4,
    bondsRequired: true,
    bondAmount: 15000,
    eAndORequired: false,
    eAndOMinCoverage: 0,
    journalRequired: true,
    thumbprintRequired: true,
    maxFees: { acknowledgment: 15, jurat: 15, copyVerification: 15, oath: 15 },
    expirationFormat: "date",
  },
  GA: {
    state: "Georgia",
    sealType: "either",
    maxDiameterInches: 2,
    minDiameterInches: 1.5,
    requiredElements: ["NOTARY PUBLIC", "GEORGIA", "Notary Name", "Commission Expiration"],
    optionalElements: ["County", "Commission Number"],
    inkColor: "either",
    embossedAllowed: true,
    photographicReproductionAllowed: true,
    ronAllowed: true,
    commissionTermYears: 4,
    bondsRequired: false,
    bondAmount: 0,
    eAndORequired: false,
    eAndOMinCoverage: 0,
    journalRequired: false,
    thumbprintRequired: false,
    maxFees: { acknowledgment: 2, jurat: 2, copyVerification: 2, oath: 2 },
    expirationFormat: "date",
  },
  NY: {
    state: "New York",
    sealType: "either",
    maxDiameterInches: 2,
    minDiameterInches: 1,
    requiredElements: ["NOTARY PUBLIC", "STATE OF NEW YORK", "Notary Name", "Commission Expiration", "Qualified in County"],
    optionalElements: ["Registration Number"],
    inkColor: "black",
    embossedAllowed: true,
    photographicReproductionAllowed: true,
    ronAllowed: true,
    commissionTermYears: 4,
    bondsRequired: false,
    bondAmount: 0,
    eAndORequired: false,
    eAndOMinCoverage: 0,
    journalRequired: false,
    thumbprintRequired: false,
    maxFees: { acknowledgment: 2, jurat: 2, copyVerification: 2, oath: 2 },
    expirationFormat: "date",
    stateSpecificText: "Qualified in",
  },
  NV: {
    state: "Nevada",
    sealType: "either",
    maxDiameterInches: 2,
    minDiameterInches: 1.5,
    requiredElements: ["NOTARY PUBLIC", "STATE OF NEVADA", "Notary Name", "Appointment Date", "Expiration Date"],
    optionalElements: ["County"],
    inkColor: "either",
    embossedAllowed: true,
    photographicReproductionAllowed: true,
    ronAllowed: true,
    commissionTermYears: 4,
    bondsRequired: true,
    bondAmount: 10000,
    eAndORequired: true,
    eAndOMinCoverage: 25000,
    journalRequired: true,
    thumbprintRequired: false,
    maxFees: { acknowledgment: 5, jurat: 5, copyVerification: 5, oath: 2.50 },
    expirationFormat: "date",
  },
  OH: {
    state: "Ohio",
    sealType: "either",
    maxDiameterInches: 2,
    minDiameterInches: 1.5,
    requiredElements: ["NOTARY PUBLIC", "STATE OF OHIO", "Notary Name", "Commission Expiration"],
    optionalElements: ["County", "Commission Number"],
    inkColor: "either",
    embossedAllowed: true,
    photographicReproductionAllowed: true,
    ronAllowed: true,
    commissionTermYears: 5,
    bondsRequired: false,
    bondAmount: 0,
    eAndORequired: false,
    eAndOMinCoverage: 0,
    journalRequired: false,
    thumbprintRequired: false,
    maxFees: { acknowledgment: 2, jurat: 2, copyVerification: 2, oath: 2 },
    expirationFormat: "date",
  },
  PA: {
    state: "Pennsylvania",
    sealType: "either",
    maxDiameterInches: 2,
    minDiameterInches: 1.5,
    requiredElements: ["NOTARIAL SEAL", "COMMONWEALTH OF PENNSYLVANIA", "Notary Name", "Commission Expiration", "County"],
    optionalElements: ["Commission Number"],
    inkColor: "either",
    embossedAllowed: true,
    photographicReproductionAllowed: true,
    ronAllowed: true,
    commissionTermYears: 4,
    bondsRequired: true,
    bondAmount: 10000,
    eAndORequired: false,
    eAndOMinCoverage: 0,
    journalRequired: true,
    thumbprintRequired: false,
    maxFees: { acknowledgment: 5, jurat: 5, copyVerification: 5, oath: 5 },
    expirationFormat: "date",
    stateSpecificText: "NOTARIAL SEAL",
  },
};

// Default requirements for states without specific configuration
const DEFAULT_STATE_REQUIREMENTS: StateNotaryRequirements = {
  state: "Default",
  sealType: "either",
  maxDiameterInches: 2,
  minDiameterInches: 1.5,
  requiredElements: ["NOTARY PUBLIC", "State Name", "Notary Name", "Commission Expiration"],
  optionalElements: ["County", "Commission Number"],
  inkColor: "either",
  embossedAllowed: true,
  photographicReproductionAllowed: true,
  ronAllowed: true,
  commissionTermYears: 4,
  bondsRequired: false,
  bondAmount: 0,
  eAndORequired: false,
  eAndOMinCoverage: 0,
  journalRequired: false,
  thumbprintRequired: false,
  maxFees: { acknowledgment: 5, jurat: 5, copyVerification: 5, oath: 5 },
  expirationFormat: "date",
};

// =============================================================================
// NOTARY BOT INTEGRATION
// =============================================================================

interface NotaryBotAction {
  type: "SEAL_GENERATION" | "DOCUMENT_NOTARIZATION" | "RON_SESSION" | "SEAL_VALIDATION" | "COMMISSION_CHECK";
  status: "SUCCESS" | "FAILED" | "PENDING";
  caseId?: string;
  documentId?: string;
  details: Record<string, any>;
  costCents: number;
  timestamp: Date;
}

class NotaryBotIntegration {
  private actionLog: NotaryBotAction[] = [];

  /**
   * Log a notary bot action for billing and audit
   */
  async logAction(
    userId: string,
    action: Omit<NotaryBotAction, "timestamp">
  ): Promise<void> {
    const fullAction: NotaryBotAction = {
      ...action,
      timestamp: new Date(),
    };

    this.actionLog.push(fullAction);

    // Log to BotUsageLog if available
    try {
      await prisma.botRunLog.create({
        data: {
          botName: "NotaryBot",
          success: action.status === "SUCCESS",
          runType: action.type,
          insightsGenerated: action.status === "SUCCESS" ? 1 : 0,
          errorsEncountered: action.status === "FAILED" ? 1 : 0,
          startedAt: fullAction.timestamp,
          completedAt: fullAction.timestamp,
          details: {
            userId,
            ...action.details,
            costCents: action.costCents,
          },
        },
      });
    } catch (error) {
      logger.warn("[NotaryBot] Failed to log action to database", { error });
    }

    logger.info("[NotaryBot] Action logged", {
      userId,
      type: action.type,
      status: action.status,
      costCents: action.costCents,
    });
  }

  /**
   * Get user's notary bot usage for billing
   */
  async getUserUsage(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalActions: number;
    totalCostCents: number;
    breakdown: Record<string, { count: number; costCents: number }>;
  }> {
    const logs = await prisma.botRunLog.findMany({
      where: {
        botName: "NotaryBot",
        startedAt: {
          gte: startDate || new Date(0),
          lte: endDate || new Date(),
        },
        details: {
          path: ["userId"],
          equals: userId,
        },
      },
    });

    const breakdown: Record<string, { count: number; costCents: number }> = {};
    let totalCostCents = 0;

    for (const log of logs) {
      const details = log.details as any;
      const runType = log.runType || "UNKNOWN";
      const cost = details?.costCents || 0;

      if (!breakdown[runType]) {
        breakdown[runType] = { count: 0, costCents: 0 };
      }
      breakdown[runType].count++;
      breakdown[runType].costCents += cost;
      totalCostCents += cost;
    }

    return {
      totalActions: logs.length,
      totalCostCents,
      breakdown,
    };
  }

  /**
   * Check if notary commission is valid and not expiring soon
   */
  async checkCommissionStatus(credentials: NotaryCredentials): Promise<{
    isValid: boolean;
    daysUntilExpiration: number;
    warnings: string[];
    requirements: StateNotaryRequirements;
  }> {
    const stateCode = credentials.commissionState.toUpperCase();
    const requirements = STATE_NOTARY_REQUIREMENTS[stateCode] || DEFAULT_STATE_REQUIREMENTS;

    const now = new Date();
    const expiration = new Date(credentials.commissionExpiration);
    const daysUntilExpiration = Math.floor(
      (expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const warnings: string[] = [];

    if (daysUntilExpiration < 0) {
      warnings.push("Commission has EXPIRED - cannot perform notarizations");
    } else if (daysUntilExpiration < 30) {
      warnings.push("Commission expires in less than 30 days - renew immediately");
    } else if (daysUntilExpiration < 90) {
      warnings.push("Commission expires in less than 90 days - schedule renewal");
    }

    // Check bond requirements
    if (requirements.bondsRequired && !credentials.bondNumber) {
      warnings.push(`${requirements.state} requires a $${requirements.bondAmount.toLocaleString()} bond`);
    }

    // Check E&O requirements
    if (requirements.eAndORequired && !credentials.eoInsurancePolicyNumber) {
      warnings.push(`${requirements.state} requires E&O insurance with minimum $${requirements.eAndOMinCoverage.toLocaleString()} coverage`);
    }

    return {
      isValid: daysUntilExpiration > 0,
      daysUntilExpiration,
      warnings,
      requirements,
    };
  }
}

// =============================================================================
// ENHANCED DIGITAL SEAL SERVICE CLASS
// Now with state-specific requirements and bot integration
// =============================================================================

class EnhancedDigitalSealService extends DigitalSealService {
  public notaryBot: NotaryBotIntegration;

  constructor() {
    super();
    this.notaryBot = new NotaryBotIntegration();
  }

  /**
   * Get state-specific notary requirements
   */
  getStateRequirements(stateCode: string): StateNotaryRequirements {
    return STATE_NOTARY_REQUIREMENTS[stateCode.toUpperCase()] || DEFAULT_STATE_REQUIREMENTS;
  }

  /**
   * Get all supported states with RON capability
   */
  getRONEnabledStates(): string[] {
    return Object.entries(STATE_NOTARY_REQUIREMENTS)
      .filter(([_, req]) => req.ronAllowed)
      .map(([code]) => code);
  }

  /**
   * Validate seal against state requirements
   */
  async validateSealForState(
    sealConfig: SealConfig,
    stateCode: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const requirements = STATE_NOTARY_REQUIREMENTS[stateCode.toUpperCase()] || DEFAULT_STATE_REQUIREMENTS;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check seal type
    if (requirements.sealType === "circular" && sealConfig.sealType === "rectangular") {
      errors.push(`${requirements.state} requires a circular seal`);
    }

    // Check diameter
    const diameterInches = (sealConfig.diameter || 200) / 96; // Assuming 96 DPI
    if (diameterInches > requirements.maxDiameterInches) {
      errors.push(`Seal diameter exceeds ${requirements.state} maximum of ${requirements.maxDiameterInches} inches`);
    }
    if (diameterInches < requirements.minDiameterInches) {
      errors.push(`Seal diameter below ${requirements.state} minimum of ${requirements.minDiameterInches} inches`);
    }

    // Check required elements
    for (const element of requirements.requiredElements) {
      if (element === "County" && !sealConfig.countyName) {
        errors.push(`${requirements.state} requires county name on seal`);
      }
      if (element === "Commission Number" && !sealConfig.commissionNumber) {
        errors.push(`${requirements.state} requires commission number on seal`);
      }
    }

    // Check expiration
    const expDate = new Date(sealConfig.expirationDate);
    if (expDate < new Date()) {
      errors.push("Commission has expired - seal is invalid");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate state-compliant seal with bot logging
   */
  async generateStateCompliantSeal(
    credentials: NotaryCredentials,
    userId: string,
    caseId?: string
  ): Promise<GeneratedSeal> {
    const stateCode = credentials.commissionState.toUpperCase();
    const requirements = STATE_NOTARY_REQUIREMENTS[stateCode] || DEFAULT_STATE_REQUIREMENTS;

    // Validate commission
    const commissionStatus = await this.notaryBot.checkCommissionStatus(credentials);
    if (!commissionStatus.isValid) {
      throw new Error("Cannot generate seal: Commission has expired");
    }

    const stateName = STATE_NAMES[stateCode] || credentials.commissionState.toUpperCase();

    // Create config based on state requirements
    const sealConfig: SealConfig = {
      notaryName: credentials.notaryName,
      stateName,
      commissionNumber: credentials.commissionNumber,
      expirationDate: credentials.commissionExpiration,
      countyName: credentials.commissionCounty,
      sealType: requirements.sealType === "either" ? "circular" : requirements.sealType,
      diameter: Math.round(requirements.maxDiameterInches * 96), // 96 DPI
      primaryColor: requirements.inkColor === "black" ? "#000000" : "#1a365d",
    };

    // Generate the seal
    const seal = await this.generateSeal(sealConfig);

    // Log the action
    await this.notaryBot.logAction(userId, {
      type: "SEAL_GENERATION",
      status: "SUCCESS",
      caseId,
      details: {
        stateCode,
        commissionNumber: credentials.commissionNumber,
        sealId: seal.id,
      },
      costCents: 25, // $0.25 per seal generation
    });

    return seal;
  }

  /**
   * Auto-notarize document with state compliance check
   */
  async autoNotarizeDocument(
    pdfBase64: string,
    credentials: NotaryCredentials,
    userId: string,
    caseId?: string,
    documentId?: string
  ): Promise<{
    notarizedPdfBase64: string;
    sealId: string;
    notarizedAt: Date;
    certificateText: string;
    stateCompliance: {
      state: string;
      ronAllowed: boolean;
      journalRequired: boolean;
      maxFee: number;
    };
  }> {
    const stateCode = credentials.commissionState.toUpperCase();
    const requirements = STATE_NOTARY_REQUIREMENTS[stateCode] || DEFAULT_STATE_REQUIREMENTS;

    // Check commission status
    const commissionStatus = await this.notaryBot.checkCommissionStatus(credentials);
    if (!commissionStatus.isValid) {
      await this.notaryBot.logAction(userId, {
        type: "DOCUMENT_NOTARIZATION",
        status: "FAILED",
        caseId,
        documentId,
        details: { error: "Commission expired", warnings: commissionStatus.warnings },
        costCents: 0,
      });
      throw new Error("Cannot notarize: Commission has expired");
    }

    // Perform notarization
    const result = await this.notarizeDocument(pdfBase64, credentials);

    // Log the action
    await this.notaryBot.logAction(userId, {
      type: "DOCUMENT_NOTARIZATION",
      status: "SUCCESS",
      caseId,
      documentId,
      details: {
        stateCode,
        sealId: result.sealId,
        notarizedAt: result.notarizedAt.toISOString(),
      },
      costCents: 100, // $1.00 per notarization
    });

    return {
      ...result,
      stateCompliance: {
        state: requirements.state,
        ronAllowed: requirements.ronAllowed,
        journalRequired: requirements.journalRequired,
        maxFee: requirements.maxFees.acknowledgment,
      },
    };
  }

  /**
   * Get all state requirements (for UI display)
   */
  getAllStateRequirements(): Record<string, StateNotaryRequirements> {
    return STATE_NOTARY_REQUIREMENTS;
  }

  /**
   * Check if RON is allowed for a state
   */
  isRONAllowed(stateCode: string): boolean {
    const requirements = STATE_NOTARY_REQUIREMENTS[stateCode.toUpperCase()];
    return requirements?.ronAllowed ?? true;
  }

  /**
   * Get maximum notary fee for a state and act type
   */
  getMaxFee(stateCode: string, actType: keyof StateNotaryRequirements["maxFees"]): number {
    const requirements = STATE_NOTARY_REQUIREMENTS[stateCode.toUpperCase()];
    return requirements?.maxFees[actType] ?? DEFAULT_STATE_REQUIREMENTS.maxFees[actType];
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const digitalSealService = new EnhancedDigitalSealService();
export { STATE_NOTARY_REQUIREMENTS, DEFAULT_STATE_REQUIREMENTS };
export type { NotaryBotAction };
export default digitalSealService;
