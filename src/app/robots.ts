// src/app/robots.ts
import { MetadataRoute } from "next";

/**
 * Comprehensive disallow list of AI training / LLM / scraper user agents,
 * superset of Cloudflare's old "Managed robots.txt" feature plus every
 * recent public AI crawler we've seen in our access logs.
 *
 * Sources kept in mind when curating:
 * - Cloudflare AI Bots verified-bots list (radar.cloudflare.com/ai-insights)
 * - darkvisitors.com user-agent registry
 * - Each vendor's published crawler docs (OpenAI, Anthropic, Google, etc.)
 *
 * Sorted alphabetically. Add new bots here rather than inline.
 */
const AI_AND_SCRAPER_BOTS: readonly string[] = [
  // OpenAI
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",

  // Anthropic
  "ClaudeBot",
  "Claude-Web", // legacy
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai", // legacy

  // Google AI (Bard / Gemini / training opt-out)
  "Google-Extended",
  "GoogleOther",
  "GoogleOther-Image",
  "GoogleOther-Video",
  "AdsBot-Google", // ad-quality crawler we don't want on protected paths

  // Meta
  "FacebookBot",
  "Meta-ExternalAgent",
  "meta-externalagent",
  "FacebookExternalHit", // when used for AI ingestion specifically

  // Apple
  "Applebot-Extended",

  // Amazon
  "Amazonbot",

  // Microsoft / Bing AI training (does not affect Bingbot core search)
  "Bingbot-Extended",

  // Bytedance / TikTok
  "Bytespider",

  // Perplexity
  "PerplexityBot",
  "Perplexity-User",

  // Common Crawl (most LLM training datasets seed from this)
  "CCBot",

  // Cohere
  "cohere-ai",
  "cohere-training-data-crawler",

  // You.com
  "YouBot",

  // Diffbot
  "Diffbot",

  // Cloudflare-internal AI renderer (was in their managed block)
  "CloudflareBrowserRenderingCrawler",

  // AI2 (Allen Institute) — Dolma / OLMo training crawler
  "AI2Bot",
  "Ai2Bot-Dolma",

  // Huawei Petal Search / Pangu LLM
  "PetalBot",
  "PanguBot",

  // Webz.io (sells text feed to LLM trainers)
  "Webzio-Extended",
  "Omgili",
  "Omgilibot",

  // ImageSift / Hive (image dataset scraping)
  "ImagesiftBot",

  // iAsk.ai
  "iaskspider/2.0",

  // Timpi
  "Timpibot",

  // DataForSEO (sells crawled corpora)
  "DataForSeoBot",

  // Brightbot (Bright Data / formerly Luminati)
  "Brightbot 1.0",

  // Seekr — AI ranking + training
  "SeekrBot",

  // Pegasus Crawl
  "PegasusBot",

  // DuckDuckGo AI assist
  "DuckAssistBot",

  // Alibaba / Tongyi Qianwen
  "TQ-AI-Search",
  "Qwen-Bot",

  // Turnitin (originality / training)
  "TurnitinBot",

  // Velen.io (scrapes corpus for LLM training)
  "velenpublicwebcrawler",

  // Misc. AI-related crawlers
  "ICCCrawler",
  "ISSCyberRiskCrawler",
  "AwarioBot",
  "AwarioRssBot",
  "AwarioSmartBot",
  "magpie-crawler",
  "Meltwater",
  "Kangaroo Bot",
  "aiHitBot",

  // Generic scraping frameworks — default-deny so any unattributed scrape
  // identifies itself as something else (which then can be added here).
  "Scrapy",
  "Diffbot",
];

export default function robots(): MetadataRoute.Robots {
  const rawBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pathologybites.com";
  // Trim whitespace + trailing slash so `${baseUrl}/sitemap.xml` cannot produce
  // a wrapped or doubled URL (Vercel env vars sometimes carry trailing newlines).
  const baseUrl = rawBaseUrl.trim().replace(/\/+$/, "");

  // De-dupe in case an entry is listed twice across categories.
  const uniqueBots = Array.from(new Set(AI_AND_SCRAPER_BOTS));

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Protected areas (require auth)
          "/api/",
          "/admin/",
          "/dashboard/",

          // Auth flow pages (no SEO value)
          "/auth-error",
          "/check-email",
          "/email-already-verified",
          "/email-verified",
          "/forgot-password",
          "/reset-password",
          "/reset-success",
          "/verify-email",

          // Technical paths
          "/_next/",
          "/debug/",
          "/private/",
          "/temp/",
          "/draft/",
          "/maintenance",
        ],
      },

      // Block every known AI / LLM / scraper user agent from the entire site.
      ...uniqueBots.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
