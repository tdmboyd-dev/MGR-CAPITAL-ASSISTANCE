import { Router, Request, Response } from "express";
import multer from "multer";
import { voiceService } from "../services/VoiceService";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

/**
 * POST /api/voice/stt
 * Speech-to-Text: Convert uploaded audio to text
 */
router.post(
  "/stt",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      const audioBuffer = req.file.buffer;
      console.log(`[Voice] STT request - File size: ${audioBuffer.length} bytes`);

      const result = await voiceService.stt(audioBuffer);

      res.json({
        success: true,
        transcript: result.transcript,
        confidence: result.confidence,
      });
    } catch (error) {
      console.error("[Voice] STT Error:", error);
      res.status(500).json({
        success: false,
        error: "Speech-to-text processing failed",
      });
    }
  }
);

/**
 * POST /api/voice/tts
 * Text-to-Speech: Convert text to audio
 */
router.post(
  "/tts",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { text } = req.body;

      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "Text is required" });
        return;
      }

      if (text.length > 5000) {
        res.status(400).json({ error: "Text too long (max 5000 characters)" });
        return;
      }

      console.log(`[Voice] TTS request - Text length: ${text.length}`);

      const result = await voiceService.tts(text);

      res.set({
        "Content-Type": result.format,
        "Content-Length": result.audio.length,
        "Cache-Control": "no-cache",
      });

      res.send(result.audio);
    } catch (error) {
      console.error("[Voice] TTS Error:", error);
      res.status(500).json({
        success: false,
        error: "Text-to-speech processing failed",
      });
    }
  }
);

/**
 * POST /api/voice/process
 * Full voice pipeline: STT -> AI Processing -> TTS
 */
router.post(
  "/process",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      const audioBuffer = req.file.buffer;
      const userId = (req as any).user?.id;

      // Step 1: Speech-to-Text
      const sttResult = await voiceService.stt(audioBuffer);
      console.log(`[Voice] Transcript: "${sttResult.transcript}"`);

      // Step 2: AI Processing
      const aiResponse = await voiceService.processVoiceQuery(
        sttResult.transcript,
        userId
      );
      console.log(`[Voice] AI Response: "${aiResponse.substring(0, 50)}..."`);

      // Step 3: Text-to-Speech
      const ttsResult = await voiceService.tts(aiResponse);

      res.json({
        success: true,
        transcript: sttResult.transcript,
        response: aiResponse,
        audioBase64: ttsResult.audio.toString("base64"),
        audioFormat: ttsResult.format,
      });
    } catch (error) {
      console.error("[Voice] Full pipeline error:", error);
      res.status(500).json({
        success: false,
        error: "Voice processing failed",
      });
    }
  }
);

/**
 * GET /api/voice/health
 * Check voice services health
 */
router.get("/health", async (req: Request, res: Response): Promise<void> => {
  try {
    const health = await voiceService.checkHealth();
    res.json({
      success: true,
      services: health,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Health check failed",
    });
  }
});

export default router;
