import { useState, useRef, useEffect } from "react";
import { Input } from "@/shared/components/ui/input";
import { formatNumber } from "../utils/formatters";

interface EditableLabelProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onSave: (value: number) => void;
}

export function EditableLabel({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onSave,
}: EditableLabelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const numValue = Number(editValue);
    if (!isNaN(numValue)) {
      const clamped = Math.max(min, Math.min(max, numValue));
      onSave(clamped);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value.toString());
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}:</span>
        <Input
          ref={inputRef}
          type="number"
          min={min}
          max={max}
          step={step}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-6 w-20 text-xs px-2"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    );
  }

  return (
    <div
      className="text-xs cursor-pointer hover:bg-muted/40 px-1 py-0.5 rounded transition-colors inline-block mb-1"
      onClick={() => {
        setEditValue(value.toString());
        setIsEditing(true);
      }}
    >
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">
        {formatNumber(value)}
        {suffix}
      </span>
    </div>
  );
}
