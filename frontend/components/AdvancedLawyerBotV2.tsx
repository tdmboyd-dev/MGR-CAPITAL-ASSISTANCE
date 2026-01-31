'use client'

import { useRef, useEffect, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Html, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Loader2, Volume2, VolumeX, RotateCcw } from 'lucide-react'

type Expression = 'neutral' | 'happy' | 'angry' | 'thinking' | 'surprised' | 'sad' | 'confused' | 'excited'

interface VisemeData {
  timestamp: number // ms from start
  viseme: keyof typeof VISEMES
  duration?: number
}

interface AdvancedLawyerBotV2Props {
  isSpeaking: boolean
  visemeStream?: VisemeData[] // from TTS API (e.g., ElevenLabs)
  transcript?: string // fallback if no viseme stream
  expression?: Expression
  clothing?: 'suit' | 'casual' | 'robe' | 'formal' | 'business-casual'
  scale?: number
  profanityMode?: boolean
  onAnimationEnd?: () => void
  botName?: string
  showControls?: boolean
}

// Standard 15-viseme mapping (compatible with ElevenLabs, Azure, etc.)
const VISEMES = {
  A: { mouthOpen: 0.8, mouthWide: 0.4, jawOpen: 0.7 }, // Ah
  E: { mouthOpen: 0.6, mouthWide: 0.8, jawOpen: 0.5 }, // Ee
  I: { mouthOpen: 0.4, mouthWide: 0.9, jawOpen: 0.3 }, // Ih
  O: { mouthOpen: 0.7, mouthWide: 0.3, jawOpen: 0.6 }, // Oh
  U: { mouthOpen: 0.5, mouthWide: 0.2, jawOpen: 0.4 }, // Oo
  F: { mouthOpen: 0.1, mouthWide: 0.2, jawOpen: 0.05 }, // F/V
  M: { mouthOpen: 0, mouthWide: 0, jawOpen: 0 }, // M/B/P (closed)
  L: { mouthOpen: 0.3, mouthWide: 0.5, jawOpen: 0.25 }, // L/Th
  W: { mouthOpen: 0.4, mouthWide: 0.1, jawOpen: 0.35 }, // W/Q
  T: { mouthOpen: 0.2, mouthWide: 0.6, jawOpen: 0.15 }, // T/D/N
  S: { mouthOpen: 0.15, mouthWide: 0.7, jawOpen: 0.1 }, // S/Z
  K: { mouthOpen: 0.25, mouthWide: 0.4, jawOpen: 0.2 }, // K/G/H
  CH: { mouthOpen: 0.35, mouthWide: 0.65, jawOpen: 0.3 }, // Ch/Sh/J
  R: { mouthOpen: 0.45, mouthWide: 0.35, jawOpen: 0.35 }, // R
  silence: { mouthOpen: 0, mouthWide: 0, jawOpen: 0 },
} as const

// Map characters to visemes for transcript-based lip sync
const charToViseme: Record<string, keyof typeof VISEMES> = {
  'a': 'A', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U',
  'f': 'F', 'v': 'F', 'p': 'M', 'b': 'M', 'm': 'M',
  'l': 'L', 'w': 'W', 'q': 'W', 't': 'T', 'd': 'T', 'n': 'T',
  's': 'S', 'z': 'S', 'c': 'S', 'k': 'K', 'g': 'K', 'h': 'K',
  'r': 'R', 'j': 'CH', 'y': 'E', 'x': 'S',
  ' ': 'silence', '.': 'silence', ',': 'silence',
}

// Expression configurations
const EXPRESSIONS: Record<Expression, {
  headTilt: number
  eyeScale: number
  browHeight: number
  mouthCurve: number
}> = {
  neutral: { headTilt: 0, eyeScale: 1, browHeight: 0, mouthCurve: 0 },
  happy: { headTilt: 0.08, eyeScale: 0.9, browHeight: 0.05, mouthCurve: 0.3 },
  angry: { headTilt: -0.12, eyeScale: 0.8, browHeight: -0.15, mouthCurve: -0.2 },
  thinking: { headTilt: 0.1, eyeScale: 0.95, browHeight: 0.1, mouthCurve: 0 },
  surprised: { headTilt: 0.05, eyeScale: 1.3, browHeight: 0.2, mouthCurve: 0.1 },
  sad: { headTilt: -0.1, eyeScale: 0.85, browHeight: -0.1, mouthCurve: -0.3 },
  confused: { headTilt: 0.15, eyeScale: 1.05, browHeight: 0.05, mouthCurve: 0 },
  excited: { headTilt: 0.05, eyeScale: 1.1, browHeight: 0.15, mouthCurve: 0.4 },
}

// Clothing colors
const CLOTHING_COLORS: Record<string, string> = {
  suit: '#1e293b',
  casual: '#3b82f6',
  robe: '#1f2937',
  formal: '#0f172a',
  'business-casual': '#475569',
}

