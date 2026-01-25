/**
 * HeirGenealogyService.ts — MGR CAPITAL ASSISTANCE
 * AI-Powered Heir Genealogy Tree Generation
 * D3.js visualization data, skip trace integration, PDF export
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import OpenAI from 'openai';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const prisma = new PrismaClient();

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface FamilyMember {
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
  skipTraceStatus: 'not_traced' | 'found' | 'not_found' | 'pending';
  notes?: string;
}

interface GenealogyTree {
  id: string;
  caseId: string;
  decedentName: string;
  decedentDeathDate?: Date;
  propertyAddress?: string;
  state: string;
  rootMember: FamilyMember;
  totalHeirs: number;
  confirmedHeirs: number;
  heirDistribution: { [heirId: string]: number }; // percentage
  lastUpdated: Date;
  aiGenerated: boolean;
  confidenceScore: number;
}

interface SkipTraceResult {
  name: string;
  addresses: string[];
  phones: string[];
  emails: string[];
  relatives: string[];
  age?: number;
  deceased?: boolean;
}

export class HeirGenealogyService {
  /**
   * Generate heir genealogy tree from skip trace data
   */
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
    logger.info('Generating genealogy tree', { caseId, decedent: decedentInfo.name });

    // Create root member (decedent)
    const rootMember: FamilyMember = {
      id: `member_${Date.now()}_root`,
      name: decedentInfo.name,
      relationship: 'Decedent',
      isDeceased: true,
      deathYear: decedentInfo.deathDate?.getFullYear(),
      isHeir: false,
      children: [],
      spouses: [],
      skipTraceStatus: 'not_traced',
    };

    // Use AI to analyze and predict family structure
    let aiPrediction = null;
    if (openai && decedentInfo.knownRelatives) {
      aiPrediction = await this.getAIPrediction(decedentInfo);
    }

    // Generate tree structure
    const tree: GenealogyTree = {
      id: `tree_${Date.now()}`,
      caseId,
      decedentName: decedentInfo.name,
      decedentDeathDate: decedentInfo.deathDate,
      state: decedentInfo.state,
      rootMember,
      totalHeirs: 0,
      confirmedHeirs: 0,
      heirDistribution: {},
      lastUpdated: new Date(),
      aiGenerated: !!aiPrediction,
      confidenceScore: aiPrediction ? 0.75 : 0.5,
    };

    // Store tree
    await this.storeTree(tree);

    return tree;
  }

  /**
   * Use AI to predict family structure from skip trace data
   */
  private async getAIPrediction(decedentInfo: {
    name: string;
    state: string;
    knownRelatives?: string[];
  }): Promise<any> {
    if (!openai) return null;

    try {
      const prompt = `Analyze the following information about a deceased property owner and predict their likely family structure for heir determination.

Decedent: ${decedentInfo.name}
State: ${decedentInfo.state}
Known Relatives: ${decedentInfo.knownRelatives?.join(', ') || 'None provided'}

Based on ${decedentInfo.state} intestate succession laws, provide a JSON structure with:
1. Likely family relationships (spouse, children, parents, siblings)
2. Inheritance priority order
3. Estimated percentage share for each heir class
4. Recommended next steps for heir research

Return as valid JSON with keys: familyStructure, inheritancePriority, percentageShares, recommendations`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert in estate law and heir research.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      return content ? JSON.parse(content) : null;
    } catch (error: any) {
      logger.error('AI prediction failed', { error: error.message });
      return null;
    }
  }

  /**
   * Add family member to tree
   */
  async addFamilyMember(
    treeId: string,
    parentId: string,
    member: Omit<FamilyMember, 'id' | 'children'>
  ): Promise<FamilyMember> {
    const tree = await this.getTree(treeId);
    if (!tree) throw new Error('Tree not found');

    const newMember: FamilyMember = {
      ...member,
      id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      children: [],
    };

    // Find parent and add child
    const added = this.addChildToParent(tree.rootMember, parentId, newMember);
    if (!added) throw new Error('Parent not found in tree');

    // Update heir counts
    if (newMember.isHeir) {
      tree.totalHeirs++;
      if (newMember.skipTraceStatus === 'found') {
        tree.confirmedHeirs++;
      }
    }

    tree.lastUpdated = new Date();
    await this.storeTree(tree);

    return newMember;
  }

  /**
   * Recursively add child to parent
   */
  private addChildToParent(
    node: FamilyMember,
    parentId: string,
    child: FamilyMember
  ): boolean {
    if (node.id === parentId) {
      node.children.push(child);
      return true;
    }

    for (const childNode of node.children) {
      if (this.addChildToParent(childNode, parentId, child)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update family member with skip trace results
   */
  async updateMemberFromSkipTrace(
    treeId: string,
    memberId: string,
    skipTraceResult: SkipTraceResult
  ): Promise<FamilyMember | null> {
    const tree = await this.getTree(treeId);
    if (!tree) return null;

    const member = this.findMember(tree.rootMember, memberId);
    if (!member) return null;

    // Update contact info from skip trace
    member.contactInfo = {
      phone: skipTraceResult.phones?.[0],
      email: skipTraceResult.emails?.[0],
      address: skipTraceResult.addresses?.[0],
    };
    member.skipTraceStatus = skipTraceResult.phones?.length > 0 ? 'found' : 'not_found';
    member.isDeceased = skipTraceResult.deceased || false;

    // Auto-add discovered relatives
    for (const relativeName of skipTraceResult.relatives || []) {
      const exists = this.findMemberByName(tree.rootMember, relativeName);
      if (!exists) {
        await this.addFamilyMember(treeId, memberId, {
          name: relativeName,
          relationship: 'Discovered Relative',
          isDeceased: false,
          isHeir: false,
          spouses: [],
          skipTraceStatus: 'pending',
        });
      }
    }

    tree.lastUpdated = new Date();
    if (member.isHeir && member.skipTraceStatus === 'found') {
      tree.confirmedHeirs = this.countConfirmedHeirs(tree.rootMember);
    }

    await this.storeTree(tree);
    return member;
  }

  /**
   * Find member by ID
   */
  private findMember(node: FamilyMember, id: string): FamilyMember | null {
    if (node.id === id) return node;

    for (const child of node.children) {
      const found = this.findMember(child, id);
      if (found) return found;
    }

    return null;
  }

  /**
   * Find member by name
   */
  private findMemberByName(node: FamilyMember, name: string): FamilyMember | null {
    if (node.name.toLowerCase() === name.toLowerCase()) return node;

    for (const child of node.children) {
      const found = this.findMemberByName(child, name);
      if (found) return found;
    }

    return null;
  }

  /**
   * Count confirmed heirs
   */
  private countConfirmedHeirs(node: FamilyMember): number {
    let count = node.isHeir && node.skipTraceStatus === 'found' ? 1 : 0;

    for (const child of node.children) {
      count += this.countConfirmedHeirs(child);
    }

    return count;
  }

  /**
   * Calculate heir distribution based on state law
   */
  async calculateHeirDistribution(treeId: string): Promise<{ [heirId: string]: number }> {
    const tree = await this.getTree(treeId);
    if (!tree) return {};

    const heirs = this.getAllHeirs(tree.rootMember);
    if (heirs.length === 0) return {};

    // Simple equal distribution (real implementation would follow state law)
    const distribution: { [heirId: string]: number } = {};
    const share = 100 / heirs.length;

    for (const heir of heirs) {
      distribution[heir.id] = share;
    }

    tree.heirDistribution = distribution;
    await this.storeTree(tree);

    return distribution;
  }

  /**
   * Get all heirs from tree
   */
  private getAllHeirs(node: FamilyMember): FamilyMember[] {
    const heirs: FamilyMember[] = [];

    if (node.isHeir) {
      heirs.push(node);
    }

    for (const child of node.children) {
      heirs.push(...this.getAllHeirs(child));
    }

    return heirs;
  }

  /**
   * Get tree data for D3.js visualization
   */
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
        totalHeirs: tree.totalHeirs,
        confirmedHeirs: tree.confirmedHeirs,
        state: tree.state,
        confidenceScore: tree.confidenceScore,
      },
    };
  }

  /**
   * Build D3.js visualization data recursively
   */
  private buildVisualizationData(
    node: FamilyMember,
    parentId: string | null,
    nodes: any[],
    links: any[],
    depth: number
  ): void {
    const nodeData = {
      id: node.id,
      name: node.name,
      relationship: node.relationship,
      isDeceased: node.isDeceased,
      isHeir: node.isHeir,
      heirPriority: node.heirPriority,
      skipTraceStatus: node.skipTraceStatus,
      depth,
      hasContact: !!node.contactInfo?.phone,
      color: node.isDeceased ? '#94a3b8' : node.isHeir ? '#22c55e' : '#3b82f6',
      size: node.isHeir ? 40 : 30,
    };

    nodes.push(nodeData);

    if (parentId) {
      links.push({
        source: parentId,
        target: node.id,
        type: node.relationship,
      });
    }

    for (const child of node.children) {
      this.buildVisualizationData(child, node.id, nodes, links, depth + 1);
    }
  }

  /**
   * Export genealogy tree to PDF
   */
  async exportToPDF(treeId: string): Promise<Buffer> {
    const tree = await this.getTree(treeId);
    if (!tree) throw new Error('Tree not found');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Title page
    let page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();

    page.drawText('HEIR GENEALOGY REPORT', {
      x: 50,
      y: height - 80,
      size: 24,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.4),
    });

    page.drawText(`Case ID: ${tree.caseId}`, {
      x: 50,
      y: height - 120,
      size: 12,
      font,
    });

    page.drawText(`Decedent: ${tree.decedentName}`, {
      x: 50,
      y: height - 140,
      size: 12,
      font,
    });

    page.drawText(`State: ${tree.state}`, {
      x: 50,
      y: height - 160,
      size: 12,
      font,
    });

    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: height - 180,
      size: 12,
      font,
    });

    page.drawText(`Total Heirs Identified: ${tree.totalHeirs}`, {
      x: 50,
      y: height - 220,
      size: 14,
      font: boldFont,
    });

    page.drawText(`Heirs Located: ${tree.confirmedHeirs}`, {
      x: 50,
      y: height - 240,
      size: 14,
      font: boldFont,
    });

    page.drawText(`Confidence Score: ${(tree.confidenceScore * 100).toFixed(0)}%`, {
      x: 50,
      y: height - 260,
      size: 14,
      font: boldFont,
    });

    // Heir list page
    page = pdfDoc.addPage([612, 792]);
    let yPos = height - 80;

    page.drawText('IDENTIFIED HEIRS', {
      x: 50,
      y: yPos,
      size: 18,
      font: boldFont,
    });

    yPos -= 40;

    const heirs = this.getAllHeirs(tree.rootMember);
    for (const heir of heirs) {
      if (yPos < 100) {
        page = pdfDoc.addPage([612, 792]);
        yPos = height - 80;
      }

      page.drawText(`• ${heir.name}`, {
        x: 50,
        y: yPos,
        size: 12,
        font: boldFont,
      });

      yPos -= 20;

      page.drawText(`  Relationship: ${heir.relationship}`, {
        x: 50,
        y: yPos,
        size: 10,
        font,
      });

      yPos -= 15;

      page.drawText(`  Status: ${heir.skipTraceStatus} | ${heir.isDeceased ? 'Deceased' : 'Living'}`, {
        x: 50,
        y: yPos,
        size: 10,
        font,
      });

      yPos -= 15;

      if (heir.contactInfo?.phone) {
        page.drawText(`  Phone: ${heir.contactInfo.phone}`, {
          x: 50,
          y: yPos,
          size: 10,
          font,
        });
        yPos -= 15;
      }

      if (heir.contactInfo?.address) {
        page.drawText(`  Address: ${heir.contactInfo.address}`, {
          x: 50,
          y: yPos,
          size: 10,
          font,
        });
        yPos -= 15;
      }

      const share = tree.heirDistribution[heir.id];
      if (share) {
        page.drawText(`  Estimated Share: ${share.toFixed(1)}%`, {
          x: 50,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0.5, 0),
        });
        yPos -= 15;
      }

      yPos -= 15;
    }

    // Footer
    page.drawText('Generated by MGR Capital Assistance - AI Heir Genealogy System', {
      x: 50,
      y: 40,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  // In-memory cache for trees (fallback when DB unavailable)
  private treeCache: Map<string, GenealogyTree> = new Map();

  /**
   * Store tree in database
   */
  private async storeTree(tree: GenealogyTree): Promise<void> {
    try {
      // Try to store in database using Document model
      await prisma.document.upsert({
        where: { id: tree.id },
        update: {
          metadata: JSON.stringify({
            type: 'GENEALOGY_TREE',
            decedentName: tree.decedentName,
            state: tree.state,
            rootMember: tree.rootMember,
            totalHeirs: tree.totalHeirs,
            confirmedHeirs: tree.confirmedHeirs,
            heirDistribution: tree.heirDistribution,
            aiGenerated: tree.aiGenerated,
            confidenceScore: tree.confidenceScore,
          }),
          updatedAt: new Date(),
        },
        create: {
          id: tree.id,
          caseId: tree.caseId,
          type: 'GENEALOGY_TREE',
          status: 'UPLOADED',
          filePath: `genealogy/${tree.caseId}/${tree.id}.json`,
          metadata: JSON.stringify({
            type: 'GENEALOGY_TREE',
            decedentName: tree.decedentName,
            decedentDeathDate: tree.decedentDeathDate,
            state: tree.state,
            rootMember: tree.rootMember,
            totalHeirs: tree.totalHeirs,
            confirmedHeirs: tree.confirmedHeirs,
            heirDistribution: tree.heirDistribution,
            aiGenerated: tree.aiGenerated,
            confidenceScore: tree.confidenceScore,
          }),
        },
      });
      logger.info('Genealogy tree stored in DB', { treeId: tree.id });
    } catch (error: any) {
      // Fallback to in-memory cache
      logger.warn('DB storage failed, using cache', { error: error.message });
      this.treeCache.set(tree.id, tree);
    }
  }

  /**
   * Get tree from database
   */
  async getTree(treeId: string): Promise<GenealogyTree | null> {
    try {
      // Try database first
      const doc = await prisma.document.findFirst({
        where: {
          id: treeId,
          type: 'GENEALOGY_TREE',
        },
      });

      if (doc && doc.metadata) {
        const metadata = typeof doc.metadata === 'string'
          ? JSON.parse(doc.metadata)
          : doc.metadata;

        return {
          id: doc.id,
          caseId: doc.caseId,
          decedentName: metadata.decedentName,
          decedentDeathDate: metadata.decedentDeathDate ? new Date(metadata.decedentDeathDate) : undefined,
          state: metadata.state,
          rootMember: metadata.rootMember,
          totalHeirs: metadata.totalHeirs || 0,
          confirmedHeirs: metadata.confirmedHeirs || 0,
          heirDistribution: metadata.heirDistribution || {},
          lastUpdated: doc.updatedAt,
          aiGenerated: metadata.aiGenerated || false,
          confidenceScore: metadata.confidenceScore || 0.5,
        };
      }
    } catch (error: any) {
      logger.warn('DB fetch failed, checking cache', { error: error.message });
    }

    // Fallback to cache
    return this.treeCache.get(treeId) || null;
  }

  /**
   * List all trees for a case
   */
  async listTrees(caseId: string): Promise<GenealogyTree[]> {
    try {
      const docs = await prisma.document.findMany({
        where: {
          caseId,
          type: 'GENEALOGY_TREE',
        },
        orderBy: { createdAt: 'desc' },
      });

      return docs.map(doc => {
        const metadata = typeof doc.metadata === 'string'
          ? JSON.parse(doc.metadata)
          : doc.metadata as any;

        return {
          id: doc.id,
          caseId: doc.caseId,
          decedentName: metadata.decedentName,
          decedentDeathDate: metadata.decedentDeathDate ? new Date(metadata.decedentDeathDate) : undefined,
          state: metadata.state,
          rootMember: metadata.rootMember,
          totalHeirs: metadata.totalHeirs || 0,
          confirmedHeirs: metadata.confirmedHeirs || 0,
          heirDistribution: metadata.heirDistribution || {},
          lastUpdated: doc.updatedAt,
          aiGenerated: metadata.aiGenerated || false,
          confidenceScore: metadata.confidenceScore || 0.5,
        };
      });
    } catch (error: any) {
      logger.warn('DB list failed', { error: error.message });
      // Return from cache
      return Array.from(this.treeCache.values()).filter(t => t.caseId === caseId);
    }
  }

  /**
   * Delete a genealogy tree
   */
  async deleteTree(treeId: string): Promise<boolean> {
    try {
      await prisma.document.delete({
        where: { id: treeId },
      });
      this.treeCache.delete(treeId);
      logger.info('Genealogy tree deleted', { treeId });
      return true;
    } catch (error: any) {
      logger.error('Delete failed', { error: error.message });
      this.treeCache.delete(treeId);
      return false;
    }
  }

  /**
   * Get state-specific intestate succession rules
   */
  getIntestateRules(state: string): {
    spouseShare: string;
    childrenShare: string;
    parentsShare: string;
    siblingsShare: string;
    statute: string;
  } {
    const rules: Record<string, any> = {
      'CA': {
        spouseShare: '100% if no children, else 50-100% community property + 1/3-1/2 separate property',
        childrenShare: 'Remaining after spouse share, divided equally',
        parentsShare: '100% if no spouse/children',
        siblingsShare: 'If no spouse/children/parents',
        statute: 'California Probate Code §§ 6400-6414'
      },
      'FL': {
        spouseShare: '100% if no descendants, else 50% if descendants are also spouse\'s',
        childrenShare: 'Remaining after spouse, divided equally per stirpes',
        parentsShare: '100% if no spouse/descendants',
        siblingsShare: 'If no spouse/descendants/parents',
        statute: 'Florida Statutes §§ 732.101-732.111'
      },
      'TX': {
        spouseShare: '100% community property + 1/3 separate property life estate',
        childrenShare: '2/3 separate property, divided equally',
        parentsShare: '50% if one parent survives with siblings',
        siblingsShare: '50% divided equally if parent survives',
        statute: 'Texas Estates Code §§ 201.001-201.152'
      },
      'GA': {
        spouseShare: 'Equal share with children, minimum 1/3',
        childrenShare: 'Equal shares with spouse',
        parentsShare: '100% if no spouse/children',
        siblingsShare: 'Equal shares if no spouse/children/parents',
        statute: 'OCGA §§ 53-2-1 to 53-2-10'
      },
      'NY': {
        spouseShare: '$50,000 + 50% if children, else 100%',
        childrenShare: 'Remaining after spouse share',
        parentsShare: '100% if no spouse/children',
        siblingsShare: 'If no spouse/children/parents',
        statute: 'NY EPTL §§ 4-1.1 to 4-1.6'
      }
    };

    return rules[state.toUpperCase()] || {
      spouseShare: 'Check state statute',
      childrenShare: 'Check state statute',
      parentsShare: 'Check state statute',
      siblingsShare: 'Check state statute',
      statute: 'Varies by state'
    };
  }
}

export const heirGenealogyService = new HeirGenealogyService();
