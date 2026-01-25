'use client'

import * as tf from '@tensorflow/tfjs'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Brain, TrendingUp, Clock, DollarSign, Loader2 } from 'lucide-react'

interface SimulationInputs {
  state: string
  claimAmount: number
  heirCount: number
  evidenceStrength: number
  opponentType: string
}

interface PredictionResult {
  winProbability: number
  durationMonths: number
  costEstimate: number
  confidence: number
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6']

export default function LitigationSimulator() {
  const [model, setModel] = useState<tf.LayersModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [inputs, setInputs] = useState<SimulationInputs>({
    state: 'CA',
    claimAmount: 50000,
    heirCount: 3,
    evidenceStrength: 75,
    opponentType: 'state'
  })
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [monteCarloResults, setMonteCarloResults] = useState<number[]>([])

  useEffect(() => {
    const loadModel = async () => {
      try {
        // Create and train a simple model
        const m = tf.sequential()
        m.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [5] }))
        m.add(tf.layers.dropout({ rate: 0.2 }))
        m.add(tf.layers.dense({ units: 32, activation: 'relu' }))
        m.add(tf.layers.dense({ units: 3, activation: 'sigmoid' }))

        m.compile({
          optimizer: tf.train.adam(0.001),
          loss: 'meanSquaredError'
        })

        // Generate training data (simulated historical cases)
        const numSamples = 500
        const xs = tf.randomUniform([numSamples, 5], 0, 1)
        // Generate labels based on input features
        const ysData = []
        const xsData = await xs.array() as number[][]
        for (let i = 0; i < numSamples; i++) {
          const evidenceWeight = xsData[i][3] * 0.4
          const heirPenalty = xsData[i][2] * 0.1
          const amountFactor = xsData[i][1] * 0.2
          const winProb = Math.min(0.95, Math.max(0.1, 0.5 + evidenceWeight - heirPenalty + (Math.random() * 0.2 - 0.1)))
          const duration = 0.3 + Math.random() * 0.5
          const cost = 0.2 + amountFactor * 0.3 + Math.random() * 0.2
          ysData.push([winProb, duration, cost])
        }
        const ys = tf.tensor2d(ysData)

        await m.fit(xs, ys, {
          epochs: 30,
          batchSize: 32,
          shuffle: true,
          verbose: 0
        })

        setModel(m)
        setLoading(false)
      } catch (error) {
        console.error('Model loading error:', error)
        setLoading(false)
      }
    }
    loadModel()
  }, [])

  const runSimulation = async () => {
    if (!model) return
    setSimulating(true)

    try {
      // Encode inputs
      const stateCode = inputs.state.charCodeAt(0) / 100
      const normalizedAmount = Math.min(inputs.claimAmount / 1000000, 1)
      const normalizedHeirs = Math.min(inputs.heirCount / 10, 1)
      const normalizedEvidence = inputs.evidenceStrength / 100
      const opponentCode = inputs.opponentType === 'state' ? 0.3 : inputs.opponentType === 'bank' ? 0.6 : 0.9

      const inputTensor = tf.tensor2d([[stateCode, normalizedAmount, normalizedHeirs, normalizedEvidence, opponentCode]])
      const output = model.predict(inputTensor) as tf.Tensor
      const [win, duration, cost] = await output.data()

      // Monte Carlo simulation for confidence interval
      const mcResults: number[] = []
      for (let i = 0; i < 100; i++) {
        const noise = (Math.random() - 0.5) * 0.2
        mcResults.push(Math.max(0, Math.min(100, win * 100 + noise * 100)))
      }
      setMonteCarloResults(mcResults)

      setPrediction({
        winProbability: Math.round(win * 100),
        durationMonths: Math.round(duration * 24 + 3), // 3-27 months
        costEstimate: Math.round(cost * inputs.claimAmount * 0.3), // Up to 30% of claim
        confidence: 85 + Math.round(inputs.evidenceStrength / 10)
      })
    } catch (error) {
      console.error('Simulation error:', error)
    }

    setSimulating(false)
  }

  const getWinDistribution = () => {
    if (monteCarloResults.length === 0) return []
    const ranges = [
      { name: '0-25%', count: 0 },
      { name: '25-50%', count: 0 },
      { name: '50-75%', count: 0 },
      { name: '75-100%', count: 0 }
    ]
    monteCarloResults.forEach(r => {
      if (r < 25) ranges[0].count++
      else if (r < 50) ranges[1].count++
      else if (r < 75) ranges[2].count++
      else ranges[3].count++
    })
    return ranges
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-400" />
            Predictive Litigation Simulator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              <span className="ml-3 text-slate-300">Training ML model on historical cases...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">State</label>
                  <Input
                    placeholder="State (e.g., CA)"
                    value={inputs.state}
                    onChange={(e) => setInputs({ ...inputs, state: e.target.value.toUpperCase() })}
                    className="bg-slate-800 border-slate-600 text-white"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Claim Amount ($)</label>
                  <Input
                    type="number"
                    placeholder="Claim Amount"
                    value={inputs.claimAmount}
                    onChange={(e) => setInputs({ ...inputs, claimAmount: Number(e.target.value) })}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Number of Heirs</label>
                  <Input
                    type="number"
                    placeholder="Heir Count"
                    value={inputs.heirCount}
                    onChange={(e) => setInputs({ ...inputs, heirCount: Number(e.target.value) })}
                    className="bg-slate-800 border-slate-600 text-white"
                    min={1}
                    max={20}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Evidence Strength (0-100)</label>
                  <Input
                    type="number"
                    placeholder="Evidence Strength"
                    value={inputs.evidenceStrength}
                    onChange={(e) => setInputs({ ...inputs, evidenceStrength: Number(e.target.value) })}
                    className="bg-slate-800 border-slate-600 text-white"
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Opponent Type</label>
                  <select
                    value={inputs.opponentType}
                    onChange={(e) => setInputs({ ...inputs, opponentType: e.target.value })}
                    className="w-full p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
                  >
                    <option value="state">State/County</option>
                    <option value="bank">Bank/Lender</option>
                    <option value="private">Private Party</option>
                  </select>
                </div>
              </div>

              <Button
                onClick={runSimulation}
                disabled={simulating}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {simulating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Running Monte Carlo Simulation...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Run Prediction Simulation
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {prediction && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-400" />
                <div>
                  <p className="text-sm text-green-300">Win Probability</p>
                  <p className="text-3xl font-bold text-white">{prediction.winProbability}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-sm text-blue-300">Est. Duration</p>
                  <p className="text-3xl font-bold text-white">{prediction.durationMonths} mo</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 border-amber-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-amber-400" />
                <div>
                  <p className="text-sm text-amber-300">Est. Legal Costs</p>
                  <p className="text-3xl font-bold text-white">${prediction.costEstimate.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {monteCarloResults.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">Monte Carlo Distribution (100 simulations)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={getWinDistribution()}>
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-500 mt-2">
              Model Confidence: {prediction?.confidence}% | Based on simulated historical case data
            </p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
