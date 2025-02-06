import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion'; // v10.0.0
import { Toast } from '../components/ui/toast';
import type { ComponentVariant } from '../types/common';

// Types and interfaces
type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

interface ToastTemplate {
  id: string;
  title: string;
  description?: string;
  variant: ComponentVariant;
  duration?: number;
}

interface ToastOptions {
  title: string;
  description?: string;
  variant: ComponentVariant;
  duration?: number;
  templateId?: string;
  templateData?: Record<string, unknown>;
  focusAfterDismiss?: HTMLElement;
}

interface ToastInstance {
  id: string;
  title: string;
  description?: string;
  variant: ComponentVariant;
  duration: number;
  createdAt: number;
  isPaused: boolean;
  templateId?: string;
  templateData?: Record<string, unknown>;
  focusAfterDismiss?: HTMLElement;
}

interface ToastContextState {
  toasts: ToastInstance[];
  position: ToastPosition;
  maxVisible: number;
  pauseOnHover: boolean;
  variantDurations: Record<ComponentVariant, number>;
  show: (options: ToastOptions) => void;
  success: (options: Omit<ToastOptions, 'variant'>) => void;
  error: (options: Omit<ToastOptions, 'variant'>) => void;
  warning: (options: Omit<ToastOptions, 'variant'>) => void;
  info: (options: Omit<ToastOptions, 'variant'>) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  registerTemplate: (template: ToastTemplate) => void;
}

interface ToastProviderProps {
  children: ReactNode;
  position?: ToastPosition;
  maxVisible?: number;
  pauseOnHover?: boolean;
  variantDurations?: Record<ComponentVariant, number>;
  templates?: ToastTemplate[];
}

// Default values
const DEFAULT_MAX_VISIBLE = 5;
const DEFAULT_POSITION: ToastPosition = 'top-right';
const DEFAULT_VARIANT_DURATIONS: Record<ComponentVariant, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

// Create context
const ToastContext = createContext<ToastContextState | undefined>(undefined);

// Provider component
export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  position = DEFAULT_POSITION,
  maxVisible = DEFAULT_MAX_VISIBLE,
  pauseOnHover = true,
  variantDurations = DEFAULT_VARIANT_DURATIONS,
  templates = [],
}) => {
  const [toasts, setToasts] = useState<ToastInstance[]>([]);
  const [queue, setQueue] = useState<ToastInstance[]>([]);
  const [templateMap] = useState<Map<string, ToastTemplate>>(
    new Map(templates.map(template => [template.id, template]))
  );

  // Helper to generate unique IDs
  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Process queue when toasts change
  const processQueue = useCallback(() => {
    if (queue.length > 0 && toasts.length < maxVisible) {
      const [nextToast, ...remainingQueue] = queue;
      setToasts(prev => [...prev, nextToast]);
      setQueue(remainingQueue);
    }
  }, [queue, toasts.length, maxVisible]);

  // Add toast with queue management
  const addToast = useCallback((options: ToastOptions) => {
    const id = generateId();
    const createdAt = Date.now();
    
    let toastData: ToastInstance = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant,
      duration: options.duration || variantDurations[options.variant],
      createdAt,
      isPaused: false,
      focusAfterDismiss: options.focusAfterDismiss,
    };

    // Apply template if specified
    if (options.templateId && templateMap.has(options.templateId)) {
      const template = templateMap.get(options.templateId)!;
      toastData = {
        ...toastData,
        title: template.title,
        description: template.description,
        variant: template.variant,
        duration: template.duration || toastData.duration,
        templateId: options.templateId,
        templateData: options.templateData,
      };
    }

    if (toasts.length >= maxVisible) {
      setQueue(prev => [...prev, toastData]);
    } else {
      setToasts(prev => [...prev, toastData]);
    }
  }, [toasts.length, maxVisible, variantDurations, templateMap]);

  // Remove toast and process queue
  const removeToast = useCallback((id: string) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      if (toast?.focusAfterDismiss) {
        toast.focusAfterDismiss.focus();
      }
      return prev.filter(t => t.id !== id);
    });
    processQueue();
  }, [processQueue]);

  // Variant-specific show methods
  const success = useCallback((options: Omit<ToastOptions, 'variant'>) => {
    addToast({ ...options, variant: 'success' });
  }, [addToast]);

  const error = useCallback((options: Omit<ToastOptions, 'variant'>) => {
    addToast({ ...options, variant: 'error' });
  }, [addToast]);

  const warning = useCallback((options: Omit<ToastOptions, 'variant'>) => {
    addToast({ ...options, variant: 'warning' });
  }, [addToast]);

  const info = useCallback((options: Omit<ToastOptions, 'variant'>) => {
    addToast({ ...options, variant: 'info' });
  }, [addToast]);

  // Pause/resume toast timers
  const togglePause = useCallback((id: string, isPaused: boolean) => {
    setToasts(prev =>
      prev.map(toast =>
        toast.id === id ? { ...toast, isPaused } : toast
      )
    );
  }, []);

  // Register new template
  const registerTemplate = useCallback((template: ToastTemplate) => {
    templateMap.set(template.id, template);
  }, [templateMap]);

  const dismissAll = useCallback(() => {
    setToasts([]);
    setQueue([]);
  }, []);

  const contextValue: ToastContextState = {
    toasts,
    position,
    maxVisible,
    pauseOnHover,
    variantDurations,
    show: addToast,
    success,
    error,
    warning,
    info,
    dismiss: removeToast,
    dismissAll,
    registerTemplate,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            duration={toast.duration}
            isVisible={true}
            onClose={() => removeToast(toast.id)}
            onMouseEnter={() => pauseOnHover && togglePause(toast.id, true)}
            onMouseLeave={() => pauseOnHover && togglePause(toast.id, false)}
          />
        ))}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

// Custom hook for using toast context
export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};