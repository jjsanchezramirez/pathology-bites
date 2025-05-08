// src/components/auth/form-field.tsx
import { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { UseFormRegister, RegisterOptions, FieldValues, Path } from "react-hook-form"

interface FormFieldProps<TFieldValues extends FieldValues = FieldValues> {
  id: string;
  name: Path<TFieldValues>; // Separate name for type-safe form registration
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  register?: UseFormRegister<TFieldValues>;
  registerOptions?: RegisterOptions<TFieldValues, Path<TFieldValues>>;
  className?: string;
  required?: boolean;
  autoComplete?: string;
  rightElement?: ReactNode;
  children?: ReactNode;
}

export function FormField<TFieldValues extends FieldValues = FieldValues>({
  id,
  name,
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
}: FormFieldProps<TFieldValues>) {
  // Generate ID for ARIA attributes
  const labelId = `${id}-label`;
  const errorId = error ? `${id}-error` : undefined;
  
  // Field registration properties
  const registrationProps = register 
    ? register(name, registerOptions) 
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