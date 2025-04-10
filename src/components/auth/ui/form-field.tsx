// src/components/auth/form-field.tsx
import { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  register?: any; // React Hook Form register function
  registerOptions?: any; // React Hook Form register options
  className?: string;
  required?: boolean;
  autoComplete?: string;
  rightElement?: ReactNode;
  children?: ReactNode;
}

export function FormField({
  id,
  label,
  type = "text",
  placeholder,
  error,
  disabled = false,
  register,
  registerOptions = {},
  className,
  required = false,
  autoComplete,
  rightElement,
  children,
}: FormFieldProps) {
  // Generate ID for ARIA attributes
  const labelId = `${id}-label`;
  const errorId = error ? `${id}-error` : undefined;
  
  // Field registration properties
  const registrationProps = register 
    ? register(id, registerOptions) 
    : {};

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
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={errorId}
          aria-labelledby={labelId}
          {...registrationProps}
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