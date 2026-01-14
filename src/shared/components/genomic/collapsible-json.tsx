"use client";

import { useState } from "react";

interface Props {
  title: string;
  data: unknown;
}

export function CollapsibleJson({ title, data }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg flex items-center justify-between"
      >
        <span>{title}</span>
        <svg
          className={`h-5 w-5 transform transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen && (
        <pre className="p-4 text-xs overflow-auto max-h-96 bg-gray-900 text-green-400 rounded-b-lg">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
