"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Loader2,
  Bot,
  Zap,
  MessageSquare,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface LegalBot {
  id: string;
  name: string;
  role: string;
  specialty: string;
  description: string;
  avatar: string;
  color: string;
  capabilities: string[];
  personality: {
    tone: string;
    profanityEnabled: boolean;
  };
  status: "active" | "busy" | "offline";
}

interface ChatMessage {
  role: "user" | "bot";
  content: string;
  suggestions?: string[];
}

export default function AIBotsPage() {
  const [selectedBot, setSelectedBot] = useState<LegalBot | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [activeTab, setActiveTab] = useState("bots");

  // Fetch all bots
  const { data: bots, isLoading } = useQuery({
    queryKey: ["ai-bots"],
    queryFn: async () => {
      const { data } = await api.get("/ai-bots");
      return data.data as LegalBot[];
    },
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async ({ botId, message }: { botId: string; message: string }) => {
      const { data } = await api.post(`/ai-bots/${botId}/chat`, { message });
      return data.data;
    },
    onSuccess: (data) => {
      setChatMessages((prev) => [
        ...prev,
        { role: "bot", content: data.response, suggestions: data.suggestions },
      ]);
    },
    onError: () => {
      toast.error("Failed to get response from bot");
    },
  });

  // Task mutation
  const taskMutation = useMutation({
    mutationFn: async ({
      botId,
      taskType,
      input,
    }: {
      botId: string;
      taskType: string;
      input: any;
    }) => {
      const { data } = await api.post(`/ai-bots/${botId}/task`, { taskType, input });
      return data.data;
    },
    onSuccess: (data) => {
      toast.success("Task completed", {
        description: `${data.botId} finished the task`,
      });
      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: `Task completed!\n\n${JSON.stringify(data.result, null, 2)}`,
        },
      ]);
    },
    onError: () => {
      toast.error("Task failed");
    },
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !selectedBot) return;

    setChatMessages((prev) => [...prev, { role: "user", content: inputMessage }]);
    chatMutation.mutate({ botId: selectedBot.id, message: inputMessage });
    setInputMessage("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!selectedBot) return;
    setChatMessages((prev) => [...prev, { role: "user", content: suggestion }]);
    chatMutation.mutate({ botId: selectedBot.id, message: suggestion });
  };

  const handleSelectBot = (bot: LegalBot) => {
    setSelectedBot(bot);
    setChatMessages([
      {
        role: "bot",
        content: `Hello! I'm ${bot.name}, your ${bot.role}. ${bot.description}\n\nHow can I help you today?`,
        suggestions: bot.capabilities.slice(0, 3),
      },
    ]);
    setActiveTab("chat");
  };

  const statusColors = {
    active: "bg-green-500",
    busy: "bg-yellow-500",
    offline: "bg-gray-500",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Legal Team</h1>
        <p className="text-muted-foreground">
          Your firm of 8 specialized AI legal agents ready to assist
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bots">
            <Bot className="h-4 w-4 mr-2" />
            All Bots ({bots?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="chat" disabled={!selectedBot}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat {selectedBot && `with ${selectedBot.name}`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bots" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {bots?.map((bot, index) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
                    selectedBot?.id === bot.id
                      ? "ring-2 ring-blue-500"
                      : ""
                  }`}
                  onClick={() => handleSelectBot(bot)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div
                        className="text-4xl p-3 rounded-xl"
                        style={{ backgroundColor: `${bot.color}20` }}
                      >
                        {bot.avatar}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${statusColors[bot.status]}`}
                        />
                        <span className="text-xs text-muted-foreground capitalize">
                          {bot.status}
                        </span>
                      </div>
                    </div>
                    <CardTitle className="text-lg mt-3">{bot.name}</CardTitle>
                    <CardDescription>{bot.role}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {bot.specialty}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {bot.capabilities.slice(0, 2).map((cap) => (
                        <Badge key={cap} variant="secondary" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                      {bot.capabilities.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{bot.capabilities.length - 2} more
                        </Badge>
                      )}
                    </div>
                    {bot.personality.profanityEnabled && (
                      <Badge
                        variant="outline"
                        className="mt-2 text-xs text-orange-600 border-orange-300"
                      >
                        Uncensored Mode
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          {selectedBot && (
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  <div
                    className="text-3xl p-2 rounded-lg"
                    style={{ backgroundColor: `${selectedBot.color}20` }}
                  >
                    {selectedBot.avatar}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{selectedBot.name}</CardTitle>
                    <CardDescription>{selectedBot.role}</CardDescription>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${statusColors[selectedBot.status]}`}
                    />
                    <span className="text-sm text-muted-foreground capitalize">
                      {selectedBot.status}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-4">
                    <AnimatePresence>
                      {chatMessages.map((msg, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${
                            msg.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-xl p-4 ${
                              msg.role === "user"
                                ? "bg-blue-600 text-white"
                                : "bg-muted"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            {msg.suggestions && msg.suggestions.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {msg.suggestions.map((suggestion) => (
                                  <Button
                                    key={suggestion}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                  >
                                    <Zap className="h-3 w-3 mr-1" />
                                    {suggestion}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {chatMutation.isPending && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-xl p-4">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>

              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={`Ask ${selectedBot.name} anything...`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={chatMutation.isPending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || chatMutation.isPending}
                  >
                    {chatMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
