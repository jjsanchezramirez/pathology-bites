// Tiny shared inputs for the inspector. Compact, labeled, consistent.

"use client";

import type { ChangeEvent, ReactNode } from "react";

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-gray-700">
      <span className="w-16 flex-shrink-0 text-right text-gray-500">{label}</span>
      <div className="flex-1">{children}</div>
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b px-3 py-2">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step}
        min={min}
        max={max}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="h-6 w-full rounded border border-gray-300 bg-white px-1.5 text-right text-[11px] outline-none focus:border-blue-500"
      />
      {suffix && <span className="text-[10px] text-gray-400">{suffix}</span>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-6 w-full rounded border border-gray-300 bg-white px-1.5 text-[11px] outline-none focus:border-blue-500"
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] outline-none focus:border-blue-500"
    />
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        value={toHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 rounded border border-gray-300 bg-white p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 flex-1 rounded border border-gray-300 bg-white px-1.5 text-[11px] outline-none focus:border-blue-500"
      />
    </div>
  );
}

function toHex(color: string): string {
  // Accept only #rrggbb for the native picker; return #000000 if input doesn't match.
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return "#000000";
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-6 w-full rounded border border-gray-300 bg-white px-1 text-[11px] outline-none focus:border-blue-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
