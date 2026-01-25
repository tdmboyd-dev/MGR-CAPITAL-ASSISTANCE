'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Download, Eye, Loader2, RefreshCw, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const formSchema = z.object({
  assignor: z.string().min(1, 'Assignor name is required'),
  assignorAddress: z.string().optional(),
  assignee: z.string().min(1, 'Assignee name is required'),
  propertyId: z.string().min(1, 'Property ID is required'),
  propertyAddress: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  state: z.string().length(2, 'State must be 2 letters'),
  notaryRequired: z.boolean().default(false),
})

type FormData = z.infer<typeof formSchema>

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]

export default function AssignmentEditor() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [documentHash, setDocumentHash] = useState<string | null>(null)
  const [blockchainTxId, setBlockchainTxId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assignor: '',
      assignorAddress: '',
      assignee: 'MGR Capital Assistance',
      propertyId: '',
      propertyAddress: '',
      amount: 0,
      state: 'FL',
      notaryRequired: false,
    },
  })

  // Signature pad handling
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const signatureDataUrl = canvasRef.current?.toDataURL('image/png') || ''

      const res = await fetch('/api/documents/assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data, signatureDataUrl }),
      })

      if (!res.ok) throw new Error('Failed to generate document')

      const result = await res.json()

      // Create blob URL for preview
      if (result.data?.pdfBase64) {
        const binaryString = atob(result.data.pdfBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: 'application/pdf' })
        setPreviewUrl(URL.createObjectURL(blob))
      }

      setDocumentHash(result.data?.hash)
      setBlockchainTxId(result.data?.blockchainTxId)

      toast.success('Assignment document generated successfully!')
    } catch (err) {
      toast.error('Failed to generate document')
    } finally {
      setLoading(false)
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
          Assignment of Interest Editor
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate state-specific assignment documents with blockchain verification
        </p>
      </div>

      {/* Form */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Document Details
          </CardTitle>
          <CardDescription>
            Fill in the assignment details to generate a legally compliant document
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="assignor">Assignor (Property Owner) *</Label>
                <Input
                  id="assignor"
                  {...form.register('assignor')}
                  placeholder="John Doe"
                  className="mt-1"
                />
                {form.formState.errors.assignor && (
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.assignor.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="assignorAddress">Assignor Address</Label>
                <Input
                  id="assignorAddress"
                  {...form.register('assignorAddress')}
                  placeholder="123 Main St, City, ST 12345"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="assignee">Assignee (Your Company) *</Label>
                <Input
                  id="assignee"
                  {...form.register('assignee')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Select
                  value={form.watch('state')}
                  onValueChange={(v) => form.setValue('state', v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="propertyId">Property ID / Parcel Number *</Label>
                <Input
                  id="propertyId"
                  {...form.register('propertyId')}
                  placeholder="12-34-56-789"
                  className="mt-1"
                />
                {form.formState.errors.propertyId && (
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.propertyId.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="propertyAddress">Property Address</Label>
                <Input
                  id="propertyAddress"
                  {...form.register('propertyAddress')}
                  placeholder="456 Oak Ave, City, ST 12345"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="amount">Estimated Surplus Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  {...form.register('amount', { valueAsNumber: true })}
                  placeholder="25000"
                  className="mt-1"
                />
                {form.formState.errors.amount && (
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="notaryRequired"
                  checked={form.watch('notaryRequired')}
                  onCheckedChange={(checked) => form.setValue('notaryRequired', checked as boolean)}
                />
                <Label htmlFor="notaryRequired" className="cursor-pointer">
                  Include Notary Acknowledgment Section
                </Label>
              </div>
            </div>

            {/* Signature Pad */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Digital Signature</Label>
                <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className="border rounded-lg w-full max-w-md bg-white cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Draw your signature above {hasSignature && <Badge variant="outline" className="ml-2">Signed</Badge>}
              </p>
            </div>

            <Button type="submit" disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate PDF
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Preview */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-600" />
                  Document Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Verification Badges */}
                {(documentHash || blockchainTxId) && (
                  <div className="flex flex-wrap gap-2">
                    {documentHash && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Hash: {documentHash.substring(0, 16)}...
                      </Badge>
                    )}
                    {blockchainTxId && (
                      <Badge variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 border-green-300">
                        <Shield className="h-3 w-3" />
                        Blockchain Verified
                      </Badge>
                    )}
                  </div>
                )}

                {/* PDF Preview */}
                <iframe
                  src={previewUrl}
                  className="w-full h-[600px] border rounded-lg"
                  title="PDF Preview"
                />

                {/* Download Button */}
                <Button asChild size="lg">
                  <a href={previewUrl} download="assignment-of-interest.pdf">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </a>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
