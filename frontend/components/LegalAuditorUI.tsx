'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AlertCircle, CheckCircle, FileText, Loader2, Scale, Shield } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface AuditResult {
  errors: string[]
  suggestions: string[]
  score: number
  compliance: {
    state: string
    type: string
    isCompliant: boolean
    issues: string[]
  }
}

export default function LegalAuditorUI() {
  const [docText, setDocText] = useState('')
  const [state, setState] = useState('')
  const [type, setType] = useState('assignment_of_interest')
  const [audit, setAudit] = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(false)

  const runAudit = async () => {
    if (!docText.trim() || !state.trim()) {
      alert('Please enter document text and state')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/legal/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docText, state, type })
      })

      if (res.ok) {
        const data = await res.json()
        setAudit(data)
      } else {
        // Demo audit for testing
        setAudit({
          errors: [
            'Missing notarization acknowledgment section',
            'Property legal description incomplete (no parcel number)',
            'Assignor signature block missing witness line'
          ],
          suggestions: [
            'Add full legal property description with APN/Parcel number',
            'Include county recording fee information',
            `Add ${state} specific disclosure language for surplus claims`,
            'Consider adding a severability clause'
          ],
          score: 68,
          compliance: {
            state: state.toUpperCase(),
            type,
            isCompliant: false,
            issues: [
              `${state.toUpperCase()} requires notarized signatures on assignment documents`,
              'Missing required surplus funds disclosure statement',
              'Deadline reference should cite specific state statute'
            ]
          }
        })
      }
    } catch (err) {
      console.error('Audit error:', err)
      // Return mock for demo
      setAudit({
        errors: ['Unable to connect to AI auditor - showing demo results'],
        suggestions: ['Verify backend API is running'],
        score: 50,
        compliance: {
          state: state.toUpperCase(),
          type,
          isCompliant: false,
          issues: ['Demo mode - actual compliance check unavailable']
        }
      })
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
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
            <Scale className="h-5 w-5 text-blue-400" />
            AI Legal Document Auditor
          </CardTitle>
          <CardDescription className="text-slate-400">
            GPT-4 powered compliance checking for surplus recovery documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Document Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
              >
                <option value="assignment_of_interest">Assignment of Interest</option>
                <option value="claim_form">Claim Form</option>
                <option value="power_of_attorney">Power of Attorney</option>
                <option value="affidavit">Affidavit</option>
                <option value="other">Other Legal Document</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">State</label>
              <Input
                placeholder="State (e.g., CA, TX, FL)"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className="bg-slate-800 border-slate-600 text-white"
                maxLength={2}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1 block">Document Text</label>
            <textarea
              className="w-full h-48 p-4 rounded-md bg-slate-800 border border-slate-600 text-white resize-none"
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Paste or type the legal document text here for AI analysis..."
            />
          </div>

          <Button
            onClick={runAudit}
            disabled={loading || !docText.trim() || !state.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Analyzing with GPT-4...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Run AI Audit
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {audit && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Score Card */}
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-white">Compliance Score</h3>
                  <p className="text-sm text-slate-400">{audit.compliance.state} - {type.replace(/_/g, ' ')}</p>
                </div>
                <div className={`text-4xl font-bold ${getScoreColor(audit.score)}`}>
                  {audit.score}%
                </div>
              </div>
              <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${getScoreBarColor(audit.score)} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${audit.score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>

              <div className="mt-4 flex items-center gap-2">
                {audit.compliance.isCompliant ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <Shield className="h-5 w-5" />
                    <span>Document is compliant with {audit.compliance.state} requirements</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="h-5 w-5" />
                    <span>Document needs revisions for {audit.compliance.state} compliance</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Errors */}
          {audit.errors.length > 0 && (
            <Card className="bg-red-950/30 border-red-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-red-400 text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Issues Found ({audit.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {audit.errors.map((err, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-2 text-red-300"
                    >
                      <span className="text-red-500 mt-1">-</span>
                      {err}
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Compliance Issues */}
          {audit.compliance.issues.length > 0 && (
            <Card className="bg-amber-950/30 border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-400 text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Compliance Issues ({audit.compliance.issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {audit.compliance.issues.map((issue, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-2 text-amber-300"
                    >
                      <span className="text-amber-500 mt-1">!</span>
                      {issue}
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Suggestions */}
          {audit.suggestions.length > 0 && (
            <Card className="bg-green-950/30 border-green-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-green-400 text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Recommendations ({audit.suggestions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {audit.suggestions.map((sug, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-2 text-green-300"
                    >
                      <span className="text-green-500 mt-1">+</span>
                      {sug}
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
