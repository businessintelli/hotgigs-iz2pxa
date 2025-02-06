import dayjs from 'dayjs'; // ^1.11.9
import utc from 'dayjs/plugin/utc'; // ^1.11.9
import timezone from 'dayjs/plugin/timezone'; // ^1.11.9
import { BaseEntity } from '../types/common';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Supported date formats
const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DATE: 'YYYY-MM-DD',
  TIME: 'HH:mm:ss',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  DISPLAY: 'MMM D, YYYY h:mm A'
} as const;

// Supported duration units
const DURATION_UNITS = ['minutes', 'hours', 'days'] as const;
type DurationUnit = typeof DURATION_UNITS[number];

// Business hours configuration
const BUSINESS_HOURS = {
  start: 9, // 9 AM
  end: 17, // 5 PM
  timezone: 'America/New_York',
  weekdays: [1, 2, 3, 4, 5] // Monday to Friday
} as const;

/**
 * Formats a date into a standardized string format
 * @param date - The date to format
 * @param format - The desired format (from DATE_FORMATS)
 * @returns Formatted date string
 * @throws Error if date is invalid or format is unsupported
 */
export function formatDate(date: Date, format: keyof typeof DATE_FORMATS): string {
  try {
    if (!date) {
      throw new Error('Date parameter is required');
    }

    const dayjsDate = dayjs(date);
    if (!dayjsDate.isValid()) {
      throw new Error('Invalid date provided');
    }

    if (!(format in DATE_FORMATS)) {
      throw new Error(`Unsupported format: ${format}`);
    }

    return dayjsDate.format(DATE_FORMATS[format]);
  } catch (error) {
    throw new Error(`Date formatting error: ${(error as Error).message}`);
  }
}

/**
 * Parses a date string into a Date object
 * @param dateString - The date string to parse
 * @param format - The format of the input string (from DATE_FORMATS)
 * @returns Parsed Date object
 * @throws Error if parsing fails or format is unsupported
 */
export function parseDate(dateString: string, format: keyof typeof DATE_FORMATS): Date {
  try {
    if (!dateString) {
      throw new Error('Date string is required');
    }

    if (!(format in DATE_FORMATS)) {
      throw new Error(`Unsupported format: ${format}`);
    }

    const parsed = dayjs(dateString, DATE_FORMATS[format], true);
    if (!parsed.isValid()) {
      throw new Error('Invalid date string for specified format');
    }

    return parsed.toDate();
  } catch (error) {
    throw new Error(`Date parsing error: ${(error as Error).message}`);
  }
}

/**
 * Converts a date to a specific timezone
 * @param date - The date to convert
 * @param timezone - Target IANA timezone
 * @returns Date object in specified timezone
 * @throws Error if timezone is invalid or conversion fails
 */
export function convertToTimezone(date: Date, timezone: string): Date {
  try {
    if (!date) {
      throw new Error('Date parameter is required');
    }

    const dayjsDate = dayjs(date);
    if (!dayjsDate.isValid()) {
      throw new Error('Invalid date provided');
    }

    // Validate timezone
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      throw new Error(`Invalid timezone: ${timezone}`);
    }

    return dayjsDate.tz(timezone).toDate();
  } catch (error) {
    throw new Error(`Timezone conversion error: ${(error as Error).message}`);
  }
}

/**
 * Calculates duration between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @param unit - Duration unit (minutes, hours, days)
 * @returns Duration in specified unit
 * @throws Error if dates are invalid or unit is unsupported
 */
export function calculateDuration(
  startDate: Date,
  endDate: Date,
  unit: DurationUnit
): number {
  try {
    if (!startDate || !endDate) {
      throw new Error('Both start and end dates are required');
    }

    const start = dayjs(startDate);
    const end = dayjs(endDate);

    if (!start.isValid() || !end.isValid()) {
      throw new Error('Invalid date(s) provided');
    }

    if (!DURATION_UNITS.includes(unit)) {
      throw new Error(`Unsupported duration unit: ${unit}`);
    }

    const duration = end.diff(start, unit);
    if (duration < 0) {
      throw new Error('End date must be after start date');
    }

    return duration;
  } catch (error) {
    throw new Error(`Duration calculation error: ${(error as Error).message}`);
  }
}

/**
 * Checks if a given time falls within business hours
 * @param date - The date to check
 * @param timezone - Timezone for business hours check
 * @returns Boolean indicating if time is within business hours
 * @throws Error if date or timezone is invalid
 */
export function isBusinessHours(date: Date, timezone: string = BUSINESS_HOURS.timezone): boolean {
  try {
    if (!date) {
      throw new Error('Date parameter is required');
    }

    const localDate = dayjs(date).tz(timezone);
    if (!localDate.isValid()) {
      throw new Error('Invalid date provided');
    }

    const hour = localDate.hour();
    const dayOfWeek = localDate.day();

    // Check if it's a weekday
    if (!BUSINESS_HOURS.weekdays.includes(dayOfWeek)) {
      return false;
    }

    // Check if time is within business hours
    return hour >= BUSINESS_HOURS.start && hour < BUSINESS_HOURS.end;
  } catch (error) {
    throw new Error(`Business hours check error: ${(error as Error).message}`);
  }
}

/**
 * Adds a duration to a date
 * @param date - The base date
 * @param amount - Amount to add
 * @param unit - Duration unit (minutes, hours, days)
 * @returns New date with added duration
 * @throws Error if parameters are invalid
 */
export function addDuration(date: Date, amount: number, unit: DurationUnit): Date {
  try {
    if (!date) {
      throw new Error('Date parameter is required');
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Amount must be a positive integer');
    }

    if (!DURATION_UNITS.includes(unit)) {
      throw new Error(`Unsupported duration unit: ${unit}`);
    }

    const dayjsDate = dayjs(date);
    if (!dayjsDate.isValid()) {
      throw new Error('Invalid date provided');
    }

    return dayjsDate.add(amount, unit).toDate();
  } catch (error) {
    throw new Error(`Duration addition error: ${(error as Error).message}`);
  }
}