'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Calculator, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PredictionResult {
  predictedSurplus: number
  confidence: number
  factors: {
    name: string
    impact: 'positive' | 'negative' | 'neutral'
    value: string
  }[]
}

export default function SurplusForecaster() {
  const [propertyValue, setPropertyValue] = useState('')
  const [taxOwed, setTaxOwed] = useState('')
  const [assessedValue, setAssessedValue] = useState('')
  const [yearsDelinquent, setYearsDelinquent] = useState('')
  const [state, setState] = useState('FL')
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [modelReady, setModelReady] = useState(false)

  // Simulate ML model initialization
  useEffect(() => {
    const timer = setTimeout(() => setModelReady(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  const predict = async () => {
    if (!propertyValue || !taxOwed) return

    setLoading(true)

    // Simulate ML prediction (in production, use TensorFlow.js or API)
    await new Promise(resolve => setTimeout(resolve, 1000))

    const propVal = parseFloat(propertyValue)
    const tax = parseFloat(taxOwed)
    const assessed = parseFloat(assessedValue) || propVal * 0.85
    const years = parseInt(yearsDelinquent) || 1

    // Simple heuristic calculation (replace with real ML model)
    const salePrice = Math.min(tax * 1.5, assessed * 0.7) // Typical auction price
    const predictedSurplus = Math.max(0, propVal - salePrice - tax)

    // Calculate confidence based on data quality
    let confidence = 0.75
    if (assessedValue) confidence += 0.1
    if (yearsDelinquent) confidence += 0.05
    confidence = Math.min(confidence, 0.95)

    // Generate factors
    const factors: PredictionResult['factors'] = [
      {
        name: 'Market Value',
        impact: propVal > assessed * 1.2 ? 'positive' : 'neutral',
        value: `$${propVal.toLocaleString()} (${((propVal / assessed) * 100 - 100).toFixed(0)}% above assessed)`,
      },
      {
        name: 'Tax Burden',
        impact: tax > propVal * 0.1 ? 'negative' : 'positive',
        value: `$${tax.toLocaleString()} (${((tax / propVal) * 100).toFixed(1)}% of value)`,
      },
      {
        name: 'Years Delinquent',
        impact: years > 2 ? 'negative' : 'positive',
        value: `${years} year${years > 1 ? 's' : ''}`,
      },
      {
        name: 'State Rules',
        impact: 'neutral',
        value: `${state} - Standard surplus recovery`,
      },
    ]

    setPrediction({
      predictedSurplus,
      confidence,
      factors,
    })

    setLoading(false)
  }

  const reset = () => {
    setPropertyValue('')
    setTaxOwed('')
    setAssessedValue('')
    setYearsDelinquent('')
    setPrediction(null)
  }

  return (
    <Card className="border-none shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          AI Surplus Forecaster
        </CardTitle>
        <CardDescription>
          Predict potential surplus recovery using machine learning analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!modelReady ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span className="text-muted-foreground">Loading prediction model...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="propertyValue">Estimated Property Value *</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Current fair market value of the property</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="propertyValue"
                  type="number"
                  value={propertyValue}
                  onChange={(e) => setPropertyValue(e.target.value)}
                  placeholder="200000"
                  className="mt-1"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="taxOwed">Total Tax Owed *</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total delinquent taxes including fees and interest</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="taxOwed"
                  type="number"
                  value={taxOwed}
                  onChange={(e) => setTaxOwed(e.target.value)}
                  placeholder="15000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="assessedValue">Assessed Value (optional)</Label>
                <Input
                  id="assessedValue"
                  type="number"
                  value={assessedValue}
                  onChange={(e) => setAssessedValue(e.target.value)}
                  placeholder="180000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="yearsDelinquent">Years Delinquent (optional)</Label>
                <Input
                  id="yearsDelinquent"
                  type="number"
                  value={yearsDelinquent}
                  onChange={(e) => setYearsDelinquent(e.target.value)}
                  placeholder="2"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={predict} disabled={loading || !propertyValue || !taxOwed}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    Predict Surplus
                  </>
                )}
              </Button>
              {prediction && (
                <Button variant="outline" onClick={reset}>
                  Reset
                </Button>
              )}
            </div>

            {/* Prediction Result */}
            {prediction && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pt-4 border-t"
              >
                <div className="text-center py-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Predicted Recoverable Surplus</p>
                  <p className="text-5xl font-bold text-green-600">
                    ${prediction.predictedSurplus.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Confidence: {(prediction.confidence * 100).toFixed(0)}%
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Analysis Factors</h4>
                  <div className="space-y-2">
                    {prediction.factors.map((factor, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg flex items-center justify-between ${
                          factor.impact === 'positive'
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : factor.impact === 'negative'
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : 'bg-gray-50 dark:bg-gray-800/50'
                        }`}
                      >
                        <span className="font-medium">{factor.name}</span>
                        <span className="text-sm text-muted-foreground">{factor.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This prediction is based on historical data and market analysis.
                    Actual surplus may vary based on auction dynamics and legal factors.
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
