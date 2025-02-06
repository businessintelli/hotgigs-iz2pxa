"use client"

import * as React from "react";
import { format, startOfMonth } from "date-fns"; // ^2.30.0
import { Calendar } from "../ui/calendar";
import { useInterviews } from "../../lib/hooks/useInterviews";
import { Interview, InterviewType, InterviewStatus } from "../../types/interviews";
import { cn } from "../../lib/utils";

// ViewMode type for calendar display options
type ViewMode = "month" | "week";

// Props interface for the CalendarView component
interface CalendarViewProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  defaultView?: ViewMode;
  isReadOnly?: boolean;
  config?: {
    minDate?: Date;
    maxDate?: Date;
    disabledDates?: Date[];
  };
}

// Interview grouping by time slot
interface TimeSlotGroup {
  time: string;
  interviews: Interview[];
}

export const CalendarView = React.forwardRef<HTMLDivElement, CalendarViewProps>(
  (
    {
      selectedDate = new Date(),
      onDateSelect,
      defaultView = "month",
      isReadOnly = false,
      config = {},
    },
    ref
  ) => {
    // State management
    const [currentDate, setCurrentDate] = React.useState<Date>(selectedDate);
    const [viewMode, setViewMode] = React.useState<ViewMode>(defaultView);
    const [selectedTimeSlot, setSelectedTimeSlot] = React.useState<string | null>(null);

    // Fetch interviews using custom hook with pagination
    const {
      data: interviews,
      isLoading,
      error,
      totalCount
    } = useInterviews(
      {
        status: InterviewStatus.SCHEDULED,
      },
      {
        page: 1,
        limit: 100,
      }
    );

    // Accessibility announcement ref
    const announcer = React.useRef<HTMLDivElement>(null);

    // Filter interviews for selected date
    const getInterviewsForDate = (date: Date): Interview[] => {
      return interviews.filter((interview) => {
        const interviewDate = new Date(interview.scheduled_at);
        return (
          interviewDate.getDate() === date.getDate() &&
          interviewDate.getMonth() === date.getMonth() &&
          interviewDate.getFullYear() === date.getFullYear()
        );
      });
    };

    // Group interviews by time slot
    const groupInterviewsByTimeSlot = (dayInterviews: Interview[]): TimeSlotGroup[] => {
      const groups: { [key: string]: Interview[] } = {};
      
      dayInterviews.forEach((interview) => {
        const timeSlot = format(new Date(interview.scheduled_at), "HH:mm");
        if (!groups[timeSlot]) {
          groups[timeSlot] = [];
        }
        groups[timeSlot].push(interview);
      });

      return Object.entries(groups)
        .map(([time, interviews]) => ({ time, interviews }))
        .sort((a, b) => a.time.localeCompare(b.time));
    };

    // Handle date selection with accessibility announcement
    const handleDateSelect = React.useCallback(
      (date: Date) => {
        setCurrentDate(date);
        
        const interviewCount = getInterviewsForDate(date).length;
        const announcement = `Selected date ${format(date, "MMMM do, yyyy")}. ${
          interviewCount
        } interviews scheduled.`;
        
        if (announcer.current) {
          announcer.current.textContent = announcement;
        }

        onDateSelect?.(date);
      },
      [onDateSelect, interviews]
    );

    // Handle view mode change
    const handleViewChange = (mode: ViewMode) => {
      setViewMode(mode);
      const announcement = `Calendar view changed to ${mode} view`;
      if (announcer.current) {
        announcer.current.textContent = announcement;
      }
    };

    // Render time slot with interviews
    const renderTimeSlot = (group: TimeSlotGroup) => (
      <div
        key={group.time}
        className={cn(
          "p-2 border-l-4",
          selectedTimeSlot === group.time
            ? "border-primary bg-primary/10"
            : "border-transparent hover:border-primary/50"
        )}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedTimeSlot(group.time)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setSelectedTimeSlot(group.time);
          }
        }}
      >
        <div className="font-medium text-sm">{group.time}</div>
        {group.interviews.map((interview) => (
          <div
            key={interview.id}
            className="mt-1 p-2 bg-white rounded-md shadow-sm"
            role="article"
            aria-label={`${interview.type} interview at ${group.time}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {InterviewType[interview.type]}
              </span>
              <span
                className={cn(
                  "px-2 py-1 text-xs rounded-full",
                  interview.status === InterviewStatus.SCHEDULED
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                )}
              >
                {InterviewStatus[interview.status]}
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {interview.interviewer_ids.length} interviewer
              {interview.interviewer_ids.length !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>
    );

    // Loading state
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <div
          role="alert"
          className="p-4 border border-red-200 rounded-md bg-red-50 text-red-800"
        >
          Failed to load interviews. Please try again later.
        </div>
      );
    }

    return (
      <div ref={ref} className="space-y-4">
        {/* Accessibility announcer */}
        <div
          ref={announcer}
          className="sr-only"
          role="status"
          aria-live="polite"
        />

        {/* View mode controls */}
        <div className="flex items-center space-x-2" role="toolbar">
          <button
            onClick={() => handleViewChange("month")}
            className={cn(
              "px-3 py-1 rounded-md text-sm",
              viewMode === "month"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent hover:bg-gray-100"
            )}
            aria-pressed={viewMode === "month"}
          >
            Month
          </button>
          <button
            onClick={() => handleViewChange("week")}
            className={cn(
              "px-3 py-1 rounded-md text-sm",
              viewMode === "week"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent hover:bg-gray-100"
            )}
            aria-pressed={viewMode === "week"}
          >
            Week
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {/* Calendar */}
          <div className={viewMode === "month" ? "md:col-span-7" : "md:col-span-5"}>
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={handleDateSelect}
              disabled={isReadOnly}
              {...config}
              className="rounded-md border"
            />
          </div>

          {/* Interview list */}
          <div
            className={cn(
              "border rounded-md p-4",
              viewMode === "month" ? "md:col-span-7" : "md:col-span-2"
            )}
          >
            <h2 className="text-lg font-semibold mb-4">
              {format(currentDate, "MMMM d, yyyy")}
            </h2>
            <div className="space-y-4">
              {getInterviewsForDate(currentDate).length === 0 ? (
                <p className="text-gray-500 text-sm">No interviews scheduled</p>
              ) : (
                groupInterviewsByTimeSlot(getInterviewsForDate(currentDate)).map(
                  renderTimeSlot
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CalendarView.displayName = "CalendarView";

export default CalendarView;