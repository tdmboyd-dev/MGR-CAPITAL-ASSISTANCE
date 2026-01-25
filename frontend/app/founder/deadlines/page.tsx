'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Search, Calendar, AlertTriangle, Clock, CheckCircle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

// US States data for the map
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
]

export default function DeadlineTracker() {
  const [search, setSearch] = useState('')
  const [selectedState, setSelectedState] = useState<string | null>(null)

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery({
    queryKey: ['deadlines'],
    queryFn: async () => {
      const res = await fetch('/api/deadlines', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch deadlines')
      return res.json()
    },
  })

  const { data: upcoming, isLoading: upcomingLoading } = useQuery({
    queryKey: ['upcoming-deadlines'],
    queryFn: async () => {
      const res = await fetch('/api/deadlines/upcoming?days=90', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch upcoming')
      return res.json()
    },
  })

  const filteredStates = US_STATES.filter(s =>
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const getDeadlineColor = (years: number) => {
    if (years <= 1) return 'bg-red-100 text-red-800 border-red-300'
    if (years <= 2) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    return 'bg-green-100 text-green-800 border-green-300'
  }

  const isLoading = deadlinesLoading || upcomingLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const stateDeadlines = deadlines?.data || {}
  const upcomingCases = upcoming?.data || []

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 p-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          State Deadline Tracker
        </h1>
        <p className="text-muted-foreground mt-1">Monitor claim deadlines across all 50 states</p>
      </div>

      {/* Urgent Deadlines Alert */}
      {upcomingCases.filter((c: any) => c.daysRemaining <= 30).length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {upcomingCases.filter((c: any) => c.daysRemaining <= 30).length} cases have deadlines within 30 days!
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Controls */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>State Deadlines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search state..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Export to Calendar
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* State Grid */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-4">
              <AnimatePresence>
                {filteredStates.map((state, i) => {
                  const dl = stateDeadlines[state.code]
                  return (
                    <motion.div
                      key={state.code}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        selectedState === state.code ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedState(state.code)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedState(state.code)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <div>
                            <p className="font-medium">{state.name}</p>
                            <p className="text-sm text-muted-foreground">{state.code}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant="outline"
                            className={dl ? getDeadlineColor(dl.years) : ''}
                          >
                            {dl?.deadline || 'Unknown'}
                          </Badge>
                        </div>
                      </div>
                      {dl?.notes && (
                        <p className="text-xs text-muted-foreground mt-2">{dl.notes}</p>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* Selected State Details */}
            <Card className="h-fit sticky top-4">
              <CardHeader>
                <CardTitle>
                  {selectedState ? US_STATES.find(s => s.code === selectedState)?.name : 'Select a State'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedState && stateDeadlines[selectedState] ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Deadline:</span>
                      <span>{stateDeadlines[selectedState].deadline}</span>
                    </div>
                    <div>
                      <span className="font-medium">Legal Source:</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {stateDeadlines[selectedState].source}
                      </p>
                    </div>
                    {stateDeadlines[selectedState].notes && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {stateDeadlines[selectedState].notes}
                        </AlertDescription>
                      </Alert>
                    )}
                    <Button className="w-full">
                      <Calendar className="mr-2 h-4 w-4" />
                      Set Reminder for {selectedState} Claims
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Click on a state to view deadline details
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Deadlines */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Upcoming Case Deadlines (Next 90 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingCases.length > 0 ? (
              upcomingCases.map((c: any, i: number) => (
                <motion.div
                  key={c.caseId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-4 border rounded-lg flex items-center justify-between ${
                    c.isUrgent ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''
                  }`}
                >
                  <div>
                    <p className="font-medium">{c.internalCode}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.clientName} • {c.state}, {c.county}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold flex items-center gap-2">
                      {c.isUrgent && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      {c.daysRemaining} days
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Due: {new Date(c.claimBy).toLocaleDateString()}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">No urgent deadlines in the next 90 days</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
