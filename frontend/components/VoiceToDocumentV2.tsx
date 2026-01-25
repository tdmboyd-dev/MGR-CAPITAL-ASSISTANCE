'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Mic,
  MicOff,
  FileText,
  Loader2,
  Download,
  Share2,
  Volume2,
  FileCheck,
  Sparkles,
  Eye,
  Edit3,
  Copy,
  Check,
  AlertCircle,
  Wand2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'

type DocumentType =
  | 'demand-letter'
  | 'motion'
  | 'affidavit'
  | 'contract'
  | 'notice'
  | 'memo'
  | 'power-of-attorney'
  | 'subpoena'
  | 'settlement-agreement'
  | 'assignment-of-interest'
  | 'ach-authorization'
  | 'contingency-agreement'
  | 'claim-form'
  | 'release'
  | 'lien-discharge'

interface DocumentTemplate {
  id: DocumentType
  name: string
  description: string
  category: 'Legal' | 'Financial' | 'Administrative'
}

const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  // Legal Documents
  { id: 'demand-letter', name: 'Demand Letter', description: 'Formal demand for payment or action', category: 'Legal' },
  { id: 'motion', name: 'Motion for Release', description: 'Court motion filing document', category: 'Legal' },
  { id: 'affidavit', name: 'Affidavit of Claim', description: 'Sworn statement of facts', category: 'Legal' },
  { id: 'subpoena', name: 'Subpoena', description: 'Court order to appear or produce documents', category: 'Legal' },
  { id: 'notice', name: 'Notice', description: 'Formal notification document', category: 'Legal' },
  { id: 'memo', name: 'Legal Memo', description: 'Internal legal memorandum', category: 'Legal' },
  // Financial Documents
  { id: 'assignment-of-interest', name: 'Assignment of Interest', description: 'Assigns surplus claim rights', category: 'Financial' },
  { id: 'ach-authorization', name: 'ACH Authorization', description: 'Authorize automatic fee collection', category: 'Financial' },
  { id: 'contingency-agreement', name: 'Contingency Fee Agreement', description: 'Service agreement with fee terms', category: 'Financial' },
  { id: 'settlement-agreement', name: 'Settlement Agreement', description: 'Settlement and release document', category: 'Financial' },
  // Administrative
  { id: 'power-of-attorney', name: 'Power of Attorney', description: 'Limited POA for surplus recovery', category: 'Administrative' },
  { id: 'claim-form', name: 'State Claim Form', description: 'Official surplus claim form', category: 'Administrative' },
  { id: 'release', name: 'Release & Waiver', description: 'Release of claims document', category: 'Administrative' },
  { id: 'lien-discharge', name: 'Lien Discharge', description: 'Document to discharge liens', category: 'Administrative' },
  { id: 'contract', name: 'General Contract', description: 'Legal agreement between parties', category: 'Administrative' },
]

