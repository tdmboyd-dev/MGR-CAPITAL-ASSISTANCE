/**
 * PhoneBotService.ts — MGR CAPITAL ASSISTANCE
 * AI Phone Bot with Twilio + ElevenLabs + OpenAI
 * ADVANCED: Multi-language, sentiment analysis, call recording, auto-followup
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

// API configurations
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_NUMBER;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

const CALL_SCRIPTS = {
  initial_outreach: `
Hello, this is a representative from MGR Capital calling regarding an important financial matter.
Our records show that you may be entitled to unclaimed surplus funds from a recent property tax sale.
This is not a sales call - we're reaching out because these funds legally belong to you.
Would you have a few minutes to discuss this?
  `.trim(),
  follow_up: `
Hello, I'm following up on our previous conversation about your unclaimed surplus funds.
Have you had a chance to review the documents we sent?
I'm here to answer any questions you might have.
  `.trim(),
  closing: `
Thank you for your time today. We'll send you the necessary paperwork via email.
Once signed, we'll begin the recovery process on your behalf.
You can expect to hear from us within 5-7 business days.
Have a great day!
  `.trim(),
};

export class PhoneBotService {
  /**
   * Initialize Twilio client
   */
  private getTwilioClient() {
    if (!TWILIO_SID || !TWILIO_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }
    // Dynamic import for Twilio
    const Twilio = require('twilio');
    return new Twilio(TWILIO_SID, TWILIO_TOKEN);
  }

  /**
   * Start an outbound call
   */
  async startCall(to: string, script: string, caseId?: string): Promise<CallResult> {
    try {
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

      // Log call in database
      await prisma.communication.create({
        data: {
          caseId,
          type: 'PHONE_OUTBOUND',
          direction: 'OUTBOUND',
          status: 'INITIATED',
          subject: 'AI Outreach Call',
          content: script,
          metadata: JSON.stringify({ callSid: call.sid }),
        },
      });

      logger.info('Call initiated', { callSid: call.sid, to });

      return { success: true, callSid: call.sid };
    } catch (error: any) {
      logger.error('Failed to start call', { error: error.message });
      return { success: false, error: error.message };
    }
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

      // Log inbound call
      await prisma.communication.create({
        data: {
          type: 'PHONE_INBOUND',
          direction: 'INBOUND',
          status: 'ANSWERED',
          subject: 'Inbound Call',
          content: `Call from ${from}`,
          metadata: JSON.stringify({ callSid }),
        },
      });

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
   * Generate conversational response using OpenAI
   */
  async generateConversationalResponse(userInput: string): Promise<string> {
    if (!OPENAI_API_KEY) {
      return 'I understand. Let me connect you with a representative who can better assist you.';
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
              content: `You are a professional representative for MGR Capital, a surplus fund recovery company.
You help property owners recover unclaimed funds from tax sales.
Be professional, empathetic, and informative.
Keep responses concise (under 100 words) for phone conversations.
Never discuss specific amounts over the phone.
If asked about fees, explain we work on contingency (no upfront costs).`,
            },
            { role: 'user', content: userInput },
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'I understand. How else may I assist you?';
    } catch (error: any) {
      logger.error('OpenAI API error', { error: error.message });
      return 'I understand. Let me make a note of that for our team.';
    }
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

      const data = await response.json();
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

      const data = await response.json();
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
      await prisma.caseDeadline.create({
        data: {
          caseId,
          deadlineType: 'FOLLOWUP_CALL',
          dueDate: scheduledAt,
          reminderSent: false,
          notes: `Scheduled follow-up call to ${phoneNumber}`,
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
          type: { in: ['PHONE_INBOUND', 'PHONE_OUTBOUND'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      return logs.map(log => ({
        id: log.id,
        type: log.type,
        direction: log.direction,
        status: log.status,
        createdAt: log.createdAt,
        metadata: log.metadata ? JSON.parse(log.metadata as string) : {},
      }));
    } catch (error: any) {
      logger.error('Failed to get call logs', { error: error.message });
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
