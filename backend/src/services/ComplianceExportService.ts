/**
 * ComplianceExportService.ts — MGR CAPITAL ASSISTANCE
 * Generates CSV and PDF exports for compliance reporting
 *
 * Supports:
 * - Audit logs export
 * - Ledger entries export
 * - Training progress export
 * - Case filings export
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { logger } from "../utils/logger.js";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export type ExportType = "audit" | "ledger" | "training" | "cases";
export type ExportFormat = "csv" | "pdf";

export interface ExportOptions {
  type: ExportType;
  format: ExportFormat;
  startDate?: Date;
  endDate?: Date;
}

export interface ExportResult {
  success: boolean;
  data?: Buffer;
  filename?: string;
  mimeType?: string;
  error?: string;
}

// =============================================================================
// COMPLIANCE EXPORT SERVICE
// =============================================================================

class ComplianceExportService {
  /**
   * Generate compliance export based on type and format
   */
  async generateExport(options: ExportOptions): Promise<ExportResult> {
    const { type, format, startDate, endDate } = options;

    logger.info("Generating compliance export", { type, format, startDate, endDate });

    try {
      let data: any[];
      let columns: { header: string; key: string; width?: number }[];

      // Fetch data based on type
      switch (type) {
        case "audit":
          const auditResult = await this.fetchAuditData(startDate, endDate);
          data = auditResult.data;
          columns = auditResult.columns;
          break;
        case "ledger":
          const ledgerResult = await this.fetchLedgerData(startDate, endDate);
          data = ledgerResult.data;
          columns = ledgerResult.columns;
          break;
        case "training":
          const trainingResult = await this.fetchTrainingData(startDate, endDate);
          data = trainingResult.data;
          columns = trainingResult.columns;
          break;
        case "cases":
          const casesResult = await this.fetchCasesData(startDate, endDate);
          data = casesResult.data;
          columns = casesResult.columns;
          break;
        default:
          return { success: false, error: `Invalid export type: ${type}` };
      }

      // Generate export in requested format
      let buffer: Buffer;
      let mimeType: string;
      let extension: string;

      if (format === "csv") {
        buffer = await this.generateCSV(data, columns);
        mimeType = "text/csv";
        extension = "csv";
      } else if (format === "pdf") {
        buffer = await this.generatePDF(data, columns, type, startDate, endDate);
        mimeType = "application/pdf";
        extension = "pdf";
      } else {
        return { success: false, error: `Invalid format: ${format}` };
      }

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `compliance-${type}-${timestamp}.${extension}`;

      logger.info("Export generated successfully", { type, format, filename, recordCount: data.length });

      return {
        success: true,
        data: buffer,
        filename,
        mimeType,
      };
    } catch (error) {
      logger.error("Export generation failed", { type, format, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      };
    }
  }

  /**
   * Fetch audit log data
   */
  private async fetchAuditData(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ data: any[]; columns: { header: string; key: string; width?: number }[] }> {
    const where: any = {};
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const audits = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
      orderBy: { timestamp: "desc" },
      take: 10000,
    });

    const data = audits.map((a) => ({
      timestamp: a.timestamp.toISOString(),
      user: a.user?.email || "System",
      userName: a.user?.name || "System",
      action: a.action,
      entityType: a.entityType || "-",
      entityId: a.entityId || "-",
      ipAddress: a.ipAddress || "-",
      userAgent: a.userAgent?.substring(0, 50) || "-",
      details: a.details ? JSON.stringify(a.details).substring(0, 100) : "-",
    }));

    const columns = [
      { header: "Timestamp", key: "timestamp", width: 20 },
      { header: "User Email", key: "user", width: 25 },
      { header: "User Name", key: "userName", width: 20 },
      { header: "Action", key: "action", width: 25 },
      { header: "Entity Type", key: "entityType", width: 15 },
      { header: "Entity ID", key: "entityId", width: 30 },
      { header: "IP Address", key: "ipAddress", width: 15 },
      { header: "User Agent", key: "userAgent", width: 30 },
      { header: "Details", key: "details", width: 40 },
    ];

    return { data, columns };
  }

  /**
   * Fetch ledger entry data
   */
  private async fetchLedgerData(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ data: any[]; columns: { header: string; key: string; width?: number }[] }> {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const entries = await prisma.ledgerEntry.findMany({
      where,
      include: {
        case: {
          select: { caseNumber: true },
        },
        employee: {
          select: { email: true, name: true },
        },
        client: {
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    const data = entries.map((e) => ({
      date: e.createdAt.toISOString(),
      type: e.type,
      description: e.description,
      amountCents: e.amountCents,
      amountFormatted: `$${(e.amountCents / 100).toFixed(2)}`,
      caseNumber: e.case?.caseNumber || "-",
      employee: e.employee?.email || "-",
      client: e.client?.email || "-",
      balanceAfterCents: e.balanceAfterCents,
      balanceFormatted: `$${(e.balanceAfterCents / 100).toFixed(2)}`,
    }));

    const columns = [
      { header: "Date", key: "date", width: 20 },
      { header: "Type", key: "type", width: 20 },
      { header: "Description", key: "description", width: 35 },
      { header: "Amount (cents)", key: "amountCents", width: 15 },
      { header: "Amount", key: "amountFormatted", width: 12 },
      { header: "Case Number", key: "caseNumber", width: 15 },
      { header: "Employee", key: "employee", width: 25 },
      { header: "Client", key: "client", width: 25 },
      { header: "Balance After", key: "balanceFormatted", width: 12 },
    ];

    return { data, columns };
  }

  /**
   * Fetch training progress data
   */
  private async fetchTrainingData(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ data: any[]; columns: { header: string; key: string; width?: number }[] }> {
    const where: any = {};
    if (startDate || endDate) {
      where.updatedAt = {};
      if (startDate) where.updatedAt.gte = startDate;
      if (endDate) where.updatedAt.lte = endDate;
    }

    const progress = await prisma.employeeTrainingProgress.findMany({
      where,
      include: {
        employee: {
          select: { email: true, name: true, employeeTier: true },
        },
        module: {
          select: { name: true, tier: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 10000,
    });

    const data = progress.map((p) => ({
      updatedAt: p.updatedAt.toISOString(),
      employee: p.employee?.email || "-",
      employeeName: p.employee?.name || "-",
      employeeTier: p.employee?.employeeTier || "-",
      module: p.module?.name || "-",
      moduleTier: p.module?.tier || "-",
      status: p.status,
      progressPct: p.progressPct,
      quizScore: p.quizScore ?? "-",
      quizPassed: p.quizPassed ? "Yes" : "No",
      startedAt: p.startedAt?.toISOString() || "-",
      completedAt: p.completedAt?.toISOString() || "-",
    }));

    const columns = [
      { header: "Last Updated", key: "updatedAt", width: 20 },
      { header: "Employee Email", key: "employee", width: 25 },
      { header: "Employee Name", key: "employeeName", width: 20 },
      { header: "Employee Tier", key: "employeeTier", width: 12 },
      { header: "Module", key: "module", width: 30 },
      { header: "Module Tier", key: "moduleTier", width: 12 },
      { header: "Status", key: "status", width: 15 },
      { header: "Progress %", key: "progressPct", width: 10 },
      { header: "Quiz Score", key: "quizScore", width: 10 },
      { header: "Quiz Passed", key: "quizPassed", width: 10 },
      { header: "Started At", key: "startedAt", width: 20 },
      { header: "Completed At", key: "completedAt", width: 20 },
    ];

    return { data, columns };
  }

  /**
   * Fetch cases data
   */
  private async fetchCasesData(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ data: any[]; columns: { header: string; key: string; width?: number }[] }> {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const cases = await prisma.case.findMany({
      where,
      include: {
        client: {
          select: { email: true, name: true },
        },
        assignedEmployee: {
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    const data = cases.map((c) => ({
      caseNumber: c.caseNumber,
      createdAt: c.createdAt.toISOString(),
      status: c.status,
      type: c.type,
      priority: c.priority,
      client: c.client?.email || "-",
      clientName: c.client?.name || "-",
      assignedTo: c.assignedEmployee?.email || "-",
      parcelId: c.parcelId || "-",
      propertyAddress: c.propertyAddress || "-",
      county: c.county || "-",
      state: c.state || "-",
      estimatedValueCents: c.estimatedValueCents,
      estimatedValue: `$${(c.estimatedValueCents / 100).toFixed(2)}`,
      internalNotes: c.internalNotes?.substring(0, 50) || "-",
    }));

    const columns = [
      { header: "Case Number", key: "caseNumber", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Type", key: "type", width: 15 },
      { header: "Priority", key: "priority", width: 10 },
      { header: "Client Email", key: "client", width: 25 },
      { header: "Client Name", key: "clientName", width: 20 },
      { header: "Assigned To", key: "assignedTo", width: 25 },
      { header: "Parcel ID", key: "parcelId", width: 15 },
      { header: "Property Address", key: "propertyAddress", width: 30 },
      { header: "County", key: "county", width: 15 },
      { header: "State", key: "state", width: 8 },
      { header: "Est. Value", key: "estimatedValue", width: 12 },
      { header: "Notes", key: "internalNotes", width: 30 },
    ];

    return { data, columns };
  }

  /**
   * Generate CSV from data
   */
  private async generateCSV(
    data: any[],
    columns: { header: string; key: string }[]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Export");

    // Add columns
    worksheet.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
    }));

    // Add rows
    data.forEach((row) => {
      worksheet.addRow(row);
    });

    // Generate CSV buffer
    const buffer = await workbook.csv.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate PDF from data
   */
  private async generatePDF(
    data: any[],
    columns: { header: string; key: string }[],
    type: ExportType,
    startDate?: Date,
    endDate?: Date
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: "LETTER", layout: "landscape" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Title
      doc.fontSize(18).font("Helvetica-Bold").text("MGR CAPITAL ASSISTANCE", { align: "center" });
      doc.fontSize(14).font("Helvetica").text(`Compliance Report: ${type.toUpperCase()}`, { align: "center" });

      // Date range
      const dateRange = [];
      if (startDate) dateRange.push(`From: ${startDate.toISOString().split("T")[0]}`);
      if (endDate) dateRange.push(`To: ${endDate.toISOString().split("T")[0]}`);
      if (dateRange.length > 0) {
        doc.fontSize(10).text(dateRange.join(" | "), { align: "center" });
      }
      doc.text(`Generated: ${new Date().toISOString()}`, { align: "center" });
      doc.moveDown(2);

      // Summary
      doc.fontSize(12).font("Helvetica-Bold").text(`Total Records: ${data.length}`);
      doc.moveDown();

      // Table header
      const tableTop = doc.y;
      const colWidth = Math.min(80, (doc.page.width - 60) / Math.min(columns.length, 8));
      const visibleColumns = columns.slice(0, 8); // Limit columns for PDF readability

      doc.fontSize(8).font("Helvetica-Bold");
      visibleColumns.forEach((col, i) => {
        doc.text(col.header.substring(0, 12), 30 + i * colWidth, tableTop, {
          width: colWidth - 5,
          ellipsis: true,
        });
      });

      // Horizontal line
      doc.moveTo(30, tableTop + 12).lineTo(doc.page.width - 30, tableTop + 12).stroke();

      // Table rows (limit to first 100 for PDF)
      let y = tableTop + 18;
      const maxRows = 50;
      doc.fontSize(7).font("Helvetica");

      data.slice(0, maxRows).forEach((row) => {
        if (y > doc.page.height - 50) {
          doc.addPage();
          y = 50;
        }

        visibleColumns.forEach((col, i) => {
          const value = String(row[col.key] ?? "-").substring(0, 15);
          doc.text(value, 30 + i * colWidth, y, {
            width: colWidth - 5,
            ellipsis: true,
          });
        });
        y += 12;
      });

      if (data.length > maxRows) {
        doc.moveDown();
        doc.fontSize(10).font("Helvetica-Oblique").text(
          `... and ${data.length - maxRows} more records. Export as CSV for full data.`,
          { align: "center" }
        );
      }

      // Footer
      doc.fontSize(8).text("CONFIDENTIAL - FOR INTERNAL USE ONLY", 30, doc.page.height - 30, {
        align: "center",
      });

      doc.end();
    });
  }

  /**
   * Generate weekly compliance digest
   */
  async generateWeeklyDigest(): Promise<{
    success: boolean;
    summary?: any;
    error?: string;
  }> {
    logger.info("Generating weekly compliance digest");

    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Gather weekly stats
      const [auditCount, newCases, completedCases, trainingCompletions, ledgerTotal] = await Promise.all([
        prisma.auditLog.count({
          where: { timestamp: { gte: oneWeekAgo } },
        }),
        prisma.case.count({
          where: { createdAt: { gte: oneWeekAgo } },
        }),
        prisma.case.count({
          where: {
            status: "COMPLETED",
            updatedAt: { gte: oneWeekAgo },
          },
        }),
        prisma.employeeTrainingProgress.count({
          where: {
            status: "COMPLETED",
            completedAt: { gte: oneWeekAgo },
          },
        }),
        prisma.ledgerEntry.aggregate({
          where: {
            createdAt: { gte: oneWeekAgo },
            type: { in: ["FEE_COLLECTED", "CLIENT_PAYMENT", "SURPLUS_RECEIVED"] },
          },
          _sum: { amountCents: true },
        }),
      ]);

      const summary = {
        period: {
          start: oneWeekAgo.toISOString(),
          end: new Date().toISOString(),
        },
        auditEvents: auditCount,
        newCases,
        completedCases,
        trainingCompletions,
        revenueCollectedCents: ledgerTotal._sum.amountCents || 0,
        revenueFormatted: `$${((ledgerTotal._sum.amountCents || 0) / 100).toFixed(2)}`,
        generatedAt: new Date().toISOString(),
      };

      // Log digest (would email to founder in production)
      logger.info("Weekly compliance digest generated", summary);
      console.log("\n=== WEEKLY COMPLIANCE DIGEST ===");
      console.log("Would email to founder with summary:");
      console.log(JSON.stringify(summary, null, 2));
      console.log("================================\n");

      // Save as OpsInsight
      await prisma.opsInsight.create({
        data: {
          type: "COMPLIANCE_DIGEST",
          summary: `Weekly digest: ${newCases} new cases, ${completedCases} completed, ${summary.revenueFormatted} revenue`,
          details: summary as any,
          priority: "INFO",
          actionRequired: false,
        },
      });

      return { success: true, summary };
    } catch (error) {
      logger.error("Weekly digest generation failed", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Digest failed",
      };
    }
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const complianceExportService = new ComplianceExportService();
export default complianceExportService;
