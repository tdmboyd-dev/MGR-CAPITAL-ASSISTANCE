'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Search, Phone, Mail, Home, User, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  ssn: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface TraceResult {
  name: string
  address: string
  phone: string
  email?: string
  confidence: number
  assets?: string[]
  relatives?: string[]
  location?: [number, number]
}

export default function SkipTraceDashboard() {
  const [results, setResults] = useState<TraceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<TraceResult | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', address: '', phone: '', ssn: '' },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError(null)
    setResults([])

    try {
      const res = await fetch('/api/skip-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        throw new Error('Skip trace failed')
      }

      const result = await res.json()
      setResults(result.data?.results || [])
      toast.success(`Found ${result.data?.results?.length || 0} matches`)
    } catch (err: any) {
      setError(err.message || 'Skip trace failed - check API key or rate limit')
      toast.error('Skip trace failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAutoCall = async (phone: string) => {
    try {
      await fetch('/api/phone/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: phone, script: 'initial_outreach' }),
      })
      toast.success('Call initiated')
    } catch (err) {
      toast.error('Failed to initiate call')
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
          Skip Trace Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Find property owners, heirs, and contact information</p>
      </div>

      {/* Search Form */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" />
            Person Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  placeholder="John Doe"
                  className="mt-1"
                />
                {form.formState.errors.name && (
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="address">Last Known Address</Label>
                <Input
                  id="address"
                  {...form.register('address')}
                  placeholder="123 Main St, City, ST"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  {...form.register('phone')}
                  placeholder="(555) 123-4567"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ssn">Last 4 SSN</Label>
                <Input
                  id="ssn"
                  {...form.register('ssn')}
                  placeholder="1234"
                  maxLength={4}
                  className="mt-1"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="h-12 px-8">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Run Skip Trace
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {results.map((r, i) => (
            <motion.div
              key={i}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card
                className={`cursor-pointer transition-all hover:shadow-xl ${
                  selectedResult === r ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedResult(r)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      {r.name}
                    </span>
                    <Badge
                      variant={r.confidence >= 0.8 ? 'default' : r.confidence >= 0.5 ? 'secondary' : 'outline'}
                      className="ml-auto"
                    >
                      {(r.confidence * 100).toFixed(0)}% Match
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span>{r.address || 'No address found'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{r.phone || 'No phone found'}</span>
                  </div>
                  {r.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{r.email}</span>
                    </div>
                  )}
                  {r.assets && r.assets.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {r.assets.map((asset, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {asset}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {r.relatives && r.relatives.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Relatives: </span>
                      {r.relatives.slice(0, 3).join(', ')}
                      {r.relatives.length > 3 && ` +${r.relatives.length - 3} more`}
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (r.phone) handleAutoCall(r.phone)
                      }}
                      disabled={!r.phone}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Call
                    </Button>
                    <Button size="sm" variant="outline">
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </Button>
                    <Button size="sm" variant="outline">
                      <MapPin className="h-3 w-3 mr-1" />
                      Map
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {!loading && results.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Results Yet</h3>
            <p className="text-muted-foreground mt-1">
              Enter a name and run a skip trace to find property owners
            </p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
