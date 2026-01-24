"use client";

import { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

type Expression = "neutral" | "happy" | "angry" | "thinking" | "surprised";
type Clothing = "suit" | "casual" | "robe";

interface AdvancedLawyerBotProps {
  isSpeaking: boolean;
  transcript?: string;
  expression?: Expression;
  clothing?: Clothing;
  scale?: number;
  profanityMode?: boolean;
  botName?: string;
}

// Viseme mapping for basic lip sync
const VISEME_MAP: Record<string, number> = {
  a: 0.8,
  e: 0.6,
  i: 0.4,
  o: 0.9,
  u: 0.7,
  m: 0.1,
  b: 0.1,
  p: 0.1,
  f: 0.3,
  v: 0.3,
  th: 0.5,
  default: 0.5,
};

// Expression colors and transforms
const EXPRESSION_CONFIG: Record<
  Expression,
  { color: string; eyeScale: number; mouthScale: number; headTilt: number }
> = {
  neutral: { color: "#3b82f6", eyeScale: 1, mouthScale: 1, headTilt: 0 },
  happy: { color: "#22c55e", eyeScale: 1.1, mouthScale: 1.3, headTilt: 0.1 },
  angry: { color: "#ef4444", eyeScale: 0.7, mouthScale: 0.8, headTilt: -0.15 },
  thinking: { color: "#a855f7", eyeScale: 0.9, mouthScale: 0.6, headTilt: 0.2 },
  surprised: { color: "#f59e0b", eyeScale: 1.4, mouthScale: 1.5, headTilt: 0 },
};

// Clothing configurations
const CLOTHING_CONFIG: Record<Clothing, { bodyColor: string; accentColor: string }> = {
  suit: { bodyColor: "#1e293b", accentColor: "#ef4444" }, // Dark suit, red tie
  casual: { bodyColor: "#3b82f6", accentColor: "#f59e0b" }, // Blue shirt, orange accent
  robe: { bodyColor: "#1a1a2e", accentColor: "#ffd700" }, // Judge robe, gold accent
};

function LawyerModel({
  isSpeaking,
  transcript = "",
  expression = "neutral",
  clothing = "suit",
  scale = 1,
  profanityMode = false,
}: AdvancedLawyerBotProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Group>(null!);
  const mouthRef = useRef<THREE.Mesh>(null!);
  const leftEyeRef = useRef<THREE.Mesh>(null!);
  const rightEyeRef = useRef<THREE.Mesh>(null!);
  const leftBrowRef = useRef<THREE.Mesh>(null!);
  const rightBrowRef = useRef<THREE.Mesh>(null!);

  const [visemeIndex, setVisemeIndex] = useState(0);
  const expressionConfig = EXPRESSION_CONFIG[expression];
  const clothingConfig = CLOTHING_CONFIG[clothing];

  // Animate based on transcript for lip sync
  useEffect(() => {
    if (!isSpeaking || !transcript) return;

    const interval = setInterval(() => {
      setVisemeIndex((prev) => (prev + 1) % transcript.length);
    }, 100);

    return () => clearInterval(interval);
  }, [isSpeaking, transcript]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Mouth animation
    if (mouthRef.current) {
      if (isSpeaking) {
        const char = transcript[visemeIndex]?.toLowerCase() || "";
        const visemeValue = VISEME_MAP[char] || VISEME_MAP.default;
        const targetScale = 0.5 + visemeValue * 0.8 * expressionConfig.mouthScale;

        // Smooth transition
        mouthRef.current.scale.y = THREE.MathUtils.lerp(
          mouthRef.current.scale.y,
          targetScale,
          0.3
        );

        // Add some randomness for realism
        mouthRef.current.scale.x = 1 + Math.sin(t * 15) * 0.05;
      } else {
        mouthRef.current.scale.y = THREE.MathUtils.lerp(
          mouthRef.current.scale.y,
          0.5 * expressionConfig.mouthScale,
          0.1
        );
      }
    }

    // Eye animation (blinking and expression)
    if (leftEyeRef.current && rightEyeRef.current) {
      const blink = Math.sin(t * 0.4) > 0.97 ? 0.1 : expressionConfig.eyeScale;
      leftEyeRef.current.scale.y = blink;
      rightEyeRef.current.scale.y = blink;
    }

    // Eyebrow animation
    if (leftBrowRef.current && rightBrowRef.current) {
      const browOffset = expression === "angry" ? -0.05 : expression === "surprised" ? 0.08 : 0;
      leftBrowRef.current.position.y = 0.5 + browOffset + Math.sin(t * 2) * 0.01;
      rightBrowRef.current.position.y = 0.5 + browOffset + Math.sin(t * 2) * 0.01;

      if (expression === "angry") {
        leftBrowRef.current.rotation.z = 0.2;
        rightBrowRef.current.rotation.z = -0.2;
      } else {
        leftBrowRef.current.rotation.z = 0;
        rightBrowRef.current.rotation.z = 0;
      }
    }

    // Head movement
    if (headRef.current) {
      // Base idle animation
      headRef.current.rotation.y = Math.sin(t * 0.5) * 0.08 + expressionConfig.headTilt;
      headRef.current.rotation.x = Math.sin(t * 0.3) * 0.03;

      // Profanity mode - aggressive head shaking
      if (profanityMode) {
        headRef.current.rotation.y += Math.sin(t * 8) * 0.15;
        headRef.current.rotation.z = Math.sin(t * 10) * 0.08;
      }
    }

    // Body sway
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.2) * 0.02;
    }
  });

  return (
    <group ref={groupRef} scale={scale}>
      {/* Head group */}
      <group ref={headRef} position={[0, 0.8, 0]}>
        {/* Head */}
        <RoundedBox args={[1.2, 1.4, 1]} radius={0.2}>
          <meshStandardMaterial color={expressionConfig.color} />
        </RoundedBox>

        {/* Left Eye */}
        <group position={[-0.3, 0.2, 0.5]}>
          <mesh ref={leftEyeRef}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="white" />
          </mesh>
          <mesh position={[0, 0, 0.08]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Pupil highlight */}
          <mesh position={[0.02, 0.02, 0.14]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
          </mesh>
        </group>

        {/* Right Eye */}
        <group position={[0.3, 0.2, 0.5]}>
          <mesh ref={rightEyeRef}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="white" />
          </mesh>
          <mesh position={[0, 0, 0.08]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[-0.02, 0.02, 0.14]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
          </mesh>
        </group>

        {/* Eyebrows */}
        <mesh ref={leftBrowRef} position={[-0.3, 0.5, 0.5]}>
          <boxGeometry args={[0.2, 0.04, 0.05]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <mesh ref={rightBrowRef} position={[0.3, 0.5, 0.5]}>
          <boxGeometry args={[0.2, 0.04, 0.05]} />
          <meshStandardMaterial color="#374151" />
        </mesh>

        {/* Mouth */}
        <mesh ref={mouthRef} position={[0, -0.3, 0.5]}>
          <boxGeometry args={[0.5, 0.15, 0.1]} />
          <meshStandardMaterial color="#7f1d1d" />
        </mesh>

        {/* Glasses (for thinking expression) */}
        {expression === "thinking" && (
          <group position={[0, 0.2, 0.55]}>
            <mesh position={[-0.3, 0, 0]}>
              <torusGeometry args={[0.18, 0.02, 8, 16]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            <mesh position={[0.3, 0, 0]}>
              <torusGeometry args={[0.18, 0.02, 8, 16]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.15, 0.02, 0.02]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
          </group>
        )}
      </group>

      {/* Neck */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.25, 0.3]} />
        <meshStandardMaterial color={expressionConfig.color} />
      </mesh>

      {/* Body */}
      <group position={[0, -0.9, 0]}>
        {/* Torso */}
        <RoundedBox args={[1.4, 1.4, 0.8]} radius={0.1}>
          <meshStandardMaterial color={clothingConfig.bodyColor} />
        </RoundedBox>

        {/* Collar/Lapels for suit */}
        {clothing === "suit" && (
          <>
            <mesh position={[-0.35, 0.5, 0.35]} rotation={[0, 0, 0.3]}>
              <boxGeometry args={[0.3, 0.5, 0.1]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
            <mesh position={[0.35, 0.5, 0.35]} rotation={[0, 0, -0.3]}>
              <boxGeometry args={[0.3, 0.5, 0.1]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          </>
        )}

        {/* Tie/Accent */}
        <mesh position={[0, 0.3, 0.4]}>
          <coneGeometry args={[0.12, 0.5, 4]} />
          <meshStandardMaterial color={clothingConfig.accentColor} />
        </mesh>

        {/* Robe collar for judge */}
        {clothing === "robe" && (
          <mesh position={[0, 0.6, 0.3]}>
            <boxGeometry args={[1.2, 0.15, 0.3]} />
            <meshStandardMaterial color="white" />
          </mesh>
        )}

        {/* Arms */}
        <mesh position={[-0.85, 0.1, 0]} rotation={[0, 0, 0.2]}>
          <capsuleGeometry args={[0.12, 0.8]} />
          <meshStandardMaterial color={clothingConfig.bodyColor} />
        </mesh>
        <mesh position={[0.85, 0.1, 0]} rotation={[0, 0, -0.2]}>
          <capsuleGeometry args={[0.12, 0.8]} />
          <meshStandardMaterial color={clothingConfig.bodyColor} />
        </mesh>

        {/* Hands */}
        <mesh position={[-1.1, -0.4, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color={expressionConfig.color} />
        </mesh>
        <mesh position={[1.1, -0.4, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color={expressionConfig.color} />
        </mesh>
      </group>

      {/* Briefcase */}
      {clothing === "suit" && (
        <mesh position={[1.3, -1.4, 0]}>
          <boxGeometry args={[0.5, 0.35, 0.15]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
      )}

      {/* Gavel for judge */}
      {clothing === "robe" && (
        <group position={[1.2, -0.8, 0.2]} rotation={[0, 0, -0.5]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.04, 0.4]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.15, 0.1, 0.1]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
        </group>
      )}
    </group>
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 2, 1]} />
      <meshStandardMaterial color="#64748b" wireframe />
    </mesh>
  );
}

export default function AdvancedLawyerBot({
  isSpeaking = false,
  transcript = "",
  expression = "neutral",
  clothing = "suit",
  scale = 1,
  profanityMode = false,
  botName = "Legal Assistant",
}: AdvancedLawyerBotProps) {
  return (
    <div className="h-[500px] w-full rounded-xl overflow-hidden border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Canvas camera={{ position: [0, 0.5, 4], fov: 40 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
        <pointLight position={[-5, 5, 5]} intensity={0.5} color="#60a5fa" />
        <spotLight
          position={[0, 8, 3]}
          intensity={0.8}
          angle={0.5}
          penumbra={1}
          castShadow
        />

        <Suspense fallback={<LoadingFallback />}>
          <Environment preset="city" background={false} />
          <LawyerModel
            isSpeaking={isSpeaking}
            transcript={transcript}
            expression={expression}
            clothing={clothing}
            scale={scale}
            profanityMode={profanityMode}
          />

          {/* Name plate */}
          <Text
            position={[0, -2.5, 0]}
            fontSize={0.2}
            color="#1e293b"
            anchorX="center"
            anchorY="middle"
          >
            {botName}
          </Text>

          {/* Expression indicator */}
          <Text
            position={[0, 2, 0]}
            fontSize={0.12}
            color={EXPRESSION_CONFIG[expression].color}
            anchorX="center"
            anchorY="middle"
          >
            {expression.toUpperCase()}
          </Text>

          {/* Speaking indicator */}
          {isSpeaking && (
            <Text
              position={[0, 1.7, 0]}
              fontSize={0.1}
              color="#22c55e"
              anchorX="center"
              anchorY="middle"
            >
              Speaking...
            </Text>
          )}
        </Suspense>

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={3}
          maxDistance={8}
          minPolarAngle={Math.PI * 0.3}
          maxPolarAngle={Math.PI * 0.7}
        />
      </Canvas>
    </div>
  );
}
