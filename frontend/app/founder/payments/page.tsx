'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card'

import { useQuery } from '@tanstack/react-query'
import { AnimatePresence,motion } from 'framer-motion'
import { Activity, AlertTriangle, CheckCircle, Clock, DollarSign, Loader2, RefreshCw, ShieldAlert, ShieldCheck, TrendingUp, XCircle, Zap } from 'lucide-react';
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { paymentListSchema, paymentMetricsSchema } from '@/lib/paymentRecords'
import { useState } from 'react'
import { Area,AreaChart,CartesianGrid,Cell,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import { toast } from 'sonner'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

interface FraudScore {
  score: number
  risk: 'low' | 'medium' | 'high' | 'critical'
  factors: string[]
  recommendation: 'approve' | 'review' | 'block'
  confidence: number
}

interface Payment {
  id: string
  amount: number
  method: string | null
  status: string
  clientId?: string
  clientName?: string
  description?: string
  createdAt: string
  fraudScore?: FraudScore
}

export default function PaymentsDashboard() {
  const [refreshing, setRefreshing] = useState(false)
  const { user } = useAuth()
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const paymentQuery = useQuery({
    queryKey: ['payments', user?.id], enabled: user?.role === 'FOUNDER',
    queryFn: async ({ signal }) => paymentListSchema.parse((await api.get<unknown>('/payments', { signal })).data),
    retry: false, gcTime: 0,
  })
  const metricsQuery = useQuery({
    queryKey: ['payment-metrics', user?.id], enabled: user?.role === 'FOUNDER',
    queryFn: async ({ signal }) => paymentMetricsSchema.parse((await api.get<unknown>('/payments/metrics', { signal })).data),
    retry: false, gcTime: 0,
  })
  const { data: payments, isLoading: paymentsLoading, refetch: refetchPayments } = paymentQuery
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = metricsQuery

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const results = await Promise.all([refetchPayments(), refetchMetrics()])
      if (results.some(result => result.isError)) throw new Error('Refresh failed')
      toast.success('Saved financial records refreshed')
    } catch { toast.error('Financial records could not be refreshed') }
    finally { setRefreshing(false) }
  }

  const handlePaymentAction = async (...action: [string, 'approve' | 'block']) => {
    void action
    // The server intentionally rejects unqualified money movement. No write is sent.
    toast.error('Payment execution is unavailable until the provider workflow is qualified.')
  }

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Badge className="bg-green-500"><ShieldCheck className="h-3 w-3 mr-1" />Low Risk</Badge>
      case 'medium':
        return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />Medium</Badge>
      case 'high':
        return <Badge className="bg-orange-500"><ShieldAlert className="h-3 w-3 mr-1" />High Risk</Badge>
      case 'critical':
        return <Badge className="bg-red-500 animate-pulse"><ShieldAlert className="h-3 w-3 mr-1" />Critical</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const isLoading = paymentsLoading || metricsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (paymentQuery.isError || metricsQuery.isError || user?.role !== 'FOUNDER') {
    return <div role="alert" className="space-y-4 p-8"><p>Financial records are unavailable. A failed request does not mean there are no payments.</p><Button onClick={handleRefresh} disabled={refreshing}>Retry</Button></div>
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 min-h-screen"
    >
      {/* Header with WebSocket Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
            <DollarSign className="h-10 w-10 text-blue-600" />
            Payments Control Center
          </h1>
          <p className="text-muted-foreground mt-1">Saved payment records and recovery totals</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">Saved records · refresh manually</Badge>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card><CardContent className="p-6 text-amber-700 dark:text-amber-300">
        These are saved financial records, not confirmation of bank settlement. Payment execution and live payment events are not qualified.
        Fraud accuracy and automatic approval statistics are unavailable; no sample model scores are displayed.
      </CardContent></Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card className="border-none shadow-xl bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Recovered</p>
                  <p className="text-3xl font-bold text-green-600">
                    ${(metrics?.data?.totalRecovered || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card className="border-none shadow-xl bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/20 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    ${(metrics?.data?.pending || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card className="border-none shadow-xl bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/20 rounded-full">
                  <RefreshCw className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Refunded</p>
                  <p className="text-3xl font-bold text-red-600">
                    ${(metrics?.data?.refunded || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <Card className="border-none shadow-xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-full">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-3xl font-bold text-blue-600">
                    ${(metrics?.data?.trend?.slice(-1)[0]?.amount || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <Card className="border-none shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recorded Recovery Trend (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={metrics?.data?.trend || []}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#colorAmount)"
                  name="Recovery Amount"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Method Breakdown */}
        <Card className="border-none shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80">
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics?.data?.byMethod || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="total"
                  nameKey="method"
                  label={({ method, percent }) => `${method}: ${(percent * 100).toFixed(0)}%`}
                >
                  {(metrics?.data?.byMethod || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table with Fraud Scores */}
      <Card className="border-none shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Recent Saved Payments
            </span>
            <Badge variant="outline" className="font-normal">
              <Activity className="h-3 w-3 mr-1" />
              Saved records
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {(payments?.data || []).map((p: Payment, index: number) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                  className={`p-4 rounded-xl flex justify-between items-center transition-all cursor-pointer hover:shadow-lg ${
                    p.fraudScore?.risk === 'critical' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200' :
                    p.fraudScore?.risk === 'high' ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200' :
                    'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  onClick={() => setSelectedPayment(p)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      p.fraudScore?.risk === 'critical' || p.fraudScore?.risk === 'high'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-green-100 text-green-600'
                    }`}>
                      {p.fraudScore?.risk === 'critical' || p.fraudScore?.risk === 'high'
                        ? <ShieldAlert className="h-6 w-6" />
                        : <ShieldCheck className="h-6 w-6" />
                      }
                    </div>
                    <div>
                      <p className="font-medium">{p.clientName || 'Unknown Client'}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.method?.toUpperCase()} • {new Date(p.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <Badge variant="outline">Fraud assessment unavailable</Badge>

                    <div className="text-right">
                      <p className="font-bold text-xl">${p.amount?.toLocaleString() || 0}</p>
                      <Badge
                        variant={
                          p.status === 'succeeded' ? 'default' :
                          p.status === 'pending' ? 'secondary' :
                          p.status === 'review' ? 'outline' :
                          'destructive'
                        }
                      >
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {(!payments?.data || payments.data.length === 0) && (
              <p className="text-center text-muted-foreground py-8">No payments found</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selected Payment Detail Modal */}
      <AnimatePresence>
        {selectedPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedPayment(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">Saved Payment Details</h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Amount</span>
                  <span className="text-2xl font-bold">${selectedPayment.amount.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Risk Level</span>
                  {getRiskBadge(selectedPayment.fraudScore?.risk || 'unknown')}
                </div>

                <div className="flex justify-between items-center">
                  <span>AI Confidence</span>
                  <span className="font-mono">{selectedPayment.fraudScore ? `${(selectedPayment.fraudScore.confidence * 100).toFixed(0)}%` : 'Unavailable'}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Recommendation</span>
                  <Badge variant={
                    selectedPayment.fraudScore?.recommendation === 'approve' ? 'default' :
                    selectedPayment.fraudScore?.recommendation === 'review' ? 'secondary' : 'outline'
                  }>
                    {selectedPayment.fraudScore?.recommendation?.toUpperCase() ?? 'Unavailable'}
                  </Badge>
                </div>

                {selectedPayment.fraudScore?.factors && selectedPayment.fraudScore.factors.length > 0 && (
                  <div>
                    <p className="font-medium mb-2">Risk Factors:</p>
                    <ul className="space-y-1">
                      {selectedPayment.fraudScore.factors.map((factor, i) => (
                        <li key={i} className="text-sm text-red-600 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled title="Provider qualification required" onClick={() => handlePaymentAction(selectedPayment.id, 'approve')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled title="Provider qualification required" onClick={() => handlePaymentAction(selectedPayment.id, 'block')}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Block
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
