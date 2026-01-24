"use client";

import { useState, useRef } from "react";
import { Mic, MicOff, Loader2, Volume2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function VoiceAiButton() {
  const { user, accessToken } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await sendAudioToBackend(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info("Recording... Speak now", {
        description: "Click the button again to stop recording.",
      });
    } catch (err) {
      toast.error("Microphone access denied", {
        description: "Please allow microphone access to use voice features.",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioToBackend = async (audioBlob: Blob) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice.webm");

      // Step 1: Speech-to-Text
      const sttRes = await fetch(`${API_URL}/api/voice/stt`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!sttRes.ok) throw new Error("STT failed");
      const sttData = await sttRes.json();
      const text = sttData.transcript;
      setTranscript(text);

      // Step 2: Send to AI agent for processing
      const aiRes = await fetch(`${API_URL}/api/ai/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          task: "voice_query",
          context: { query: text, userId: user?.id },
        }),
      });

      if (!aiRes.ok) throw new Error("AI processing failed");
      const aiData = await aiRes.json();
      setResponse(aiData.response || aiData.result || "No response generated");

      // Step 3: Text-to-Speech for response
      const ttsRes = await fetch(`${API_URL}/api/voice/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text: aiData.response || aiData.result }),
      });

      if (ttsRes.ok) {
        const audioData = await ttsRes.blob();
        const audioUrl = URL.createObjectURL(audioData);
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onplay = () => setIsPlaying(true);
        audioRef.current.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        audioRef.current.play();
      }
    } catch (err) {
      console.error("Voice processing error:", err);
      toast.error("Voice processing failed", {
        description: "Please try again or check your connection.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsOpen(false);
    setTranscript("");
    setResponse("");
    setIsPlaying(false);
  };

  // Only show for logged-in users
  if (!user) return null;

  return (
    <>
      {/* Floating Voice Button */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 shadow-2xl hover:scale-110 transition-transform hover:shadow-blue-500/50"
          size="icon"
          title="Voice AI Assistant"
        >
          <Mic className="h-6 w-6 text-white" />
        </Button>
      </motion.div>

      {/* Voice AI Dialog */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Mic className="h-4 w-4 text-white" />
              </div>
              Voice AI Assistant
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Recording Button */}
            <div className="flex justify-center">
              <motion.div
                animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Button
                  variant={isRecording ? "destructive" : "default"}
                  size="lg"
                  className={`h-24 w-24 rounded-full transition-all ${
                    isRecording
                      ? "bg-red-500 hover:bg-red-600 animate-pulse"
                      : "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  }`}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={loading}
                >
                  {isRecording ? (
                    <MicOff className="h-12 w-12 text-white" />
                  ) : (
                    <Mic className="h-12 w-12 text-white" />
                  )}
                </Button>
              </motion.div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {isRecording
                ? "Recording... Click to stop"
                : loading
                ? "Processing your voice..."
                : "Click the microphone to start speaking"}
            </p>

            {/* Loading State */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Transcript */}
            <AnimatePresence>
              {transcript && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-lg bg-muted p-4"
                >
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    You said:
                  </p>
                  <p className="text-foreground">{transcript}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI Response */}
            <AnimatePresence>
              {response && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 p-4 border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      AI Response:
                    </p>
                    {isPlaying && (
                      <Volume2 className="h-4 w-4 text-blue-600 animate-pulse" />
                    )}
                  </div>
                  <p className="text-foreground">{response}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default VoiceAiButton;
