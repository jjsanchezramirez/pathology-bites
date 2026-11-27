// Where narration parts wait in R2 between the per-batch requests and the
// finish request. Keys are built and checked here so the finish route only ever
// reads and deletes objects this flow wrote.

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PART_KEY = new RegExp(`^narration-parts/(${UUID})/(\\d{1,3})\\.wav$`);

export const NARRATION_BUCKET = "pathology-bites-audio";

export function narrationPartKey(session: string, index: number): string {
  return `narration-parts/${session}/${index}.wav`;
}

/** True when `key` is a part of `session`. */
export function isNarrationPartKey(key: string, session: string): boolean {
  const m = PART_KEY.exec(key);
  return !!m && m[1] === session.toLowerCase();
}