// 3D Bot Model Component
function BotModel({
  isSpeaking,
  visemeStream,
  transcript,
  expression = 'neutral',
  clothing = 'suit',
  profanityMode = false,
  onAnimationEnd,
}: AdvancedLawyerBotV2Props) {
  const groupRef = useRef<THREE.Group>(null!)
  const headRef = useRef<THREE.Mesh>(null!)
  const mouthRef = useRef<THREE.Mesh>(null!)
  const leftEyeRef = useRef<THREE.Mesh>(null!)
  const rightEyeRef = useRef<THREE.Mesh>(null!)
  const browRef = useRef<THREE.Mesh>(null!)

  const [targetViseme, setTargetViseme] = useState<{ mouthOpen: number; mouthWide: number; jawOpen: number }>(VISEMES.silence)
  const [currentMouth, setCurrentMouth] = useState({ open: 0, wide: 0, jaw: 0 })
  const [blinkTimer, setBlinkTimer] = useState(Math.random() * 3)
  const [isBlinking, setIsBlinking] = useState(false)
  const [charIndex, setCharIndex] = useState(0)

  const expressionConfig = EXPRESSIONS[expression]
  const clothingColor = new THREE.Color(CLOTHING_COLORS[clothing])

  // Process viseme stream or transcript
  useEffect(() => {
    if (!isSpeaking) {
      setTargetViseme(VISEMES.silence)
      setCharIndex(0)
      return
    }

    if (visemeStream && visemeStream.length > 0) {
      // Real viseme data from TTS
      let idx = 0
      const startTime = Date.now()

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime

        while (idx < visemeStream.length && visemeStream[idx].timestamp <= elapsed) {
          setTargetViseme(VISEMES[visemeStream[idx].viseme] || VISEMES.silence)
          idx++
        }

        if (idx >= visemeStream.length) {
          clearInterval(interval)
          setTargetViseme(VISEMES.silence)
          onAnimationEnd?.()
        }
      }, 16) // ~60fps

      return () => clearInterval(interval)
    } else if (transcript) {
      // Fallback: character-based lip sync
      const chars = transcript.toLowerCase().split('')
      let idx = 0

      const interval = setInterval(() => {
        if (idx >= chars.length) {
          clearInterval(interval)
          setTargetViseme(VISEMES.silence)
          onAnimationEnd?.()
          return
        }

        const char = chars[idx]
        const visemeKey = charToViseme[char] || 'silence'
        setTargetViseme(VISEMES[visemeKey])
        setCharIndex(idx)
        idx++
      }, 80) // ~12 chars/sec for natural speech

      return () => clearInterval(interval)
    }
  }, [isSpeaking, visemeStream, transcript, onAnimationEnd])

  // Animation frame
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime()

    // Smooth mouth interpolation
    const lerpSpeed = 12 * delta
    setCurrentMouth(prev => ({
      open: THREE.MathUtils.lerp(prev.open, targetViseme.mouthOpen, lerpSpeed),
      wide: THREE.MathUtils.lerp(prev.wide, targetViseme.mouthWide, lerpSpeed),
      jaw: THREE.MathUtils.lerp(prev.jaw, targetViseme.jawOpen, lerpSpeed),
    }))

    // Apply mouth shape
    if (mouthRef.current) {
      mouthRef.current.scale.set(
        0.3 + currentMouth.wide * 0.3,
        0.05 + currentMouth.open * 0.2,
        0.1
      )
      mouthRef.current.position.y = -0.15 - currentMouth.jaw * 0.05
    }

    // Head movement
    if (headRef.current) {
      // Idle sway
      const idleSway = isSpeaking ? 0 : Math.sin(time * 0.5) * 0.02
      headRef.current.rotation.y = idleSway

      // Expression-based tilt
      const targetTilt = expressionConfig.headTilt + (profanityMode ? Math.sin(time * 8) * 0.1 : 0)
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        targetTilt,
        delta * 3
      )

      // Speaking nod
      if (isSpeaking) {
        headRef.current.rotation.x += Math.sin(time * 4) * 0.02
      }
    }

    // Blink logic
    setBlinkTimer(prev => prev + delta)
    if (!isBlinking && blinkTimer > 3 + Math.random() * 2) {
      setIsBlinking(true)
      setBlinkTimer(0)
      setTimeout(() => setIsBlinking(false), 150)
    }

    // Eye scale (expression + blink)
    const eyeScaleY = isBlinking ? 0.1 : expressionConfig.eyeScale
    if (leftEyeRef.current) {
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(
        leftEyeRef.current.scale.y,
        eyeScaleY,
        delta * 20
      )
    }
    if (rightEyeRef.current) {
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(
        rightEyeRef.current.scale.y,
        eyeScaleY,
        delta * 20
      )
    }

    // Eyebrow position
    if (browRef.current) {
      browRef.current.position.y = THREE.MathUtils.lerp(
        browRef.current.position.y,
        0.35 + expressionConfig.browHeight,
        delta * 5
      )
    }
  })

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      {/* Body */}
      <mesh position={[0, -0.5, 0]}>
        <capsuleGeometry args={[0.4, 0.8, 8, 16]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.3, 16]} />
        <meshStandardMaterial color="#fcd5b8" roughness={0.8} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color="#fcd5b8" roughness={0.7} />

        {/* Face group */}
        <group position={[0, 0, 0.25]}>
          {/* Eyes */}
          <mesh ref={leftEyeRef} position={[-0.1, 0.05, 0.12]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial color="#ffffff" />
            {/* Pupil */}
            <mesh position={[0, 0, 0.04]}>
              <sphereGeometry args={[0.025, 16, 16]} />
              <meshStandardMaterial color="#1e3a5f" />
            </mesh>
          </mesh>

          <mesh ref={rightEyeRef} position={[0.1, 0.05, 0.12]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial color="#ffffff" />
            <mesh position={[0, 0, 0.04]}>
              <sphereGeometry args={[0.025, 16, 16]} />
              <meshStandardMaterial color="#1e3a5f" />
            </mesh>
          </mesh>

          {/* Eyebrows */}
          <mesh ref={browRef} position={[0, 0.35, 0.08]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.3, 0.03, 0.02]} />
            <meshStandardMaterial color="#4a3728" />
          </mesh>

          {/* Nose */}
          <mesh position={[0, -0.02, 0.15]}>
            <coneGeometry args={[0.03, 0.08, 8]} />
            <meshStandardMaterial color="#e8c4a8" />
          </mesh>

          {/* Mouth */}
          <mesh ref={mouthRef} position={[0, -0.15, 0.1]}>
            <boxGeometry args={[0.15, 0.05, 0.05]} />
            <meshStandardMaterial color="#c94c4c" />
          </mesh>
        </group>

        {/* Hair */}
        <mesh position={[0, 0.2, -0.05]}>
          <sphereGeometry args={[0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#2d1810" roughness={0.9} />
        </mesh>
      </mesh>

      {/* Tie (suit only) */}
      {(clothing === 'suit' || clothing === 'formal') && (
        <mesh position={[0, -0.2, 0.35]}>
          <boxGeometry args={[0.08, 0.4, 0.02]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
      )}

      {/* Collar */}
      <mesh position={[0, 0, 0.3]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.35, 0.08, 0.05]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Glasses (thinking expression) */}
      {expression === 'thinking' && (
        <group position={[0, 0.55, 0.35]}>
          <mesh position={[-0.1, 0, 0]}>
            <torusGeometry args={[0.06, 0.008, 8, 24]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} />
          </mesh>
          <mesh position={[0.1, 0, 0]}>
            <torusGeometry args={[0.06, 0.008, 8, 24]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0, -0.01]} rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.08, 8]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} />
          </mesh>
        </group>
      )}
    </group>
  )
}

