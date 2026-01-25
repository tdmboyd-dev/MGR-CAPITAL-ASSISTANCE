'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { useState, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Eye, EyeOff } from 'lucide-react'

// Property type configurations
const PROPERTY_TYPES = {
  house: {
    color: '#8B7355',
    roofColor: '#654321',
    size: [2, 1, 1.5] as [number, number, number],
    hasGarage: false,
    floors: 1
  },
  'multi-family': {
    color: '#7B6C5B',
    roofColor: '#4A4A4A',
    size: [3, 2, 2] as [number, number, number],
    hasGarage: false,
    floors: 2
  },
  commercial: {
    color: '#A0A0A0',
    roofColor: '#505050',
    size: [4, 1.5, 2.5] as [number, number, number],
    hasGarage: true,
    floors: 1
  },
  land: {
    color: '#8B7355',
    roofColor: '#654321',
    size: [0.5, 0.5, 0.5] as [number, number, number],
    hasGarage: false,
    floors: 0
  }
}

// Detect property type from description
function getPropertyType(description: string): keyof typeof PROPERTY_TYPES {
  const lower = description.toLowerCase()
  if (lower.includes('commercial') || lower.includes('office') || lower.includes('retail')) {
    return 'commercial'
  }
  if (lower.includes('multi') || lower.includes('apartment') || lower.includes('duplex')) {
    return 'multi-family'
  }
  if (lower.includes('land') || lower.includes('vacant') || lower.includes('lot')) {
    return 'land'
  }
  return 'house'
}

