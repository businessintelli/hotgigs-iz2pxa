"use client"

import * as React from "react"
import { DayPicker, DayPickerRootProps } from "react-day-picker" // ^8.8.0
import { format } from "date-fns" // ^2.30.0
import { cn } from "../../lib/utils"

// Calendar component props extending DayPicker props
export interface CalendarProps extends DayPickerRootProps {
  mode?: "single" | "range" | "multiple"
  selected?: Date | Date[] | { from: Date; to: Date }
  onSelect?: (date: Date | undefined) => void
  className?: string
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
}

// Business hours configuration
const BUSINESS_HOURS = {
  start: 9, // 9 AM
  end: 17, // 5 PM
  daysOff: [0, 6], // Sunday and Saturday
}

const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  (
    {
      mode = "single",
      selected,
      onSelect,
      className,
      classNames,
      disabled = false,
      minDate = new Date(),
      maxDate,
      ...props
    },
    ref
  ) => {
    // Handle day selection with business hours validation
    const handleDaySelect = React.useCallback(
      (day: Date | undefined) => {
        if (!day || disabled) return

        const hours = day.getHours()
        const dayOfWeek = day.getDay()

        // Validate business hours and working days
        const isBusinessHours = hours >= BUSINESS_HOURS.start && hours < BUSINESS_HOURS.end
        const isWorkingDay = !BUSINESS_HOURS.daysOff.includes(dayOfWeek)

        if (isWorkingDay && onSelect) {
          onSelect(day)
        }
      },
      [disabled, onSelect]
    )

    // Custom footer component for accessibility information
    const footer = (
      <div className="pt-2 text-sm text-muted-foreground">
        <p role="note" className="text-center">
          Select a date during business hours (9 AM - 5 PM, Mon-Fri)
        </p>
      </div>
    )

    return (
      <DayPicker
        ref={ref}
        mode={mode}
        selected={selected}
        onSelect={handleDaySelect}
        disabled={[
          { dayOfWeek: BUSINESS_HOURS.daysOff },
          { before: minDate },
          ...(maxDate ? [{ after: maxDate }] : []),
          ...(disabled ? [{ from: new Date(0), to: new Date(8640000000000000) }] : []),
        ]}
        showOutsideDays={false}
        fixedWeeks
        className={cn(
          // Base styles
          "p-3",
          "bg-white dark:bg-gray-800",
          "rounded-lg",
          "border border-gray-200 dark:border-gray-700",
          "shadow-sm",
          // Responsive sizing
          "w-full sm:w-auto",
          // Custom className
          className
        )}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-sm font-medium text-gray-900 dark:text-gray-100",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            "inline-flex items-center justify-center rounded-md text-sm font-medium",
            "h-7 w-7",
            "bg-transparent",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            "disabled:opacity-50 disabled:pointer-events-none"
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell: cn(
            "text-gray-500 dark:text-gray-400",
            "rounded-md",
            "w-9",
            "font-normal",
            "text-[0.8rem]"
          ),
          row: "flex w-full mt-2",
          cell: cn(
            "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
            "first:[&:has([aria-selected])]:rounded-l-md",
            "last:[&:has([aria-selected])]:rounded-r-md"
          ),
          day: cn(
            "inline-flex items-center justify-center rounded-md",
            "h-9 w-9",
            "p-0",
            "font-normal",
            "aria-selected:opacity-100",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            "disabled:opacity-50 disabled:pointer-events-none"
          ),
          day_selected: cn(
            "bg-primary text-primary-foreground",
            "hover:bg-primary hover:text-primary-foreground",
            "focus:bg-primary focus:text-primary-foreground"
          ),
          day_today: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
          day_outside: "text-gray-400 dark:text-gray-500 opacity-50",
          day_disabled: "text-gray-400 dark:text-gray-500",
          day_range_middle: "aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800",
          day_hidden: "invisible",
          ...classNames,
        }}
        components={{
          IconLeft: () => <ChevronLeftIcon className="h-4 w-4" />,
          IconRight: () => <ChevronRightIcon className="h-4 w-4" />,
        }}
        footer={footer}
        {...props}
      />
    )
  }
)

Calendar.displayName = "Calendar"

// Icon components for navigation
const ChevronLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

const ChevronRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
)

export { Calendar }