import { useCallback, useEffect, useState } from 'react'; // ^18.0.0
import type { ComponentVariant } from '../../types/common';

// Constants for toast configuration
const TOAST_MAX_COUNT = 5;
const DEFAULT_DURATION = 5000;
const ANIMATION_DURATION = 300;
const Z_INDEX_BASE = 9000;

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ComponentVariant;
  duration?: number;
  dismissible?: boolean;
  pauseOnHover?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  ariaProps?: {
    role?: string;
    'aria-live'?: 'assertive' | 'polite';
    'aria-atomic'?: boolean;
  };
}

interface ToastInstance {
  id: string;
  title: string;
  description?: string;
  variant: ComponentVariant;
  duration: number;
  createdAt: number;
  isVisible: boolean;
  isPaused: boolean;
  remainingTime: number;
  position: string;
}

const createToastContainer = () => {
  const container = document.createElement('div');
  container.id = 'hotgigs-toast-container';
  container.style.cssText = `
    position: fixed;
    max-width: 420px;
    width: calc(100% - 2rem);
    pointer-events: none;
    z-index: ${Z_INDEX_BASE};
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
  `;
  return container;
};

const createToastElement = (toast: ToastInstance): HTMLElement => {
  const element = document.createElement('div');
  element.id = `toast-${toast.id}`;
  element.setAttribute('role', 'alert');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-atomic', 'true');
  
  element.style.cssText = `
    pointer-events: auto;
    display: flex;
    align-items: start;
    gap: 0.75rem;
    width: 100%;
    padding: 1rem;
    border-radius: 0.5rem;
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    transform: translateX(100%);
    transition: all ${ANIMATION_DURATION}ms ease-in-out;
  `;

  // Apply variant-specific styles
  switch (toast.variant) {
    case 'success':
      element.style.borderLeft = '4px solid #10B981';
      break;
    case 'error':
      element.style.borderLeft = '4px solid #EF4444';
      break;
    case 'warning':
      element.style.borderLeft = '4px solid #F59E0B';
      break;
    case 'info':
      element.style.borderLeft = '4px solid #3B82F6';
      break;
  }

  return element;
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastInstance[]>([]);
  
  useEffect(() => {
    const container = createToastContainer();
    document.body.appendChild(container);
    return () => {
      document.body.removeChild(container);
    };
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = crypto.randomUUID();
    const toast: ToastInstance = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant || 'info',
      duration: options.duration || DEFAULT_DURATION,
      createdAt: Date.now(),
      isVisible: true,
      isPaused: false,
      remainingTime: options.duration || DEFAULT_DURATION,
      position: options.position || 'top-right'
    };

    setToasts(current => {
      const updated = [toast, ...current].slice(0, TOAST_MAX_COUNT);
      return updated;
    });

    const element = createToastElement(toast);
    const container = document.getElementById('hotgigs-toast-container');
    if (container) {
      container.appendChild(element);
      
      // Trigger enter animation
      requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.transform = 'translateX(0)';
      });

      // Setup hover pause functionality
      if (options.pauseOnHover) {
        element.addEventListener('mouseenter', () => {
          setToasts(current =>
            current.map(t =>
              t.id === id ? { ...t, isPaused: true } : t
            )
          );
        });

        element.addEventListener('mouseleave', () => {
          setToasts(current =>
            current.map(t =>
              t.id === id ? { ...t, isPaused: false } : t
            )
          );
        });
      }

      // Setup dismiss functionality
      if (options.dismissible !== false) {
        element.addEventListener('click', () => {
          dismiss(id);
        });
      }
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    const element = document.getElementById(`toast-${id}`);
    if (element) {
      element.style.opacity = '0';
      element.style.transform = 'translateX(100%)';
      
      setTimeout(() => {
        element.remove();
        setToasts(current => current.filter(t => t.id !== id));
      }, ANIMATION_DURATION);
    }
  }, []);

  const dismissAll = useCallback(() => {
    toasts.forEach(toast => dismiss(toast.id));
  }, [dismiss, toasts]);

  // Convenience methods for different variants
  const success = useCallback((options: Omit<ToastOptions, 'variant'>) => {
    return show({ ...options, variant: 'success' });
  }, [show]);

  const error = useCallback((options: Omit<ToastOptions, 'variant'>) => {
    return show({ ...options, variant: 'error' });
  }, [show]);

  const warning = useCallback((options: Omit<ToastOptions, 'variant'>) => {
    return show({ ...options, variant: 'warning' });
  }, [show]);

  const info = useCallback((options: Omit<ToastOptions, 'variant'>) => {
    return show({ ...options, variant: 'info' });
  }, [show]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dismissAll();
    };
  }, [dismissAll]);

  return {
    show,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll
  };
}

export type { ToastOptions };