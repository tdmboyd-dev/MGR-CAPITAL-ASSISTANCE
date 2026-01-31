'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Users,
  GitBranch,
  Search,
  Plus,
  Download,
  Brain,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  FileText,
  RefreshCw
} from 'lucide-react'
import * as d3 from 'd3'

interface FamilyMember {
  id: string
  name: string
  relationship: string
  isDeceased: boolean
  isHeir: boolean
  heirPriority?: number
  skipTraceStatus: 'not_traced' | 'found' | 'not_found' | 'pending'
  contactInfo?: {
    phone?: string
    email?: string
    address?: string
  }
  children: FamilyMember[]
}

interface GenealogyTree {
  id: string
  caseId: string
  decedentName: string
  state: string
  rootMember: FamilyMember
  totalHeirs: number
  confirmedHeirs: number
  heirDistribution: Record<string, number>
  confidenceScore: number
  aiGenerated: boolean
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

export default function GenealogyPage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedTree, setSelectedTree] = useState<GenealogyTree | null>(null)
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)
  const [showNewTreeDialog, setShowNewTreeDialog] = useState(false)
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [newTreeForm, setNewTreeForm] = useState({
    caseId: '',
    decedentName: '',
    deathDate: '',
    state: '',
    knownRelatives: '',
    lastKnownAddress: ''
  })
  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    relationship: '',
    isDeceased: false,
    isHeir: false
  })

  // Fetch trees list
  const { data: trees, isLoading } = useQuery({
    queryKey: ['genealogy-trees'],
    queryFn: async () => {
      // Mock data for demo
      return [
        {
          id: 'tree_demo_1',
          caseId: 'CASE-001',
          decedentName: 'John Smith',
          state: 'TX',
          rootMember: {
            id: 'root_1',
            name: 'John Smith',
            relationship: 'Decedent',
            isDeceased: true,
            isHeir: false,
            skipTraceStatus: 'found' as const,
            children: [
              {
                id: 'child_1',
                name: 'Mary Smith',
                relationship: 'Daughter',
                isDeceased: false,
                isHeir: true,
                heirPriority: 1,
                skipTraceStatus: 'found' as const,
                contactInfo: { phone: '555-0101', address: '123 Main St, Dallas, TX' },
                children: [
                  {
                    id: 'grandchild_1',
                    name: 'Tom Smith Jr',
                    relationship: 'Grandson',
                    isDeceased: false,
                    isHeir: false,
                    skipTraceStatus: 'pending' as const,
                    children: []
                  }
                ]
              },
              {
                id: 'child_2',
                name: 'Robert Smith',
                relationship: 'Son',
                isDeceased: true,
                isHeir: false,
                skipTraceStatus: 'found' as const,
                children: [
                  {
                    id: 'grandchild_2',
                    name: 'Sarah Smith',
                    relationship: 'Granddaughter',
                    isDeceased: false,
                    isHeir: true,
                    heirPriority: 2,
                    skipTraceStatus: 'found' as const,
                    contactInfo: { phone: '555-0102', email: 'sarah@email.com' },
                    children: []
                  }
                ]
              },
              {
                id: 'child_3',
                name: 'James Smith',
                relationship: 'Son',
                isDeceased: false,
                isHeir: true,
                heirPriority: 1,
                skipTraceStatus: 'not_found' as const,
                children: []
              }
            ]
          },
          totalHeirs: 3,
          confirmedHeirs: 2,
          heirDistribution: { 'child_1': 33.33, 'grandchild_2': 33.33, 'child_3': 33.33 },
          confidenceScore: 0.85,
          aiGenerated: true
        }
      ] as GenealogyTree[]
    }
  })

  // Generate tree mutation
  const generateMutation = useMutation({
    mutationFn: async (data: typeof newTreeForm) => {
      return api.post('/genealogy/generate', {
        caseId: data.caseId,
        decedentName: data.decedentName,
        deathDate: data.deathDate || undefined,
        state: data.state,
        knownRelatives: data.knownRelatives.split(',').map(s => s.trim()).filter(Boolean),
        lastKnownAddress: data.lastKnownAddress || undefined
      })
    },
    onSuccess: () => {
      toast.success('Genealogy tree generated')
      setShowNewTreeDialog(false)
      setNewTreeForm({ caseId: '', decedentName: '', deathDate: '', state: '', knownRelatives: '', lastKnownAddress: '' })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to generate tree')
    }
  })

  // D3.js tree visualization
  const renderTree = useCallback((tree: GenealogyTree) => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 900
    const height = 600
    const margin = { top: 40, right: 40, bottom: 40, left: 40 }

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Convert tree data to D3 hierarchy
    const root = d3.hierarchy(tree.rootMember, d => d.children)

    // Create tree layout
    const treeLayout = d3.tree<FamilyMember>()
      .size([width - margin.left - margin.right, height - margin.top - margin.bottom - 100])
      .separation((a, b) => (a.parent === b.parent ? 1.5 : 2))

    treeLayout(root)

    // Draw links
    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', (d3.linkVertical()
        .x((d: any) => d.x)
        .y((d: any) => d.y)
      ) as any)
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', d => d.target.data.isDeceased ? '5,5' : 'none')

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedMember(d.data)
      })

    // Node circles
    nodes.append('circle')
      .attr('r', d => d.data.isHeir ? 28 : 22)
      .attr('fill', d => {
        if (d.data.isDeceased) return '#64748b'
        if (d.data.isHeir) return '#22c55e'
        return '#3b82f6'
      })
      .attr('stroke', d => {
        if (d.data.skipTraceStatus === 'found') return '#16a34a'
        if (d.data.skipTraceStatus === 'not_found') return '#dc2626'
        if (d.data.skipTraceStatus === 'pending') return '#eab308'
        return '#94a3b8'
      })
      .attr('stroke-width', 3)

    // Heir badge
    nodes.filter(d => d.data.isHeir)
      .append('circle')
      .attr('cx', 18)
      .attr('cy', -18)
      .attr('r', 10)
      .attr('fill', '#fbbf24')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)

    nodes.filter(d => d.data.isHeir)
      .append('text')
      .attr('x', 18)
      .attr('y', -14)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .text(d => d.data.heirPriority || '★')

    // Node labels
    nodes.append('text')
      .attr('dy', 45)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#1e293b')
      .text(d => d.data.name)

    // Relationship labels
    nodes.append('text')
      .attr('dy', 60)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .text(d => d.data.relationship)

    // Status icons
    nodes.append('text')
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('fill', 'white')
      .text(d => {
        if (d.data.isDeceased) return '†'
        if (d.data.skipTraceStatus === 'found') return '✓'
        if (d.data.skipTraceStatus === 'pending') return '?'
        return '○'
      })

  }, [])

  // Render tree when selected
  useEffect(() => {
    if (selectedTree) {
      renderTree(selectedTree)
    }
  }, [selectedTree, renderTree])

  // Auto-select first tree
  useEffect(() => {
    if (trees && trees.length > 0 && !selectedTree) {
      setSelectedTree(trees[0])
    }
  }, [trees, selectedTree])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'found': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'not_found': return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />
      default: return <Search className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 p-8"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
              <GitBranch className="h-10 w-10 text-indigo-600" />
              AI Heir Genealogy
            </h1>
            <p className="text-muted-foreground mt-2">
              AI-powered family tree analysis with skip trace integration
            </p>
          </div>

          <Dialog open={showNewTreeDialog} onOpenChange={setShowNewTreeDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                New Genealogy Tree
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-indigo-600" />
                  Generate AI Genealogy Tree
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Case ID *</Label>
                    <Input
                      value={newTreeForm.caseId}
                      onChange={(e) => setNewTreeForm(f => ({ ...f, caseId: e.target.value }))}
                      placeholder="CASE-001"
                    />
                  </div>
                  <div>
                    <Label>State *</Label>
                    <Select
                      value={newTreeForm.state}
                      onValueChange={(v) => setNewTreeForm(f => ({ ...f, state: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Decedent Name *</Label>
                  <Input
                    value={newTreeForm.decedentName}
                    onChange={(e) => setNewTreeForm(f => ({ ...f, decedentName: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label>Death Date</Label>
                  <Input
                    type="date"
                    value={newTreeForm.deathDate}
                    onChange={(e) => setNewTreeForm(f => ({ ...f, deathDate: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Last Known Address</Label>
                  <Input
                    value={newTreeForm.lastKnownAddress}
                    onChange={(e) => setNewTreeForm(f => ({ ...f, lastKnownAddress: e.target.value }))}
                    placeholder="123 Main St, City, State"
                  />
                </div>

                <div>
                  <Label>Known Relatives (comma-separated)</Label>
                  <Textarea
                    value={newTreeForm.knownRelatives}
                    onChange={(e) => setNewTreeForm(f => ({ ...f, knownRelatives: e.target.value }))}
                    placeholder="Jane Doe (wife), John Jr (son), Mary Smith (daughter)"
                    rows={3}
                  />
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600"
                  onClick={() => generateMutation.mutate(newTreeForm)}
                  disabled={generateMutation.isPending || !newTreeForm.caseId || !newTreeForm.decedentName || !newTreeForm.state}
                >
                  {generateMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate with AI
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tree List Sidebar */}
          <Card className="border-none shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Family Trees
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : trees?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No trees yet</p>
              ) : (
                trees?.map((tree) => (
                  <motion.div
                    key={tree.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedTree(tree)}
                    className={`p-4 rounded-xl cursor-pointer transition-all ${
                      selectedTree?.id === tree.id
                        ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500'
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <p className="font-semibold">{tree.decedentName}</p>
                    <p className="text-sm text-muted-foreground">
                      Case: {tree.caseId} • {tree.state}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {tree.totalHeirs} heirs
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {tree.confirmedHeirs} found
                      </Badge>
                      {tree.aiGenerated && (
                        <Badge className="text-xs bg-purple-500">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Main Tree Visualization */}
          <Card className="lg:col-span-2 border-none shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Family Tree Visualization
              </CardTitle>
              {selectedTree && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Export PDF
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {selectedTree ? (
                <div className="relative">
                  <svg
                    ref={svgRef}
                    className="w-full h-[500px] border rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
                  />
                  <div className="absolute bottom-4 left-4 flex gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-blue-500" />
                      <span>Living</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-slate-500" />
                      <span>Deceased</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-green-500" />
                      <span>Heir</span>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-medium">AI Confidence</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {(selectedTree.confidenceScore * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                  <GitBranch className="h-16 w-16 mb-4 opacity-30" />
                  <p>Select a tree to visualize</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Member Details */}
          <Card className="border-none shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Member Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {selectedMember ? (
                  <motion.div
                    key={selectedMember.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="text-center pb-4 border-b">
                      <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-white text-2xl ${
                        selectedMember.isDeceased ? 'bg-slate-500' :
                        selectedMember.isHeir ? 'bg-green-500' : 'bg-blue-500'
                      }`}>
                        {selectedMember.name.charAt(0)}
                      </div>
                      <h3 className="font-bold text-xl mt-3">{selectedMember.name}</h3>
                      <p className="text-muted-foreground">{selectedMember.relationship}</p>
                      <div className="flex justify-center gap-2 mt-2">
                        {selectedMember.isDeceased && (
                          <Badge variant="secondary">Deceased</Badge>
                        )}
                        {selectedMember.isHeir && (
                          <Badge className="bg-green-500">Heir #{selectedMember.heirPriority}</Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Skip Trace Status</span>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(selectedMember.skipTraceStatus)}
                          <span className="capitalize">{selectedMember.skipTraceStatus.replace('_', ' ')}</span>
                        </div>
                      </div>

                      {selectedMember.contactInfo?.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> Phone
                          </span>
                          <span className="font-mono">{selectedMember.contactInfo.phone}</span>
                        </div>
                      )}

                      {selectedMember.contactInfo?.email && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" /> Email
                          </span>
                          <span className="text-sm">{selectedMember.contactInfo.email}</span>
                        </div>
                      )}

                      {selectedMember.contactInfo?.address && (
                        <div className="flex items-start justify-between">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Address
                          </span>
                          <span className="text-sm text-right max-w-[150px]">
                            {selectedMember.contactInfo.address}
                          </span>
                        </div>
                      )}

                      {selectedTree?.heirDistribution[selectedMember.id] && (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm font-medium">Estimated Share</span>
                          <span className="text-lg font-bold text-green-600">
                            {selectedTree.heirDistribution[selectedMember.id].toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 space-y-2">
                      {selectedMember.skipTraceStatus !== 'found' && (
                        <Button className="w-full" variant="outline">
                          <Search className="h-4 w-4 mr-2" />
                          Run Skip Trace
                        </Button>
                      )}
                      <Button className="w-full" variant="outline">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Child
                      </Button>
                      <Button className="w-full" variant="outline">
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Document
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                    <Users className="h-12 w-12 mb-4 opacity-30" />
                    <p>Click a member to view details</p>
                  </div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Heir Summary */}
        {selectedTree && (
          <Card className="border-none shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Heir Distribution Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
                  <p className="text-4xl font-bold text-blue-600">{selectedTree.totalHeirs}</p>
                  <p className="text-muted-foreground">Total Heirs Identified</p>
                </div>
                <div className="text-center p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10">
                  <p className="text-4xl font-bold text-green-600">{selectedTree.confirmedHeirs}</p>
                  <p className="text-muted-foreground">Heirs Located</p>
                </div>
                <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                  <p className="text-4xl font-bold text-purple-600">
                    {((selectedTree.confirmedHeirs / selectedTree.totalHeirs) * 100).toFixed(0)}%
                  </p>
                  <p className="text-muted-foreground">Location Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  )
}
