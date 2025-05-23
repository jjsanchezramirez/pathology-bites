// src/components/auth/ui/form-field.tsx
import { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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
}

export function FormField({
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
}: FormFieldProps) {
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
}