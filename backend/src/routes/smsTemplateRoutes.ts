/**
 * smsTemplateRoutes.ts — MGR CAPITAL ASSISTANCE
 * SMS Template Library API routes
 *
 * Endpoints:
 * - GET /api/sms-templates - List all templates
 * - GET /api/sms-templates/stages - Get available stages
 * - GET /api/sms-templates/states - Get supported states
 * - GET /api/sms-templates/performance - Get A/B testing performance
 * - GET /api/sms-templates/:id - Get single template
 * - POST /api/sms-templates/render - Render template with case data
 * - POST /api/sms-templates/validate - Validate template content
 * - PUT /api/sms-templates/:id - Update template (FOUNDER only)
 * - POST /api/sms-templates - Create custom template (FOUNDER only)
 * - POST /api/sms-templates/:id/record-event - Record A/B testing event
 */

import express from 'express';
import { authenticate, roleGuard } from '../middleware/authMiddleware.js';
import {
  smsTemplatesService,
  OutreachStage,
  RenderOptions,
} from '../services/SMSTemplatesService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ============================================
// PUBLIC ENDPOINTS (Authenticated users)
// ============================================

/**
 * GET /api/sms-templates
 * List all SMS templates with optional filters
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      stage,
      stateCode,
      isActive,
      variant,
    } = req.query;

    const filters: {
      stage?: OutreachStage;
      stateCode?: string;
      isActive?: boolean;
      variant?: 'A' | 'B' | 'C';
    } = {};

    if (stage) {
      filters.stage = stage as OutreachStage;
    }

    if (stateCode) {
      filters.stateCode = stateCode as string;
    }

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    if (variant) {
      filters.variant = variant as 'A' | 'B' | 'C';
    }

    const templates = smsTemplatesService.getAll(filters);

    res.json({
      success: true,
      templates,
      total: templates.length,
    });
  } catch (error) {
    logger.error('Error fetching SMS templates', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SMS templates',
    });
  }
});

/**
 * GET /api/sms-templates/stages
 * Get available outreach stages
 */
router.get('/stages', authenticate, (_req, res) => {
  try {
    const stages = smsTemplatesService.getStages();

    res.json({
      success: true,
      stages: stages.map(stage => ({
        value: stage,
        label: stage
          .split('_')
          .map(word => word.charAt(0) + word.slice(1).toLowerCase())
          .join(' '),
      })),
    });
  } catch (error) {
    logger.error('Error fetching SMS stages', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stages',
    });
  }
});

/**
 * GET /api/sms-templates/states
 * Get states with custom templates
 */
router.get('/states', authenticate, (_req, res) => {
  try {
    const states = smsTemplatesService.getSupportedStates();

    res.json({
      success: true,
      states,
    });
  } catch (error) {
    logger.error('Error fetching supported states', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supported states',
    });
  }
});

/**
 * GET /api/sms-templates/performance
 * Get A/B testing performance report (FOUNDER/ADMIN)
 */
router.get(
  '/performance',
  authenticate,
  roleGuard(['FOUNDER', 'ADMIN']),
  async (req, res) => {
    try {
      const { stage } = req.query;

      const performance = smsTemplatesService.getPerformanceReport(
        stage as OutreachStage | undefined
      );

      // Sort by conversion rate descending
      performance.sort((a, b) => b.conversionRate - a.conversionRate);

      res.json({
        success: true,
        performance,
        summary: {
          totalTemplates: performance.length,
          totalSent: performance.reduce((sum, p) => sum + p.sent, 0),
          totalDelivered: performance.reduce((sum, p) => sum + p.delivered, 0),
          totalResponded: performance.reduce((sum, p) => sum + p.responded, 0),
          totalOptedOut: performance.reduce((sum, p) => sum + p.optedOut, 0),
          averageConversionRate:
            performance.length > 0
              ? performance.reduce((sum, p) => sum + p.conversionRate, 0) / performance.length
              : 0,
        },
      });
    } catch (error) {
      logger.error('Error fetching performance report', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance report',
      });
    }
  }
);

/**
 * GET /api/sms-templates/best/:stage
 * Get the best performing template for a stage
 */
router.get('/best/:stage', authenticate, async (req, res) => {
  try {
    const { stage } = req.params;
    const { stateCode, variant } = req.query;

    const template = smsTemplatesService.getBestForStage(
      stage as OutreachStage,
      stateCode as string | undefined,
      variant as 'A' | 'B' | 'C' | undefined
    );

    if (!template) {
      return res.status(404).json({
        success: false,
        error: `No active template found for stage: ${stage}`,
      });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    logger.error('Error fetching best template', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch best template',
    });
  }
});

/**
 * GET /api/sms-templates/:id
 * Get single template by ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const template = smsTemplatesService.getById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    logger.error('Error fetching SMS template', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SMS template',
    });
  }
});

/**
 * POST /api/sms-templates/render
 * Render template with case data
 */
