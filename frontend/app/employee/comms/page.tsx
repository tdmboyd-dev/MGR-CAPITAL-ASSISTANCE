"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Lock, Send, Users, MessageSquare, Hash } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function EmployeeCommsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ["chat-rooms"],
    queryFn: async () => {
      const { data } = await api.get("/comms/rooms");
      return data;
    },
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["chat-messages", selectedRoom],
    queryFn: async () => {
      if (!selectedRoom) return { data: [] };
      const { data } = await api.get(`/comms/messages?roomId=${selectedRoom}`);
      return data;
    },
    enabled: !!selectedRoom,
    refetchInterval: 5000,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post("/comms/messages", {
        roomId: selectedRoom,
        content,
      });
      return data;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedRoom] });
    },
    onError: () => {
      toast.error("Failed to send message");
    },
  });

  const handleSend = () => {
    if (!message.trim() || !selectedRoom) return;
    sendMessage.mutate(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getRoomIcon = (type: string) => {
    switch (type) {
      case "company":
        return <Users className="h-4 w-4" />;
      case "team":
        return <Hash className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Comms Chamber</h1>
        <p className="text-muted-foreground">Team communication and collaboration</p>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Rooms sidebar */}
        <Card className="w-72 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rooms</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-1 p-2">
            {roomsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : rooms?.data?.length > 0 ? (
              rooms.data.map((room: any) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  className={`w-full flex items-center gap-2 p-3 rounded-lg text-left transition-colors ${
                    selectedRoom === room.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {getRoomIcon(room.type)}
                  <span className="flex-1 truncate">{room.name}</span>
                  {room.locked && <Lock className="h-3 w-3" />}
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No rooms available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Messages area */}
        <Card className="flex-1 flex flex-col">
          {selectedRoom ? (
            <>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-lg">
                  {rooms?.data?.find((r: any) => r.id === selectedRoom)?.name || "Chat"}
                </CardTitle>
                <CardDescription>
                  {rooms?.data?.find((r: any) => r.id === selectedRoom)?.type} room
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : messages?.data?.length > 0 ? (
                  messages.data.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.userId === user?.id ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.userId === user?.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {msg.user?.name || msg.user?.email || "Unknown"}
                        </p>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(msg.createdAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No messages yet. Start the conversation!
                  </p>
                )}
              </CardContent>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sendMessage.isPending}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!message.trim() || sendMessage.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a room to start chatting</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
