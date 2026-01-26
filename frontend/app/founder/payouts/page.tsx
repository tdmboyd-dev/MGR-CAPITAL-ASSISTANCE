'use client'

import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  DollarSign, ExternalLink, Copy, CheckCircle, Clock,
  Users, Building2, RefreshCw, Loader2, ArrowRight,
  Clipboard, ClipboardCheck, Send, AlertCircle, Bot,
  UserPlus, Sparkles, Zap, Play, Pause, User, Briefcase, Crown
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

// Nickel URL
const NICKEL_URL = 'https://app.nickelpayments.com'

// Types for the new payout structure
interface PayoutRecipient {
  name: string
  email: string
  phone?: string
  bankName?: string
  routingNumber?: string
  accountNumber?: string
}

interface ClientPayout extends PayoutRecipient {
  payoutCents: number
}

interface EmployeePayout extends PayoutRecipient {
  id: string
  tier: string
  commissionCents: number
  commissionRate: number
}

interface FounderPayout extends PayoutRecipient {
  shareCents: number
}

interface CasePayout {
  id: string
  caseCode: string
  caseStatus: string
  county: string
  state: string
  createdAt: string
  status: 'READY' | 'PENDING_INFO' | 'PROCESSING' | 'COMPLETED'
  surplusAmountCents: number
  feePercent: number
  companyFeeCents: number
  client: ClientPayout
  employee: EmployeePayout | null
  founder: FounderPayout
  override: {
    recipientId: string
    commissionCents: number
  } | null
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
const formatPhone = (phone?: string) => {
  if (!phone) return 'N/A'
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

// Demo data for when API isn't available
const getDemoPayouts = (): CasePayout[] => [
  {
    id: '1',
    caseCode: 'MGR-2026-001',
    caseStatus: 'AWAITING_FUNDS',
    county: 'Davidson',
    state: 'TN',
    createdAt: '2026-01-20',
    status: 'READY',
    surplusAmountCents: 4500000,
    feePercent: 33,
    companyFeeCents: 1350000,
    client: {
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '5551234567',
      bankName: 'Chase Bank',
      routingNumber: '021000021',
      accountNumber: '****4567',
      payoutCents: 3150000,
    },
    employee: {
      id: 'emp-1',
      name: 'Sarah Wilson',
      email: 'sarah.w@mgrcapital.com',
      phone: '5559998888',
      tier: 'TIER_2_SPECIALIST',
      bankName: 'Wells Fargo',
      routingNumber: '121000248',
      accountNumber: '****7890',
      commissionCents: 270000, // 20% actual of $13,500 fee
      commissionRate: 20,
    },
    founder: {
      name: 'MGR Capital',
      email: 'admin@capitalmgr.com',
      bankName: 'Bank of America',
      routingNumber: '026009593',
      accountNumber: '****1234',
      shareCents: 1080000, // $10,800 founder share
    },
    override: null,
  },
  {
    id: '2',
    caseCode: 'MGR-2026-002',
    caseStatus: 'AWAITING_FUNDS',
    county: 'Shelby',
    state: 'TN',
    createdAt: '2026-01-22',
    status: 'READY',
    surplusAmountCents: 2800000,
    feePercent: 33,
    companyFeeCents: 840000,
    client: {
      name: 'Maria Garcia',
      email: 'maria.g@email.com',
      phone: '5559876543',
      bankName: 'Bank of America',
      routingNumber: '026009593',
      accountNumber: '****8901',
      payoutCents: 1960000,
    },
    employee: {
      id: 'emp-2',
      name: 'James Brown',
      email: 'james.b@mgrcapital.com',
      phone: '5557776666',
      tier: 'TIER_1_ASSOCIATE',
      bankName: 'Chase Bank',
      routingNumber: '021000021',
      accountNumber: '****3456',
      commissionCents: 84000, // 10% actual of $8,400 fee
      commissionRate: 10,
    },
    founder: {
      name: 'MGR Capital',
      email: 'admin@capitalmgr.com',
      bankName: 'Bank of America',
      routingNumber: '026009593',
      accountNumber: '****1234',
      shareCents: 756000, // $7,560 founder share
    },
    override: null,
  },
  {
    id: '3',
    caseCode: 'MGR-2026-003',
    caseStatus: 'SIGNED',
    county: 'Knox',
    state: 'TN',
    createdAt: '2026-01-24',
    status: 'PENDING_INFO',
    surplusAmountCents: 1200000,
    feePercent: 33,
    companyFeeCents: 360000,
    client: {
      name: 'Michael Brown',
      email: 'mbrown@email.com',
      phone: '5555551212',
      payoutCents: 840000,
    },
    employee: null, // Not yet assigned
    founder: {
      name: 'MGR Capital',
      email: 'admin@capitalmgr.com',
      shareCents: 360000, // Full fee since no employee
    },
    override: null,
  },
]

type PayoutType = 'client' | 'employee' | 'founder'

export default function NickelPayoutsPage() {
  const [activeTab, setActiveTab] = useState<PayoutType>('client')
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
        return getDemoPayouts()
      }
    },
  })

  const allPayouts: CasePayout[] = payouts || getDemoPayouts()
  const readyPayouts = allPayouts.filter(p => p.status === 'READY')

  // Calculate totals for each type
  const totals = {
    client: readyPayouts.reduce((sum, p) => sum + p.client.payoutCents, 0),
    employee: readyPayouts.reduce((sum, p) => sum + (p.employee?.commissionCents || 0), 0),
    founder: readyPayouts.reduce((sum, p) => sum + p.founder.shareCents, 0),
  }

  // Copy single payout data based on type
  const copyPayoutData = (payout: CasePayout, type: PayoutType) => {
    let data = ''
    let recipient = ''

    if (type === 'client') {
      recipient = payout.client.name
      data = `CLIENT ACH PAYOUT - ${payout.caseCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recipient: ${payout.client.name}
Email: ${payout.client.email}
Phone: ${formatPhone(payout.client.phone)}
${payout.client.bankName ? `Bank: ${payout.client.bankName}` : ''}
${payout.client.routingNumber ? `Routing: ${payout.client.routingNumber}` : ''}
${payout.client.accountNumber ? `Account: ${payout.client.accountNumber}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Amount: ${formatCurrency(payout.client.payoutCents)}
Type: Client Payout (${100 - payout.feePercent}% of surplus)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Case: ${payout.caseCode} | ${payout.county}, ${payout.state}
Surplus: ${formatCurrency(payout.surplusAmountCents)}`
    } else if (type === 'employee' && payout.employee) {
      recipient = payout.employee.name
      data = `EMPLOYEE COMMISSION ACH - ${payout.caseCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recipient: ${payout.employee.name}
Email: ${payout.employee.email}
Phone: ${formatPhone(payout.employee.phone)}
Tier: ${payout.employee.tier.replace('_', ' ')}
${payout.employee.bankName ? `Bank: ${payout.employee.bankName}` : ''}
${payout.employee.routingNumber ? `Routing: ${payout.employee.routingNumber}` : ''}
${payout.employee.accountNumber ? `Account: ${payout.employee.accountNumber}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Amount: ${formatCurrency(payout.employee.commissionCents)}
Type: Employee Commission (${payout.employee.commissionRate}% of company fee)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Case: ${payout.caseCode} | ${payout.county}, ${payout.state}
Company Fee: ${formatCurrency(payout.companyFeeCents)}`
    } else if (type === 'founder') {
      recipient = payout.founder.name
      data = `FOUNDER SHARE ACH - ${payout.caseCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recipient: ${payout.founder.name}
Email: ${payout.founder.email}
Phone: ${formatPhone(payout.founder.phone)}
${payout.founder.bankName ? `Bank: ${payout.founder.bankName}` : ''}
${payout.founder.routingNumber ? `Routing: ${payout.founder.routingNumber}` : ''}
${payout.founder.accountNumber ? `Account: ${payout.founder.accountNumber}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Amount: ${formatCurrency(payout.founder.shareCents)}
Type: Founder Share (Company Fee - Employee Commission)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Case: ${payout.caseCode} | ${payout.county}, ${payout.state}
Company Fee: ${formatCurrency(payout.companyFeeCents)}
Employee Commission: ${formatCurrency(payout.employee?.commissionCents || 0)}`
    }

    navigator.clipboard.writeText(data)
    setCopiedId(`${payout.id}-${type}`)
    toast.success(`Copied ${recipient}'s ${type} payout data`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Copy all selected payouts for current tab
  const copyAllSelected = () => {
    const selected = allPayouts.filter(p => selectedPayouts.has(p.id))
    if (selected.length === 0) {
      toast.error('Select at least one payout to copy')
      return
    }

    let allData = ''
    if (activeTab === 'client') {
      allData = selected.map(p => `
${p.client.name} | ${formatCurrency(p.client.payoutCents)} | ${p.client.email}
Bank: ${p.client.bankName || 'N/A'} | Routing: ${p.client.routingNumber || 'N/A'} | Account: ${p.client.accountNumber || 'N/A'}
Case: ${p.caseCode}
`).join('\n---\n')
    } else if (activeTab === 'employee') {
      allData = selected.filter(p => p.employee).map(p => `
${p.employee!.name} | ${formatCurrency(p.employee!.commissionCents)} | ${p.employee!.email}
Bank: ${p.employee!.bankName || 'N/A'} | Routing: ${p.employee!.routingNumber || 'N/A'} | Account: ${p.employee!.accountNumber || 'N/A'}
Case: ${p.caseCode} | Commission Rate: ${p.employee!.commissionRate}%
`).join('\n---\n')
    } else {
      allData = selected.map(p => `
${p.founder.name} | ${formatCurrency(p.founder.shareCents)} | ${p.founder.email}
Bank: ${p.founder.bankName || 'N/A'} | Routing: ${p.founder.routingNumber || 'N/A'} | Account: ${p.founder.accountNumber || 'N/A'}
Case: ${p.caseCode}
`).join('\n---\n')
    }

    navigator.clipboard.writeText(allData)
    toast.success(`Copied ${selected.length} ${activeTab} payout(s) to clipboard`)
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
    const readyIds = readyPayouts.map(p => p.id)
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

    setBots(prev => prev.map(b =>
      b.id === selectedBot
        ? { ...b, assignedPayouts: b.assignedPayouts + selectedPayouts.size, status: 'active' as const }
        : b
    ))
  }

  // Run bot automation for current tab
  const runBot = async (botId: string) => {
    const bot = bots.find(b => b.id === botId)
    if (!bot) return

    setBotRunning(botId)
    toast.info(`${bot.name} is preparing ${activeTab} payouts...`)

    await new Promise(resolve => setTimeout(resolve, 2000))

    // Copy based on active tab
    let allData = ''
    const ready = readyPayouts

    if (activeTab === 'client') {
      allData = ready.map(p => `
CLIENT: ${p.client.name} | ${formatCurrency(p.client.payoutCents)}
Email: ${p.client.email} | Phone: ${formatPhone(p.client.phone)}
Bank: ${p.client.bankName || 'N/A'} | Routing: ${p.client.routingNumber || 'N/A'} | Account: ${p.client.accountNumber || 'N/A'}
`).join('\n---\n')
    } else if (activeTab === 'employee') {
      allData = ready.filter(p => p.employee).map(p => `
EMPLOYEE: ${p.employee!.name} | ${formatCurrency(p.employee!.commissionCents)}
Email: ${p.employee!.email} | Tier: ${p.employee!.tier}
Bank: ${p.employee!.bankName || 'N/A'} | Routing: ${p.employee!.routingNumber || 'N/A'} | Account: ${p.employee!.accountNumber || 'N/A'}
`).join('\n---\n')
    } else {
      allData = ready.map(p => `
FOUNDER: ${p.founder.name} | ${formatCurrency(p.founder.shareCents)}
Email: ${p.founder.email}
Bank: ${p.founder.bankName || 'N/A'} | Routing: ${p.founder.routingNumber || 'N/A'} | Account: ${p.founder.accountNumber || 'N/A'}
`).join('\n---\n')
    }

    if (allData) {
      navigator.clipboard.writeText(allData)
      toast.success(`${bot.name} prepared ${ready.length} ${activeTab} payouts - data copied!`)
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

  // Get icon for tab
  const getTabIcon = (type: PayoutType) => {
    switch (type) {
      case 'client': return <User className="w-4 h-4" />
      case 'employee': return <Briefcase className="w-4 h-4" />
      case 'founder': return <Crown className="w-4 h-4" />
    }
  }

  // Get color for tab
  const getTabColor = (type: PayoutType) => {
    switch (type) {
      case 'client': return 'text-blue-600 bg-blue-100'
      case 'employee': return 'text-green-600 bg-green-100'
      case 'founder': return 'text-purple-600 bg-purple-100'
    }
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
            Manage ACH transfers for Clients, Employees, and Founder
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

      {/* Summary Cards - All Three Payout Types */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Client Payouts</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(totals.client)}</p>
                <p className="text-xs text-muted-foreground">{readyPayouts.length} clients ready</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <Briefcase className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employee Commissions</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(totals.employee)}</p>
                <p className="text-xs text-muted-foreground">{readyPayouts.filter(p => p.employee).length} employees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <Crown className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Founder Share</p>
                <p className="text-2xl font-bold text-purple-700">{formatCurrency(totals.founder)}</p>
                <p className="text-xs text-muted-foreground">From {readyPayouts.length} cases</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Surplus</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {formatCurrency(readyPayouts.reduce((sum, p) => sum + p.surplusAmountCents, 0))}
                </p>
                <p className="text-xs text-muted-foreground">Ready to distribute</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout Distribution Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Payout Distribution Structure
          </CardTitle>
          <CardDescription>
            How surplus funds are split: Client (67%) + Company Fee (33%) = Employee Commission + Founder Share
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1 text-center p-4 bg-yellow-100 rounded-lg">
              <p className="text-sm text-yellow-700 font-medium">Total Surplus</p>
              <p className="text-xl font-bold text-yellow-800">100%</p>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="flex-1 space-y-2">
              <div className="p-3 bg-blue-100 rounded-lg text-center">
                <p className="text-sm text-blue-700 font-medium">Client Payout</p>
                <p className="text-lg font-bold text-blue-800">67%</p>
              </div>
              <div className="p-3 bg-gray-200 rounded-lg text-center">
                <p className="text-sm text-gray-700 font-medium">Company Fee</p>
                <p className="text-lg font-bold text-gray-800">33%</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="flex-1 space-y-2">
              <div className="p-3 bg-green-100 rounded-lg text-center">
                <p className="text-sm text-green-700 font-medium">Employee</p>
                <p className="text-lg font-bold text-green-800">10-50%*</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg text-center">
                <p className="text-sm text-purple-700 font-medium">Founder</p>
                <p className="text-lg font-bold text-purple-800">Remainder</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">*Employee commission % varies by tier (10% Tier 1 to 50% Tier 5)</p>
        </CardContent>
      </Card>

      {/* Payroll Bots Section */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600" />
            Payroll Bots
            <Badge variant="secondary" className="ml-2">AI-Powered</Badge>
          </CardTitle>
          <CardDescription>
            Assign AI agents to automate ACH data preparation for {activeTab} payouts
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
                        Processing {activeTab}...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Run for {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}s
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Payout Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as PayoutType); setSelectedPayouts(new Set()) }}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-fit grid-cols-3">
            <TabsTrigger value="client" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Clients ({readyPayouts.length})
            </TabsTrigger>
            <TabsTrigger value="employee" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Employees ({readyPayouts.filter(p => p.employee).length})
            </TabsTrigger>
            <TabsTrigger value="founder" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Founder ({readyPayouts.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" onClick={selectAllReady}>
              Select All
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
                    Select a bot to handle {selectedPayouts.size} {activeTab} payout(s)
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
            <Button className="bg-green-600 hover:bg-green-700" onClick={openNickel}>
              <Send className="w-4 h-4 mr-2" />
              Go to Nickel
            </Button>
          </div>
        </div>

        {/* Client Payouts Tab */}
        <TabsContent value="client">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Client ACH Payouts
              </CardTitle>
              <CardDescription>
                67% of surplus goes to clients after successful recovery
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
                      <TableHead>Banking</TableHead>
                      <TableHead className="text-right">Surplus</TableHead>
                      <TableHead className="text-right">Payout (67%)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPayouts.map((payout) => (
                      <TableRow key={payout.id} className={selectedPayouts.has(payout.id) ? 'bg-blue-50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPayouts.has(payout.id)}
                            onCheckedChange={() => toggleSelection(payout.id)}
                            disabled={payout.status !== 'READY'}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payout.client.name}</p>
                            <p className="text-sm text-muted-foreground">{payout.client.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payout.caseCode}</Badge>
                          <p className="text-xs text-muted-foreground">{payout.county}, {payout.state}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{payout.client.bankName || 'Not provided'}</p>
                          <p className="text-xs text-muted-foreground">
                            {payout.client.routingNumber ? `Routing: ${payout.client.routingNumber}` : 'No routing'}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(payout.surplusAmountCents)}</TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          {formatCurrency(payout.client.payoutCents)}
                        </TableCell>
                        <TableCell>
                          {payout.status === 'READY' ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Ready
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {payout.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={copiedId === `${payout.id}-client` ? 'default' : 'outline'}
                            onClick={() => copyPayoutData(payout, 'client')}
                            disabled={payout.status !== 'READY'}
                          >
                            {copiedId === `${payout.id}-client` ? (
                              <><ClipboardCheck className="w-4 h-4 mr-1" /> Copied!</>
                            ) : (
                              <><Copy className="w-4 h-4 mr-1" /> Copy</>
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
        </TabsContent>

        {/* Employee Commissions Tab */}
        <TabsContent value="employee">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-600" />
                Employee Commission ACH
              </CardTitle>
              <CardDescription>
                Commission based on tier (10-50% of company fee) paid to assigned employees
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
                          checked={selectedPayouts.size === readyPayouts.filter(p => p.employee).length && readyPayouts.filter(p => p.employee).length > 0}
                          onCheckedChange={() => {
                            if (selectedPayouts.size === readyPayouts.filter(p => p.employee).length) {
                              setSelectedPayouts(new Set())
                            } else {
                              setSelectedPayouts(new Set(readyPayouts.filter(p => p.employee).map(p => p.id)))
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Case</TableHead>
                      <TableHead>Banking</TableHead>
                      <TableHead className="text-right">Company Fee</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPayouts.filter(p => p.employee).map((payout) => (
                      <TableRow key={payout.id} className={selectedPayouts.has(payout.id) ? 'bg-green-50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPayouts.has(payout.id)}
                            onCheckedChange={() => toggleSelection(payout.id)}
                            disabled={payout.status !== 'READY'}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payout.employee!.name}</p>
                            <p className="text-sm text-muted-foreground">{payout.employee!.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50">
                            {payout.employee!.tier.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payout.caseCode}</Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{payout.employee!.bankName || 'Not provided'}</p>
                          <p className="text-xs text-muted-foreground">
                            {payout.employee!.routingNumber ? `Routing: ${payout.employee!.routingNumber}` : 'No routing'}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(payout.companyFeeCents)}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-green-600">{formatCurrency(payout.employee!.commissionCents)}</span>
                          <p className="text-xs text-muted-foreground">{payout.employee!.commissionRate}%</p>
                        </TableCell>
                        <TableCell>
                          {payout.status === 'READY' ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Ready
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {payout.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={copiedId === `${payout.id}-employee` ? 'default' : 'outline'}
                            onClick={() => copyPayoutData(payout, 'employee')}
                            disabled={payout.status !== 'READY'}
                          >
                            {copiedId === `${payout.id}-employee` ? (
                              <><ClipboardCheck className="w-4 h-4 mr-1" /> Copied!</>
                            ) : (
                              <><Copy className="w-4 h-4 mr-1" /> Copy</>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {allPayouts.filter(p => !p.employee && p.status === 'READY').length > 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-4 bg-yellow-50">
                          <AlertCircle className="w-4 h-4 inline mr-2 text-yellow-600" />
                          {allPayouts.filter(p => !p.employee && p.status === 'READY').length} case(s) have no employee assigned - full fee goes to founder
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Founder Share Tab */}
        <TabsContent value="founder">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-600" />
                Founder Share ACH
              </CardTitle>
              <CardDescription>
                Company fee minus employee commission = Founder profit
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
                      <TableHead>Case</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Banking</TableHead>
                      <TableHead className="text-right">Company Fee</TableHead>
                      <TableHead className="text-right">Employee Cut</TableHead>
                      <TableHead className="text-right">Founder Share</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPayouts.map((payout) => (
                      <TableRow key={payout.id} className={selectedPayouts.has(payout.id) ? 'bg-purple-50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPayouts.has(payout.id)}
                            onCheckedChange={() => toggleSelection(payout.id)}
                            disabled={payout.status !== 'READY'}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payout.caseCode}</Badge>
                          <p className="text-xs text-muted-foreground">{payout.county}, {payout.state}</p>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payout.founder.name}</p>
                            <p className="text-sm text-muted-foreground">{payout.founder.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{payout.founder.bankName || 'Not provided'}</p>
                          <p className="text-xs text-muted-foreground">
                            {payout.founder.routingNumber ? `Routing: ${payout.founder.routingNumber}` : 'No routing'}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(payout.companyFeeCents)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          -{formatCurrency(payout.employee?.commissionCents || 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-purple-600">
                          {formatCurrency(payout.founder.shareCents)}
                        </TableCell>
                        <TableCell>
                          {payout.status === 'READY' ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Ready
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {payout.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={copiedId === `${payout.id}-founder` ? 'default' : 'outline'}
                            onClick={() => copyPayoutData(payout, 'founder')}
                            disabled={payout.status !== 'READY'}
                          >
                            {copiedId === `${payout.id}-founder` ? (
                              <><ClipboardCheck className="w-4 h-4 mr-1" /> Copied!</>
                            ) : (
                              <><Copy className="w-4 h-4 mr-1" /> Copy</>
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
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            How ACH Payouts Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-blue-800">1. Client Payouts</h4>
              </div>
              <p className="text-sm text-blue-700">
                Clients receive 67% of surplus. Copy their ACH info, paste in Nickel, and send their share first.
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-800">2. Employee Commissions</h4>
              </div>
              <p className="text-sm text-green-700">
                Employees earn 10-50% of company fee based on tier. Copy their ACH info and pay their commission.
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-purple-600" />
                <h4 className="font-semibold text-purple-800">3. Founder Share</h4>
              </div>
              <p className="text-sm text-purple-700">
                Founder keeps the remainder (company fee minus employee commission). Transfer to founder account.
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>Tip:</strong> Use the payroll bots to automatically copy all payouts of a type to your clipboard,
              then paste directly into Nickel. The bots prepare formatted data for quick entry.
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
                  Paste the copied {activeTab} payout data in Nickel, review, and submit.
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
