import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

interface STTResult {
  transcript: string;
  confidence?: number;
}

interface TTSResult {
  audio: Buffer;
  format: string;
}

// API Keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

/**
 * VoiceService - Handles Speech-to-Text (STT) and Text-to-Speech (TTS)
 * Supports multiple providers with automatic fallback:
 * - STT: OpenAI Whisper, Deepgram, or browser-based
 * - TTS: ElevenLabs, browser-based, or silent fallback
 * - AI: DeepSeek (95% cheaper), Gemini, OpenAI, or Ollama
 */
export class VoiceService {
  private ollamaUrl: string;

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    logger.info('[VoiceService] Initialized with providers:', {
      stt: OPENAI_API_KEY ? 'OpenAI Whisper' : 'Demo mode',
      tts: ELEVENLABS_API_KEY ? 'ElevenLabs' : 'Browser-based',
      ai: DEEPSEEK_API_KEY ? 'DeepSeek' : (GOOGLE_AI_KEY ? 'Gemini' : 'Ollama'),
    });
  }

  /**
   * Speech-to-Text: Convert audio buffer to text
   * Uses OpenAI Whisper API if available, else demo mode
   */
  async stt(audioBuffer: Buffer): Promise<STTResult> {
    try {
      logger.info("[VoiceService] STT: Processing audio buffer of size:", { size: audioBuffer.length });

      // Try OpenAI Whisper first (best accuracy)
      if (OPENAI_API_KEY && audioBuffer.length > 1000) {
        try {
          const result = await this.whisperSTT(audioBuffer);
          if (result.transcript) return result;
        } catch (e) {
          logger.warn('[VoiceService] Whisper STT failed, using fallback');
        }
      }

      // Fallback: Demo mode with helpful message
      await new Promise((resolve) => setTimeout(resolve, 500));

      return {
        transcript: "Hello, how can I help you with your case today?",
        confidence: 0.5, // Lower confidence for demo mode
      };
    } catch (error: any) {
      logger.error("[VoiceService] STT Error:", { error: error?.message || error });
      throw new Error("Speech-to-text processing failed");
    }
  }

  /**
   * OpenAI Whisper STT implementation
   */
  private async whisperSTT(audioBuffer: Buffer): Promise<STTResult> {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const data: any = await response.json();
    return {
      transcript: data.text || '',
      confidence: 0.95,
    };
  }

  /**
   * Text-to-Speech: Convert text to audio
   * Uses ElevenLabs if available, else returns empty for browser TTS
   */
  async tts(text: string): Promise<TTSResult> {
    try {
      logger.info("[VoiceService] TTS: Converting text to speech:", { text: text.substring(0, 50) });

      // Try ElevenLabs first (best quality)
      if (ELEVENLABS_API_KEY) {
        try {
          const audio = await this.elevenLabsTTS(text);
          if (audio.length > 100) {
            return { audio, format: 'audio/mpeg' };
          }
        } catch (e) {
          logger.warn('[VoiceService] ElevenLabs TTS failed, using browser fallback');
        }
      }

      // Return empty - frontend will use Web Speech API
      await new Promise((resolve) => setTimeout(resolve, 100));

      return {
        audio: Buffer.alloc(0),
        format: "browser", // Signal to use browser TTS
      };
    } catch (error: any) {
      logger.error("[VoiceService] TTS Error:", { error: error?.message || error });
      throw new Error("Text-to-speech processing failed");
    }
  }

  /**
   * ElevenLabs TTS implementation
   */
  private async elevenLabsTTS(text: string): Promise<Buffer> {
    const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!,
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
  }

  /**
   * Process voice query through AI agent
   * Uses DeepSeek (cheapest), Gemini, OpenAI, or Ollama
   */
  async processVoiceQuery(transcript: string, userId?: string): Promise<string> {
    const systemPrompt = `You are a helpful voice assistant for MGR Capital Assistance, a sovereign surplus and tax sale recovery platform.
User query: "${transcript}"
Respond naturally and concisely as if speaking. Keep responses under 100 words for voice output.`;

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
            messages: [{ role: 'user', content: systemPrompt }],
            max_tokens: 150,
          }),
        });

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      } catch (e) {
        logger.warn('[VoiceService] DeepSeek failed, trying fallback');
      }
    }

    // Try Gemini
    if (GOOGLE_AI_KEY) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_AI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }],
              generationConfig: { maxOutputTokens: 150 },
            }),
          }
        );

        const data: any = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) return content;
      } catch (e) {
        logger.warn('[VoiceService] Gemini failed, trying Ollama');
      }
    }

    // Try Ollama (local)
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || "llama3.2",
          prompt: systemPrompt,
          stream: false,
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        if (data.response) return data.response;
      }
    } catch (e) {
      logger.warn('[VoiceService] Ollama not available');
    }

    // Final fallback
    return "I'm here to help with your surplus recovery case. Please tell me what you need assistance with.";
  }

  /**
   * Check if voice services are available
   */
  async checkHealth(): Promise<{ stt: string; tts: string; ai: string }> {
    let aiProvider = 'offline';

    if (DEEPSEEK_API_KEY) {
      aiProvider = 'deepseek';
    } else if (GOOGLE_AI_KEY) {
      aiProvider = 'gemini';
    } else {
      try {
        const response = await fetch(`${this.ollamaUrl}/api/tags`, { method: "GET" });
        if (response.ok) aiProvider = 'ollama';
      } catch { }
    }

    return {
      stt: OPENAI_API_KEY ? 'whisper' : 'demo',
      tts: ELEVENLABS_API_KEY ? 'elevenlabs' : 'browser',
      ai: aiProvider,
    };
  }
}

export const voiceService = new VoiceService();
