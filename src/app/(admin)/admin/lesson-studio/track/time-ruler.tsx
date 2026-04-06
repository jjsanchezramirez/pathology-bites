// Time ruler with tick marks. Major ticks labeled every `majorEvery` seconds.

"use client";

interface TimeRulerProps {
  duration: number; // seconds
  majorEvery?: number; // label every N seconds
}

export function TimeRuler({ duration, majorEvery = 1 }: TimeRulerProps) {
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += majorEvery) ticks.push(t);
  return (
    <div className="relative h-6 border-b bg-gray-50 text-[10px] text-gray-500">
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 flex h-full flex-col items-center"
          style={{ left: `${(t / duration) * 100}%` }}
        >
          <div className="h-2 w-px bg-gray-300" />
          <div className="-translate-x-1/2 pt-0.5">{t}s</div>
        </div>
      ))}
    </div>
  );
}
