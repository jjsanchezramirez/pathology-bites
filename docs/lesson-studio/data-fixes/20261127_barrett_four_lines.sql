-- Barrett esophagus lesson (7106e5c4-…), slide 2 "Four lines": a layout that fits.
--
-- The picture filled 83% of the width, leaving the labels a 12.7% strip with boxes far too
-- short for the text, so labels overflowed into each other (made worse by the player wrapping
-- right-hand text even narrower; fixed in explainer-viewport.tsx in the same change).
-- Here: the picture shrinks to 68% wide (same proportions, centred vertically), the four rings
-- move with it, and the labels get a 27.5% panel with boxes sized to their text (measured
-- with the templates' estimateLines, +10%). Only element rects change; text, timing and
-- narration are untouched. Guarded on the slide id, element count and heading, so it updates
-- one row or none. Rollback: rollback/20261127_barrett_four_lines.down.sql.
-- Applied to production 2026-11-27.

update public.interactive_sequences
set sequence_data = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(sequence_data, '{slides,1,elements,0,rect}', '{"x":0,"y":9.166,"w":68,"h":81.668,"rotation":0}'::jsonb), '{slides,1,elements,1,rect}', '{"x":70.5,"y":7,"w":27.5,"h":8.91,"rotation":0}'::jsonb), '{slides,1,elements,2,rect}', '{"x":31.362,"y":14.747,"w":6.533,"h":5.717,"rotation":0}'::jsonb), '{slides,1,elements,3,rect}', '{"x":70.5,"y":19.91,"w":27.5,"h":5.57,"rotation":0}'::jsonb), '{slides,1,elements,4,rect}', '{"x":34.154,"y":18.719,"w":6.533,"h":5.717,"rotation":0}'::jsonb), '{slides,1,elements,5,rect}', '{"x":70.5,"y":27.67,"w":27.5,"h":11.13,"rotation":0}'::jsonb), '{slides,1,elements,6,rect}', '{"x":39.041,"y":24.428,"w":6.533,"h":5.717,"rotation":0}'::jsonb), '{slides,1,elements,7,rect}', '{"x":70.5,"y":41.01,"w":27.5,"h":11.13,"rotation":0}'::jsonb), '{slides,1,elements,8,rect}', '{"x":35.83,"y":40.315,"w":6.533,"h":5.717,"rotation":0}'::jsonb), '{slides,1,elements,9,rect}', '{"x":70.5,"y":54.34,"w":27.5,"h":5.57,"rotation":0}'::jsonb), '{slides,1,elements,10,rect}', '{"x":70.5,"y":64.41,"w":27.5,"h":16.7,"rotation":0}'::jsonb), '{slides,1,elements,11,rect}', '{"x":70.5,"y":83.31,"w":27.5,"h":11.13,"rotation":0}'::jsonb), '{slides,1,elements,12,rect}', '{"x":0.6,"y":92.03,"w":66.8,"h":5,"rotation":0}'::jsonb)
where id = '7106e5c4-e3f8-4c67-aa34-f8da84b9e3c4'
  and sequence_data->'slides'->1->>'id' = 'slide-40'
  and jsonb_array_length(sequence_data->'slides'->1->'elements') = 13
  and sequence_data->'slides'->1->'elements'->1->>'text' = 'Four lines';
