"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface DaysOffPickerProps {
  daysOff: Record<string, "full" | "half">;
  onChange: (daysOff: Record<string, "full" | "half">) => void;
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
}

const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

export function DaysOffPicker({ daysOff, onChange, calendarMonth, setCalendarMonth }: DaysOffPickerProps) {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const cells: Date[] = [];
  const current = new Date(startDate);
  while (current <= lastDay || current.getDay() !== 0) {
    cells.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const toggleDayOff = (dateStr: string) => {
    const newDaysOff = { ...daysOff };
    const status = newDaysOff[dateStr];
    if (!status) {
      newDaysOff[dateStr] = "half";
    } else if (status === "half") {
      newDaysOff[dateStr] = "full";
    } else {
      delete newDaysOff[dateStr];
    }
    onChange(newDaysOff);
  };

  const navMonth = (offset: number) => {
    const m = new Date(calendarMonth);
    m.setMonth(m.getMonth() + offset);
    setCalendarMonth(m);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navMonth(-1)}>
          <ChevronLeft size={16} />
        </Button>
        <span className="text-sm font-medium text-foreground">
          {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => navMonth(1)}>
          <ChevronRight size={16} />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Tap to cycle: none → half day → full day off
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((day, i) => (
          <div key={i} className="py-1 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          const dateStr = date.toISOString().split("T")[0];
          const status = daysOff[dateStr];
          const isOtherMonth = date.getMonth() !== month;

          let cellClass = "bg-card text-foreground";
          if (status === "half") cellClass = "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 ring-1 ring-amber-200";
          if (status === "full") cellClass = "bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 ring-1 ring-rose-200";

          return (
            <button
              key={idx}
              onClick={() => toggleDayOff(dateStr)}
              className={`flex aspect-square items-center justify-center rounded-md text-xs font-medium transition-all hover:ring-1 hover:ring-ring/30 ${cellClass} ${
                isOtherMonth ? "opacity-25" : ""
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded bg-amber-100 ring-1 ring-amber-200" />
          <span>Half Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded bg-rose-100 ring-1 ring-rose-200" />
          <span>Full Off</span>
        </div>
      </div>
    </div>
  );
}
