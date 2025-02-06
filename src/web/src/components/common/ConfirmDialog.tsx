"use client"

import * as React from "react" // ^18.0.0
import { ErrorBoundary } from "react-error-boundary" // ^4.0.0
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog"
import Button from "../ui/button"
import { cn } from "../../lib/utils"

// Types for dialog variants
type DialogVariant = "default" | "destructive" | "warning"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: DialogVariant
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  analyticsEvent?: string
  className?: string
}

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div role="alert" className="p-4 text-destructive">
    <p className="font-semibold">Something went wrong:</p>
    <pre className="mt-2 text-sm">{error.message}</pre>
    <Button
      variant="outline"
      size="sm"
      onClick={resetErrorBoundary}
      className="mt-4"
    >
      Try again
    </Button>
  </div>
)

// Variant styles configuration
const variantStyles: Record<DialogVariant, { confirm: ButtonProps["variant"]; title: string }> = {
  default: {
    confirm: "primary",
    title: "text-foreground",
  },
  destructive: {
    confirm: "destructive",
    title: "text-destructive",
  },
  warning: {
    confirm: "warning",
    title: "text-warning",
  },
}

export const ConfirmDialog = React.forwardRef<HTMLDivElement, ConfirmDialogProps>(
  (
    {
      open,
      onOpenChange,
      title,
      description,
      confirmText = "Confirm",
      cancelText = "Cancel",
      variant = "default",
      onConfirm,
      onCancel,
      isLoading = false,
      analyticsEvent,
      className,
    },
    ref
  ) => {
    // Track dialog events if analytics event name is provided
    const trackDialogEvent = React.useCallback(
      (action: "confirm" | "cancel") => {
        if (analyticsEvent) {
          // Analytics tracking implementation would go here
          console.debug(`Dialog ${analyticsEvent}: ${action}`)
        }
      },
      [analyticsEvent]
    )

    // Handle confirmation with error boundary reset
    const handleConfirm = async () => {
      try {
        trackDialogEvent("confirm")
        await onConfirm()
        onOpenChange(false)
      } catch (error) {
        console.error("Confirmation error:", error)
        // Error will be caught by ErrorBoundary
        throw error
      }
    }

    // Handle cancellation with analytics
    const handleCancel = () => {
      trackDialogEvent("cancel")
      onCancel?.()
      onOpenChange(false)
    }

    // Get styles for current variant
    const styles = variantStyles[variant]

    return (
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => onOpenChange(false)}
      >
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            ref={ref}
            className={cn(
              "sm:max-w-[425px]",
              className
            )}
            onKeyDown={(e) => {
              // Handle keyboard navigation
              if (e.key === "Enter" && !isLoading) {
                e.preventDefault()
                handleConfirm()
              }
            }}
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
          >
            <DialogHeader>
              <DialogTitle
                id="confirm-dialog-title"
                className={cn("text-lg font-semibold", styles.title)}
              >
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription id="confirm-dialog-description">
                  {description}
                </DialogDescription>
              )}
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                aria-label={cancelText}
              >
                {cancelText}
              </Button>
              <Button
                variant={styles.confirm}
                onClick={handleConfirm}
                disabled={isLoading}
                isLoading={isLoading}
                aria-label={confirmText}
              >
                {confirmText}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ErrorBoundary>
    )
  }
)

ConfirmDialog.displayName = "ConfirmDialog"

export default ConfirmDialog