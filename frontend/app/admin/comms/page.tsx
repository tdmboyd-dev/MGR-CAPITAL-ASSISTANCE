"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import {
  MessageSquare,
  Users,
  Hash,
  Lock,
  ChevronRight,
} from "lucide-react";

export default function AdminCommsPage() {
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["admin-chat-rooms"],
    queryFn: async () => {
      const { data } = await api.get("/comms/rooms");
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getRoomIcon = (type: string) => {
    switch (type) {
      case "company":
        return <Users className="h-5 w-5 text-blue-500" />;
      case "team":
        return <Hash className="h-5 w-5 text-purple-500" />;
      default:
        return <MessageSquare className="h-5 w-5 text-green-500" />;
    }
  };

  const roomList = rooms?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <MessageSquare className="h-8 w-8" />
          Comms Chamber
        </h1>
        <p className="text-muted-foreground">
          Monitor and manage all communication rooms
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rooms
            </CardTitle>
            <Hash className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roomList.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team Rooms
            </CardTitle>
            <Users className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roomList.filter((r: any) => r.type === "team").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Private Rooms
            </CardTitle>
            <Lock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roomList.filter((r: any) => r.locked).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room List */}
      <Card>
        <CardHeader>
          <CardTitle>All Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          {roomList.length > 0 ? (
            <div className="space-y-3">
              {roomList.map((room: any) => (
                <Link
                  key={room.id}
                  href={`/admin/comms/${room.id}`}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getRoomIcon(room.type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{room.name}</p>
                        {room.locked && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {room.lastMessage?.content
                          ? room.lastMessage.content.length > 60
                            ? room.lastMessage.content.substring(0, 60) + "..."
                            : room.lastMessage.content
                          : "No messages yet"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant="secondary">
                        {room.participantCount || room._count?.members || 0} members
                      </Badge>
                      {room.lastMessage?.createdAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(room.lastMessage.createdAt)}
                        </p>
                      )}
                      {room.updatedAt && !room.lastMessage?.createdAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(room.updatedAt)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No chat rooms yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