// Loading Fallback
function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 text-slate-600 dark:text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-sm">Loading Bot...</span>
      </div>
    </Html>
  )
}

// Main Component
export default function AdvancedLawyerBotV2({
  isSpeaking = false,
  visemeStream,
  transcript,
  expression = 'neutral',
  clothing = 'suit',
  scale = 1,
  profanityMode = false,
  onAnimationEnd,
  botName = 'Legal Assistant',
  showControls = true,
}: AdvancedLawyerBotV2Props) {
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-96 flex flex-col items-center justify-center gap-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800"
        role="alert"
      >
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative h-96 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl"
      role="figure"
      aria-label={`3D ${botName} Avatar`}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950" />

      {/* Canvas */}
      <Canvas
        camera={{ position: [0, 0.5, 2.5], fov: 45 }}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={<LoadingFallback />}>
          {/* Lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[5, 10, 5]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <spotLight
            position={[-3, 5, 3]}
            angle={0.4}
            penumbra={0.8}
            intensity={0.8}
            castShadow
          />

          {/* Environment */}
          <Environment preset="studio" />

          {/* Bot */}
          <group scale={scale}>
            <BotModel
              isSpeaking={isSpeaking && !muted}
              visemeStream={visemeStream}
              transcript={transcript}
              expression={expression}
              clothing={clothing}
              profanityMode={profanityMode}
              onAnimationEnd={onAnimationEnd}
            />
          </group>

          {/* Shadow */}
          <ContactShadows
            position={[0, -1.3, 0]}
            opacity={0.4}
            scale={3}
            blur={2}
          />

          {/* Controls */}
          <OrbitControls
            enableZoom={showControls}
            enablePan={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 2}
            minDistance={1.5}
            maxDistance={4}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        {/* Bot name */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {botName}
          </span>
          {isSpeaking && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Speaking...
            </span>
          )}
        </div>

        {/* Mute button */}
        {showControls && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMuted(!muted)}
            className="h-8 w-8"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Expression indicator */}
      <AnimatePresence>
        {expression !== 'neutral' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 right-4"
          >
            <span className="text-xs bg-slate-800/70 text-white px-2 py-1 rounded-full">
              {expression}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
