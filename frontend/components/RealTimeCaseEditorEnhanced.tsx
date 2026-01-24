"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  Save,
  Wifi,
  WifiOff,
  Undo,
  Redo,
  History,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  caseId: string;
  userId?: string;
  userName?: string;
}

interface RemoteCursor {
  clientId: number;
  name: string;
  color: string;
  position: number;
  selection?: { start: number; end: number };
}

const CURSOR_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

function getRandomColor(): string {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

export default function RealTimeCaseEditorEnhanced({
  caseId,
  userId = "anonymous",
  userName = "Anonymous",
}: Props) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState("");
  const [connected, setConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Map<number, RemoteCursor>>(
    new Map()
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [userColor] = useState(() => getRandomColor());
  const [versionHistory, setVersionHistory] = useState<
    Array<{ timestamp: Date; content: string }>
  >([]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebsocketProvider(
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001",
      `case-${caseId}`,
      ydoc,
      { connect: true }
    );
    providerRef.current = provider;

    const ytext = ydoc.getText("notes");

    // Set up undo manager
    const undoManager = new Y.UndoManager(ytext, {
      trackedOrigins: new Set([ydoc.clientID]),
    });
    undoManagerRef.current = undoManager;

    // Track undo/redo state
    undoManager.on("stack-item-added", () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    });

    undoManager.on("stack-item-popped", () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    });

    // Observe text changes
    ytext.observe(() => {
      setContent(ytext.toString());

      // Save to version history (debounced in real app)
      setVersionHistory((prev) => [
        ...prev.slice(-9),
        { timestamp: new Date(), content: ytext.toString() },
      ]);
    });

    // Connection status
    provider.on("status", (event: { status: string }) => {
      setConnected(event.status === "connected");
    });

    // Set up awareness (presence)
    const awareness = provider.awareness;
    awareness.setLocalState({
      user: {
        id: userId,
        name: userName,
        color: userColor,
      },
      cursor: {
        position: 0,
        selection: null,
      },
    });

    // Track remote cursors
    awareness.on("change", () => {
      const states = awareness.getStates();
      const newCursors = new Map<number, RemoteCursor>();

      states.forEach((state: any, clientId: number) => {
        if (clientId !== awareness.clientID && state?.user && state?.cursor) {
          newCursors.set(clientId, {
            clientId,
            name: state.user.name,
            color: state.user.color,
            position: state.cursor.position,
            selection: state.cursor.selection,
          });
        }
      });

      setRemoteCursors(newCursors);
    });

    return () => {
      undoManager.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, [caseId, userId, userName, userColor]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!ydocRef.current) return;

      const ytext = ydocRef.current.getText("notes");

      ydocRef.current.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, e.target.value);
      }, ydocRef.current.clientID);

      // Update local cursor position
      const awareness = providerRef.current?.awareness;
      if (awareness) {
        awareness.setLocalStateField("cursor", {
          position: e.target.selectionStart,
          selection:
            e.target.selectionStart !== e.target.selectionEnd
              ? { start: e.target.selectionStart, end: e.target.selectionEnd }
              : null,
        });
      }
    },
    []
  );

  const handleSelect = useCallback(() => {
    if (!textareaRef.current || !providerRef.current) return;

    const awareness = providerRef.current.awareness;
    const { selectionStart, selectionEnd } = textareaRef.current;

    awareness.setLocalStateField("cursor", {
      position: selectionStart,
      selection:
        selectionStart !== selectionEnd
          ? { start: selectionStart, end: selectionEnd }
          : null,
    });
  }, []);

  const handleUndo = () => {
    undoManagerRef.current?.undo();
  };

  const handleRedo = () => {
    undoManagerRef.current?.redo();
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: content }),
      });

      if (response.ok) {
        toast.success("Saved to database");
      } else {
        toast.error("Failed to save");
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  const restoreVersion = (version: { timestamp: Date; content: string }) => {
    if (!ydocRef.current) return;

    const ytext = ydocRef.current.getText("notes");
    ydocRef.current.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, version.content);
    }, ydocRef.current.clientID);

    toast.success("Version restored");
  };

  // Calculate cursor positions in textarea
  const getCursorStyle = (position: number): React.CSSProperties => {
    if (!textareaRef.current) return {};

    // Rough estimation of cursor position
    const lineHeight = 24;
    const charWidth = 8;
    const padding = 16;
    const textareaWidth = textareaRef.current.clientWidth - padding * 2;
    const charsPerLine = Math.floor(textareaWidth / charWidth);

    const line = Math.floor(position / charsPerLine);
    const col = position % charsPerLine;

    return {
      top: `${padding + line * lineHeight}px`,
      left: `${padding + col * charWidth}px`,
    };
  };

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Real-time Case Editor
              <Badge variant="outline">Case #{caseId}</Badge>
            </CardTitle>
            <div className="flex items-center gap-3">
              {/* Connection status */}
              <Badge variant={connected ? "default" : "destructive"}>
                {connected ? (
                  <>
                    <Wifi className="h-3 w-3 mr-1" />
                    Live
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 mr-1" />
                    Offline
                  </>
                )}
              </Badge>

              {/* Active users */}
              <div className="flex -space-x-2">
                {/* Current user */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar
                      className="h-8 w-8 border-2 border-white dark:border-slate-950"
                      style={{ backgroundColor: userColor }}
                    >
                      <AvatarFallback
                        style={{ backgroundColor: userColor, color: "white" }}
                      >
                        {userName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{userName} (you)</p>
                  </TooltipContent>
                </Tooltip>

                {/* Remote users */}
                {Array.from(remoteCursors.values()).map((cursor) => (
                  <Tooltip key={cursor.clientId}>
                    <TooltipTrigger asChild>
                      <Avatar
                        className="h-8 w-8 border-2 border-white dark:border-slate-950"
                        style={{ backgroundColor: cursor.color }}
                      >
                        <AvatarFallback
                          style={{ backgroundColor: cursor.color, color: "white" }}
                        >
                          {cursor.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{cursor.name}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo}
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo}
            >
              <Redo className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>

          {/* Editor with cursor overlays */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onSelect={handleSelect}
              onKeyUp={handleSelect}
              onClick={handleSelect}
              className="w-full h-64 p-4 border rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-950"
              placeholder="Start typing... Changes sync in real-time"
              spellCheck={false}
            />

            {/* Remote cursor overlays */}
            {Array.from(remoteCursors.values()).map((cursor) => (
              <div key={cursor.clientId}>
                {/* Cursor line */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute w-0.5 h-5 pointer-events-none animate-pulse"
                      style={{
                        ...getCursorStyle(cursor.position),
                        backgroundColor: cursor.color,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{cursor.name}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Selection highlight */}
                {cursor.selection && (
                  <div
                    className="absolute h-5 pointer-events-none opacity-30"
                    style={{
                      ...getCursorStyle(cursor.selection.start),
                      width: `${(cursor.selection.end - cursor.selection.start) * 8}px`,
                      backgroundColor: cursor.color,
                    }}
                  />
                )}

                {/* Cursor label */}
                <div
                  className="absolute text-xs px-1 rounded pointer-events-none -mt-5"
                  style={{
                    ...getCursorStyle(cursor.position),
                    backgroundColor: cursor.color,
                    color: "white",
                  }}
                >
                  {cursor.name}
                </div>
              </div>
            ))}
          </div>

          {/* Version history */}
          {versionHistory.length > 0 && (
            <details className="text-sm">
              <summary className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                <History className="h-4 w-4" />
                Version History ({versionHistory.length})
              </summary>
              <div className="mt-2 space-y-1 max-h-32 overflow-auto">
                {versionHistory
                  .slice()
                  .reverse()
                  .map((version, i) => (
                    <button
                      key={i}
                      onClick={() => restoreVersion(version)}
                      className="w-full text-left px-2 py-1 rounded hover:bg-muted text-xs"
                    >
                      {version.timestamp.toLocaleTimeString()} -{" "}
                      {version.content.slice(0, 50)}...
                    </button>
                  ))}
              </div>
            </details>
          )}

          {/* Active collaborators list */}
          {remoteCursors.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Editing with:</span>
              {Array.from(remoteCursors.values()).map((cursor, i) => (
                <span
                  key={cursor.clientId}
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: cursor.color + "20",
                    color: cursor.color,
                  }}
                >
                  {cursor.name}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