// 3D property component with multiple types
function PropertyModel({ description }: { description: string }) {
  const type = getPropertyType(description)
  const config = PROPERTY_TYPES[type]

  if (type === 'land') {
    // Vacant land with survey markers
    return (
      <group>
        {/* Survey stake markers at corners */}
        {[[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.15, z]}>
            <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
            <meshStandardMaterial color="#FF6B00" />
          </mesh>
        ))}
        {/* Ground with texture variation */}
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#8B7355" />
        </mesh>
        {/* For Sale sign */}
        <group position={[-1.5, 0, -1.5]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.6, 0.4, 0.02]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
            <meshStandardMaterial color="#654321" />
          </mesh>
        </group>
      </group>
    )
  }

  return (
    <group>
      {/* Main building */}
      <mesh position={[0, config.size[1] / 2, 0]}>
        <boxGeometry args={config.size} />
        <meshStandardMaterial color={config.color} />
      </mesh>

      {/* Second floor for multi-family */}
      {config.floors === 2 && (
        <mesh position={[0, config.size[1] + 0.5, 0]}>
          <boxGeometry args={[config.size[0], 1, config.size[2]]} />
          <meshStandardMaterial color={config.color} />
        </mesh>
      )}

      {/* Windows */}
      {Array.from({ length: config.floors + 1 }).map((_, floor) => (
        <group key={floor}>
          {[-0.5, 0.5].map((x, i) => (
            <mesh key={i} position={[x * config.size[0] * 0.4, 0.4 + floor * 1.2, config.size[2] / 2 + 0.01]}>
              <planeGeometry args={[0.3, 0.4]} />
              <meshStandardMaterial color="#87CEEB" metalness={0.5} roughness={0.2} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Door */}
      <mesh position={[0, 0.35, config.size[2] / 2 + 0.01]}>
        <planeGeometry args={[0.35, 0.7]} />
        <meshStandardMaterial color="#4A3728" />
      </mesh>

      {/* Roof */}
      {type !== 'commercial' ? (
        <mesh
          position={[0, config.size[1] * (config.floors === 2 ? 1.75 : 1.25), 0]}
          rotation={[0, 0, Math.PI / 4]}
        >
          <boxGeometry args={[config.size[0] * 0.8, 0.15, config.size[2] + 0.2]} />
          <meshStandardMaterial color={config.roofColor} />
        </mesh>
      ) : (
        <mesh position={[0, config.size[1] + 0.05, 0]}>
          <boxGeometry args={[config.size[0] + 0.2, 0.1, config.size[2] + 0.2]} />
          <meshStandardMaterial color={config.roofColor} />
        </mesh>
      )}

      {/* Garage for commercial */}
      {config.hasGarage && (
        <group position={[config.size[0] / 2 + 0.8, 0.4, 0]}>
          <mesh>
            <boxGeometry args={[1.2, 0.8, 1]} />
            <meshStandardMaterial color="#606060" />
          </mesh>
          <mesh position={[0, -0.2, 0.51]}>
            <planeGeometry args={[0.8, 0.6]} />
            <meshStandardMaterial color="#303030" />
          </mesh>
        </group>
      )}

      {/* Ground */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>

      {/* Driveway */}
      <mesh position={[0, 0.005, config.size[2] / 2 + 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 2]} />
        <meshStandardMaterial color="#505050" />
      </mesh>
    </group>
  )
}

interface VRClaimSimulationProps {
  propertyDescription?: string
  claimAmount?: number
  propertyAddress?: string
}

export default function VRClaimSimulation({
  propertyDescription = "2-bedroom house",
  claimAmount = 50000,
  propertyAddress = "123 Main St"
}: VRClaimSimulationProps) {
  const [inVR, setInVR] = useState(false)
  const [loading, setLoading] = useState(false)

  const enterVR = async () => {
    setLoading(true)
    // Check for WebXR support
    if ('xr' in navigator) {
      try {
        // @ts-ignore
        const xr = navigator.xr
        if (xr) {
          const vrSupported = await xr.isSessionSupported('immersive-vr')
          const arSupported = await xr.isSessionSupported('immersive-ar')

          if (vrSupported) {
            setInVR(true)
            // In a real implementation, we would request the session here:
            // const session = await xr.requestSession('immersive-vr')
            // and integrate with three.js XR manager
          } else if (arSupported) {
            alert('VR not available, but AR mode is supported. Use AR to view property overlay.')
            setInVR(true)
          } else {
            alert('VR/AR not supported on this device. Viewing in 3D mode - use mouse/touch to explore.')
          }
        }
      } catch (e) {
        console.log('WebXR not available:', e)
        alert('WebXR not available. Viewing in 3D mode - use mouse/touch to explore.')
      }
    } else {
      alert('WebXR not supported in this browser. Viewing in 3D mode.')
    }
    setLoading(false)
  }

  const exitVR = () => {
    setInVR(false)
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
            <Eye className="h-5 w-5 text-purple-400" />
            VR Property Simulation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-slate-300 text-sm">
            <p><strong>Property:</strong> {propertyDescription}</p>
            <p><strong>Address:</strong> {propertyAddress}</p>
            <p><strong>Surplus Amount:</strong> ${claimAmount.toLocaleString()}</p>
          </div>

          <div className="h-80 w-full rounded-lg overflow-hidden border border-slate-600 relative">
            <Canvas camera={{ position: [5, 3, 5], fov: 60 }}>
              <Suspense fallback={null}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
                <PropertyModel description={propertyDescription} />
                <Environment preset="sunset" />
                <OrbitControls
                  enablePan={true}
                  enableZoom={true}
                  enableRotate={true}
                  maxPolarAngle={Math.PI / 2}
                />
              </Suspense>
            </Canvas>

            {inVR && (
              <div className="absolute top-4 left-4 p-3 bg-purple-600/90 text-white rounded-lg text-sm">
                VR Mode Active - Use controllers to explore
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            {inVR ? (
              <Button
                onClick={exitVR}
                className="bg-red-600 hover:bg-red-700"
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Exit VR Mode
              </Button>
            ) : (
              <Button
                onClick={enterVR}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Enter VR Mode
              </Button>
            )}
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Generate 3D from Street View
            </Button>
          </div>

          {/* Property Type Indicator */}
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Detected Property Type:</p>
            <p className="text-sm text-purple-300 font-medium capitalize">
              {propertyDescription.toLowerCase().includes('commercial') ? 'Commercial' :
               propertyDescription.toLowerCase().includes('multi') || propertyDescription.toLowerCase().includes('apartment') ? 'Multi-Family' :
               propertyDescription.toLowerCase().includes('land') || propertyDescription.toLowerCase().includes('vacant') ? 'Vacant Land' :
               'Single Family Residential'}
            </p>
          </div>

          <p className="text-xs text-slate-500 mt-3">
            Note: VR mode requires WebXR-compatible headset (Oculus, HTC Vive, etc.)
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
