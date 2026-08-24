/**
 * Whether /e, /m and /g are served.
 *
 * OFF in production. These pages read curation that is still being audited —
 * parent links, organ tagging and alias lists have all moved in the last day —
 * and a public URL is a promise that what it shows is settled. It is not yet.
 *
 * They stay ON everywhere else, so `npm run dev` and preview deploys keep
 * working on them.
 *
 * To turn them on in production, set NEXT_PUBLIC_KNOWLEDGE_PAGES=1.
 *
 * Verified in a real production build: the NODE_ENV half folds away and the
 * server bundle keeps `"1" === process.env.NEXT_PUBLIC_KNOWLEDGE_PAGES`, read at
 * request time. These are server components, so setting the variable and
 * restarting is enough — no rebuild. (The NEXT_PUBLIC_ prefix would also inline
 * it into a client bundle, which is why the same name is safe to read from
 * either side without the two disagreeing.)
 *
 * Disabled means `notFound()`, not a redirect or a notice: a route that is not
 * ready should be indistinguishable from a route that does not exist. The gate
 * is the first statement in both the page and generateMetadata, so a disabled
 * route leaks no title either.
 */
export const KNOWLEDGE_PAGES_ENABLED =
  process.env.NEXT_PUBLIC_KNOWLEDGE_PAGES === "1" || process.env.NODE_ENV !== "production";
