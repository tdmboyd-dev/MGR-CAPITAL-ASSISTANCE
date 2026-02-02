/**
 * PhoneBotService.ts — MGR CAPITAL ASSISTANCE
 * AI Phone Bot with Telnyx/Twilio + Chatterbox/ElevenLabs + DeepSeek/OpenAI
 * ADVANCED: Multi-language, sentiment analysis, call recording, auto-followup
 *
 * RECOMMENDED PROVIDERS (see BEST_APIS_GUIDE.md):
 * - Phone: Telnyx ($0.007/min) - 50% cheaper than Twilio
 * - TTS: Chatterbox (FREE) or Fish Audio ($9.99/mo)
 * - LLM: DeepSeek V3 - 95% cheaper than OpenAI
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

// API configurations - supports multiple providers
// PHONE: Telnyx (recommended) or Twilio
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_NUMBER = process.env.TELNYX_NUMBER;
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_NUMBER;

// TTS: Chatterbox (FREE, local) or ElevenLabs (paid)
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// LLM: DeepSeek (recommended) or OpenAI
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;

// Determine which phone provider to use
const PHONE_PROVIDER = TELNYX_API_KEY ? 'telnyx' : (TWILIO_SID ? 'twilio' : 'demo');
const PHONE_NUMBER = TELNYX_NUMBER || TWILIO_NUMBER;

// Determine which LLM provider to use (DeepSeek is 95% cheaper)
const LLM_PROVIDER = DEEPSEEK_API_KEY ? 'deepseek' : (GOOGLE_AI_KEY ? 'gemini' : (OPENAI_API_KEY ? 'openai' : 'scripted'));

interface CallResult {
  success: boolean;
  callSid?: string;
  error?: string;
}

interface TranscriptResult {
  text: string;
  status: 'in_progress' | 'completed' | 'failed';
  sentiment?: 'positive' | 'negative' | 'neutral';
  confidence?: number;
}

interface VoiceConfig {
  voiceId: string;
  name: string;
  language: string;
  style: 'professional' | 'friendly' | 'empathetic';
}

const VOICE_PRESETS: Record<string, VoiceConfig> = {
  'lawyer-male': {
    voiceId: '21m00Tcm4TlvDq8ikWAM', // ElevenLabs voice ID
    name: 'Professional Male',
    language: 'en',
    style: 'professional',
  },
  'lawyer-female': {
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Professional Female',
    language: 'en',
    style: 'professional',
  },
  'friendly-male': {
    voiceId: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Friendly Male',
    language: 'en',
    style: 'friendly',
  },
  'spanish-male': {
    voiceId: 'GBv7mTt0atIp3Br8iCZE',
    name: 'Spanish Male',
    language: 'es',
    style: 'professional',
  },
};

// Client-facing call scripts — NEVER reveal surplus amounts, fees, or business model
const CALL_SCRIPTS = {
  initial_outreach: `
Hey, this is the team at MGR Capital Assistant. Am I speaking with {ownerName}?

Great — we found something that might be yours. There are some funds from a property matter in {county} County. No cost to you upfront, we just handle the paperwork. Want us to look into it for you?
  `.trim(),
  follow_up: `
Hey {ownerName}, this is MGR Capital Assistant following up on the funds we discussed. Did you get a chance to look over the paperwork we sent? No rush, but I wanted to let you know the filing deadline is coming up so we want to make sure we get this submitted in time for you.
  `.trim(),
  closing: `
Hey {ownerName}, great news. Your claim is moving forward and we're handling the next steps. We'll send you the paperwork via email. You'll hear from your case manager within 24 hours. Thanks for your time.
  `.trim(),
  objection_scam: `
Totally fair question. These funds are held by the county — that's public record you can verify yourself. We just handle the legal process to get them released. No payment needed from you, ever.
  `.trim(),
  objection_how_much: `
The exact amount gets determined during the recovery process once we review the county records. What I can tell you is there are funds connected to your name.
  `.trim(),
  objection_not_interested: `
No problem at all. Just so you know, there is a deadline on these types of claims. If you change your mind, you can reach us at this number. Have a good one.
  `.trim(),
};

export class PhoneBotService {
  private isConfigured: boolean;
  private demoMode: boolean;
  private phoneProvider: string;
  private llmProvider: string;

  constructor() {
    this.phoneProvider = PHONE_PROVIDER;
    this.llmProvider = LLM_PROVIDER;
    this.isConfigured = this.phoneProvider !== 'demo';
    this.demoMode = !this.isConfigured;

    if (this.demoMode) {
      logger.info('[PhoneBot] Running in DEMO MODE - calls are simulated');
      logger.info('[PhoneBot] To enable real calls, add TELNYX_API_KEY (recommended) or TWILIO credentials');
    } else {
      logger.info(`[PhoneBot] Using ${this.phoneProvider.toUpperCase()} for phone calls`);
      logger.info(`[PhoneBot] Using ${this.llmProvider.toUpperCase()} for AI responses`);
    }
  }

  /**
   * Initialize phone client based on provider
   */
  private getPhoneClient() {
    if (this.phoneProvider === 'telnyx') {
      // Telnyx is 50% cheaper than Twilio
      return { provider: 'telnyx', apiKey: TELNYX_API_KEY };
    } else if (this.phoneProvider === 'twilio') {
      const Twilio = require('twilio');
      return { provider: 'twilio', client: new Twilio(TWILIO_SID, TWILIO_TOKEN) };
    }
    return null;
  }

  /**
   * Initialize Twilio client (legacy support)
   */
  private getTwilioClient() {
    if (this.phoneProvider !== 'twilio') {
      return null;
    }
    const Twilio = require('twilio');
    return new Twilio(TWILIO_SID, TWILIO_TOKEN);
  }

  /**
   * Start an outbound call (real or simulated)
   * Supports: Telnyx (recommended, 50% cheaper) or Twilio
   */
  async startCall(to: string, script: string, caseId?: string): Promise<CallResult> {
    // Generate a call ID (real or simulated)
    const callSid = this.demoMode
      ? `DEMO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      : undefined;

    try {
      let finalCallSid = callSid;

      if (!this.demoMode) {
        if (this.phoneProvider === 'telnyx') {
          // Telnyx call (50% cheaper than Twilio)
          const response = await fetch('https://api.telnyx.com/v2/calls', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${TELNYX_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              connection_id: process.env.TELNYX_CONNECTION_ID,
              to,
              from: TELNYX_NUMBER,
              webhook_url: `${process.env.API_BASE_URL}/api/phone/webhook`,
              record: 'record-from-answer',
            }),
          });

          if (!response.ok) {
            throw new Error(`Telnyx API error: ${response.status}`);
          }

          const data: any = await response.json();
          finalCallSid = data.data?.call_control_id || `TELNYX_${Date.now()}`;
        } else {
          // Twilio call (legacy)
          const twilio = this.getTwilioClient();
          const call = await twilio.calls.create({
            to,
            from: TWILIO_NUMBER,
            url: `${process.env.API_BASE_URL}/api/phone/webhook`,
            statusCallback: `${process.env.API_BASE_URL}/api/phone/status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            record: true,
            recordingStatusCallback: `${process.env.API_BASE_URL}/api/phone/recording`,
          });
          finalCallSid = call.sid;
        }
      }

      // Log call in database (works for both real and demo)
      try {
        if (caseId) {
          const caseRecord = await prisma.case.findUnique({ where: { id: caseId }, select: { clientId: true } });
          await prisma.communication.create({
            data: {
              caseId,
              userId: caseRecord?.clientId || '',
              type: 'CALL',
              direction: 'OUTBOUND',
              subject: 'AI Outreach Call',
              content: script,
              metadata: {
                callSid: finalCallSid,
                demoMode: this.demoMode,
                to,
                timestamp: new Date().toISOString(),
                status: this.demoMode ? 'DEMO_SIMULATED' : 'INITIATED',
              },
            },
          });
        }
      } catch (dbError) {
        // Database might not be available in dev
        logger.warn('Could not log call to database', { error: (dbError as Error).message });
      }

      logger.info('Call initiated', {
        callSid: finalCallSid,
        to,
        demoMode: this.demoMode
      });

      // In demo mode, simulate call completion after 2 seconds
      if (this.demoMode) {
        setTimeout(() => {
          logger.info('Demo call completed', { callSid: finalCallSid });
        }, 2000);
      }

      return { success: true, callSid: finalCallSid };
    } catch (error: any) {
      logger.error('Failed to start call', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if service is in demo mode
   */
  isDemoMode(): boolean {
    return this.demoMode;
  }

  /**
   * Get service status
   */
  getStatus(): { configured: boolean; mode: string; phoneProvider: string; llmProvider: string } {
    return {
      configured: this.isConfigured,
      mode: this.demoMode ? 'demo' : 'live',
      phoneProvider: this.phoneProvider,
      llmProvider: this.llmProvider,
    };
  }

  /**
   * Handle inbound call webhook
   */
  async handleInboundCall(callSid: string, from: string): Promise<string> {
    try {
      // Generate TwiML response
      const greeting = await this.generateVoiceResponse(
        'Hello, thank you for calling MGR Capital. How may I assist you today?',
        'lawyer-female'
      );

      // Log inbound call (find a case/user if possible, or skip logging)
      // Note: caseId and userId are required for Communication model

      return `
        <Response>
          <Say voice="Polly.Joanna">${greeting}</Say>
          <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/phone/process-speech">
            <Say>Please tell me how I can help you.</Say>
          </Gather>
        </Response>
      `.trim();
    } catch (error: any) {
      logger.error('Failed to handle inbound call', { error: error.message });
      return '<Response><Say>We are experiencing technical difficulties. Please call back later.</Say></Response>';
    }
  }

  /**
   * Process speech input and generate AI response
   */
  async processSpeech(speechResult: string, callSid: string): Promise<string> {
    try {
      // Use OpenAI to generate conversational response
      const aiResponse = await this.generateConversationalResponse(speechResult);

      // Generate voice audio
      const voiceResponse = await this.generateVoiceResponse(aiResponse, 'lawyer-female');

      return `
        <Response>
          <Say voice="Polly.Joanna">${aiResponse}</Say>
          <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/phone/process-speech">
            <Say>Is there anything else I can help you with?</Say>
          </Gather>
        </Response>
      `.trim();
    } catch (error: any) {
      logger.error('Failed to process speech', { error: error.message });
      return '<Response><Say>I apologize, I did not understand. Could you please repeat that?</Say></Response>';
    }
  }

  /**
   * Generate conversational response using AI
   * Supports: DeepSeek (95% cheaper), Gemini, or OpenAI
   */
  async generateConversationalResponse(userInput: string): Promise<string> {
    const systemPrompt = `You are a friendly representative for MGR Capital Assistant, a fund recovery assistance firm.
You help property owners recover unclaimed funds from property matters.
Keep responses short (under 60 words) — this is a phone conversation.

ABSOLUTE RULES:
- NEVER say dollar amounts or surplus figures
- NEVER say "surplus" — say "unclaimed funds" or "funds from a property matter"
- NEVER reveal fee percentages — say "no upfront cost, we only get paid if we recover your funds"
- NEVER say "contingency" — say "no cost to you unless we're successful"
- NEVER discuss other clients or how many cases you handle
- If asked how much: "The exact amount is determined during the recovery process."
- If asked about fees: "There's zero cost to you upfront. We handle everything."
- If they think it's a scam: "These funds are held by the county — public record you can verify."

TONE: Casual, warm, direct. Like a helpful neighbor. Not corporate. Not salesy.`;

    // Try DeepSeek first (95% cheaper than OpenAI)
    if (DEEPSEEK_API_KEY) {
      try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userInput },
            ],
            max_tokens: 150,
            temperature: 0.7,
          }),
        });

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      } catch (error: any) {
        logger.warn('DeepSeek API error, trying fallback', { error: error.message });
      }
    }

    // Try Gemini (Google AI) as second option
    if (GOOGLE_AI_KEY) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_AI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${userInput}` }] }],
              generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
            }),
          }
        );

        const data: any = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) return content;
      } catch (error: any) {
        logger.warn('Gemini API error, trying fallback', { error: error.message });
      }
    }

    // Try OpenAI as third option
    if (OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini', // Using mini for cost savings
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userInput },
            ],
            max_tokens: 150,
            temperature: 0.7,
          }),
        });

        const data: any = await response.json();
        return data.choices?.[0]?.message?.content || 'I understand. How else may I assist you?';
      } catch (error: any) {
        logger.error('OpenAI API error', { error: error.message });
      }
    }

    // Scripted fallback (no API needed)
    return 'I understand. Let me connect you with a representative who can better assist you.';
  }

  /**
   * Generate voice audio using ElevenLabs
   */
  async generateVoiceResponse(text: string, voice: string = 'lawyer-male'): Promise<Buffer | string> {
    if (!ELEVENLABS_API_KEY) {
      return text; // Fallback to text if no API key
    }

    const voiceConfig = VOICE_PRESETS[voice] || VOICE_PRESETS['lawyer-male'];

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
    } catch (error: any) {
      logger.error('ElevenLabs API error', { error: error.message });
      return text;
    }
  }

  /**
   * Transcribe call recording
   */
  async transcribeCall(callSid: string): Promise<TranscriptResult> {
    try {
      const twilio = this.getTwilioClient();
      const recordings = await twilio.calls(callSid).recordings.list({ limit: 1 });

      if (recordings.length === 0) {
        return { text: '', status: 'in_progress' };
      }

      const recordingUrl = `https://api.twilio.com${recordings[0].uri.replace('.json', '.mp3')}`;

      // Use OpenAI Whisper for transcription
      if (!OPENAI_API_KEY) {
        return { text: 'Transcription not available', status: 'failed' };
      }

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: new URLSearchParams({
          file: recordingUrl,
          model: 'whisper-1',
        }),
      });

      const data: any = await response.json();
      const text = data.text || '';

      // Analyze sentiment
      const sentiment = await this.analyzeSentiment(text);

      return {
        text,
        status: 'completed',
        sentiment: sentiment.sentiment,
        confidence: sentiment.confidence,
      };
    } catch (error: any) {
      logger.error('Transcription failed', { error: error.message });
      return { text: '', status: 'failed' };
    }
  }

  /**
   * Analyze call sentiment
   */
  async analyzeSentiment(text: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
    if (!OPENAI_API_KEY || !text) {
      return { sentiment: 'neutral', confidence: 0 };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'Analyze the sentiment of the following call transcript. Respond with JSON: {"sentiment": "positive"|"negative"|"neutral", "confidence": 0-1}',
            },
            { role: 'user', content: text },
          ],
          max_tokens: 50,
        }),
      });

      const data: any = await response.json();
      const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');

      return {
        sentiment: result.sentiment || 'neutral',
        confidence: result.confidence || 0.5,
      };
    } catch (error: any) {
      logger.error('Sentiment analysis failed', { error: error.message });
      return { sentiment: 'neutral', confidence: 0 };
    }
  }

  /**
   * Schedule follow-up call
   */
  async scheduleFollowUp(caseId: string, phoneNumber: string, scheduledAt: Date): Promise<boolean> {
    try {
      await prisma.deadline.create({
        data: {
          caseId,
          title: 'FOLLOWUP_CALL',
          dueDate: scheduledAt,
          reminderSent: false,
          description: `Scheduled follow-up call to ${phoneNumber}`,
        },
      });

      logger.info('Follow-up scheduled', { caseId, scheduledAt });
      return true;
    } catch (error: any) {
      logger.error('Failed to schedule follow-up', { error: error.message });
      return false;
    }
  }

  /**
   * Get call logs for a case
   */
  async getCallLogs(caseId: string): Promise<any[]> {
    try {
      const logs = await prisma.communication.findMany({
        where: {
          caseId,
          type: 'CALL',
        },
        orderBy: { createdAt: 'desc' },
      });

      return logs.map(log => ({
        id: log.id,
        type: log.type,
        direction: log.direction,
        createdAt: log.createdAt,
        metadata: log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : {},
      }));
    } catch (error: any) {
      logger.error('Failed to get call logs', { error: error.message });
      return [];
    }
  }

  /**
   * Get all recent call logs (across all cases)
   */
  async getAllRecentCalls(limit: number = 50): Promise<any[]> {
    try {
      const logs = await prisma.communication.findMany({
        where: {
          type: 'CALL',
        },
        include: {
          case: {
            select: {
              internalCode: true,
              propertyAddress: true,
              client: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return logs.map(log => ({
        id: log.id,
        type: log.type,
        direction: log.direction,
        caseId: log.caseId,
        caseCode: log.case?.internalCode,
        clientName: log.case?.client?.name,
        property: log.case?.propertyAddress,
        createdAt: log.createdAt,
        metadata: log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : {},
      }));
    } catch (error: any) {
      logger.error('Failed to get all call logs', { error: error.message });
      return [];
    }
  }

  /**
   * Get available scripts
   */
  getScripts(): Record<string, string> {
    return { ...CALL_SCRIPTS };
  }

  /**
   * Get available voices
   */
  getVoices(): VoiceConfig[] {
    return Object.values(VOICE_PRESETS);
  }
}

export const phoneBotService = new PhoneBotService();
