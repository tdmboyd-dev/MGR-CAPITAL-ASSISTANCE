"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export function NotificationBadge() {
  const { unreadCount, notifications, isConnected, markAsRead, markAllAsRead } =
    useNotifications();
  const [open, setOpen] = useState(false);

  const priorityColors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    MEDIUM: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
          {/* Connection indicator */}
          <span
            className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-gray-400"
            }`}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-4 cursor-pointer transition-colors hover:bg-muted ${
                    !notification.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                  }`}
                  onClick={() => {
                    if (!notification.isRead) {
                      markAsRead(notification.id);
                    }
                    if (notification.link) {
                      window.location.href = notification.link;
                    }
                    setOpen(false);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <p className="font-medium text-sm truncate">
                          {notification.title}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${priorityColors[notification.priority] || ""}`}
                        >
                          {notification.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(notification.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t">
          <Button
            variant="ghost"
            className="w-full text-sm"
            asChild
          >
            <a href="/notifications">View all notifications</a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBadge;
