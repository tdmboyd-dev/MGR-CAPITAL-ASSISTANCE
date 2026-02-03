'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DollarSign, RefreshCw, Loader2, CheckCircle, Clock,
  TrendingUp, Wallet, Calendar, Award, Building
} from 'lucide-react'
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

interface Payout {
  id: string
  caseCode: string
  property: string
  location: string
  amountCents: number
  status: string
  date: string
}

interface EarningsSummary {
  lifetimeEarningsCents: number
  thisMonthCents: number
  pendingCents: number
}

export default function EmployeePayoutsPage() {
  // Fetch employee's own payouts
  const { data: payoutsData, isLoading: payoutsLoading, refetch: refetchPayouts } = useQuery({
    queryKey: ['my-payouts'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/payouts/my')
        return data
      } catch {
        // Demo data
        return {
          data: {
            totalEarnedCents: 425000,
            pendingCents: 75000,
            payouts: [
              {
                id: 'pay-1',
                caseCode: 'MGR-2026-001',
                property: '123 Main St',
                location: 'Davidson, TN',
                amountCents: 125000,
                status: 'COMPLETED',
                date: new Date(Date.now() - 7 * 86400000).toISOString()
              },
              {
                id: 'pay-2',
                caseCode: 'MGR-2026-002',
                property: '456 Oak Ave',
                location: 'Shelby, TN',
                amountCents: 75000,
                status: 'PENDING',
                date: new Date().toISOString()
              },
              {
                id: 'pay-3',
                caseCode: 'MGR-2025-089',
                property: '789 Pine Rd',
                location: 'Knox, TN',
                amountCents: 300000,
                status: 'COMPLETED',
                date: new Date(Date.now() - 30 * 86400000).toISOString()
              },
            ]
          }
        }
      }
    },
  })

  // Fetch summary
  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<{ data: EarningsSummary }>({
    queryKey: ['my-earnings-summary'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/payouts/my/summary')
        return data
      } catch {
        return {
          data: {
            lifetimeEarningsCents: 850000,
            thisMonthCents: 200000,
            pendingCents: 75000
          }
        }
      }
    },
  })

  const isLoading = payoutsLoading || summaryLoading
  const payouts: Payout[] = payoutsData?.data?.payouts || []
  const summary = summaryData?.data || {
    lifetimeEarningsCents: 0,
    thisMonthCents: 0,
    pendingCents: 0
  }

  const handleRefresh = () => {
    refetchPayouts()
    refetchSummary()
  }

  // Calculate tier progress (demo - would come from employee profile)
  const tierProgress = 65 // Percentage to next tier

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge className="bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="w-8 h-8 text-green-600" />
            My Earnings
          </h1>
          <p className="text-muted-foreground">
            Track your commissions and payout history
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-full">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Lifetime Earnings</p>
                      <p className="text-2xl font-bold text-green-700">
                        {formatCurrency(summary.lifetimeEarningsCents)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">This Month</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatCurrency(summary.thisMonthCents)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 rounded-full">
                      <Clock className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold text-yellow-700">
                        {formatCurrency(summary.pendingCents)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-full">
                      <Award className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cases Completed</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {payouts.filter(p => p.status === 'COMPLETED').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Tier Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Commission Tier Progress
              </CardTitle>
              <CardDescription>
                Your progress toward the next commission tier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-700">Current: Tier 2</Badge>
                    <span className="text-muted-foreground">20% Commission</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-700">Next: Tier 3</Badge>
                    <span className="text-muted-foreground">30% Commission</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress value={tierProgress} className="h-3" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{tierProgress}% complete</span>
                    <span>3 more cases needed</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  Complete 3 more cases to unlock Tier 3 and earn 30% commission on all future cases!
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payouts Table */}
          <Card>
            <CardHeader>
              <CardTitle>Commission History</CardTitle>
              <CardDescription>
                Your earnings from completed and pending cases
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No commissions yet. Complete cases to start earning!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Case</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout, index) => (
                      <motion.tr
                        key={payout.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b"
                      >
                        <TableCell className="text-muted-foreground">
                          {formatDate(payout.date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payout.caseCode}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{payout.property}</TableCell>
                        <TableCell className="text-muted-foreground">{payout.location}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${payout.status === 'COMPLETED' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {formatCurrency(payout.amountCents)}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <h4 className="font-semibold text-blue-800 mb-4">How Commissions Work</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">1</div>
                    <h5 className="font-medium">Case Completed</h5>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When a case you're assigned to is successfully recovered, your commission is calculated.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">2</div>
                    <h5 className="font-medium">Pending Status</h5>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Commission shows as "Pending" while funds are being processed through Nickel ACH.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">3</div>
                    <h5 className="font-medium">Paid</h5>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Once ACH transfer clears (typically 2-3 business days), status changes to "Paid".
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
