'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Mic, CheckCircle, AlertCircle, Loader2, Shield, Volume2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface VoiceBiometricsProps {
  userId?: string
  onVerified?: (success: boolean) => void
}

export default function VoiceBiometrics({ userId, onVerified }: VoiceBiometricsProps) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [verified, setVerified] = useState<boolean | null>(null)
  const [progress, setProgress] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [enrollmentMode, setEnrollmentMode] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Set up audio context for visualization
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      // Visualize audio level
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(average)
        }
        animationFrameRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()

      // Set up media recorder
      mediaRecorderRef.current = new MediaRecorder(stream)
      const chunks: Blob[] = []

      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data)

      mediaRecorderRef.current.onstop = async () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        stream.getTracks().forEach(track => track.stop())

        const blob = new Blob(chunks, { type: 'audio/wav' })
        await processVoiceSample(blob)
      }

      mediaRecorderRef.current.start()
      setRecording(true)
      setVerified(null)

      // Progress bar
      let p = 0
      const interval = setInterval(() => {
        p += 2
        setProgress(p)
        if (p >= 100) {
          clearInterval(interval)
          mediaRecorderRef.current?.stop()
          setRecording(false)
        }
      }, 100)

    } catch (error) {
      console.error('Microphone access error:', error)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const processVoiceSample = async (blob: Blob) => {
    setProcessing(true)

    try {
      // Convert blob to array buffer
      const arrayBuffer = await blob.arrayBuffer()

      // In production, this would:
      // 1. Extract MFCC features from audio
      // 2. Compare against stored voiceprint
      // 3. Use ML model for verification

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Simulated verification (demo purposes)
      // In real implementation, compare voice features against enrolled voiceprint
      const isVerified = Math.random() > 0.3 // 70% success rate for demo

      setVerified(isVerified)
      onVerified?.(isVerified)

    } catch (error) {
      console.error('Voice processing error:', error)
      setVerified(false)
    }

    setProcessing(false)
    setProgress(0)
    setAudioLevel(0)
  }

  const enrollVoice = async () => {
    setEnrollmentMode(true)
    // In production, this would collect multiple voice samples
    // and create a voiceprint for the user
    await startRecording()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-400" />
            Voice Biometrics Verification
          </CardTitle>
          <CardDescription className="text-slate-400">
            Verify client identity using AI-powered voice recognition
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Audio Level Visualization */}
          <div className="relative h-24 bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
            {recording && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-end gap-1 h-16">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-2 bg-purple-500 rounded-full"
                      animate={{
                        height: recording
                          ? Math.max(8, (audioLevel / 255) * 64 * (0.5 + Math.random() * 0.5))
                          : 8
                      }}
                      transition={{ duration: 0.1 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {!recording && !processing && (
              <div className="text-slate-500 flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                <span>Click to start voice verification</span>
              </div>
            )}

            {processing && (
              <div className="flex items-center gap-3 text-purple-400">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Analyzing voice biometrics...</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {recording && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Recording voice sample...</span>
                <span>{Math.round(progress / 20)}s / 5s</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={startRecording}
              disabled={recording || processing}
              className={`flex-1 ${recording ? 'bg-red-600' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              <Mic className={`h-4 w-4 mr-2 ${recording ? 'animate-pulse' : ''}`} />
              {recording ? 'Recording (5s)' : 'Verify Identity'}
            </Button>

            <Button
              onClick={enrollVoice}
              disabled={recording || processing}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Enroll New Voice
            </Button>
          </div>

          {/* Verification Result */}
          {verified !== null && !recording && !processing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-4 rounded-lg flex items-center gap-3 ${
                verified
                  ? 'bg-green-900/30 border border-green-700'
                  : 'bg-red-900/30 border border-red-700'
              }`}
            >
              {verified ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-400" />
                  <div>
                    <p className="font-medium text-green-300">Identity Verified</p>
                    <p className="text-sm text-green-400/70">Voice matches registered biometrics</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-red-400" />
                  <div>
                    <p className="font-medium text-red-300">Verification Failed</p>
                    <p className="text-sm text-red-400/70">Voice does not match - please try again</p>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Info Note */}
          <div className="text-xs text-slate-500 border-t border-slate-700 pt-4">
            <p>Voice biometrics uses AI to analyze unique vocal characteristics including:</p>
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li>Vocal tract shape and resonance</li>
              <li>Speech patterns and cadence</li>
              <li>Frequency distribution (MFCC features)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
