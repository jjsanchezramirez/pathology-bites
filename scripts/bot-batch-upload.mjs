#!/usr/bin/env node
/* eslint-disable no-console -- a command-line script; its output is the report */
/**
 * Uploads a batch of LLM-written questions as drafts, signed in as the question bot.
 *
 * The bot is an ordinary account that holds only create_questions and is listed in
 * internal.bot_accounts. Every question goes through POST /api/admin/questions/create, so the
 * site's own checks apply: the question is created as a draft, recorded as source llm_batch
 * (whatever the file says), and a version snapshot is stored. The bot cannot edit anyone
 * else's questions, submit, approve or publish; a person reviews each draft in the admin.
 *
 * Usage (on your own machine, with the bot's credentials in .env.local):
 *   node --env-file=.env.local scripts/bot-batch-upload.mjs <questions.json> [--dry-run] [--site <url>]
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY   (already in .env.local)
 *   QUESTION_BOT_EMAIL, QUESTION_BOT_PASSWORD                (the bot account)
 *   QUESTION_BOT_SITE                                        (optional, default the live site)
 *
 * The file is a JSON array of questions in the create route's shape:
 *   { title, stem, teaching_point, difficulty?, question_set_id?, category_id?, lesson?, topic?,
 *     question_options: [{ text, is_correct, explanation? }], tag_ids?: [uuid],
 *     question_images?: [{ image_id, question_section }], source_detail?: { model, batch, ... } }
 *
 * Questions are sent one at a time. A refused question is reported and the rest continue.
 * A results file (<questions>.results.json) lists the new ids and any errors.
 * Re-running a file creates the questions again, so remove the uploaded ones first.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const siteFlag = args.indexOf("--site");
const site = (
  siteFlag >= 0
    ? args[siteFlag + 1]
    : process.env.QUESTION_BOT_SITE || "https://www.pathologybites.com"
).replace(/\/+$/, "");
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--site");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!file)
  fail(
    "Usage: node --env-file=.env.local scripts/bot-batch-upload.mjs <questions.json> [--dry-run] [--site <url>]"
  );

let questions;
try {
  questions = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  fail(`Could not read ${file}: ${error.message}`);
}
if (!Array.isArray(questions) || questions.length === 0)
  fail(`${file} must be a non-empty JSON array`);

// Catch the obvious mistakes before signing in; the server checks everything again.
const problems = [];
questions.forEach((q, i) => {
  const label = `#${i + 1} ${q?.title ?? "(no title)"}`;
  if (!q || typeof q !== "object") return problems.push(`${label}: not an object`);
  if (!q.title?.trim()) problems.push(`${label}: missing title`);
  if (!q.stem?.trim()) problems.push(`${label}: missing stem`);
  if (!q.teaching_point?.trim()) problems.push(`${label}: missing teaching point`);
  const options = Array.isArray(q.question_options) ? q.question_options : [];
  if (options.length < 2) problems.push(`${label}: needs at least 2 options`);
  if (options.some((o) => !o?.text?.trim())) problems.push(`${label}: an option has no text`);
  if (options.filter((o) => o?.is_correct === true).length !== 1)
    problems.push(`${label}: needs exactly one correct option`);
});
if (problems.length > 0) fail(`Fix these before uploading:\n  ${problems.join("\n  ")}`);

console.log(`${questions.length} question(s) look complete.`);
if (dryRun) {
  console.log("Dry run: nothing was uploaded.");
  process.exit(0);
}

const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env;
const { QUESTION_BOT_EMAIL, QUESTION_BOT_PASSWORD } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY)
  fail("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
if (!QUESTION_BOT_EMAIL || !QUESTION_BOT_PASSWORD)
  fail("QUESTION_BOT_EMAIL and QUESTION_BOT_PASSWORD must be set (the bot account)");

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: true },
});
const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
  email: QUESTION_BOT_EMAIL,
  password: QUESTION_BOT_PASSWORD,
});
if (signInError || !signIn.session)
  fail(`Bot sign-in failed: ${signInError?.message ?? "no session"}`);

const batch = new Date().toISOString();
const results = [];
for (const [i, question] of questions.entries()) {
  // Refresh the token if it is close to expiring (long batches).
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const body = {
    ...question,
    // The database records bot questions as llm_batch regardless; keep the batch details.
    source: "llm_batch",
    source_detail: { batch, file: file.split("/").pop(), ...(question.source_detail ?? {}) },
    allowDuplicate: question.allowDuplicate ?? false,
  };
  const label = `#${i + 1} ${question.title}`;
  try {
    const response = await fetch(`${site}/api/admin/questions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (response.ok) {
      results.push({ index: i, title: question.title, id: json.question?.id });
      console.log(`  ok    ${label} -> ${json.question?.id}`);
    } else {
      const error =
        json.error === "DUPLICATE_TOPIC"
          ? `duplicate topic (existing: ${(json.existingQuestions ?? []).map((q) => q.title).join("; ")})`
          : json.error || `HTTP ${response.status}`;
      results.push({ index: i, title: question.title, error });
      console.log(`  FAIL  ${label}: ${error}`);
    }
  } catch (error) {
    results.push({ index: i, title: question.title, error: error.message });
    console.log(`  FAIL  ${label}: ${error.message}`);
  }
}

await supabase.auth.signOut();
const out = file.replace(/\.json$/i, "") + ".results.json";
await writeFile(out, JSON.stringify({ site, batch, results }, null, 2));
const ok = results.filter((r) => r.id).length;
console.log(`\n${ok} of ${questions.length} uploaded as drafts. Details: ${out}`);
process.exit(ok === questions.length ? 0 : 1);
