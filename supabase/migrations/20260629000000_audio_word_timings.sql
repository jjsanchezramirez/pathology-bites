-- Forced-alignment word timings for audio rows.
-- Populated by POST /api/admin/audio/align (OpenAI Whisper word timestamps).
-- Backward compatible: NULL until an audio file is aligned; the player falls
-- back to uniform caption timing when absent.

alter table public.audio
  add column if not exists word_timings jsonb;

comment on column public.audio.word_timings is
  'Forced-alignment word timestamps: [{ "text": string, "start": number, "end": number }] in seconds. NULL until aligned.';
