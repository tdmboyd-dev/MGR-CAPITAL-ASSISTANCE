"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mic,
  MicOff,
  FileText,
  Loader2,
  Sparkles,
  Volume2,
} from "lucide-react";

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface ExtractedCaseData {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  propertyAddress?: string;
  estimatedValue?: number;
  jurisdiction?: string;
}

export default function VoiceCaseCreator() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedCaseData | null>(
    null
  );
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript((prev) => prev + " " + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Please enable it in settings.");
      } else {
        toast.error(`Voice recognition error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      if (listening) {
        // Restart if still supposed to be listening
        recognition.start();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [listening]);

  const startListening = () => {
    if (!recognitionRef.current) {
      toast.error("Voice recognition not available");
      return;
    }

    try {
      recognitionRef.current.start();
      setListening(true);
      setTranscript("");
      setInterimTranscript("");
      setExtractedData(null);
      toast.success("Listening... Speak now");
    } catch (error) {
      toast.error("Failed to start voice recognition");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
    setInterimTranscript("");
  };

  const extractCaseData = async () => {
    if (!transcript.trim()) {
      toast.error("No transcript to process");
      return;
    }

    setProcessing(true);

    // Simple extraction logic (could be enhanced with LLM)
    const text = transcript.toLowerCase();

    const extracted: ExtractedCaseData = {
      title: "Voice-created case",
      description: transcript.trim(),
      priority: "MEDIUM",
    };

    // Extract priority
    if (text.includes("urgent") || text.includes("emergency")) {
      extracted.priority = "URGENT";
    } else if (text.includes("high priority") || text.includes("important")) {
      extracted.priority = "HIGH";
    } else if (text.includes("low priority") || text.includes("not urgent")) {
      extracted.priority = "LOW";
    }

    // Extract address pattern
    const addressMatch = text.match(
      /(\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd)[\w\s,]*)/i
    );
    if (addressMatch) {
      extracted.propertyAddress = addressMatch[1].trim();
    }

    // Extract dollar amounts
    const amountMatch = text.match(
      /\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|thousand|k)?/i
    );
    if (amountMatch) {
      let amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      if (text.includes("thousand") || text.includes(" k")) {
        amount *= 1000;
      }
      extracted.estimatedValue = amount;
    }

    // Extract jurisdiction/state
    const states = [
      "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
      "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
      "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
      "maine", "maryland", "massachusetts", "michigan", "minnesota",
      "mississippi", "missouri", "montana", "nebraska", "nevada",
      "new hampshire", "new jersey", "new mexico", "new york",
      "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
      "pennsylvania", "rhode island", "south carolina", "south dakota",
      "tennessee", "texas", "utah", "vermont", "virginia", "washington",
      "west virginia", "wisconsin", "wyoming",
    ];

    for (const state of states) {
      if (text.includes(state)) {
        extracted.jurisdiction = state.charAt(0).toUpperCase() + state.slice(1);
        break;
      }
    }

    // Generate title from context
    if (extracted.propertyAddress) {
      extracted.title = `Property at ${extracted.propertyAddress}`;
    } else if (extracted.jurisdiction) {
      extracted.title = `${extracted.jurisdiction} Surplus Recovery Case`;
    }

    setExtractedData(extracted);
    setProcessing(false);
    toast.success("Data extracted from voice input");
  };

  const createCase = async () => {
    if (!extractedData) {
      toast.error("No case data to submit");
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: extractedData.title,
          description: extractedData.description,
          priority: extractedData.priority,
          propertyAddress: extractedData.propertyAddress,
          estimatedValue: extractedData.estimatedValue,
          jurisdiction: extractedData.jurisdiction,
          source: "VOICE_COMMAND",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Case #${data.id} created successfully!`);
        setTranscript("");
        setExtractedData(null);
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to create case");
      }
    } catch (error) {
      toast.error("Network error - please try again");
    } finally {
      setProcessing(false);
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MicOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Voice Not Supported</h3>
          <p className="text-muted-foreground">
            Your browser does not support voice recognition. Please use Chrome,
            Edge, or Safari.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-blue-600" />
          Voice Case Creator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Microphone Button */}
        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            variant={listening ? "destructive" : "default"}
            onClick={listening ? stopListening : startListening}
            className="h-20 w-20 rounded-full"
          >
            {listening ? (
              <MicOff className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            {listening
              ? "Listening... Click to stop"
              : "Click to start voice input"}
          </p>
          {listening && (
            <Badge variant="destructive" className="animate-pulse">
              <Volume2 className="h-3 w-3 mr-1" />
              Recording
            </Badge>
          )}
        </div>

        {/* Live Transcript */}
        {(transcript || interimTranscript) && (
          <div className="space-y-2">
            <Label>Transcript</Label>
            <div className="p-4 bg-muted rounded-lg min-h-[100px]">
              <p className="whitespace-pre-wrap">
                {transcript}
                <span className="text-muted-foreground">{interimTranscript}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setTranscript("");
                  setExtractedData(null);
                }}
              >
                Clear
              </Button>
              <Button onClick={extractCaseData} disabled={processing}>
                {processing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Extract Case Data
              </Button>
            </div>
          </div>
        )}

        {/* Extracted Data Form */}
        {extractedData && (
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Extracted Case Data
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={extractedData.title}
                  onChange={(e) =>
                    setExtractedData({ ...extractedData, title: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={extractedData.priority}
                  onValueChange={(value: any) =>
                    setExtractedData({ ...extractedData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {extractedData.propertyAddress && (
                <div className="space-y-2">
                  <Label htmlFor="address">Property Address</Label>
                  <Input
                    id="address"
                    value={extractedData.propertyAddress}
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        propertyAddress: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {extractedData.estimatedValue && (
                <div className="space-y-2">
                  <Label htmlFor="value">Estimated Value</Label>
                  <Input
                    id="value"
                    type="number"
                    value={extractedData.estimatedValue}
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        estimatedValue: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              )}

              {extractedData.jurisdiction && (
                <div className="space-y-2">
                  <Label htmlFor="jurisdiction">Jurisdiction</Label>
                  <Input
                    id="jurisdiction"
                    value={extractedData.jurisdiction}
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        jurisdiction: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={extractedData.description}
                onChange={(e) =>
                  setExtractedData({
                    ...extractedData,
                    description: e.target.value,
                  })
                }
                rows={4}
              />
            </div>

            <Button
              onClick={createCase}
              disabled={processing}
              className="w-full"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Create Case
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
