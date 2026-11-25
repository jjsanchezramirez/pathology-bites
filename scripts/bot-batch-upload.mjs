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
 *   node --env-file=.env.local scripts/bot-batch-upload.mjs <questions.json> [--dry-run] [--resume | --force] [--site <url>]
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
 * A results file (<questions>.results.json) is rewritten after every question, so it lists the
 * new ids and any errors even if the run stops halfway. --resume skips the questions that the
 * results file already shows as uploaded (same position, same title, same site). If a results
 * file exists, the script stops unless you pass --resume, or --force to upload everything again.
 * --site must be an https address on pathologybites.com (or http://localhost for testing),
 * because the bot's sign-in token is sent there.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const resume = args.includes("--resume");
const force = args.includes("--force");
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
    "Usage: node --env-file=.env.local scripts/bot-batch-upload.mjs <questions.json> [--dry-run] [--resume | --force] [--site <url>]"
  );

// The bot's token goes to this host, so only the real site (or a local dev server) is allowed.
let siteUrl;
try {
  siteUrl = new URL(site);
} catch {
  fail(`Not a valid site address: ${site}`);
}
const isLocal =
  siteUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(siteUrl.hostname);
const isLive =
  siteUrl.protocol === "https:" &&
  (siteUrl.hostname === "pathologybites.com" || siteUrl.hostname.endsWith(".pathologybites.com"));
if (!isLocal && !isLive)
  fail(
    `Refusing to send the bot's token to ${site}: use https on pathologybites.com, or localhost`
  );

const out = file.replace(/\.json$/i, "") + ".results.json";
let previous = null;
try {
  previous = JSON.parse(await readFile(out, "utf8"));
} catch {
  previous = null;
}
if (resume && !previous) fail(`--resume needs ${out} from an earlier run`);
if (!resume && !force && previous)
  fail(`${out} exists from an earlier run: pass --resume to skip uploaded questions, or --force`);
if (resume && previous.site !== site) fail(`${out} was uploaded to ${previous.site}, not ${site}`);
const alreadyUploaded = new Map(
  (resume ? (previous.results ?? []) : []).filter((r) => r.id).map((r) => [r.index, r])
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
const saveResults = () => writeFile(out, JSON.stringify({ site, batch, results }, null, 2));
for (const [i, question] of questions.entries()) {
  if (alreadyUploaded.get(i)?.title === question.title) {
    results.push(alreadyUploaded.get(i));
    console.log(`  skip  #${i + 1} ${question.title} (uploaded earlier)`);
    continue;
  }
  // Refresh the token if it is close to expiring (long batches).
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const body = {
    ...question,
    // The database records bot questions as llm_batch regardless; keep the batch details.
    source: "llm_batch",
    source_detail: { ...(question.source_detail ?? {}), batch, file: file.split("/").pop() },
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
  await saveResults();
}

await supabase.auth.signOut();
await saveResults();
const ok = results.filter((r) => r.id).length;
console.log(`\n${ok} of ${questions.length} uploaded as drafts. Details: ${out}`);
process.exit(ok === questions.length ? 0 : 1);
