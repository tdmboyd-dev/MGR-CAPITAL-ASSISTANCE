"use client";

import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Phone,
  Mail,
  DollarSign,
  UserCheck,
  XCircle,
  Upload,
  MessageSquare,
} from "lucide-react";
import { motion } from "framer-motion";

interface TimelineEvent {
  id: string;
  status?: string;
  type?: string;
  title: string;
  description?: string;
  createdAt: string;
  user?: {
    name: string;
  };
}

interface CaseTimelineProps {
  events: TimelineEvent[];
}

const statusIcons: Record<string, JSX.Element> = {
  NEW: <Clock className="h-5 w-5 text-blue-500" />,
  CONTACTED: <Phone className="h-5 w-5 text-yellow-500" />,
  DOCS_PENDING: <FileText className="h-5 w-5 text-orange-500" />,
  DOCS_RECEIVED: <Upload className="h-5 w-5 text-indigo-500" />,
  IN_PROGRESS: <Clock className="h-5 w-5 text-blue-500" />,
  AWAITING_FUNDS: <DollarSign className="h-5 w-5 text-amber-500" />,
  PAID: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  CLOSED_WON: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  REJECTED: <XCircle className="h-5 w-5 text-red-500" />,
  CLOSED_LOST: <XCircle className="h-5 w-5 text-red-500" />,
  // Event types
  EMAIL: <Mail className="h-5 w-5 text-blue-500" />,
  CALL: <Phone className="h-5 w-5 text-green-500" />,
  DOCUMENT: <FileText className="h-5 w-5 text-purple-500" />,
  PAYMENT: <DollarSign className="h-5 w-5 text-emerald-500" />,
  ASSIGNMENT: <UserCheck className="h-5 w-5 text-indigo-500" />,
  NOTE: <MessageSquare className="h-5 w-5 text-gray-500" />,
};

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 dark:bg-blue-900/30",
  CONTACTED: "bg-yellow-100 dark:bg-yellow-900/30",
  DOCS_PENDING: "bg-orange-100 dark:bg-orange-900/30",
  DOCS_RECEIVED: "bg-indigo-100 dark:bg-indigo-900/30",
  IN_PROGRESS: "bg-blue-100 dark:bg-blue-900/30",
  AWAITING_FUNDS: "bg-amber-100 dark:bg-amber-900/30",
  PAID: "bg-green-100 dark:bg-green-900/30",
  CLOSED_WON: "bg-green-100 dark:bg-green-900/30",
  REJECTED: "bg-red-100 dark:bg-red-900/30",
  CLOSED_LOST: "bg-red-100 dark:bg-red-900/30",
};

export function CaseTimeline({ events }: CaseTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No timeline events yet</p>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {events.map((event, idx) => {
          const icon =
            statusIcons[event.status || event.type || ""] ||
            <Clock className="h-5 w-5 text-gray-400" />;
          const bgColor =
            statusColors[event.status || ""] ||
            "bg-gray-100 dark:bg-gray-800";

          return (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <div className="relative pb-8">
                {idx !== events.length - 1 && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-900 ${bgColor}`}
                  >
                    {icon}
                  </span>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {event.title}
                      </p>
                      {event.description && (
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                          {event.description}
                        </p>
                      )}
                      {event.user && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          by {event.user.name}
                        </p>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                      <time dateTime={event.createdAt}>
                        {format(new Date(event.createdAt), "MMM d, yyyy")}
                      </time>
                      <p className="text-xs">
                        {format(new Date(event.createdAt), "h:mm a")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

export default CaseTimeline;
