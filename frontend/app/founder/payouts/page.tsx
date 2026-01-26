'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DollarSign, ExternalLink, Copy, CheckCircle, Clock,
  Users, Building2, RefreshCw, Loader2, ArrowRight,
  Clipboard, ClipboardCheck, Send, AlertCircle, Bot,
  UserPlus, Sparkles, Zap, Play, Pause, Settings2
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

// Nickel URL
const NICKEL_URL = 'https://app.nickelpayments.com'

interface PendingPayout {
  id: string
  caseCode: string
  clientName: string
  clientEmail: string
  clientPhone: string
  bankName?: string
  routingNumber?: string
  accountNumber?: string
  surplusAmount: number
  feePercent: number
  feeAmount: number
  payoutAmount: number
  status: 'READY' | 'PENDING_INFO' | 'PROCESSING' | 'COMPLETED'
  caseStatus: string
  county: string
  state: string
  createdAt: string
  assignedAgent?: string
}

interface PayrollBot {
  id: string
  name: string
  status: 'active' | 'paused' | 'idle'
  assignedPayouts: number
  processedToday: number
  totalProcessed: number
  avatar: string
}

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

// Format phone
const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

// Demo payroll bots
const PAYROLL_BOTS: PayrollBot[] = [
  {
    id: 'bot-1',
    name: 'PayBot Alpha',
    status: 'active',
    assignedPayouts: 3,
    processedToday: 12,
    totalProcessed: 847,
    avatar: '🤖',
  },
  {
    id: 'bot-2',
    name: 'PayBot Beta',
    status: 'idle',
    assignedPayouts: 0,
    processedToday: 8,
    totalProcessed: 523,
    avatar: '🦾',
  },
  {
    id: 'bot-3',
    name: 'PayBot Gamma',
    status: 'paused',
    assignedPayouts: 2,
    processedToday: 5,
    totalProcessed: 312,
    avatar: '⚡',
  },
]

