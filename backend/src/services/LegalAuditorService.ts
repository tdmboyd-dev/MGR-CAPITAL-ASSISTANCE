import OpenAI from 'openai';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';

const suggestionSchema = z.object({ errors:z.array(z.string().max(4000)).max(50),suggestions:z.array(z.string().max(4000)).max(50),score:z.number().min(0).max(100),compliance:z.object({state:z.string(),type:z.string(),isCompliant:z.boolean(),issues:z.array(z.string().max(4000)).max(50)}) });

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface AuditResult {
  errors: string[];
  suggestions: string[];
  score: number;
  compliance: {
    state: string;
    type: string;
    isCompliant: boolean;
    issues: string[];
  };
  timestamp: Date;
  assessment: 'AI_SUGGESTIONS_ONLY';
  legalQualification: string;
}

export class LegalAuditorService {
  /**
   * Audit a legal document for compliance and errors
   */
  async auditDocument(docText: string, state: string, type: string): Promise<AuditResult> {
    const prompt = `You are a legal document auditor specializing in surplus funds recovery.

Audit this ${type} document for ${state} state compliance.

Check for:
1. Missing required sections
2. Legal language errors
3. State-specific compliance issues
4. Formatting problems
5. Potential legal risks

Document to audit:
${docText}

Output JSON only:
{
  "errors": ["list of errors found"],
  "suggestions": ["list of improvement suggestions"],
  "score": 0-100,
  "compliance": {
    "state": "${state}",
    "type": "${type}",
    "isCompliant": true/false,
    "issues": ["compliance issues"]
  }
}`;

    if (typeof docText !== 'string' || !docText.trim() || docText.length > 50000 || !/^[A-Z]{2}$/.test(state) || !['assignment_of_interest','claim_form','power_of_attorney','affidavit','other'].includes(type)) throw new AppError('Invalid document review input',400,'Use a two-letter uppercase state, supported document type and 1 to 50000 characters of text.');
    try {
      if (!openai) {
        throw new AppError('Legal review unavailable',503,'AI document review is unavailable. No review or compliance result was produced.');
      }
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a legal document auditor. Output valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      });

      const content = response.choices[0].message.content || '{}';
      const parsed = suggestionSchema.parse(JSON.parse(content.replace(/```json\n?|\n?```/g, '')));

      return {
        ...parsed,
        compliance: {...parsed.compliance,state:state.toUpperCase(),type},
        assessment: 'AI_SUGGESTIONS_ONLY',
        legalQualification: 'UNVERIFIED: source-backed county requirements and qualified review still required',
        timestamp: new Date()
      };
    } catch (error) {
      // Provider errors may contain document text; do not log the raw error or return invented findings.
      throw new AppError('Legal review unavailable',503,'AI document review is unavailable. No review or compliance result was produced.');
    }
  }

  /**
   * Get document templates by state
   */
  getTemplateRequirements(state: string, type: string): string[] {
    const requirements: Record<string, string[]> = {
      'assignment_of_interest': [
        'Assignor name and address',
        'Assignee name and address',
        'Property description',
        'Surplus amount',
        'Date of sale',
        'Notarization section',
        'Witness signatures',
        'Recording instructions'
      ],
      'claim_form': [
        'Claimant information',
        'Property identification',
        'Proof of ownership/interest',
        'Amount claimed',
        'Supporting documentation list',
        'Signature and date'
      ],
      'power_of_attorney': [
        'Principal name',
        'Agent name',
        'Powers granted',
        'Effective date',
        'Expiration clause',
        'Notarization'
      ]
    };

    return requirements[type] || requirements['assignment_of_interest'];
  }

  /**
   * Batch audit multiple documents
   */
  async batchAudit(documents: { text: string; state: string; type: string }[]): Promise<AuditResult[]> {
    const results = await Promise.all(
      documents.map(doc => this.auditDocument(doc.text, doc.state, doc.type))
    );
    return results;
  }

  // The former unsourced national rule table and mock audit were removed.
  // Jurisdiction qualification belongs to the source-backed recovery requirements workflow.
}
export const legalAuditorService = new LegalAuditorService();
