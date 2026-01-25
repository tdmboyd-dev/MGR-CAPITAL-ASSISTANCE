'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RotateCcw,
  RotateCw,
  History,
  AlertCircle,
  Wifi,
  WifiOff,
  Save,
  Users,
  Clock,
  CheckCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface Props {
  caseId: string
  onSave?: (content: string) => Promise<void>
}

interface CursorData {
  name: string
  color: string
  position: number
  selectionStart: number
  selectionEnd: number
  lastUpdate: number
}

interface VersionSnapshot {
  id: string
  timestamp: Date
  author: string
  content: string
  preview: string
}

// Generate consistent color from name
function nameToColor(name: string): string {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function RealTimeCaseEditorV2({ caseId, onSave }: Props) {
  const { user } = useAuth()
  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const undoManagerRef = useRef<Y.UndoManager | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [content, setContent] = useState('')
  const [cursors, setCursors] = useState<Map<number, CursorData>>(new Map())
  const [connected, setConnected] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [versions, setVersions] = useState<VersionSnapshot[]>([])
  const [conflict, setConflict] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [activeUsers, setActiveUsers] = useState<string[]>([])

  const userColor = user?.name ? nameToColor(user.name) : '#3b82f6'

  // Initialize Yjs
  useEffect(() => {
    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001'
    const provider = new WebsocketProvider(wsUrl, `case-${caseId}`, ydoc)
    providerRef.current = provider

    const ytext = ydoc.getText('notes')
    const undoManager = new Y.UndoManager(ytext)
    undoManagerRef.current = undoManager

    // Text changes
    ytext.observe(() => {
      setContent(ytext.toString())
      setCanUndo(undoManager.canUndo())
      setCanRedo(undoManager.canRedo())
    })

    // Connection status
    provider.on('status', ({ status }: { status: string }) => {
      setConnected(status === 'connected')
      if (status === 'connected') {
        toast.success('Connected to collaboration server')
      } else if (status === 'disconnected') {
        toast.warning('Disconnected - changes will sync when reconnected')
      }
    })

    // Awareness (cursors & presence)
    const awareness = provider.awareness

    awareness.setLocalState({
      user: {
        name: user?.name || 'Anonymous',
        color: userColor,
      },
      cursor: {
        position: 0,
        selectionStart: 0,
        selectionEnd: 0,
      },
    })

    awareness.on('change', () => {
      const states = awareness.getStates()
      const newCursors = new Map<number, CursorData>()
      const users: string[] = []

      states.forEach((state: any, clientId: number) => {
        if (clientId !== awareness.clientID && state?.user && state?.cursor) {
          users.push(state.user.name)
          newCursors.set(clientId, {
            name: state.user.name,
            color: state.user.color,
            position: state.cursor.position,
            selectionStart: state.cursor.selectionStart,
            selectionEnd: state.cursor.selectionEnd,
            lastUpdate: Date.now(),
          })
        }
      })

      setCursors(newCursors)
      setActiveUsers(users)
    })

    // Version snapshots
    let changeCount = 0
    ytext.observe(() => {
      changeCount++
      if (changeCount % 10 === 0) {
        const snapshot: VersionSnapshot = {
          id: `v-${Date.now()}`,
          timestamp: new Date(),
          author: user?.name || 'Unknown',
          content: ytext.toString(),
          preview: ytext.toString().slice(0, 100) + (ytext.length > 100 ? '...' : ''),
        }
        setVersions(prev => [snapshot, ...prev].slice(0, 30))
      }
    })

    // Load initial content
    setContent(ytext.toString())

    return () => {
      provider.destroy()
      ydoc.destroy()
    }
  }, [caseId, user, userColor])

  // Handle text change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!ydocRef.current) return

    const ytext = ydocRef.current.getText('notes')
    const newValue = e.target.value

    ydocRef.current.transact(() => {
      ytext.delete(0, ytext.length)
      ytext.insert(0, newValue)
    })

    // Update cursor position in awareness
    providerRef.current?.awareness.setLocalStateField('cursor', {
      position: e.target.selectionStart,
      selectionStart: e.target.selectionStart,
      selectionEnd: e.target.selectionEnd,
    })
  }, [])

  // Handle selection change
  const handleSelect = useCallback(() => {
    if (!textareaRef.current || !providerRef.current) return

    providerRef.current.awareness.setLocalStateField('cursor', {
      position: textareaRef.current.selectionStart,
      selectionStart: textareaRef.current.selectionStart,
      selectionEnd: textareaRef.current.selectionEnd,
    })
  }, [])

  // Undo/Redo
  const handleUndo = () => {
    undoManagerRef.current?.undo()
  }

  const handleRedo = () => {
    undoManagerRef.current?.redo()
  }

  // Revert to version
  const revertToVersion = (version: VersionSnapshot) => {
    if (!ydocRef.current) return

    const ytext = ydocRef.current.getText('notes')
    ydocRef.current.transact(() => {
      ytext.delete(0, ytext.length)
      ytext.insert(0, version.content)
    })

    toast.success(`Reverted to version from ${version.timestamp.toLocaleTimeString()}`)
  }

  // Save to database
  const handleSave = async () => {
    if (!onSave) return

    setSaving(true)
    try {
      await onSave(content)
      setLastSaved(new Date())
      toast.success('Saved successfully')
    } catch (error) {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Resolve conflict
  const resolveConflict = () => {
    setConflict(null)
    toast.success('Conflict resolved')
  }

  // Calculate cursor position in textarea
  const getCursorStyle = (cursor: CursorData): React.CSSProperties => {
    if (!textareaRef.current) return {}

    const textarea = textareaRef.current
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20
    const charWidth = 8.4 // Approximate for monospace

    const lines = content.substring(0, cursor.position).split('\n')
    const currentLine = lines.length - 1
    const charInLine = lines[lines.length - 1].length

    return {
      left: `${charInLine * charWidth + 16}px`,
      top: `${currentLine * lineHeight + 16}px`,
    }
  }

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-slate-50 dark:bg-slate-900/50 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">Case Notes</CardTitle>

                {/* Connection status */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                      connected
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {connected ? 'Live' : 'Offline'}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {connected ? 'Real-time sync active' : 'Working offline - will sync when connected'}
                  </TooltipContent>
                </Tooltip>

                {/* Active users */}
                {activeUsers.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {activeUsers.length} editing
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Version history */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <History className="h-4 w-4 mr-1" />
                      History
                      {versions.length > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {versions.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-3 border-b">
                      <h4 className="font-medium">Version History</h4>
                      <p className="text-xs text-muted-foreground">
                        Click to restore a previous version
                      </p>
                    </div>
                    <ScrollArea className="h-72">
                      <div className="p-2 space-y-1">
                        {versions.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No versions yet
                          </p>
                        ) : (
                          versions.map((version) => (
                            <motion.button
                              key={version.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              onClick={() => revertToVersion(version)}
                              className="w-full p-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">{version.author}</span>
                                <span className="text-xs text-muted-foreground">
                                  {version.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {version.preview}
                              </p>
                            </motion.button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                {/* Undo/Redo */}
                <div className="flex items-center border rounded-md">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUndo}
                        disabled={!canUndo}
                        className="rounded-r-none"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRedo}
                        disabled={!canRedo}
                        className="rounded-l-none border-l"
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
                  </Tooltip>
                </div>

                {/* Save */}
                {onSave && (
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? (
                      <span className="animate-spin mr-1">⏳</span>
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 relative">
            {/* Conflict alert */}
            <AnimatePresence>
              {conflict && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-4 left-4 right-4 z-10"
                >
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>Sync conflict detected</span>
                      <Button size="sm" onClick={resolveConflict}>
                        Resolve
                      </Button>
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Editor */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onSelect={handleSelect}
                onKeyUp={handleSelect}
                onMouseUp={handleSelect}
                className="w-full min-h-[400px] p-4 font-mono text-sm resize-none focus:outline-none bg-white dark:bg-slate-950 dark:text-slate-100"
                placeholder="Start typing your case notes... Changes sync in real-time with other editors."
                aria-label="Collaborative text editor"
              />

              {/* Remote cursors */}
              <AnimatePresence>
                {Array.from(cursors.entries()).map(([clientId, cursor]) => {
                  const hasSelection = cursor.selectionEnd > cursor.selectionStart
                  const style = getCursorStyle(cursor)

                  return (
                    <motion.div
                      key={clientId}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute pointer-events-none"
                      style={style}
                    >
                      {/* Cursor line */}
                      <div
                        className="w-0.5 h-5 animate-pulse"
                        style={{ backgroundColor: cursor.color }}
                      />
                      {/* Name label */}
                      <div
                        className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap"
                        style={{ backgroundColor: cursor.color }}
                      >
                        {cursor.name}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* Active users footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                {/* User avatars */}
                <div className="flex -space-x-2">
                  {/* Current user */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-6 w-6 border-2 border-white dark:border-slate-900">
                        <AvatarFallback
                          className="text-[10px] text-white"
                          style={{ backgroundColor: userColor }}
                        >
                          {(user?.name || 'A').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>You</TooltipContent>
                  </Tooltip>

                  {/* Remote users */}
                  {Array.from(cursors.values()).map((cursor, i) => (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-6 w-6 border-2 border-white dark:border-slate-900">
                          <AvatarFallback
                            className="text-[10px] text-white"
                            style={{ backgroundColor: cursor.color }}
                          >
                            {cursor.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>{cursor.name}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                <span className="text-xs text-muted-foreground">
                  {cursors.size + 1} {cursors.size === 0 ? 'editor' : 'editors'}
                </span>
              </div>

              {/* Last saved */}
              {lastSaved && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Saved {lastSaved.toLocaleTimeString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  )
}
