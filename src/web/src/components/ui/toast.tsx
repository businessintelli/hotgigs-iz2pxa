import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion'; // v10.0.0
import { cn } from 'class-variance-authority'; // v0.7.0
import type { ComponentVariant } from '../../types/common';

// Animation constants
const ANIMATION_DURATION = 200;
const Z_INDEX_DEFAULT = 50;

// Variant-specific styles mapping
const VARIANT_STYLES: Record<ComponentVariant, string> = {
  success: 'bg-green-50 border-green-500 text-green-800',
  error: 'bg-red-50 border-red-500 text-red-800',
  warning: 'bg-yellow-50 border-yellow-500 text-yellow-800',
  info: 'bg-blue-50 border-blue-500 text-blue-800'
};

interface ToastProps {
  title: string;
  description?: string;
  variant: ComponentVariant;
  duration: number;
  isVisible: boolean;
  onClose: () => void;
  zIndex?: number;
  className?: string;
  role?: string;
  disableAutoClose?: boolean;
}

// Icon components for each variant with proper accessibility
const getToastIcon = (variant: ComponentVariant): React.ReactNode => {
  const iconProps = {
    className: cn('w-5 h-5 shrink-0', {
      'text-green-500': variant === 'success',
      'text-red-500': variant === 'error',
      'text-yellow-500': variant === 'warning',
      'text-blue-500': variant === 'info'
    }),
    'aria-hidden': 'true'
  };

  switch (variant) {
    case 'success':
      return (
        <svg {...iconProps} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    case 'error':
      return (
        <svg {...iconProps} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...iconProps} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case 'info':
      return (
        <svg {...iconProps} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      );
  }
};

export const Toast: React.FC<ToastProps> = ({
  title,
  description,
  variant,
  duration,
  isVisible,
  onClose,
  zIndex = Z_INDEX_DEFAULT,
  className,
  role = 'alert',
  disableAutoClose = false
}) => {
  const timerRef = useRef<number>();
  const icon = useMemo(() => getToastIcon(variant), [variant]);

  const handleClose = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    onClose();
  }, [onClose]);

  const startAutoClose = useCallback(() => {
    if (disableAutoClose) return;
    
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    
    timerRef.current = window.setTimeout(() => {
      handleClose();
    }, duration);
  }, [duration, handleClose, disableAutoClose]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  useEffect(() => {
    if (isVisible) {
      startAutoClose();
    }
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [isVisible, startAutoClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: ANIMATION_DURATION / 1000 }}
          className={cn(
            'fixed right-4 top-4 flex w-full max-w-sm items-center space-x-4 rounded-lg border p-4 shadow-lg',
            VARIANT_STYLES[variant],
            className
          )}
          style={{ zIndex }}
          role={role}
          aria-live="polite"
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <div className="flex-shrink-0">{icon}</div>
          <div className="flex-1 space-y-1">
            <h3 className="font-medium">{title}</h3>
            {description && (
              <p className="text-sm opacity-90">{description}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5 focus:bg-black/5 focus:outline-none"
            aria-label="Close notification"
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export type { ToastProps };