export default function NickelPayoutsPage() {
  const [selectedPayouts, setSelectedPayouts] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [nickelWindowOpen, setNickelWindowOpen] = useState(false)
  const [bots, setBots] = useState<PayrollBot[]>(PAYROLL_BOTS)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedBot, setSelectedBot] = useState<string>('')
  const [botRunning, setBotRunning] = useState<string | null>(null)

  // Fetch pending payouts
  const { data: payouts, isLoading, refetch } = useQuery({
    queryKey: ['pending-payouts'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/payouts/nickel', {
          credentials: 'include',
        })
        if (!response.ok) throw new Error('Failed to fetch')
        return response.json()
      } catch (error) {
        // Return demo data if API fails
        return getDemoPayouts()
      }
    },
  })

  // Demo payouts for when API isn't available
  const getDemoPayouts = (): PendingPayout[] => [
    {
      id: '1',
      caseCode: 'MGR-2026-001',
      clientName: 'John Smith',
      clientEmail: 'john.smith@email.com',
      clientPhone: '5551234567',
      bankName: 'Chase Bank',
      routingNumber: '021000021',
      accountNumber: '****4567',
      surplusAmount: 4500000,
      feePercent: 30,
      feeAmount: 1350000,
      payoutAmount: 3150000,
      status: 'READY',
      caseStatus: 'PAID_OUT',
      county: 'Davidson',
      state: 'TN',
      createdAt: '2026-01-20',
      assignedAgent: 'bot-1',
    },
    {
      id: '2',
      caseCode: 'MGR-2026-002',
      clientName: 'Sarah Johnson',
      clientEmail: 'sarah.j@email.com',
      clientPhone: '5559876543',
      bankName: 'Bank of America',
      routingNumber: '026009593',
      accountNumber: '****8901',
      surplusAmount: 2800000,
      feePercent: 30,
      feeAmount: 840000,
      payoutAmount: 1960000,
      status: 'READY',
      caseStatus: 'PAID_OUT',
      county: 'Shelby',
      state: 'TN',
      createdAt: '2026-01-22',
    },
    {
      id: '3',
      caseCode: 'MGR-2026-003',
      clientName: 'Michael Brown',
      clientEmail: 'mbrown@email.com',
      clientPhone: '5555551212',
      surplusAmount: 1200000,
      feePercent: 30,
      feeAmount: 360000,
      payoutAmount: 840000,
      status: 'PENDING_INFO',
      caseStatus: 'SIGNED',
      county: 'Knox',
      state: 'TN',
      createdAt: '2026-01-24',
    },
  ]

  const pendingPayouts = payouts || getDemoPayouts()
  const readyPayouts = pendingPayouts.filter((p: PendingPayout) => p.status === 'READY')
  const totalPayout = readyPayouts.reduce((sum: number, p: PendingPayout) => sum + p.payoutAmount, 0)

  // Copy payout data to clipboard in Nickel-friendly format
  const copyPayoutData = (payout: PendingPayout) => {
    const data = `CLIENT PAYOUT - ${payout.caseCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recipient: ${payout.clientName}
Email: ${payout.clientEmail}
Phone: ${formatPhone(payout.clientPhone)}
${payout.bankName ? `Bank: ${payout.bankName}` : ''}
${payout.routingNumber ? `Routing: ${payout.routingNumber}` : ''}
${payout.accountNumber ? `Account: ${payout.accountNumber}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Amount: ${formatCurrency(payout.payoutAmount)}
(Surplus: ${formatCurrency(payout.surplusAmount)} - Fee: ${formatCurrency(payout.feeAmount)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Case: ${payout.caseCode} | ${payout.county}, ${payout.state}`

    navigator.clipboard.writeText(data)
    setCopiedId(payout.id)
    toast.success(`Copied ${payout.clientName}'s payout data`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Copy all selected payouts
  const copyAllSelected = () => {
    const selected = pendingPayouts.filter((p: PendingPayout) => selectedPayouts.has(p.id))
    if (selected.length === 0) {
      toast.error('Select at least one payout to copy')
      return
    }

    const allData = selected.map((p: PendingPayout) => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYOUT: ${p.clientName} - ${formatCurrency(p.payoutAmount)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${p.clientName}
Email: ${p.clientEmail}
Phone: ${formatPhone(p.clientPhone)}
${p.bankName ? `Bank: ${p.bankName}` : ''}
${p.routingNumber ? `Routing: ${p.routingNumber}` : ''}
${p.accountNumber ? `Account: ${p.accountNumber}` : ''}
Amount: ${formatCurrency(p.payoutAmount)}
Case: ${p.caseCode}
`).join('\n')

    navigator.clipboard.writeText(allData)
    toast.success(`Copied ${selected.length} payout(s) to clipboard`)
  }

  // Open Nickel in new tab
  const openNickel = () => {
    window.open(NICKEL_URL, '_blank', 'noopener,noreferrer')
    setNickelWindowOpen(true)
    toast.success('Nickel opened in new tab - paste your data there!')
  }

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedPayouts)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedPayouts(newSelected)
  }

  // Select all ready payouts
  const selectAllReady = () => {
    const readyIds = readyPayouts.map((p: PendingPayout) => p.id)
    setSelectedPayouts(new Set(readyIds))
  }

  // Assign bot to selected payouts
  const assignBotToPayouts = () => {
    if (!selectedBot || selectedPayouts.size === 0) {
      toast.error('Select a bot and at least one payout')
      return
    }

    const bot = bots.find(b => b.id === selectedBot)
    toast.success(`Assigned ${selectedPayouts.size} payout(s) to ${bot?.name}`)
    setAssignDialogOpen(false)
    setSelectedBot('')
    setSelectedPayouts(new Set())

    // Update bot stats (demo)
    setBots(prev => prev.map(b =>
      b.id === selectedBot
        ? { ...b, assignedPayouts: b.assignedPayouts + selectedPayouts.size, status: 'active' as const }
        : b
    ))
  }

  // Run bot automation
  const runBot = async (botId: string) => {
    const bot = bots.find(b => b.id === botId)
    if (!bot) return

    setBotRunning(botId)
    toast.info(`${bot.name} is preparing payouts...`)

    // Simulate bot processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Copy all ready payouts to clipboard
    const allReady = pendingPayouts.filter((p: PendingPayout) => p.status === 'READY')
    if (allReady.length > 0) {
      const allData = allReady.map((p: PendingPayout) => `
${p.clientName} | ${formatCurrency(p.payoutAmount)} | ${p.clientEmail}
Bank: ${p.bankName || 'N/A'} | Routing: ${p.routingNumber || 'N/A'} | Account: ${p.accountNumber || 'N/A'}
`).join('\n---\n')

      navigator.clipboard.writeText(allData)
      toast.success(`${bot.name} prepared ${allReady.length} payouts - data copied!`)

      // Open Nickel
      window.open(NICKEL_URL, '_blank', 'noopener,noreferrer')
      setNickelWindowOpen(true)
    }

    setBotRunning(null)
  }

  // Toggle bot status
  const toggleBotStatus = (botId: string) => {
    setBots(prev => prev.map(b => {
      if (b.id === botId) {
        const newStatus = b.status === 'active' ? 'paused' : 'active'
        toast.info(`${b.name} is now ${newStatus}`)
        return { ...b, status: newStatus as 'active' | 'paused' | 'idle' }
      }
      return b
    }))
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-8 h-8 text-green-600" />
            Nickel Payouts
          </h1>
          <p className="text-muted-foreground">
            Manage client payouts with AI-powered payroll bots
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={openNickel}
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Open Nickel Dashboard
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ready to Pay</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPayout)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clients Ready</p>
                <p className="text-2xl font-bold">{readyPayouts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <Bot className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Bots</p>
                <p className="text-2xl font-bold">{bots.filter(b => b.status === 'active').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Zap className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Processed Today</p>
                <p className="text-2xl font-bold">{bots.reduce((sum, b) => sum + b.processedToday, 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Bots Section */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600" />
            Payroll Bots
            <Badge variant="secondary" className="ml-2">AI-Powered</Badge>
          </CardTitle>
          <CardDescription>
            Assign AI agents to automate payout preparation and data entry
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {bots.map((bot) => (
              <Card key={bot.id} className={`${bot.status === 'active' ? 'border-green-300 bg-green-50' : ''}`}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{bot.avatar}</span>
                      <div>
                        <p className="font-semibold">{bot.name}</p>
                        <Badge
                          variant={bot.status === 'active' ? 'default' : 'secondary'}
                          className={bot.status === 'active' ? 'bg-green-500' : ''}
                        >
                          {bot.status}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={bot.status === 'active' ? 'destructive' : 'default'}
                      onClick={() => toggleBotStatus(bot.id)}
                    >
                      {bot.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <p className="text-muted-foreground">Assigned</p>
                      <p className="font-bold">{bot.assignedPayouts}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Today</p>
                      <p className="font-bold">{bot.processedToday}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-bold">{bot.totalProcessed}</p>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-3"
                    variant="outline"
                    disabled={botRunning === bot.id}
                    onClick={() => runBot(bot.id)}
                  >
                    {botRunning === bot.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Run Bot
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <Card className="border-2 border-dashed border-green-300 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Clipboard className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="font-semibold text-lg">Quick Payout Workflow</h3>
                <p className="text-sm text-muted-foreground">
                  1. Select payouts → 2. Assign bot or copy data → 3. Open Nickel → 4. Submit
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={selectAllReady}>
                Select All ({readyPayouts.length})
              </Button>
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={selectedPayouts.size === 0}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Assign Bot ({selectedPayouts.size})
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Payroll Bot</DialogTitle>
                    <DialogDescription>
                      Select a bot to handle {selectedPayouts.size} payout(s)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Select value={selectedBot} onValueChange={setSelectedBot}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a bot..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bots.map((bot) => (
                          <SelectItem key={bot.id} value={bot.id}>
                            {bot.avatar} {bot.name} ({bot.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={assignBotToPayouts}>
                      <Bot className="w-4 h-4 mr-2" />
                      Assign to Bot
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                onClick={copyAllSelected}
                disabled={selectedPayouts.size === 0}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy ({selectedPayouts.size})
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={openNickel}
              >
                <Send className="w-4 h-4 mr-2" />
                Go to Nickel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Payouts</CardTitle>
          <CardDescription>
            Clients awaiting their surplus fund payout
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedPayouts.size === readyPayouts.length && readyPayouts.length > 0}
                      onCheckedChange={() => {
                        if (selectedPayouts.size === readyPayouts.length) {
                          setSelectedPayouts(new Set())
                        } else {
                          selectAllReady()
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Surplus</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bot</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayouts.map((payout: PendingPayout) => (
                  <TableRow
                    key={payout.id}
                    className={selectedPayouts.has(payout.id) ? 'bg-green-50' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedPayouts.has(payout.id)}
                        onCheckedChange={() => toggleSelection(payout.id)}
                        disabled={payout.status !== 'READY'}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payout.clientName}</p>
                        <p className="text-sm text-muted-foreground">{payout.clientEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{payout.caseCode}</Badge>
                    </TableCell>
                    <TableCell>
                      {payout.county}, {payout.state}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payout.surplusAmount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(payout.feeAmount)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {formatCurrency(payout.payoutAmount)}
                    </TableCell>
                    <TableCell>
                      {payout.status === 'READY' ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Ready
                        </Badge>
                      ) : payout.status === 'PENDING_INFO' ? (
                        <Badge className="bg-yellow-100 text-yellow-700">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Need Info
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="w-3 h-3 mr-1" />
                          {payout.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {payout.assignedAgent ? (
                        <Badge variant="outline" className="bg-purple-50">
                          <Bot className="w-3 h-3 mr-1" />
                          {bots.find(b => b.id === payout.assignedAgent)?.name || 'Bot'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={copiedId === payout.id ? 'default' : 'outline'}
                        onClick={() => copyPayoutData(payout)}
                        disabled={payout.status !== 'READY'}
                      >
                        {copiedId === payout.id ? (
                          <>
                            <ClipboardCheck className="w-4 h-4 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            How to Use Nickel + Payroll Bots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center mb-2 font-bold">1</div>
              <h4 className="font-semibold">Assign Bot</h4>
              <p className="text-sm text-muted-foreground">Select payouts and assign to a payroll bot for automatic preparation</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center mb-2 font-bold">2</div>
              <h4 className="font-semibold">Run Bot</h4>
              <p className="text-sm text-muted-foreground">Click "Run Bot" to auto-copy all payout data to clipboard</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center mb-2 font-bold">3</div>
              <h4 className="font-semibold">Open Nickel</h4>
              <p className="text-sm text-muted-foreground">Bot opens Nickel automatically - paste the prepared data</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center mb-2 font-bold">4</div>
              <h4 className="font-semibold">Review & Submit</h4>
              <p className="text-sm text-muted-foreground">Review the data in Nickel and submit the transfers</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <p className="text-sm">
              <strong>Why Nickel + Bots?</strong> Nickel offers FREE unlimited ACH transfers. Payroll bots automate
              data preparation so you just review and click submit - saving hours of manual data entry.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Nickel reminder toast */}
      <AnimatePresence>
        {nickelWindowOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border-2 border-green-500 max-w-sm"
          >
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold">Nickel Tab Open</h4>
                <p className="text-sm text-muted-foreground">
                  Paste the copied data in Nickel, review the details, and submit.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setNickelWindowOpen(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
