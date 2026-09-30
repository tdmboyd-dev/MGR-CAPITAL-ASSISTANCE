/**
 * HeirGenealogyService.ts — MGR CAPITAL ASSISTANCE
 *
 * Case-linked genealogy research/evidence storage.
 *
 * IMPORTANT:
 * - This service records relationships and contact evidence.
 * - It does NOT automatically decide legal heir status.
 * - It does NOT calculate inheritance shares without an explicit reviewed
 *   legal determination.
 * - AI/model output is not treated as authority.
 */

import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import prisma from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  birthYear?: number;
  deathYear?: number;
  isDeceased: boolean;
  isHeir: boolean;
  heirPriority?: number;
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  children: FamilyMember[];
  spouses: string[];
  skipTraceStatus: "not_traced" | "found" | "not_found" | "pending";
  notes?: string;
  evidence?: {
    source?: string;
    sourceDate?: string;
    verifiedAt?: string;
    verifiedBy?: string;
  }[];
}

export interface GenealogyTree {
  id: string;
  caseId: string;
  decedentName: string;
  decedentDeathDate?: Date;
  lastKnownAddress?: string;
  state: string;
  rootMember: FamilyMember;
  candidateRelativeCount: number;
  locatedRelativeCount: number;
  legalReviewStatus: string;
  reviewedHeirCount: number;
  reviewedDistribution: Record<string, number>;
  legalReviewedBy?: string;
  legalReviewedAt?: Date;
  researchAssisted: boolean;
  researchNotes?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkipTraceResult {
  name?: string;
  addresses?: string[];
  phones?: string[];
  emails?: string[];
  relatives?: string[];
  age?: number;
  deceased?: boolean;
}

type GenealogyRow = Awaited<ReturnType<typeof prisma.genealogyTree.findUnique>>;

function asFamilyMember(value: Prisma.JsonValue): FamilyMember {
  return value as unknown as FamilyMember;
}

function asDistribution(value: Prisma.JsonValue | null): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, number>;
}

