// Scheduler — Section 3: Validation.
import { StudyResource, StudyConfig } from "../types";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateConfig(
  _resources: StudyResource[],
  config: StudyConfig
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (config.phases.length === 0)
    errors.push({ field: "phases", message: "Add at least one phase" });

  for (let i = 0; i < config.phases.length; i++) {
    const phase = config.phases[i];
    if (!phase.start_date || !phase.end_date) {
      errors.push({
        field: `phases[${i}]`,
        message: `${phase.name || `Phase ${i + 1}`}: missing dates`,
      });
      continue;
    }
    if (phase.start_date > phase.end_date)
      errors.push({
        field: `phases[${i}]`,
        message: `${phase.name}: start date is after end date`,
      });
    if (phase.daily_minutes_weekday <= 0 && phase.daily_minutes_weekend <= 0)
      errors.push({
        field: `phases[${i}]`,
        message: `${phase.name}: no study hours configured`,
      });
    if (!phase.resources?.length)
      errors.push({ field: `phases[${i}]`, message: `${phase.name}: no resources assigned` });
    for (let j = i + 1; j < config.phases.length; j++) {
      const o = config.phases[j];
      if (
        o.start_date &&
        o.end_date &&
        phase.start_date <= o.end_date &&
        phase.end_date >= o.start_date
      )
        errors.push({
          field: `phases[${i}]`,
          message: `${phase.name} overlaps with ${o.name}`,
        });
    }
  }
  return errors;
}
