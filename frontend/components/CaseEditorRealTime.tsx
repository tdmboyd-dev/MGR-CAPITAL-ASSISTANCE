"use client";

import { useEffect, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Save, Wifi, WifiOff, Circle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  caseId: string;
  userId?: string;
  userName?: string;
}

interface Collaborator {
  id: string;
  name: string;
  color: string;
}

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export default function CaseEditorRealTime({
  caseId,
  userId = "anonymous",
  userName = "Anonymous",
}: Props) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [connected, setConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  // Synchronized fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const ydoc = new Y.Doc();

    // Connect to WebSocket server
    const wsProvider = new WebsocketProvider(
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001",
      `case-${caseId}`,
      ydoc
    );

    // Set up awareness (presence)
    wsProvider.awareness.setLocalStateField("user", {
      id: userId,
      name: userName,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });

    // Track connection status
    wsProvider.on("status", (event: { status: string }) => {
      setConnected(event.status === "connected");
    });

    // Track collaborators
    wsProvider.awareness.on("change", () => {
      const states = Array.from(wsProvider.awareness.getStates().values());
      const users = states
        .map((state: any) => state.user)
        .filter((user: any) => user && user.id !== userId);
      setCollaborators(users);
    });

    // Set up Y.js shared types
    const yTitle = ydoc.getText("title");
    const yDescription = ydoc.getText("description");
    const yNotes = ydoc.getText("notes");

    // Observe changes
    yTitle.observe(() => setTitle(yTitle.toString()));
    yDescription.observe(() => setDescription(yDescription.toString()));
    yNotes.observe(() => setNotes(yNotes.toString()));

    setDoc(ydoc);
    setProvider(wsProvider);

    return () => {
      wsProvider.destroy();
      ydoc.destroy();
    };
  }, [caseId, userId, userName]);

  const updateField = useCallback(
    (fieldName: string, value: string) => {
      if (!doc) return;

      const yText = doc.getText(fieldName);
      doc.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, value);
      });
    },
    [doc]
  );

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, notes }),
      });

      if (response.ok) {
        toast.success("Case saved successfully");
      } else {
        toast.error("Failed to save case");
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Real-time Case Editor
          </CardTitle>
          <div className="flex items-center gap-4">
            {/* Connection status */}
            <Badge variant={connected ? "default" : "destructive"}>
              {connected ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>

            {/* Collaborators */}
            {collaborators.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground mr-2">
                  {collaborators.length} other{collaborators.length > 1 ? "s" : ""} editing:
                </span>
                {collaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                    style={{ backgroundColor: collab.color + "20", color: collab.color }}
                  >
                    <Circle className="h-2 w-2 fill-current" />
                    {collab.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Case ID */}
        <div className="flex items-center gap-2">
          <Badge variant="outline">Case #{caseId}</Badge>
          <span className="text-sm text-muted-foreground">
            Changes sync automatically
          </span>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Case Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Enter case title..."
            className="font-medium"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Case description and details..."
            rows={4}
          />
        </div>

        {/* Collaborative Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Collaborative Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Team notes, updates, action items..."
            rows={6}
            className="font-mono text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Editing as <strong>{userName}</strong>
          </p>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save to Database
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