export class HeirGenealogyService {
  async generateGenealogyTree(
    caseId: string,
    decedentInfo: {
      name: string;
      deathDate?: Date;
      lastKnownAddress?: string;
      state: string;
      knownRelatives?: string[];
    }
  ): Promise<GenealogyTree> {
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, state: true },
    });

    if (!caseRecord) {
      throw new Error("Case not found");
    }

    const requestedState = decedentInfo.state.trim().toUpperCase();
    if (requestedState !== caseRecord.state.toUpperCase()) {
      throw new Error(
        `Genealogy state ${requestedState} does not match canonical case state ${caseRecord.state}`
      );
    }

    const rootMember: FamilyMember = {
      id: `member_${randomUUID()}`,
      name: decedentInfo.name.trim(),
      relationship: "Decedent",
      isDeceased: true,
      deathYear: decedentInfo.deathDate?.getFullYear(),
      isHeir: false,
      children: [],
      spouses: [],
      skipTraceStatus: "not_traced",
      evidence: [],
    };

    const uniqueKnownRelatives = Array.from(
      new Set(
        (decedentInfo.knownRelatives || [])
          .map((name) => name.trim())
          .filter(Boolean)
      )
    );

    for (const name of uniqueKnownRelatives) {
      rootMember.children.push({
        id: `member_${randomUUID()}`,
        name,
        relationship: "Known relative (unverified)",
        isDeceased: false,
        isHeir: false,
        children: [],
        spouses: [],
        skipTraceStatus: "not_traced",
        evidence: [],
      });
    }

    const created = await prisma.genealogyTree.create({
      data: {
        caseId,
        decedentName: rootMember.name,
        decedentDeathDate: decedentInfo.deathDate,
        lastKnownAddress: decedentInfo.lastKnownAddress,
        state: caseRecord.state.toUpperCase(),
        rootMember: rootMember as unknown as Prisma.InputJsonValue,
        candidateRelativeCount: uniqueKnownRelatives.length,
        locatedRelativeCount: 0,
        legalReviewStatus: "UNVERIFIED",
        reviewedHeirCount: 0,
        reviewedDistribution: {},
        researchAssisted: false,
        researchNotes: {
          note:
            "Relationships are research candidates only until evidence and legal review establish heir status.",
        },
      },
    });

    logger.info("Genealogy research tree created", {
      treeId: created.id,
      caseId,
      candidateRelativeCount: uniqueKnownRelatives.length,
    });

    return this.toTree(created);
  }

  async addFamilyMember(
    treeId: string,
    parentId: string,
    member: Omit<FamilyMember, "id" | "children">
  ): Promise<FamilyMember> {
    if (member.isHeir) {
      throw new Error(
        "Automatic heir designation is disabled. Record the person as a candidate relative and complete legal review separately."
      );
    }

    const tree = await this.requireTree(treeId);
    const root = structuredClone(tree.rootMember);

    const newMember: FamilyMember = {
      ...member,
      id: `member_${randomUUID()}`,
      isHeir: false,
      heirPriority: undefined,
      children: [],
      evidence: member.evidence || [],
    };

    if (!this.addChildToParent(root, parentId, newMember)) {
      throw new Error("Parent not found in genealogy tree");
    }

    await this.persistRoot(treeId, root);
    return newMember;
  }

  async updateMemberFromSkipTrace(
    treeId: string,
    memberId: string,
    skipTraceResult: SkipTraceResult
  ): Promise<FamilyMember | null> {
    const tree = await this.requireTree(treeId);
    const root = structuredClone(tree.rootMember);
    const member = this.findMember(root, memberId);
    if (!member) return null;

    member.contactInfo = {
      phone: skipTraceResult.phones?.[0],
      email: skipTraceResult.emails?.[0],
      address: skipTraceResult.addresses?.[0],
    };
    member.skipTraceStatus =
      (skipTraceResult.phones?.length || skipTraceResult.emails?.length || skipTraceResult.addresses?.length)
        ? "found"
        : "not_found";

    if (typeof skipTraceResult.deceased === "boolean") {
      member.isDeceased = skipTraceResult.deceased;
    }

    // Provider-discovered relatives are research candidates only.
    for (const relativeNameRaw of skipTraceResult.relatives || []) {
      const relativeName = relativeNameRaw.trim();
      if (!relativeName || this.findMemberByName(root, relativeName)) continue;

      member.children.push({
        id: `member_${randomUUID()}`,
        name: relativeName,
        relationship: "Discovered relative (unverified)",
        isDeceased: false,
        isHeir: false,
        children: [],
        spouses: [],
        skipTraceStatus: "pending",
        evidence: [{ source: "skip_trace_provider" }],
      });
    }

    await this.persistRoot(treeId, root);
    return this.findMember(root, memberId);
  }

  async calculateHeirDistribution(_treeId: string): Promise<Record<string, number>> {
    throw new Error(
      "Automatic inheritance-share calculation is disabled. Distribution requires an explicit, source-backed legal determination and review."
    );
  }

  async getTree(treeId: string): Promise<GenealogyTree | null> {
    const row = await prisma.genealogyTree.findUnique({ where: { id: treeId } });
    return row ? this.toTree(row) : null;
  }

  async listTrees(caseId: string): Promise<GenealogyTree[]> {
    const rows = await prisma.genealogyTree.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toTree(row));
  }

  async listAllTrees(limit = 100): Promise<GenealogyTree[]> {
    const rows = await prisma.genealogyTree.findMany({
      orderBy: { updatedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 500),
    });
    return rows.map((row) => this.toTree(row));
  }

  async getTreeForVisualization(treeId: string): Promise<{
    nodes: any[];
    links: any[];
    metadata: any;
  } | null> {
    const tree = await this.getTree(treeId);
    if (!tree) return null;

    const nodes: any[] = [];
    const links: any[] = [];
    this.buildVisualizationData(tree.rootMember, null, nodes, links, 0);

    return {
      nodes,
      links,
      metadata: {
        decedentName: tree.decedentName,
        candidateRelativeCount: tree.candidateRelativeCount,
        locatedRelativeCount: tree.locatedRelativeCount,
        legalReviewStatus: tree.legalReviewStatus,
        reviewedHeirCount: tree.reviewedHeirCount,
        state: tree.state,
      },
    };
  }

  async exportToPDF(treeId: string): Promise<Buffer> {
    const tree = await this.requireTree(treeId);
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([612, 792]);
    let y = 720;

    page.drawText("GENEALOGY RESEARCH REPORT", {
      x: 50,
      y,
      size: 20,
      font: bold,
      color: rgb(0.1, 0.1, 0.35),
    });
    y -= 35;

    const summary = [
      `Case ID: ${tree.caseId}`,
      `Decedent: ${tree.decedentName}`,
      `State: ${tree.state}`,
      `Candidate relatives: ${tree.candidateRelativeCount}`,
      `Located candidates: ${tree.locatedRelativeCount}`,
      `Legal review status: ${tree.legalReviewStatus}`,
      `Reviewed heirs: ${tree.reviewedHeirCount}`,
    ];

    for (const line of summary) {
      page.drawText(line, { x: 50, y, size: 11, font });
      y -= 18;
    }

    y -= 15;
    page.drawText(
      "IMPORTANT: This report records relationship research only. It is not a legal heirship or inheritance-share determination.",
      { x: 50, y, size: 9, font: bold, maxWidth: 500, color: rgb(0.65, 0.2, 0.1) }
    );

    y -= 45;
    page.drawText("RELATIONSHIP CANDIDATES", { x: 50, y, size: 15, font: bold });
    y -= 25;

    const candidates = this.flattenMembers(tree.rootMember).filter(
      (member) => member.id !== tree.rootMember.id
    );

    for (const candidate of candidates) {
      if (y < 90) {
        page = pdfDoc.addPage([612, 792]);
        y = 720;
      }
      page.drawText(`• ${candidate.name}`, { x: 50, y, size: 11, font: bold });
      y -= 15;
      page.drawText(`  Recorded relationship: ${candidate.relationship}`, {
        x: 60,
        y,
        size: 9,
        font,
      });
      y -= 14;
      page.drawText(`  Contact research status: ${candidate.skipTraceStatus}`, {
        x: 60,
        y,
        size: 9,
        font,
      });
      y -= 20;
    }

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  async deleteTree(treeId: string): Promise<boolean> {
    try {
      await prisma.genealogyTree.delete({ where: { id: treeId } });
      return true;
    } catch (error: any) {
      if (error?.code === "P2025") return false;
      throw error;
    }
  }

  private async requireTree(treeId: string): Promise<GenealogyTree> {
    const tree = await this.getTree(treeId);
    if (!tree) throw new Error("Genealogy tree not found");
    return tree;
  }

  private async persistRoot(treeId: string, rootMember: FamilyMember): Promise<void> {
    const members = this.flattenMembers(rootMember).filter((m) => m.id !== rootMember.id);
    const located = members.filter((m) => m.skipTraceStatus === "found").length;
    const reviewedHeirs = members.filter((m) => m.isHeir).length;

    await prisma.genealogyTree.update({
      where: { id: treeId },
      data: {
        rootMember: rootMember as unknown as Prisma.InputJsonValue,
        candidateRelativeCount: members.length,
        locatedRelativeCount: located,
        reviewedHeirCount: reviewedHeirs,
      },
    });
  }

  private toTree(row: NonNullable<GenealogyRow>): GenealogyTree {
    return {
      id: row.id,
      caseId: row.caseId,
      decedentName: row.decedentName,
      decedentDeathDate: row.decedentDeathDate || undefined,
      lastKnownAddress: row.lastKnownAddress || undefined,
      state: row.state,
      rootMember: asFamilyMember(row.rootMember),
      candidateRelativeCount: row.candidateRelativeCount,
      locatedRelativeCount: row.locatedRelativeCount,
      legalReviewStatus: row.legalReviewStatus,
      reviewedHeirCount: row.reviewedHeirCount,
      reviewedDistribution: asDistribution(row.reviewedDistribution),
      legalReviewedBy: row.legalReviewedBy || undefined,
      legalReviewedAt: row.legalReviewedAt || undefined,
      researchAssisted: row.researchAssisted,
      researchNotes: row.researchNotes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private addChildToParent(node: FamilyMember, parentId: string, child: FamilyMember): boolean {
    if (node.id === parentId) {
      node.children.push(child);
      return true;
    }
    return node.children.some((candidate) =>
      this.addChildToParent(candidate, parentId, child)
    );
  }

  private findMember(node: FamilyMember, id: string): FamilyMember | null {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = this.findMember(child, id);
      if (found) return found;
    }
    return null;
  }

  private findMemberByName(node: FamilyMember, name: string): FamilyMember | null {
    if (node.name.trim().toLowerCase() === name.trim().toLowerCase()) return node;
    for (const child of node.children) {
      const found = this.findMemberByName(child, name);
      if (found) return found;
    }
    return null;
  }

  private flattenMembers(node: FamilyMember): FamilyMember[] {
    return [node, ...node.children.flatMap((child) => this.flattenMembers(child))];
  }

  private buildVisualizationData(
    node: FamilyMember,
    parentId: string | null,
    nodes: any[],
    links: any[],
    depth: number
  ): void {
    nodes.push({
      id: node.id,
      name: node.name,
      relationship: node.relationship,
      isDeceased: node.isDeceased,
      isHeir: node.isHeir,
      heirPriority: node.heirPriority,
      skipTraceStatus: node.skipTraceStatus,
      depth,
      hasContact: !!(
        node.contactInfo?.phone ||
        node.contactInfo?.email ||
        node.contactInfo?.address
      ),
      color: node.isDeceased ? "#94a3b8" : node.isHeir ? "#22c55e" : "#3b82f6",
      size: node.isHeir ? 40 : 30,
    });

    if (parentId) {
      links.push({ source: parentId, target: node.id, type: node.relationship });
    }

    for (const child of node.children) {
      this.buildVisualizationData(child, node.id, nodes, links, depth + 1);
    }
  }
}

export const heirGenealogyService = new HeirGenealogyService();
