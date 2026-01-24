"use client";

import { useState } from "react";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  caseId?: string;
}

interface CalendarProps {
  events?: CalendarEvent[];
  onEventCreate?: (event: Omit<CalendarEvent, "id">) => void;
  onEventUpdate?: (event: CalendarEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export function Calendar({
  events: initialEvents = [],
  onEventCreate,
  onEventUpdate,
  onEventClick,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", time: "09:00" });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getEventsForDay = (day: Date) =>
    events.filter((event) => isSameDay(event.start, day));

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const eventId = result.draggableId;
    const newDateStr = result.destination.droppableId;
    const newDate = new Date(newDateStr);

    setEvents((prev) =>
      prev.map((event) => {
        if (event.id === eventId) {
          const duration = event.end.getTime() - event.start.getTime();
          const updatedEvent = {
            ...event,
            start: newDate,
            end: new Date(newDate.getTime() + duration),
          };
          onEventUpdate?.(updatedEvent);
          return updatedEvent;
        }
        return event;
      })
    );
  };

  const handleAddEvent = () => {
    if (!selectedDate || !newEvent.title) return;

    const [hours, minutes] = newEvent.time.split(":").map(Number);
    const start = new Date(selectedDate);
    start.setHours(hours, minutes, 0, 0);
    const end = addDays(start, 0);
    end.setHours(hours + 1, minutes, 0, 0);

    const event: CalendarEvent = {
      id: `event_${Date.now()}`,
      title: newEvent.title,
      start,
      end,
      color: "bg-blue-500",
    };

    setEvents((prev) => [...prev, event]);
    onEventCreate?.(event);
    setIsAddingEvent(false);
    setNewEvent({ title: "", time: "09:00" });
    setSelectedDate(null);
  };

  const eventColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {format(currentMonth, "MMMM yyyy")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden">
            {/* Header */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="bg-slate-100 dark:bg-slate-800 p-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400"
              >
                {day}
              </div>
            ))}

            {/* Days */}
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const dateKey = format(day, "yyyy-MM-dd");

              return (
                <Droppable key={dateKey} droppableId={dateKey}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      onClick={() => {
                        setSelectedDate(day);
                        setIsAddingEvent(true);
                      }}
                      className={cn(
                        "min-h-[100px] p-1 bg-white dark:bg-slate-900 cursor-pointer transition-colors",
                        !isCurrentMonth && "opacity-50",
                        snapshot.isDraggingOver && "bg-blue-50 dark:bg-blue-950",
                        "hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <div
                        className={cn(
                          "text-right text-sm p-1",
                          isToday &&
                            "bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center ml-auto"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1 mt-1">
                        {dayEvents.slice(0, 3).map((event, index) => (
                          <Draggable
                            key={event.id}
                            draggableId={event.id}
                            index={index}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEventClick?.(event);
                                }}
                                className={cn(
                                  "text-xs p-1 rounded truncate text-white",
                                  event.color ||
                                    eventColors[index % eventColors.length]
                                )}
                              >
                                {event.title}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-slate-500 px-1">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>

        {/* Add Event Dialog */}
        <Dialog open={isAddingEvent} onOpenChange={setIsAddingEvent}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Add Event - {selectedDate && format(selectedDate, "MMM d, yyyy")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Meeting with client..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <Input
                    id="time"
                    type="time"
                    value={newEvent.time}
                    onChange={(e) =>
                      setNewEvent((prev) => ({ ...prev, time: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAddingEvent(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddEvent}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Event
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
