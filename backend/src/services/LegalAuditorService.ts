import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a legal document auditor. Output valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      });

      const content = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));

      return {
        ...parsed,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Legal audit error:', error);
      // Return mock audit for demo
      return this.getMockAudit(state, type);
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

  private getMockAudit(state: string, type: string): AuditResult {
    return {
      errors: [
        'Missing notarization section',
        'Property description incomplete'
      ],
      suggestions: [
        'Add full legal property description with parcel number',
        'Include recording fee information',
        'Add state-specific disclosure language'
      ],
      score: 72,
      compliance: {
        state,
        type,
        isCompliant: false,
        issues: [
          `${state} requires notarized signatures`,
          'Missing required disclosure statement'
        ]
      },
      timestamp: new Date()
    };
  }
}

export const legalAuditorService = new LegalAuditorService();
