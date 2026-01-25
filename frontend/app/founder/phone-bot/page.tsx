'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Mic, Volume2, PhoneOff, User, Clock, TrendingUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'

const SCRIPTS = {
  initial_outreach: {
    name: 'Initial Outreach',
    text: 'Hello, this is a representative from MGR Capital calling regarding an important financial matter. Our records show that you may be entitled to unclaimed surplus funds from a recent property tax sale. This is not a sales call - we are reaching out because these funds legally belong to you. Would you have a few minutes to discuss this?',
  },
  follow_up: {
    name: 'Follow Up',
    text: 'Hello, I am following up on our previous conversation about your unclaimed surplus funds. Have you had a chance to review the documents we sent? I am here to answer any questions you might have.',
  },
  closing: {
    name: 'Closing',
    text: 'Thank you for your time today. We will send you the necessary paperwork via email. Once signed, we will begin the recovery process on your behalf. You can expect to hear from us within 5-7 business days. Have a great day!',
  },
}

const VOICES = [
  { id: 'lawyer-male', name: 'Professional Male', description: 'Authoritative, confident' },
  { id: 'lawyer-female', name: 'Professional Female', description: 'Warm, professional' },
  { id: 'friendly-male', name: 'Friendly Male', description: 'Approachable, casual' },
  { id: 'spanish-male', name: 'Spanish Male', description: 'Native Spanish speaker' },
]

export default function PhoneBotDashboard() {
  const [phone, setPhone] = useState('')
  const [scriptKey, setScriptKey] = useState<keyof typeof SCRIPTS>('initial_outreach')
  const [customScript, setCustomScript] = useState('')
  const [voice, setVoice] = useState('lawyer-female')
  const [callStatus, setCallStatus] = useState<string | null>(null)
  const [callSid, setCallSid] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: callLogs } = useQuery({
    queryKey: ['call-logs'],
    queryFn: async () => {
      const res = await fetch('/api/phone/logs', { credentials: 'include' })
      if (!res.ok) return { data: [] }
      return res.json()
    },
  })

  const startCall = async () => {
    if (!phone) {
      toast.error('Please enter a phone number')
      return
    }

    setLoading(true)
    try {
      const script = customScript || SCRIPTS[scriptKey].text
      const res = await fetch('/api/phone/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: phone, script, voice }),
      })

      if (!res.ok) throw new Error('Failed to start call')

      const data = await res.json()
      setCallSid(data.callSid)
      setCallStatus('connecting')
      toast.success('Call initiated')

      // Poll for transcript updates
      const interval = setInterval(async () => {
        try {
          const t = await fetch(`/api/phone/transcript/${data.callSid}`, { credentials: 'include' })
          const tData = await t.json()
          setTranscript(tData.data?.text || '')
          setCallStatus(tData.data?.status || 'in_progress')
          if (tData.data?.status === 'completed' || tData.data?.status === 'failed') {
            clearInterval(interval)
          }
        } catch (e) {
          // Continue polling
        }
      }, 3000)
    } catch (err) {
      toast.error('Failed to start call')
    } finally {
      setLoading(false)
    }
  }

  const endCall = async () => {
    if (!callSid) return
    try {
      await fetch(`/api/phone/end/${callSid}`, {
        method: 'POST',
        credentials: 'include',
      })
      setCallStatus('ended')
      toast.success('Call ended')
    } catch (err) {
      toast.error('Failed to end call')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 p-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          AI Phone Bot Control
        </h1>
        <p className="text-muted-foreground mt-1">Automated outreach with AI voice and conversation</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Phone className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{callLogs?.data?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">78%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/20 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">3:42</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-full">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interested</p>
                <p className="text-2xl font-bold">42</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Controls */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Make a Call</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="script">Script Template</Label>
                <Select value={scriptKey} onValueChange={(v) => setScriptKey(v as keyof typeof SCRIPTS)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCRIPTS).map(([key, script]) => (
                      <SelectItem key={key} value={key}>{script.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="voice">AI Voice</Label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICES.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} - {v.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="customScript">Script Preview / Custom</Label>
              <Textarea
                id="customScript"
                value={customScript || SCRIPTS[scriptKey].text}
                onChange={(e) => setCustomScript(e.target.value)}
                className="mt-1 h-40"
                placeholder="Edit script or use template..."
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button onClick={startCall} disabled={loading || callStatus === 'in_progress'} size="lg">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Phone className="mr-2 h-4 w-4" />
              )}
              Start Call
            </Button>
            {callStatus === 'in_progress' && (
              <Button onClick={endCall} variant="destructive" size="lg">
                <PhoneOff className="mr-2 h-4 w-4" />
                End Call
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Call */}
      <AnimatePresence>
        {callStatus && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    callStatus === 'in_progress' ? 'bg-green-500 animate-pulse' :
                    callStatus === 'completed' ? 'bg-blue-500' :
                    callStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                    'bg-red-500'
                  }`} />
                  Live Call - {callStatus.replace('_', ' ').toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted rounded-lg min-h-48 font-mono text-sm">
                  {transcript || 'Waiting for speech...'}
                </div>
                <div className="flex gap-4 mt-4">
                  <Button variant="outline" disabled>
                    <Mic className="mr-2 h-4 w-4" />
                    Join Call
                  </Button>
                  <Button variant="outline" disabled>
                    <Volume2 className="mr-2 h-4 w-4" />
                    Play Response
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Calls */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(callLogs?.data || []).slice(0, 10).map((log: any, i: number) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 border rounded-lg flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{log.direction}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge variant={log.status === 'completed' ? 'default' : 'secondary'}>
                  {log.status}
                </Badge>
              </motion.div>
            ))}
            {(!callLogs?.data || callLogs.data.length === 0) && (
              <p className="text-center text-muted-foreground py-8">No call history yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
