'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Eye, Home, DollarSign, MapPin, Loader2, Info } from 'lucide-react'

const VRClaimSimulation = dynamic(() => import('@/components/VRClaimSimulation'), { ssr: false })

interface Property {
  id: string
  address: string
  description: string
  surplusAmount: number
  status: string
}

const demoProperties: Property[] = [
  {
    id: '1',
    address: '123 Oak Street, Sacramento, CA',
    description: '3-bedroom single family home with garage',
    surplusAmount: 45000,
    status: 'pending'
  },
  {
    id: '2',
    address: '456 Pine Avenue, Los Angeles, CA',
    description: '2-bedroom condo with city views',
    surplusAmount: 32000,
    status: 'in_progress'
  },
  {
    id: '3',
    address: '789 Maple Drive, San Diego, CA',
    description: '4-bedroom house with pool',
    surplusAmount: 78000,
    status: 'pending'
  }
]

export default function VRSimulationPage() {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(false)

  const loadProperty = (property: Property) => {
    setLoading(true)
    setTimeout(() => {
      setSelectedProperty(property)
      setLoading(false)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-8"
      >
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Eye className="h-8 w-8 text-purple-400" />
            VR Property Simulation
          </h1>
          <p className="text-slate-400 mt-1">
            Explore surplus properties in immersive 3D/VR before filing claims
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Property List */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Available Properties</h2>

            {demoProperties.map((property) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.02 }}
              >
                <Card
                  className={`cursor-pointer transition-all ${
                    selectedProperty?.id === property.id
                      ? 'bg-purple-900/30 border-purple-500'
                      : 'bg-slate-800/50 border-slate-700 hover:border-purple-600/50'
                  }`}
                  onClick={() => loadProperty(property)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-purple-400" />
                          <span className="text-white font-medium text-sm">
                            {property.address.split(',')[0]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {property.address.split(',').slice(1).join(',')}
                        </p>
                      </div>
                      <Badge
                        className={
                          property.status === 'pending'
                            ? 'bg-amber-900/50 text-amber-300'
                            : 'bg-blue-900/50 text-blue-300'
                        }
                      >
                        {property.status}
                      </Badge>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{property.description}</span>
                      <div className="flex items-center gap-1 text-green-400">
                        <DollarSign className="h-3 w-3" />
                        <span className="font-semibold">{property.surplusAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* VR Viewer */}
          <div className="lg:col-span-2">
            {loading ? (
              <Card className="bg-slate-800/50 border-slate-700 h-[500px] flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto" />
                  <p className="text-slate-400 mt-4">Loading 3D property model...</p>
                </div>
              </Card>
            ) : selectedProperty ? (
              <VRClaimSimulation
                propertyDescription={selectedProperty.description}
                claimAmount={selectedProperty.surplusAmount}
                propertyAddress={selectedProperty.address}
              />
            ) : (
              <Card className="bg-slate-800/50 border-slate-700 h-[500px] flex items-center justify-center">
                <div className="text-center">
                  <Eye className="h-16 w-16 text-slate-600 mx-auto" />
                  <p className="text-slate-400 mt-4">Select a property to view in 3D/VR</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Click on any property from the list to load the simulation
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-900/50 rounded-lg">
                  <Eye className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">VR Headset Support</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Compatible with Oculus Quest, HTC Vive, and other WebXR devices
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-900/50 rounded-lg">
                  <Home className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">AI-Generated Models</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    3D models generated from property descriptions and satellite data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-900/50 rounded-lg">
                  <Info className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">Claim Points</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Interactive markers show key property details and claim info
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}
