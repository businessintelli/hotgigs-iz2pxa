import * as React from "react"; // ^18.0.0
import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, disabled, type, dir, ...props }, ref) => {
    // Base input styles following shadcn/ui design system
    const baseStyles = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background";
    const focusStyles = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
    const placeholderStyles = "placeholder:text-muted-foreground";
    const fileStyles = type === "file" ? "file:border-0 file:bg-transparent file:text-sm file:font-medium" : "";
    const disabledStyles = disabled ? "cursor-not-allowed opacity-50" : "";
    const errorStyles = error ? "border-destructive bg-destructive/10 focus-visible:ring-destructive" : "";
    const dirStyles = dir ? `text-${dir}` : "";

    // Merge all styles using the cn utility
    const mergedClassName = cn(
      baseStyles,
      focusStyles,
      placeholderStyles,
      fileStyles,
      disabledStyles,
      errorStyles,
      dirStyles,
      className
    );

    return (
      <input
        type={type}
        className={mergedClassName}
        ref={ref}
        disabled={disabled}
        aria-invalid={error ? "true" : "false"}
        aria-errormessage={error ? `${props.id}-error` : undefined}
        dir={dir}
        {...props}
      />
    );
  }
);

// Set display name for React DevTools
Input.displayName = "Input";

export default Input;