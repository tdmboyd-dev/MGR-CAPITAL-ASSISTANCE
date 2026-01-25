'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { useState, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Eye, EyeOff } from 'lucide-react'

// Placeholder 3D property component
function PropertyModel({ description }: { description: string }) {
  return (
    <group>
      {/* Simple house placeholder */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2, 1, 1.5]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 1.25, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[1.5, 0.1, 1.6]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      {/* Ground */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#228B22" />
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
        const supported = await navigator.xr?.isSessionSupported('immersive-vr')
        if (supported) {
          setInVR(true)
        } else {
          alert('VR not supported on this device. Viewing in 3D mode.')
        }
      } catch (e) {
        console.log('WebXR not available')
      }
    }
    setLoading(false)
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
            <Button
              onClick={enterVR}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : inVR ? (
                <EyeOff className="h-4 w-4 mr-2" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              {inVR ? 'Exit VR' : 'Enter VR Mode'}
            </Button>
            <Button variant="outline" className="border-slate-600 text-slate-300">
              Generate 3D Model from AI
            </Button>
          </div>

          <p className="text-xs text-slate-500 mt-3">
            Note: VR mode requires WebXR-compatible headset (Oculus, HTC Vive, etc.)
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
