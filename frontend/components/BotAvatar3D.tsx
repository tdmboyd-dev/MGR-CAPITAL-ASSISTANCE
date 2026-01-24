"use client";

import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

interface BotAvatar3DProps {
  speaking: boolean;
  text?: string;
  profanityMode?: boolean;
  botName?: string;
}

function LawyerBot({
  speaking,
  text = "",
  profanityMode = false,
}: BotAvatar3DProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const mouthRef = useRef<THREE.Mesh>(null!);
  const leftEyeRef = useRef<THREE.Mesh>(null!);
  const rightEyeRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Mouth animation when speaking
    if (speaking && mouthRef.current) {
      const openness = Math.sin(t * 12) * 0.3 + 0.3;
      mouthRef.current.scale.y = 0.5 + openness;
    } else if (mouthRef.current) {
      mouthRef.current.scale.y = 0.5;
    }

    // Subtle head movement
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;

      // More aggressive movement in profanity mode
      if (profanityMode) {
        groupRef.current.rotation.y = Math.sin(t * 3) * 0.2;
        groupRef.current.rotation.z = Math.sin(t * 4) * 0.05;
      }
    }

    // Eye blinking
    if (leftEyeRef.current && rightEyeRef.current) {
      const blink = Math.sin(t * 0.3) > 0.95 ? 0.1 : 1;
      leftEyeRef.current.scale.y = blink;
      rightEyeRef.current.scale.y = blink;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Head */}
      <RoundedBox args={[1.2, 1.4, 1]} radius={0.2} position={[0, 0, 0]}>
        <meshStandardMaterial color={profanityMode ? "#ef4444" : "#3b82f6"} />
      </RoundedBox>

      {/* Left Eye */}
      <mesh ref={leftEyeRef} position={[-0.3, 0.2, 0.5]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[-0.3, 0.2, 0.6]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Right Eye */}
      <mesh ref={rightEyeRef} position={[0.3, 0.2, 0.5]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0.3, 0.2, 0.6]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Mouth */}
      <mesh ref={mouthRef} position={[0, -0.3, 0.5]}>
        <boxGeometry args={[0.5, 0.15, 0.1]} />
        <meshStandardMaterial color={profanityMode ? "#7f1d1d" : "#1e40af"} />
      </mesh>

      {/* Tie */}
      <mesh position={[0, -1, 0.3]}>
        <coneGeometry args={[0.15, 0.4, 4]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>

      {/* Body (suit) */}
      <RoundedBox args={[1.4, 1.2, 0.8]} radius={0.1} position={[0, -1.3, 0]}>
        <meshStandardMaterial color="#1e293b" />
      </RoundedBox>

      {/* Briefcase indicator */}
      <mesh position={[0.9, -1.8, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.15]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
    </group>
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#64748b" wireframe />
    </mesh>
  );
}

export default function BotAvatar3D({
  speaking,
  text,
  profanityMode,
  botName = "Legal Assistant",
}: BotAvatar3DProps) {
  return (
    <div className="h-96 w-full rounded-xl overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800">
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <pointLight position={[-5, 5, 5]} intensity={0.5} color="#60a5fa" />

        <Suspense fallback={<LoadingFallback />}>
          <LawyerBot
            speaking={speaking}
            text={text}
            profanityMode={profanityMode}
          />

          {/* Name plate */}
          <Text
            position={[0, -2.2, 0]}
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            {botName}
          </Text>

          {/* Speaking indicator */}
          {speaking && (
            <Text
              position={[0, 1.2, 0]}
              fontSize={0.15}
              color="#22c55e"
              anchorX="center"
              anchorY="middle"
            >
              Speaking...
            </Text>
          )}
        </Suspense>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 2.5}
          maxPolarAngle={Math.PI / 1.8}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
        />
      </Canvas>
    </div>
  );
}
