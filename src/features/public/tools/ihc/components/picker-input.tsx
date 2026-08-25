"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

/**
 * The search-with-dropdown used by both pickers in this tool.
 *
 * It exists for two reasons. The diagnosis picker and the marker picker were
 * the same forty lines twice — same outside-click effect, same absolutely
 * positioned list, differing only in how a row is drawn — and neither could be
 * driven from the keyboard: you typed, then had to leave the keys to click.
 * With one component the arrow/Enter handling is written once and both get it.
 *
 * Keys follow the repo's existing autocomplete (see tag-autocomplete.tsx):
 * ↑/↓ move and clamp at the ends rather than wrapping, Enter takes the
 * highlighted row, Escape closes without selecting. The highlight is kept in
 * view with `block: "nearest"`, because the list scrolls at ~8 rows and arrowing
 * to row 12 otherwise moves an invisible selection.
 */
export function PickerInput<T extends { id: string }>({
  placeholder,
  search,
  onPick,
  renderRow,
}: {
  placeholder: string;
  /** Rank the query. Memoize it upstream — this runs on every keystroke. */
  search: (query: string) => T[];
  onPick: (item: T) => void;
  renderRow: (item: T) => ReactNode;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => (q.trim() ? search(q) : []), [q, search]);
  const visible = open && results.length > 0;

  // A new query means a new list; keeping the old index would leave the
  // highlight on whatever row happened to land in that position.
  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (!visible) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, visible]);

  const pick = (item: T) => {
    onPick(item);
    setQ("");
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (!visible) return;
      e.preventDefault();
      const item = results[active];
      if (item) pick(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={visible}
          aria-controls="picker-listbox"
          aria-autocomplete="list"
          aria-activedescendant={visible ? `picker-option-${active}` : undefined}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {visible && (
        <ul
          ref={listRef}
          id="picker-listbox"
          role="listbox"
          className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-lg"
        >
          {results.map((item, i) => (
            <li key={item.id} id={`picker-option-${i}`} role="option" aria-selected={i === active}>
              <button
                // Mouse and keyboard drive the SAME highlight, so moving the
                // pointer over the list cannot leave two rows looking chosen.
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(item)}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm ${
                  i === active ? "bg-accent" : ""
                }`}
              >
                {renderRow(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
