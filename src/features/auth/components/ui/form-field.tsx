// src/features/auth/components/ui/form-field.tsx
"use client"

import { ReactNode, forwardRef } from "react"
import { Label } from "@/shared/components/ui/label"
import { Input } from "@/shared/components/ui/input"
import { cn } from "@/shared/utils"

interface FormFieldProps {
  id: string;
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  autoComplete?: string;
  rightElement?: ReactNode;
  children?: ReactNode;
  defaultValue?: string;
  // Allow any additional props for react-hook-form integration
  [key: string]: any;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({
  id,
  name,
  label,
  type = "text",
  placeholder,
  error,
  disabled = false,
  className,
  required = false,
  autoComplete,
  rightElement,
  children,
  defaultValue,
  ...props
}, ref) => {
  // Generate ID for ARIA attributes
  const labelId = `${id}-label`;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          id={labelId}
          className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}
        >
          {label}
        </Label>
        {rightElement}
      </div>

      {/* Either render the input or custom children */}
      {children || (
        <Input
          ref={ref}
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
          defaultValue={defaultValue}
          aria-invalid={!!error}
          aria-describedby={errorId}
          aria-labelledby={labelId}
          {...props}
        />
      )}

      {/* Error message */}
      {error && (
        <p
          className="text-sm text-destructive"
          role="alert"
          id={errorId}
        >
          {error}
        </p>
      )}
    </div>
  )
})

FormField.displayName = "FormField"