router.post('/render', authenticate, async (req, res) => {
  try {
    const { templateId, data } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'templateId is required',
      });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'data object is required',
      });
    }

    // Validate required fields
    const requiredFields = ['firstName', 'county', 'state', 'companyName'];
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    const result = smsTemplatesService.render(templateId, data as RenderOptions);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: result.message,
      characterCount: result.characterCount,
      exceedsLimit: result.exceedsLimit,
      segments: Math.ceil((result.characterCount || 0) / 160),
    });
  } catch (error) {
    logger.error('Error rendering SMS template', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to render SMS template',
    });
  }
});

/**
 * POST /api/sms-templates/validate
 * Validate template content (FOUNDER/ADMIN)
 */
router.post(
  '/validate',
  authenticate,
  roleGuard(['FOUNDER', 'ADMIN']),
  async (req, res) => {
    try {
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'content string is required',
        });
      }

      const validation = smsTemplatesService.validateContent(content);

      res.json({
        success: true,
        validation,
      });
    } catch (error) {
      logger.error('Error validating SMS template', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to validate SMS template',
      });
    }
  }
);

// ============================================
// FOUNDER-ONLY ENDPOINTS
// ============================================

/**
 * PUT /api/sms-templates/:id
 * Update template (FOUNDER only)
 */
router.put(
  '/:id',
  authenticate,
  roleGuard(['FOUNDER']),
  async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, description, content, isActive } = req.body;

      // Validate content if provided
      if (content) {
        const validation = smsTemplatesService.validateContent(content);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: 'Invalid template content',
            validationErrors: validation.errors,
          });
        }
      }

      const updates: {
        name?: string;
        description?: string;
        content?: string;
        isActive?: boolean;
      } = {};

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (content !== undefined) updates.content = content;
      if (isActive !== undefined) updates.isActive = isActive;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid update fields provided',
        });
      }

      const template = smsTemplatesService.updateTemplate(id, updates);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      logger.info('SMS template updated by founder', {
        templateId: id,
        userId: req.user?.id,
        updates: Object.keys(updates),
      });

      res.json({
        success: true,
        template,
      });
    } catch (error) {
      logger.error('Error updating SMS template', { error, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to update SMS template',
      });
    }
  }
);

/**
 * POST /api/sms-templates
 * Create custom template (FOUNDER only)
 */
router.post(
  '/',
  authenticate,
  roleGuard(['FOUNDER']),
  async (req: any, res) => {
    try {
      const {
        stage,
        name,
        description,
        content,
        variant,
        stateCode,
        requiredPlaceholders,
      } = req.body;

      // Validate required fields
      if (!stage || !name || !content) {
        return res.status(400).json({
          success: false,
          error: 'stage, name, and content are required',
        });
      }

      // Validate stage
      const validStages = smsTemplatesService.getStages();
      if (!validStages.includes(stage)) {
        return res.status(400).json({
          success: false,
          error: `Invalid stage. Valid stages: ${validStages.join(', ')}`,
        });
      }

      // Validate variant
      if (variant && !['A', 'B', 'C'].includes(variant)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid variant. Must be A, B, or C',
        });
      }

      // Validate content
      const validation = smsTemplatesService.validateContent(content);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid template content',
          validationErrors: validation.errors,
          validationWarnings: validation.warnings,
        });
      }

      // Determine opt-out language from content
      let optOutLanguage = 'Reply STOP to unsubscribe';
      if (content.toLowerCase().includes('stop to opt out')) {
        optOutLanguage = 'STOP to opt out';
      }

      const template = smsTemplatesService.createTemplate({
        stage,
        name,
        description: description || '',
        content,
        variant: variant || 'A',
        stateCode: stateCode || undefined,
        isActive: true,
        requiredPlaceholders: requiredPlaceholders || ['firstName', 'companyName'],
        optOutLanguage,
      });

      logger.info('Custom SMS template created by founder', {
        templateId: template.id,
        userId: req.user?.id,
        stage,
      });

      res.status(201).json({
        success: true,
        template,
        validationWarnings: validation.warnings,
      });
    } catch (error) {
      logger.error('Error creating SMS template', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create SMS template',
      });
    }
  }
);

/**
 * POST /api/sms-templates/:id/record-event
 * Record A/B testing event (internal use)
 */
router.post(
  '/:id/record-event',
  authenticate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { event } = req.body;

      const validEvents = ['send', 'delivery', 'response', 'optout'];
      if (!event || !validEvents.includes(event)) {
        return res.status(400).json({
          success: false,
          error: `Invalid event. Valid events: ${validEvents.join(', ')}`,
        });
      }

      switch (event) {
        case 'send':
          smsTemplatesService.recordSend(id);
          break;
        case 'delivery':
          smsTemplatesService.recordDelivery(id);
          break;
        case 'response':
          smsTemplatesService.recordResponse(id);
          break;
        case 'optout':
          smsTemplatesService.recordOptOut(id);
          break;
      }

      res.json({
        success: true,
        message: `Event '${event}' recorded for template ${id}`,
      });
    } catch (error) {
      logger.error('Error recording SMS template event', { error, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to record event',
      });
    }
  }
);

export default router;
