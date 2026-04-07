// Reusable 4-field timing editor (start / fade in / hold / fade out).

"use client";

import type { Timing } from "../model/types";
import { Section, Row, TimeInput } from "./inputs";

interface TimingSectionProps {
  timing: Timing;
  onChange: (patch: Partial<Timing>) => void;
  slideDuration: number;
}

export function TimingSection({ timing, onChange, slideDuration }: TimingSectionProps) {
  return (
    <Section title="Timing">
      <Row label="Start">
        <TimeInput
          value={timing.start}
          min={0}
          max={slideDuration}
          onChange={(v) => onChange({ start: v })}
        />
      </Row>
      <Row label="Fade in">
        <TimeInput value={timing.fadeIn} min={0} onChange={(v) => onChange({ fadeIn: v })} />
      </Row>
      <Row label="Hold">
        <TimeInput value={timing.hold} min={0} onChange={(v) => onChange({ hold: v })} />
      </Row>
      <Row label="Fade out">
        <TimeInput value={timing.fadeOut} min={0} onChange={(v) => onChange({ fadeOut: v })} />
      </Row>
    </Section>
  );
}
