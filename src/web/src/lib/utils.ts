import { format } from "date-fns"; // ^2.30.0
import { clsx } from "clsx"; // ^2.0.0
import { PaginationParams } from "../types/common";
import { DATE_FORMATS } from "../config/constants";

/**
 * Formats a date string or timestamp according to specified format pattern
 * with enhanced null/undefined handling
 */
export const formatDate = (
  date: Date | string | number | null | undefined,
  formatPattern: string = DATE_FORMATS.DISPLAY_DATE
): string => {
  try {
    if (!date) return "";
    
    const dateObject = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObject.getTime())) {
      return "";
    }
    
    return format(dateObject, formatPattern);
  } catch (error) {
    console.error("Date formatting error:", error);
    return "";
  }
};

/**
 * Calculates pagination metadata for data lists with enhanced validation
 */
export const calculatePagination = (
  params: PaginationParams,
  totalItems: number
): {
  totalPages: number;
  offset: number;
  currentPage: number;
  pageSize: number;
  isValid: boolean;
} => {
  // Normalize and validate input
  const pageSize = Math.max(1, Math.min(params.limit, 100));
  const currentPage = Math.max(1, params.page);
  const totalPages = Math.ceil(totalItems / pageSize);
  const offset = (currentPage - 1) * pageSize;
  const isValid = currentPage <= totalPages;

  return {
    totalPages,
    offset,
    currentPage,
    pageSize,
    isValid
  };
};

/**
 * Utility for conditional className merging using clsx
 */
export const cn = (...inputs: any[]): string => {
  return clsx(inputs);
};

/**
 * Formats file size in bytes to human readable format with extended unit support
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 0) return "0 B";
  
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * Creates a debounced version of a function with proper TypeScript typing
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      fn.apply(context, args);
    }, delay);
  };
}

/**
 * Type guard to check if a value is not null or undefined
 */
export const isDefined = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};

/**
 * Safely access nested object properties
 */
export const getNestedValue = <T>(
  obj: any,
  path: string,
  defaultValue: T
): T => {
  try {
    return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? defaultValue;
  } catch {
    return defaultValue;
  }
};

/**
 * Formats a number with thousand separators and decimal places
 */
export const formatNumber = (
  number: number,
  decimals: number = 0,
  thousandsSeparator: string = ","
): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true
    }).format(number);
  } catch {
    return number.toString();
  }
};

/**
 * Truncates text to a specified length with ellipsis
 */
export const truncateText = (
  text: string,
  maxLength: number,
  ellipsis: string = "..."
): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
};

/**
 * Generates a random string of specified length
 */
export const generateRandomString = (length: number): string => {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
};