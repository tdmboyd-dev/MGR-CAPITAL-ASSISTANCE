'use client'

import { Button } from '@/components/ui/button'
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import { AlertCircle,CheckCircle,Loader2,Mic,Shield,UserCheck,Volume2 } from 'lucide-react'
import { useStoredString, writeStoredString } from '@/hooks/useStoredString'
import { z } from 'zod'
import { useCallback,useEffect,useRef,useState } from 'react'
import { toast } from 'sonner'

interface VoiceBiometricsProps {
  userId?: string
  onVerified?: (success: boolean, confidence: number) => void
}

// MFCC Configuration
const MFCC_CONFIG = {
  sampleRate: 16000,
  windowSize: 512,
  hopSize: 256,
  numCoefficients: 13,
  numFilters: 26,
  lowFreq: 300,
  highFreq: 8000
}

/**
 * Experimental local audio comparison; never identity or action authority
 *
 * How it works:
 * 1. Records 5 seconds of audio
 * 2. Extracts approximate audio features; no validated speaker model features
 * 3. Compares against stored voiceprint using cosine similarity
 * 4. Returns confidence score
 */
export default function VoiceBiometrics(props: VoiceBiometricsProps) {
  return <VoiceSampleSession key={props.userId ?? 'default'} {...props} />
}

