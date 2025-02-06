import * as React from "react" // ^18.0.0
import * as SelectPrimitive from "@radix-ui/react-select" // ^1.2.0
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons" // ^1.3.0
import { cn } from "../../lib/utils"

// Interface for individual select options with enhanced accessibility
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  description?: string
  "aria-label"?: string
}

// Comprehensive props interface for the Select component
export interface SelectProps {
  id?: string
  name?: string
  label?: string
  placeholder?: string
  value?: string
  options: SelectOption[]
  disabled?: boolean
  required?: boolean
  error?: string
  loading?: boolean
  size?: "sm" | "md" | "lg"
  "aria-label"?: string
  autoFocus?: boolean
  onChange?: (value: string) => void
  onBlur?: (event: React.FocusEvent) => void
  className?: string
}

// Base styles for the select component
const selectStyles = {
  trigger: "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  content: "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  viewport: "p-1",
  item: "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  label: "py-1.5 pl-8 pr-2 text-sm font-semibold",
  separator: "-mx-1 my-1 h-px bg-muted",
  indicator: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
  scrollButton: "flex cursor-default items-center justify-center py-1"
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({
    id,
    name,
    label,
    placeholder = "Select an option",
    value,
    options,
    disabled = false,
    required = false,
    error,
    loading = false,
    size = "md",
    "aria-label": ariaLabel,
    autoFocus = false,
    onChange,
    onBlur,
    className
  }, ref) => {
    // Handle value change with validation
    const handleChange = React.useCallback(
      (newValue: string) => {
        if (onChange) {
          onChange(newValue)
        }
      },
      [onChange]
    )

    // Handle keyboard interaction
    const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
      }
    }, [])

    return (
      <SelectPrimitive.Root
        value={value}
        onValueChange={handleChange}
        disabled={disabled || loading}
      >
        {label && (
          <SelectPrimitive.Label
            className="mb-2 block text-sm font-medium text-foreground"
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </SelectPrimitive.Label>
        )}
        
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          name={name}
          className={cn(
            selectStyles.trigger,
            error && "border-destructive",
            size === "sm" && "h-8 text-xs",
            size === "lg" && "h-12 text-base",
            className
          )}
          aria-label={ariaLabel}
          aria-invalid={!!error}
          aria-required={required}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          autoFocus={autoFocus}
        >
          <SelectPrimitive.Value
            placeholder={placeholder}
            className="text-muted-foreground"
          />
          <SelectPrimitive.Icon className="ml-2">
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={selectStyles.content}
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.ScrollUpButton className={selectStyles.scrollButton}>
              <ChevronDownIcon className="h-4 w-4 rotate-180" />
            </SelectPrimitive.ScrollUpButton>

            <SelectPrimitive.Viewport className={selectStyles.viewport}>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={selectStyles.item}
                  aria-label={option["aria-label"]}
                >
                  <span className={selectStyles.indicator}>
                    <SelectPrimitive.ItemIndicator>
                      <CheckIcon className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  {option.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>

            <SelectPrimitive.ScrollDownButton className={selectStyles.scrollButton}>
              <ChevronDownIcon className="h-4 w-4" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>

        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </SelectPrimitive.Root>
    )
  }
)

Select.displayName = "Select"

export default Select