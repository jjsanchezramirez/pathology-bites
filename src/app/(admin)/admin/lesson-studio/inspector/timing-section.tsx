// Reusable 4-field timing editor (start / fade in / hold / fade out).

"use client";

import type { Timing } from "../model/types";
import { Section, Row, NumberInput } from "./inputs";

interface TimingSectionProps {
  timing: Timing;
  onChange: (patch: Partial<Timing>) => void;
  slideDuration: number;
}

export function TimingSection({ timing, onChange, slideDuration }: TimingSectionProps) {
  return (
    <Section title="Timing (sec)">
      <Row label="Start">
        <NumberInput
          value={timing.start}
          step={0.1}
          min={0}
          max={slideDuration}
          onChange={(v) => onChange({ start: Math.max(0, v) })}
        />
      </Row>
      <Row label="Fade in">
        <NumberInput
          value={timing.fadeIn}
          step={0.1}
          min={0}
          onChange={(v) => onChange({ fadeIn: Math.max(0, v) })}
        />
      </Row>
      <Row label="Hold">
        <NumberInput
          value={timing.hold}
          step={0.1}
          min={0}
          onChange={(v) => onChange({ hold: Math.max(0, v) })}
        />
      </Row>
      <Row label="Fade out">
        <NumberInput
          value={timing.fadeOut}
          step={0.1}
          min={0}
          onChange={(v) => onChange({ fadeOut: Math.max(0, v) })}
        />
      </Row>
    </Section>
  );
}
