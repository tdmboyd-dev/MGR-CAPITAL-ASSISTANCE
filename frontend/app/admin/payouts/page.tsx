'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DollarSign, RefreshCw, Loader2, CheckCircle, Clock, Search,
  AlertTriangle, ArrowRight, FileText, Download, Eye, XCircle
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

// Format date
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface LedgerEntry {
  id: string
  type: string
  amountCents: number
  displayedAmountCents?: number
  status: string
  description?: string
  createdAt: string
  completedAt?: string
  reference?: string
  case?: {
    internalCode: string
  }
  user?: {
    name: string
    email: string
    employeeTier?: string
  }
}

export default function AdminPayoutsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const queryClient = useQueryClient()

  // Fetch payouts/ledger entries
  const { data: payoutsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-payouts', statusFilter, typeFilter],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.append('status', statusFilter)
        if (typeFilter !== 'all') params.append('type', typeFilter)
        params.append('limit', '100')

        const { data } = await api.get(`/payouts?${params.toString()}`)
        return data
      } catch (error) {
        // Re-throw to show error UI instead of fake financial data
        throw error
      }
    },
  })

  // Complete payout mutation
  const completeMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { data } = await api.post(`/payouts/${entryId}/complete`, {
        reference,
        notes,
        paymentMethod: 'ACH'
      })
      return data
    },
    onSuccess: () => {
      toast.success('Payout marked as completed')
      setCompleteDialogOpen(false)
      setSelectedEntry(null)
      setReference('')
      setNotes('')
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to complete payout')
    }
  })

  const entries: LedgerEntry[] = payoutsData?.data || []

  // Filter entries
  const filteredEntries = entries.filter(entry => {
    const searchLower = search.toLowerCase()
    return (
      entry.description?.toLowerCase().includes(searchLower) ||
      entry.case?.internalCode?.toLowerCase().includes(searchLower) ||
      entry.user?.name?.toLowerCase().includes(searchLower) ||
      entry.user?.email?.toLowerCase().includes(searchLower)
    )
  })

  // Calculate stats
  const stats = {
    totalPending: entries.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + e.amountCents, 0),
    totalCompleted: entries.filter(e => e.status === 'COMPLETED').reduce((sum, e) => sum + e.amountCents, 0),
    pendingCount: entries.filter(e => e.status === 'PENDING').length,
    completedCount: entries.filter(e => e.status === 'COMPLETED').length,
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'CLIENT_PAYOUT':
        return <Badge className="bg-blue-100 text-blue-700">Client Payout</Badge>
      case 'EMPLOYEE_COMMISSION':
        return <Badge className="bg-green-100 text-green-700">Employee Commission</Badge>
      case 'COMPANY_FEE':
        return <Badge className="bg-purple-100 text-purple-700">Company Fee</Badge>
      case 'FOUNDER_SHARE':
        return <Badge className="bg-amber-100 text-amber-700">Founder Share</Badge>
      case 'OVERRIDE':
        return <Badge className="bg-cyan-100 text-cyan-700">Override Commission</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const handleComplete = (entry: LedgerEntry) => {
    setSelectedEntry(entry)
    setCompleteDialogOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-green-600" />
            Payout Management
          </h1>
          <p className="text-muted-foreground">
            Review, approve, and track all payouts
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Payouts</p>
                <p className="text-2xl font-bold text-yellow-700">{formatCurrency(stats.totalPending)}</p>
                <p className="text-xs text-muted-foreground">{stats.pendingCount} entries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(stats.totalCompleted)}</p>
                <p className="text-xs text-muted-foreground">{stats.completedCount} entries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Volume</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(stats.totalPending + stats.totalCompleted)}
                </p>
                <p className="text-xs text-muted-foreground">{entries.length} total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold text-purple-700">
                  {entries.length > 0 ? Math.round((stats.completedCount / entries.length) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">of all payouts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by case, recipient, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="CLIENT_PAYOUT">Client Payouts</SelectItem>
                <SelectItem value="EMPLOYEE_COMMISSION">Commissions</SelectItem>
                <SelectItem value="COMPANY_FEE">Company Fees</SelectItem>
                <SelectItem value="FOUNDER_SHARE">Founder Share</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Ledger ({filteredEntries.length})</CardTitle>
          <CardDescription>
            All payout entries - mark as complete when ACH transfer is done
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No payout entries found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.case?.internalCode || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>{getTypeBadge(entry.type)}</TableCell>
                    <TableCell>
                      {entry.user ? (
                        <div>
                          <p className="font-medium">{entry.user.name}</p>
                          <p className="text-xs text-muted-foreground">{entry.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Company</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(entry.amountCents)}
                      {entry.displayedAmountCents && entry.displayedAmountCents !== entry.amountCents && (
                        <p className="text-xs text-muted-foreground">
                          (displayed: {formatCurrency(entry.displayedAmountCents)})
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Payout Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Type</p>
                                  <p className="font-medium">{entry.type.replace(/_/g, ' ')}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Amount</p>
                                  <p className="font-medium">{formatCurrency(entry.amountCents)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Status</p>
                                  {getStatusBadge(entry.status)}
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Case</p>
                                  <p className="font-medium">{entry.case?.internalCode || 'N/A'}</p>
                                </div>
                              </div>
                              {entry.description && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Description</p>
                                  <p>{entry.description}</p>
                                </div>
                              )}
                              {entry.reference && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Payment Reference</p>
                                  <p className="font-mono text-sm">{entry.reference}</p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>

                        {entry.status === 'PENDING' && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleComplete(entry)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Complete Payout Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Payout</DialogTitle>
            <DialogDescription>
              Mark this payout as completed after ACH transfer is done.
              A payment reference is required for audit compliance.
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold">{formatCurrency(selectedEntry.amountCents)}</span>
                  <span className="text-muted-foreground">Recipient:</span>
                  <span>{selectedEntry.user?.name || 'Company'}</span>
                  <span className="text-muted-foreground">Type:</span>
                  <span>{selectedEntry.type.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Reference *</label>
                <Input
                  placeholder="e.g., ACH-2026-001234 or Nickel transaction ID"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the ACH confirmation number or Nickel transaction ID
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input
                  placeholder="Any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => selectedEntry && completeMutation.mutate(selectedEntry.id)}
              disabled={!reference || completeMutation.isPending}
            >
              {completeMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Mark as Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-800">Payout Workflow</h4>
              <ol className="mt-2 text-sm text-blue-700 list-decimal list-inside space-y-1">
                <li>Cases move to "AWAITING_FUNDS" when funds are received from county</li>
                <li>Founder processes payout via Founder Dashboard &rarr; Payouts &rarr; Nickel</li>
                <li>ACH transfers are initiated in Nickel dashboard</li>
                <li>Once ACH clears, mark payout as "Completed" here with reference number</li>
                <li>All completions are logged for audit compliance</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