function VoiceSampleSession({ userId, onVerified }: VoiceBiometricsProps) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [verified, setVerified] = useState<boolean | null>(null)
  const [confidence, setConfidence] = useState<number>(0)
  const [progress, setProgress] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [enrollmentMode, setEnrollmentMode] = useState(false)
  const storageKey = `voiceprint_${userId || 'default'}`
  const rawVoiceprint = useStoredString(storageKey)
  const hasVoiceprint = Boolean(rawVoiceprint)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const streamRef = useRef<MediaStream | null>(null)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const disposedRef = useRef(false)

  useEffect(() => {
    disposedRef.current = false
    return () => {
      disposedRef.current = true
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
      if (mediaRecorderRef.current) mediaRecorderRef.current.onstop = null
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  /**
   * Extract MFCC features from audio buffer
   * Approximate local features without a validated speaker-verification model
   */
  const extractMFCC = useCallback(async (audioBuffer: AudioBuffer): Promise<number[]> => {
    const channelData = audioBuffer.getChannelData(0)
    if (channelData.length < MFCC_CONFIG.windowSize) throw new Error('Audio sample is too short')

    // Resample to target sample rate if needed
    const resampledData = channelData // In production, resample to 16kHz

    // Apply pre-emphasis filter
    const preEmphasized = new Float32Array(resampledData.length)
    preEmphasized[0] = resampledData[0]
    for (let i = 1; i < resampledData.length; i++) {
      preEmphasized[i] = resampledData[i] - 0.97 * resampledData[i - 1]
    }

    // Frame the signal
    const frameLength = MFCC_CONFIG.windowSize
    const frameStep = MFCC_CONFIG.hopSize
    const numFrames = Math.floor((preEmphasized.length - frameLength) / frameStep) + 1

    // Hamming window
    const hammingWindow = new Float32Array(frameLength)
    for (let i = 0; i < frameLength; i++) {
      hammingWindow[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (frameLength - 1))
    }

    // Calculate power spectrum for each frame
    const mfccFeatures: number[][] = []

    for (let frame = 0; frame < Math.min(numFrames, 100); frame++) { // Limit frames for performance
      const start = frame * frameStep
      const frameData = new Float32Array(frameLength)

      // Apply window
      for (let i = 0; i < frameLength; i++) {
        frameData[i] = preEmphasized[start + i] * hammingWindow[i]
      }

      // Simple power calculation (simplified FFT)
      let power = 0
      for (let i = 0; i < frameLength; i++) {
        power += frameData[i] * frameData[i]
      }
      power = Math.log(power + 1e-10)

      // Generate MFCC-like features (simplified)
      const coefficients: number[] = []
      for (let c = 0; c < MFCC_CONFIG.numCoefficients; c++) {
        let sum = 0
        for (let i = 0; i < frameLength; i++) {
          sum += frameData[i] * Math.cos((Math.PI * c * (2 * i + 1)) / (2 * frameLength))
        }
        coefficients.push(sum / frameLength)
      }

      mfccFeatures.push(coefficients)
    }

    // Average across frames to get a single feature vector
    const avgFeatures = new Array(MFCC_CONFIG.numCoefficients).fill(0)
    for (const frame of mfccFeatures) {
      for (let i = 0; i < frame.length; i++) {
        avgFeatures[i] += frame[i]
      }
    }
    for (let i = 0; i < avgFeatures.length; i++) {
      avgFeatures[i] /= mfccFeatures.length
    }

    // Add delta features (first derivative)
    const deltaFeatures: number[] = []
    for (let i = 1; i < avgFeatures.length - 1; i++) {
      deltaFeatures.push((avgFeatures[i + 1] - avgFeatures[i - 1]) / 2)
    }

    return [...avgFeatures, ...deltaFeatures]
  }, [])

  /**
   * Calculate cosine similarity between two feature vectors
   */
  const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length) {
      // Pad shorter array
      const maxLen = Math.max(a.length, b.length)
      while (a.length < maxLen) a.push(0)
      while (b.length < maxLen) b.push(0)
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Start recording audio
   */
  const startRecording = async (isEnrollment = false) => {
    if (recording || processing) return
    setEnrollmentMode(isEnrollment)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: MFCC_CONFIG.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      if (disposedRef.current) { stream.getTracks().forEach(track => track.stop()); return }
      streamRef.current = stream
      // Set up audio context for visualization
      audioContextRef.current = new AudioContext({ sampleRate: MFCC_CONFIG.sampleRate })
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      // Visualize audio level
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      const updateLevel = () => {
        if (analyserRef.current && mediaRecorderRef.current?.state === 'recording') {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(average)
        }
        if (mediaRecorderRef.current?.state === 'recording') {
          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }
      }

      // Set up media recorder
      chunksRef.current = []
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' })

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        stream.getTracks().forEach(track => track.stop())

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (!disposedRef.current) await processVoiceSample(blob, isEnrollment)
      }

      mediaRecorderRef.current.start(100) // Collect data every 100ms
      setRecording(true)
      setVerified(null)
      updateLevel()

      // Progress bar - 5 seconds recording
      let p = 0
      const interval = setInterval(() => {
        p += 2
        setProgress(p)
        if (p >= 100) {
          clearInterval(interval)
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
          }
          setRecording(false)
        }
      }, 100)
      recordTimerRef.current = interval

    } catch (error) {
      console.error('Microphone access error:', error)
      toast.error('Could not access microphone. Please check permissions.')
    }
  }

  /**
   * Process recorded voice sample
   */
  const processVoiceSample = async (blob: Blob, isEnrollment: boolean) => {
    setProcessing(true)

    let audioContext: AudioContext | null = null
    try {
      // Convert blob to audio buffer
      const arrayBuffer = await blob.arrayBuffer()
      audioContext = new AudioContext({ sampleRate: MFCC_CONFIG.sampleRate })
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      // Extract MFCC features
      const features = await extractMFCC(audioBuffer)

      if (disposedRef.current) return
      if (!features.every(Number.isFinite)) throw new Error("Invalid audio features")
      if (isEnrollment) {
        // Store voiceprint
        writeStoredString(storageKey, JSON.stringify(features))
        setEnrollmentMode(false)
        toast.success('Voice enrolled successfully!')
        setVerified(null)
        setConfidence(0)
      } else {
        // Verify against stored voiceprint
        const storedVoiceprint = localStorage.getItem(storageKey)

        if (!storedVoiceprint) {
          toast.error('No voiceprint enrolled. Please enroll first.')
          setVerified(false)
          setConfidence(0)
        } else {
          const storedFeatures = z.array(z.number().finite()).length(24).parse(JSON.parse(storedVoiceprint))
          const similarity = cosineSimilarity(features, storedFeatures)
          const confidenceScore = Math.max(0, Math.min(100, similarity * 100))

          setConfidence(confidenceScore)
          const isVerified = confidenceScore >= 70 // 70% threshold
          setVerified(isVerified)

          // A client-controlled sample comparison cannot establish identity.
          onVerified?.(false, confidenceScore)

          if (isVerified) {
            toast.info(`Experimental sample similarity: ${confidenceScore.toFixed(1)}%. Identity is not verified.`)
          } else {
            toast.error(`Verification failed. Confidence: ${confidenceScore.toFixed(1)}%`)
          }
        }
      }


    } catch (error) {
      console.error('Voice processing error:', error)
      toast.error('Failed to process voice sample')
      if (!disposedRef.current) setVerified(false)
    } finally {
      await audioContext?.close()
    }

    if (disposedRef.current) return
    setProcessing(false)
    setProgress(0)
    setAudioLevel(0)
  }

  /**
   * Start enrollment mode
   */
  const startEnrollment = () => {
    void startRecording(true)
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
            Experimental Voice Sample Comparison
          </CardTitle>
          <CardDescription className="text-slate-400">
            {hasVoiceprint
              ? 'Sample stored locally. This is not identity verification.'
              : 'No voiceprint found. Please enroll your voice first.'}
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
                        height: Math.max(8, (audioLevel / 255) * 64 * (0.5 + (i % 5) / 10))
                      }}
                      transition={{ duration: 0.05 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {!recording && !processing && (
              <div className="text-slate-500 flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                <span>{enrollmentMode ? 'Click to enroll voice' : 'Click to compare a sample'}</span>
              </div>
            )}

            {processing && (
              <div className="flex items-center gap-3 text-purple-400">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Comparing experimental audio features...</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {recording && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-400">
                <span>{enrollmentMode ? 'Enrolling voice...' : 'Recording voice sample...'}</span>
                <span>{Math.round(progress / 20)}s / 5s</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => { void startRecording(false) }}
              disabled={recording || processing || !hasVoiceprint}
              className={`flex-1 ${recording ? 'bg-red-600' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              <Mic className={`h-4 w-4 mr-2 ${recording ? 'animate-pulse' : ''}`} />
              {recording ? 'Recording (5s)' : 'Compare Sample'}
            </Button>

            <Button
              onClick={startEnrollment}
              disabled={recording || processing}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              {hasVoiceprint ? 'Re-enroll' : 'Enroll Voice'}
            </Button>
          </div>

          {/* Verification Result */}
          {verified !== null && !recording && !processing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-4 rounded-lg ${
                verified
                  ? 'bg-green-900/30 border border-green-700'
                  : 'bg-red-900/30 border border-red-700'
              }`}
            >
              <div className="flex items-center gap-3">
                {verified ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-400" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${verified ? 'text-green-300' : 'text-red-300'}`}>
                    {enrollmentMode
                      ? 'Voice Enrolled Successfully'
                      : verified ? 'Sample Similarity Threshold Reached' : 'Sample Did Not Match'}
                  </p>
                  <p className={`text-sm ${verified ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    Sample similarity: {confidence.toFixed(1)}%
                  </p>
                </div>
                {!enrollmentMode && (
                  <div className={`text-2xl font-bold ${verified ? 'text-green-400' : 'text-red-400'}`}>
                    {confidence.toFixed(0)}%
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Info Note */}
          <div className="text-xs text-slate-500 border-t border-slate-700 pt-4">
            <p className="font-medium mb-2">How Voice Biometrics Works:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Records 5 seconds of your voice</li>
              <li>Extracts approximate audio features; no validated speaker model</li>
              <li>Compares against stored voiceprint using cosine similarity</li>
              <li>A sample match cannot authorize identity checks, signatures or payments</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
