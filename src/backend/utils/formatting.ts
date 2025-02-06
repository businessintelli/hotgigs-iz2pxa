import numeral from 'numeral'; // ^2.0.6
import { BaseEntity } from '../types/common';
import { formatDate } from './date-time';

// Interfaces for formatting options
interface CurrencyFormatOptions {
  precision?: number;
  showSymbol?: boolean;
  symbolPosition?: 'prefix' | 'suffix';
  useGrouping?: boolean;
  roundingMode?: 'floor' | 'ceil' | 'round';
}

interface PhoneNumberFormatOptions {
  showExtension?: boolean;
  formatType?: 'national' | 'international';
  separator?: string;
}

interface FileSizeFormatOptions {
  precision?: number;
  binary?: boolean;
  showUnit?: boolean;
  unitSeparator?: string;
}

interface TruncateOptions {
  suffix?: string;
  preserveWords?: boolean;
  preserveHtml?: boolean;
  rtl?: boolean;
}

interface PercentageFormatOptions {
  precision?: number;
  showSymbol?: boolean;
  symbolPosition?: 'prefix' | 'suffix';
  clamp?: boolean;
}

/**
 * Formats a number as currency with locale support and customization options
 * @param amount - The amount to format
 * @param currency - The currency code (e.g., 'USD', 'EUR')
 * @param options - Formatting options
 * @returns Formatted currency string
 * @throws Error if amount is invalid or currency code is unsupported
 */
export function formatCurrency(
  amount: number,
  currency: string,
  options: CurrencyFormatOptions = {}
): string {
  try {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Invalid amount provided');
    }

    const {
      precision = 2,
      showSymbol = true,
      symbolPosition = 'prefix',
      useGrouping = true,
      roundingMode = 'round'
    } = options;

    // Apply rounding based on specified mode
    const roundedAmount = {
      floor: Math.floor(amount * Math.pow(10, precision)) / Math.pow(10, precision),
      ceil: Math.ceil(amount * Math.pow(10, precision)) / Math.pow(10, precision),
      round: Number(amount.toFixed(precision))
    }[roundingMode];

    // Format number with proper grouping
    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
      useGrouping
    });

    const formattedNumber = formatter.format(roundedAmount);
    const currencySymbol = showSymbol ? new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency
    }).format(0).replace(/[\d.,]/g, '').trim() : '';

    return symbolPosition === 'prefix'
      ? `${currencySymbol}${formattedNumber}`
      : `${formattedNumber}${currencySymbol}`;
  } catch (error) {
    throw new Error(`Currency formatting error: ${(error as Error).message}`);
  }
}

/**
 * Formats a phone number with international support and extension handling
 * @param phoneNumber - The phone number to format
 * @param countryCode - The country code (e.g., 'US', 'GB')
 * @param options - Formatting options
 * @returns Formatted phone number string
 * @throws Error if phone number is invalid
 */
export function formatPhoneNumber(
  phoneNumber: string,
  countryCode: string,
  options: PhoneNumberFormatOptions = {}
): string {
  try {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    const {
      showExtension = true,
      formatType = 'national',
      separator = ' '
    } = options;

    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Split number and extension if present
    const [number, extension] = cleaned.split('x');

    // Format based on country code and type
    let formatted: string;
    if (countryCode === 'US') {
      if (number.length === 10) {
        formatted = number.replace(/(\d{3})(\d{3})(\d{4})/, `($1)${separator}$2${separator}$3`);
      } else if (number.length === 11 && number.startsWith('1')) {
        formatted = number.replace(/1(\d{3})(\d{3})(\d{4})/, `+1${separator}($1)${separator}$2${separator}$3`);
      } else {
        throw new Error('Invalid US phone number format');
      }
    } else {
      // Default international format
      formatted = `+${number.slice(0, 2)}${separator}${number.slice(2)}`;
    }

    // Add extension if present and requested
    if (extension && showExtension) {
      formatted += ` ext. ${extension}`;
    }

    return formatted;
  } catch (error) {
    throw new Error(`Phone number formatting error: ${(error as Error).message}`);
  }
}

