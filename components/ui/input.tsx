import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, helperText, ...props }, ref) => {
    const id = React.useId();
    
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={id}
          className={cn(
            "flex h-11 w-full rounded-xl border bg-zinc-50 dark:bg-zinc-800 px-4 py-2 text-sm",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-200",
            error
              ? "border-red-500 focus-visible:ring-red-500"
              : "border-zinc-200 dark:border-zinc-700",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-500">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
