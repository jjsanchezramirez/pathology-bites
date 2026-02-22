// src/app/robots.ts
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pathologybites.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          // Public pages
          "/",
          "/about",
          "/contact",
          "/faq",
          "/privacy",
          "/terms",
          // Tools
          "/tools/abpath",
          "/tools/cell-counter",
          "/tools/cell-quiz",
          "/tools/citations",
          "/tools/genova",
          "/tools/images",
          "/tools/lupus-anticoagulant",
          "/tools/milan",
          "/tools/virtual-slides",
        ],
        disallow: [
          // Protected areas
          "/api/",
          "/admin/",
          "/dashboard/",
          // Auth pages (no SEO value, prevent indexing)
          "/auth-error",
          "/check-email",
          "/email-already-verified",
          "/email-verified",
          "/forgot-password",
          "/link-expired",
          "/login",
          "/reset-password",
          "/reset-success",
          "/signup",
          "/verify-email",
          // Technical and development paths
          "/_next/",
          "/test/",
          "/private/",
          "/temp/",
          "/draft/",
          "/maintenance",
          // Prevent indexing of assets
          "*.json",
          "*.xml",
          "*.txt",
        ],
      },
      // Block all AI scrapers and crawlers
      {
        userAgent: "GPTBot",
        disallow: "/",
      },
      {
        userAgent: "ChatGPT-User",
        disallow: "/",
      },
      {
        userAgent: "CCBot",
        disallow: "/",
      },
      {
        userAgent: "anthropic-ai",
        disallow: "/",
      },
      {
        userAgent: "Claude-Web",
        disallow: "/",
      },
      {
        userAgent: "cohere-ai",
        disallow: "/",
      },
      {
        userAgent: "Omgilibot",
        disallow: "/",
      },
      {
        userAgent: "Omgili",
        disallow: "/",
      },
      {
        userAgent: "PerplexityBot",
        disallow: "/",
      },
      {
        userAgent: "YouBot",
        disallow: "/",
      },
      {
        userAgent: "Bytespider",
        disallow: "/",
      },
      {
        userAgent: "Diffbot",
        disallow: "/",
      },
      {
        userAgent: "FacebookBot",
        disallow: "/",
      },
      {
        userAgent: "Google-Extended",
        disallow: "/",
      },
      {
        userAgent: "ImagesiftBot",
        disallow: "/",
      },
      {
        userAgent: "Meta-ExternalAgent",
        disallow: "/",
      },
      {
        userAgent: "Scrapy",
        disallow: "/",
      },
      {
        userAgent: "AdsBot-Google",
        disallow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