/**
 * Formats a file size with binary/decimal units and localization
 * @param bytes - The size in bytes
 * @param options - Formatting options
 * @returns Formatted file size string
 * @throws Error if byte count is invalid
 */
export function formatFileSize(
  bytes: number,
  options: FileSizeFormatOptions = {}
): string {
  try {
    if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
      throw new Error('Invalid byte count');
    }

    const {
      precision = 2,
      binary = true,
      showUnit = true,
      unitSeparator = ' '
    } = options;

    const base = binary ? 1024 : 1000;
    const units = binary
      ? ['B', 'KiB', 'MiB', 'GiB', 'TiB']
      : ['B', 'KB', 'MB', 'GB', 'TB'];

    if (bytes === 0) {
      return `0${showUnit ? `${unitSeparator}${units[0]}` : ''}`;
    }

    const exponent = Math.min(
      Math.floor(Math.log(bytes) / Math.log(base)),
      units.length - 1
    );

    const value = bytes / Math.pow(base, exponent);
    const formatted = value.toFixed(precision);

    return `${formatted}${showUnit ? `${unitSeparator}${units[exponent]}` : ''}`;
  } catch (error) {
    throw new Error(`File size formatting error: ${(error as Error).message}`);
  }
}

/**
 * Truncates text with Unicode support and HTML preservation
 * @param text - The text to truncate
 * @param maxLength - Maximum length
 * @param options - Truncation options
 * @returns Truncated text string
 * @throws Error if parameters are invalid
 */
export function truncateText(
  text: string,
  maxLength: number,
  options: TruncateOptions = {}
): string {
  try {
    if (!text) {
      return '';
    }

    if (maxLength < 1) {
      throw new Error('Maximum length must be positive');
    }

    const {
      suffix = '...',
      preserveWords = true,
      preserveHtml = false,
      rtl = false
    } = options;

    // Return original text if it's shorter than maxLength
    if (text.length <= maxLength) {
      return text;
    }

    let truncated: string;

    if (preserveHtml) {
      // Simple HTML tag pattern
      const htmlPattern = /<[^>]+>/g;
      const tags: string[] = [];
      let plainText = text.replace(htmlPattern, (match) => {
        tags.push(match);
        return '\u0000'; // Use null character as placeholder
      });

      // Truncate plain text
      plainText = plainText.slice(0, maxLength);

      // Restore HTML tags
      truncated = plainText.replace(/\u0000/g, () => tags.shift() || '');
    } else {
      truncated = text.slice(0, maxLength);
    }

    if (preserveWords) {
      // Find last word boundary
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 0) {
        truncated = truncated.slice(0, lastSpace);
      }
    }

    // Handle RTL text
    if (rtl) {
      truncated = '\u202B' + truncated + '\u202C';
    }

    return truncated + suffix;
  } catch (error) {
    throw new Error(`Text truncation error: ${(error as Error).message}`);
  }
}

/**
 * Formats a number as a percentage with range validation and localization
 * @param value - The value to format as percentage
 * @param decimals - Number of decimal places
 * @param options - Formatting options
 * @returns Formatted percentage string
 * @throws Error if value is invalid
 */
export function formatPercentage(
  value: number,
  decimals: number = 0,
  options: PercentageFormatOptions = {}
): string {
  try {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Invalid value provided');
    }

    const {
      showSymbol = true,
      symbolPosition = 'suffix',
      clamp = true
    } = options;

    // Clamp value between 0 and 100 if requested
    let normalizedValue = value;
    if (clamp) {
      normalizedValue = Math.max(0, Math.min(100, value));
    }

    // Format number with proper precision
    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    const formattedNumber = formatter.format(normalizedValue);
    const symbol = showSymbol ? '%' : '';

    return symbolPosition === 'prefix'
      ? `${symbol}${formattedNumber}`
      : `${formattedNumber}${symbol}`;
  } catch (error) {
    throw new Error(`Percentage formatting error: ${(error as Error).message}`);
  }
}