export default function VoiceToDocumentV2() {
  const { user } = useAuth()
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [generating, setGenerating] = useState(false)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState<DocumentType>('demand-letter')
  const [isSupported, setIsSupported] = useState(true)
  const [generatedContent, setGeneratedContent] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview')

  const recognitionRef = useRef<any>(null)
  const audioLevelRef = useRef<number>(0)

  // Check speech recognition support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (final) {
        setTranscript((prev) => prev + ' ' + final)
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      if (event.error !== 'no-speech') {
        toast.error(`Voice error: ${event.error}`)
      }
      setListening(false)
    }

    recognition.onend = () => {
      if (listening) {
        recognition.start()
      }
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [listening])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error('Voice recognition not available')
      return
    }

    try {
      recognitionRef.current.start()
      setListening(true)
      setTranscript('')
      setInterimTranscript('')
      setDocumentUrl(null)
      setGeneratedContent(null)
      toast.success('Listening... Dictate your document', {
        description: 'Say "new paragraph" to start a new paragraph',
      })
    } catch (error) {
      toast.error('Failed to start voice recognition')
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setListening(false)
    setInterimTranscript('')
    if (transcript.trim()) {
      toast.success('Transcript ready for processing')
    }
  }, [transcript])

  const generateDocument = async () => {
    if (!transcript.trim()) {
      toast.error('No dictation to process')
      return
    }

    setGenerating(true)
    setGeneratedContent(null)
    setDocumentUrl(null)

    try {
      const response = await fetch('/api/documents/generate-from-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceText: transcript.trim(),
          type: documentType,
          userId: user?.id,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Generation failed')
      }

      const contentType = response.headers.get('content-type')

      if (contentType?.includes('application/pdf')) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        setDocumentUrl(url)
        toast.success('PDF document generated successfully!')
        setPreviewOpen(true)
      } else {
        const data = await response.json()
        setGeneratedContent(data.content)
        if (data.pdfUrl) {
          setDocumentUrl(data.pdfUrl)
        }
        toast.success('Document generated!')
        setPreviewOpen(true)
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      toast.error('Failed to generate document', {
        description: error.message,
      })

      // Fallback to local generation
      const fallbackContent = generateLocalDocument(transcript, documentType)
      setGeneratedContent(fallbackContent)
      toast.info('Generated preview locally (API unavailable)')
      setPreviewOpen(true)
    } finally {
      setGenerating(false)
    }
  }

  const downloadAsText = () => {
    if (!generatedContent) return

    const blob = new Blob([generatedContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${documentType}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Downloaded as text file')
  }

  const copyToClipboard = async () => {
    if (!generatedContent) return

    try {
      await navigator.clipboard.writeText(generatedContent)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const shareDocument = async () => {
    if (!generatedContent && !documentUrl) return

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${DOCUMENT_TEMPLATES.find(t => t.id === documentType)?.name || 'Document'}`,
          text: generatedContent?.slice(0, 200) || 'Generated legal document',
          url: documentUrl || undefined,
        })
        toast.success('Document shared')
      } else {
        copyToClipboard()
      }
    } catch {
      toast.warning('Share cancelled')
    }
  }

  if (!isSupported) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <MicOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Voice Not Supported</h3>
            <p className="text-muted-foreground">
              Please use Chrome, Edge, or Safari for voice input.
            </p>
          </motion.div>
        </CardContent>
      </Card>
    )
  }

  const selectedTemplate = DOCUMENT_TEMPLATES.find(t => t.id === documentType)

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Voice to Legal Document Generator
            <Badge variant="secondary" className="ml-2">
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Powered
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {/* Document Type Selection */}
          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select
              value={documentType}
              onValueChange={(v) => setDocumentType(v as DocumentType)}
              disabled={listening || generating}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['Legal', 'Financial', 'Administrative'].map((category) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {category}
                    </div>
                    {DOCUMENT_TEMPLATES.filter(t => t.category === category).map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{template.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {template.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground">
                {selectedTemplate.description}
              </p>
            )}
          </div>

          {/* Microphone Button */}
          <div className="flex flex-col items-center gap-4 py-6">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                size="lg"
                variant={listening ? 'destructive' : 'default'}
                onClick={listening ? stopListening : startListening}
                disabled={generating}
                className="h-24 w-24 rounded-full shadow-lg relative overflow-hidden"
              >
                <AnimatePresence mode="wait">
                  {listening ? (
                    <motion.div
                      key="mic-off"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <MicOff className="h-10 w-10" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="mic-on"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Mic className="h-10 w-10" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pulse animation when listening */}
                {listening && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-red-500"
                    initial={{ scale: 1, opacity: 0.3 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </Button>
            </motion.div>

            <p className="text-sm text-muted-foreground">
              {listening
                ? 'Listening... Click to stop'
                : 'Click to start dictating'}
            </p>

            <AnimatePresence>
              {listening && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Badge variant="destructive" className="animate-pulse">
                    <Volume2 className="h-3 w-3 mr-1" />
                    Recording
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Live Transcript */}
          <AnimatePresence>
            {(transcript || interimTranscript) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label>Dictation</Label>
                <div className="p-4 bg-muted rounded-lg min-h-[120px] max-h-[200px] overflow-auto">
                  <p className="whitespace-pre-wrap">
                    {transcript}
                    <span className="text-muted-foreground italic">
                      {interimTranscript}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTranscript('')
                      setGeneratedContent(null)
                      setDocumentUrl(null)
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={generateDocument}
                    disabled={generating || !transcript.trim()}
                    className="flex-1"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate Document
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Preview */}
          {generatedContent && !previewOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800"
            >
              <FileCheck className="h-8 w-8 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">Document Ready</p>
                <p className="text-sm text-muted-foreground truncate">
                  {generatedContent.slice(0, 100)}...
                </p>
              </div>
              <Button onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </motion.div>
          )}

          {/* Tips */}
          <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
            <p className="font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Tips for better results:
            </p>
            <ul className="list-disc list-inside space-y-0.5 ml-4">
              <li>Speak clearly and at a moderate pace</li>
              <li>Include names, dates, and amounts when relevant</li>
              <li>Say "new paragraph" to indicate paragraph breaks</li>
              <li>Say "period", "comma", "colon" for punctuation</li>
              <li>Review and edit the generated document before use</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedTemplate?.name || 'Document'} Preview
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-1 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button variant="outline" size="sm" onClick={shareDocument}>
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-2 w-fit">
              <TabsTrigger value="preview">
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="edit">
                <Edit3 className="h-4 w-4 mr-1" />
                Edit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="flex-1 m-0 p-4 overflow-hidden">
              {documentUrl ? (
                <iframe
                  src={documentUrl}
                  className="w-full h-full border rounded-lg"
                  title="Document Preview"
                />
              ) : (
                <ScrollArea className="h-full">
                  <pre className="whitespace-pre-wrap font-mono text-sm p-4 bg-muted rounded-lg">
                    {generatedContent}
                  </pre>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="edit" className="flex-1 m-0 p-4 overflow-hidden">
              <Textarea
                value={generatedContent || ''}
                onChange={(e) => setGeneratedContent(e.target.value)}
                className="h-full font-mono text-sm resize-none"
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-between items-center p-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadAsText}>
                <Download className="h-4 w-4 mr-2" />
                Download TXT
              </Button>
              {documentUrl && (
                <a
                  href={documentUrl}
                  download={`${documentType}-${Date.now()}.pdf`}
                >
                  <Button>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </a>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Local fallback document generation
function generateLocalDocument(voiceText: string, type: DocumentType): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const processedText = voiceText
    .replace(/\s+/g, ' ')
    .replace(/new paragraph/gi, '\n\n')
    .replace(/new line/gi, '\n')
    .replace(/period/gi, '.')
    .replace(/comma/gi, ',')
    .replace(/colon/gi, ':')
    .replace(/semicolon/gi, ';')
    .trim()

  const templates: Partial<Record<DocumentType, string>> = {
    'demand-letter': `
DEMAND LETTER

Date: ${date}

RE: Formal Demand

To Whom It May Concern:

${processedText}

This letter serves as formal demand for immediate action. Please respond within thirty (30) days of receipt of this letter.

Failure to respond or comply may result in further legal action.

Respectfully,

_________________________
[Signature]
MGR Capital Assistance
    `.trim(),

    'assignment-of-interest': `
ASSIGNMENT OF INTEREST IN SURPLUS FUNDS

Date: ${date}

ASSIGNOR (Former Property Owner):
Name: _________________________
Address: _________________________

ASSIGNEE (Recovery Agent):
MGR Capital Assistance

PROPERTY INFORMATION:
Property Address: _________________________
County: _________________________
State: _________________________

ASSIGNMENT:

FOR VALUABLE CONSIDERATION, the Assignor hereby assigns to the Assignee a percentage interest in any and all surplus funds arising from the sale of the above-referenced property.

${processedText}

TERMS:
1. This assignment is IRREVOCABLE
2. Assignor authorizes Assignee to file claims
3. Disbursement shall be split per agreement

_________________________          _________________________
Assignor Signature                  Date

_________________________          _________________________
Assignee Signature                  Date

[NOTARY SECTION]
    `.trim(),

    'contingency-agreement': `
CONTINGENCY FEE AGREEMENT

Date: ${date}

CLIENT: _________________________
AGENT: MGR Capital Assistance

PROPERTY: _________________________
ESTIMATED SURPLUS: $_________________________

SERVICES PROVIDED:
1. Research and verify surplus funds
2. Prepare and file claim documentation
3. Communicate with courts and counties
4. Track claim status and deadlines

${processedText}

FEE STRUCTURE:
Standard Rate: ____% of total recovered

NO UPFRONT FEES - Client pays only if funds are recovered.

_________________________          _________________________
Client Signature                    Date

_________________________          _________________________
Agent Signature                     Date
    `.trim(),
  }

  return templates[type] || templates['demand-letter'] || processedText
}
