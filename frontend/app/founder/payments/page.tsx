'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DollarSign, TrendingUp, Clock, RefreshCw, Loader2,
  ShieldAlert, ShieldCheck, AlertTriangle, Brain,
  Activity, Zap, Eye, CheckCircle, XCircle, Bell
} from 'lucide-react'
import { useState, useEffect } from 'react'
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
  method: string
  status: string
  clientId?: string
  clientName?: string
  description?: string
  createdAt: string
  fraudScore?: FraudScore
}

export default function PaymentsDashboard() {
  const [refreshing, setRefreshing] = useState(false)
  const [realtimePayments, setRealtimePayments] = useState<Payment[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)

  // WebSocket connection for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null

    const connect = () => {
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsHost = process.env.NEXT_PUBLIC_WS_HOST || window.location.host
        ws = new WebSocket(`${wsProtocol}//${wsHost}/payments`)

        ws.onopen = () => {
          setWsConnected(true)
          console.log('WebSocket connected')
        }

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          if (data.type === 'new_payment') {
            toast.info('New payment received!', {
              description: `$${data.payment.amount.toLocaleString()} via ${data.payment.method}`,
            })
            setRealtimePayments(prev => [data.payment, ...prev].slice(0, 10))
            refetchPayments()
            refetchMetrics()
          }
          if (data.type === 'fraud_alert') {
            toast.error('Fraud Alert!', {
              description: data.message,
            })
          }
        }

        ws.onclose = () => {
          setWsConnected(false)
          setTimeout(connect, 3000) // Reconnect after 3s
        }

        ws.onerror = () => {
          setWsConnected(false)
        }
      } catch (err) {
        setWsConnected(false)
      }
    }

    connect()

    return () => {
      if (ws) ws.close()
    }
  }, [])

  const { data: payments, isLoading: paymentsLoading, refetch: refetchPayments } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      // Demo data with fraud scores
      return {
        data: [
          { id: 'pay_1', amount: 12500, method: 'ach', status: 'succeeded', clientName: 'John Smith', createdAt: new Date().toISOString(), fraudScore: { score: 0.12, risk: 'low', factors: [], recommendation: 'approve', confidence: 0.92 } },
          { id: 'pay_2', amount: 8750, method: 'stripe', status: 'succeeded', clientName: 'Sarah Johnson', createdAt: new Date(Date.now() - 3600000).toISOString(), fraudScore: { score: 0.08, risk: 'low', factors: [], recommendation: 'approve', confidence: 0.95 } },
          { id: 'pay_3', amount: 45000, method: 'ach', status: 'pending', clientName: 'Michael Brown', createdAt: new Date(Date.now() - 7200000).toISOString(), fraudScore: { score: 0.65, risk: 'high', factors: ['Unusual amount', 'New customer'], recommendation: 'review', confidence: 0.88 } },
          { id: 'pay_4', amount: 3200, method: 'paypal', status: 'succeeded', clientName: 'Emily Davis', createdAt: new Date(Date.now() - 10800000).toISOString(), fraudScore: { score: 0.05, risk: 'low', factors: [], recommendation: 'approve', confidence: 0.97 } },
          { id: 'pay_5', amount: 78000, method: 'ach', status: 'review', clientName: 'Unknown', createdAt: new Date(Date.now() - 14400000).toISOString(), fraudScore: { score: 0.89, risk: 'critical', factors: ['Very high amount', 'Unknown customer', 'Unusual time'], recommendation: 'block', confidence: 0.91 } },
        ] as Payment[]
      }
    },
  })

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['payment-metrics'],
    queryFn: async () => {
      return {
        data: {
          totalRecovered: 487500,
          pending: 123000,
          refunded: 15000,
          trend: [
            { date: '2026-01-19', amount: 45000 },
            { date: '2026-01-20', amount: 62000 },
            { date: '2026-01-21', amount: 38000 },
            { date: '2026-01-22', amount: 71000 },
            { date: '2026-01-23', amount: 89000 },
            { date: '2026-01-24', amount: 95000 },
            { date: '2026-01-25', amount: 87500 },
          ],
          byMethod: [
            { method: 'ACH', total: 285000, count: 45 },
            { method: 'Stripe', total: 142000, count: 32 },
            { method: 'PayPal', total: 45500, count: 18 },
            { method: 'Check', total: 15000, count: 5 },
          ],
          fraudStats: {
            blocked: 3,
            reviewed: 8,
            approved: 89,
            totalScanned: 100,
            modelAccuracy: 0.94,
          }
        }
      }
    },
  })

  const { data: fraudMetrics } = useQuery({
    queryKey: ['fraud-metrics'],
    queryFn: async () => {
      return {
        data: {
          accuracy: 0.94,
          precision: 0.89,
          recall: 0.92,
          f1Score: 0.90,
          isReady: true,
        }
      }
    },
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchPayments(), refetchMetrics()])
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  // Handle payment approval/blocking
  const handlePaymentAction = async (paymentId: string, action: 'approve' | 'block') => {
    try {
      const endpoint = action === 'approve'
        ? `/api/payments/${paymentId}/approve`
        : `/api/payments/${paymentId}/block`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action} payment`)
      }

      toast.success(`Payment ${action === 'approve' ? 'approved' : 'blocked'} successfully`)
      setSelectedPayment(null)
      refetchPayments()
    } catch (error) {
      toast.error(`Failed to ${action} payment. Please try again.`)
      console.error(`Payment ${action} error:`, error)
    }
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
          <p className="text-muted-foreground mt-1">AI-powered fraud detection • Real-time monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 dark:bg-slate-800/80 shadow">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm">{wsConnected ? 'Live' : 'Offline'}</span>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Alert Banner */}
      {realtimePayments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-blue-600 animate-bounce" />
            <span className="font-medium">
              {realtimePayments.length} new payment{realtimePayments.length > 1 ? 's' : ''} received in real-time
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setRealtimePayments([])}>
            Dismiss
          </Button>
        </motion.div>
      )}

      {/* AI Fraud Detection Stats */}
      <Card className="border-none shadow-2xl backdrop-blur-xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-red-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Fraud Detection Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="35" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                  <circle
                    cx="40" cy="40" r="35"
                    stroke="#8b5cf6"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${(fraudMetrics?.data?.accuracy || 0) * 220} 220`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{((fraudMetrics?.data?.accuracy || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Model Accuracy</p>
            </div>

            <div className="text-center p-4 rounded-xl bg-green-500/10">
              <p className="text-3xl font-bold text-green-600">{metrics?.data?.fraudStats?.approved || 0}</p>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <CheckCircle className="h-4 w-4" /> Auto-Approved
              </p>
            </div>

            <div className="text-center p-4 rounded-xl bg-yellow-500/10">
              <p className="text-3xl font-bold text-yellow-600">{metrics?.data?.fraudStats?.reviewed || 0}</p>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Eye className="h-4 w-4" /> Flagged for Review
              </p>
            </div>

            <div className="text-center p-4 rounded-xl bg-red-500/10">
              <p className="text-3xl font-bold text-red-600">{metrics?.data?.fraudStats?.blocked || 0}</p>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <XCircle className="h-4 w-4" /> Blocked
              </p>
            </div>

            <div className="text-center p-4 rounded-xl bg-blue-500/10">
              <p className="text-3xl font-bold text-blue-600">{metrics?.data?.fraudStats?.totalScanned || 0}</p>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Activity className="h-4 w-4" /> Total Scanned
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
              Recovery Trend (Last 7 Days)
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
                  {(metrics?.data?.byMethod || []).map((_: any, index: number) => (
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
              Recent Payments with AI Fraud Analysis
            </span>
            <Badge variant="outline" className="font-normal">
              <Activity className="h-3 w-3 mr-1" />
              Real-time
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
                    {/* Fraud Score Visualization */}
                    <div className="text-center">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={(p.fraudScore?.score || 0) * 100}
                          className={`w-20 h-2 ${
                            (p.fraudScore?.score || 0) > 0.6 ? '[&>div]:bg-red-500' :
                            (p.fraudScore?.score || 0) > 0.3 ? '[&>div]:bg-yellow-500' :
                            '[&>div]:bg-green-500'
                          }`}
                        />
                        <span className="text-xs font-mono">
                          {((p.fraudScore?.score || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      {getRiskBadge(p.fraudScore?.risk || 'low')}
                    </div>

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
              <h3 className="text-xl font-bold mb-4">Fraud Analysis Details</h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Amount</span>
                  <span className="text-2xl font-bold">${selectedPayment.amount.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Risk Level</span>
                  {getRiskBadge(selectedPayment.fraudScore?.risk || 'low')}
                </div>

                <div className="flex justify-between items-center">
                  <span>AI Confidence</span>
                  <span className="font-mono">{((selectedPayment.fraudScore?.confidence || 0) * 100).toFixed(0)}%</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Recommendation</span>
                  <Badge variant={
                    selectedPayment.fraudScore?.recommendation === 'approve' ? 'default' :
                    selectedPayment.fraudScore?.recommendation === 'review' ? 'secondary' : 'destructive'
                  }>
                    {selectedPayment.fraudScore?.recommendation?.toUpperCase()}
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
                    onClick={() => handlePaymentAction(selectedPayment.id, 'approve')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handlePaymentAction(selectedPayment.id, 'block')}
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
