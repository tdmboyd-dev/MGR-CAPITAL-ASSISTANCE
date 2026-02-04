import { logger } from "../utils/logger.js";

interface STTResult {
  transcript: string;
  confidence?: number;
}

interface TTSResult {
  audio: Buffer;
  format: string;
}

// API Keys - Cloud AI providers only (no ElevenLabs)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

/**
 * VoiceService - Handles Speech-to-Text (STT) and Text-to-Speech (TTS)
 * Supports multiple providers with automatic fallback:
 * - STT: Deepgram (best value), OpenAI Whisper, or browser-based
 * - TTS: Browser-based Web Speech API (FREE)
 * - AI: DeepSeek (95% cheaper), Gemini, OpenAI, or Ollama
 */
export class VoiceService {
  private ollamaUrl: string;

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    logger.info('[VoiceService] Initialized with providers:', {
      stt: DEEPGRAM_API_KEY ? 'Deepgram' : (OPENAI_API_KEY ? 'OpenAI Whisper' : 'Demo mode'),
      tts: 'Browser Web Speech API (FREE)',
      ai: DEEPSEEK_API_KEY ? 'DeepSeek' : (GOOGLE_AI_KEY ? 'Gemini' : 'Ollama'),
    });
  }

  /**
   * Speech-to-Text: Convert audio buffer to text
   * Uses Deepgram (best value) or OpenAI Whisper if available
   */
  async stt(audioBuffer: Buffer): Promise<STTResult> {
    try {
      logger.info("[VoiceService] STT: Processing audio buffer of size:", { size: audioBuffer.length });

      // Try Deepgram first (best value - $0.0043/min)
      if (DEEPGRAM_API_KEY && audioBuffer.length > 1000) {
        try {
          const result = await this.deepgramSTT(audioBuffer);
          if (result.transcript) return result;
        } catch (e) {
          logger.warn('[VoiceService] Deepgram STT failed, trying Whisper');
        }
      }

      // Try OpenAI Whisper as backup
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
   * Deepgram STT implementation (best value - $0.0043/min)
   */
  private async deepgramSTT(audioBuffer: Buffer): Promise<STTResult> {
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.status}`);
    }

    const data: any = await response.json();
    return {
      transcript: data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '',
      confidence: data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0.9,
    };
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
   * Returns empty buffer - frontend uses Web Speech API (FREE)
   */
  async tts(text: string): Promise<TTSResult> {
    try {
      logger.info("[VoiceService] TTS: Using browser Web Speech API (FREE)", { text: text.substring(0, 50) });

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
   * Process voice query through AI agent
   * Uses DeepSeek (cheapest), Gemini, OpenAI, or Ollama
   */
  async processVoiceQuery(transcript: string, userId?: string): Promise<string> {
    const systemPrompt = `You are a helpful voice assistant for MGR Capital Assistant, a sovereign surplus and tax sale recovery platform.
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
      stt: DEEPGRAM_API_KEY ? 'deepgram' : (OPENAI_API_KEY ? 'whisper' : 'demo'),
      tts: 'browser', // Always browser-based (FREE)
      ai: aiProvider,
    };
  }
}

export const voiceService = new VoiceService();
