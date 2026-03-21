// src/app/robots.ts
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pathologybites.com";

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
          "/docs/",

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
          "/test/",
          "/private/",
          "/temp/",
          "/draft/",
          "/maintenance",
        ],
      },
      // Block AI training scrapers
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "ChatGPT-User", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Claude-Web", disallow: "/" },
      { userAgent: "cohere-ai", disallow: "/" },
      { userAgent: "PerplexityBot", disallow: "/" },
      { userAgent: "YouBot", disallow: "/" },
      { userAgent: "Bytespider", disallow: "/" },
      { userAgent: "Diffbot", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "Meta-ExternalAgent", disallow: "/" },
      { userAgent: "FacebookBot", disallow: "/" },
      { userAgent: "Omgilibot", disallow: "/" },
      { userAgent: "Omgili", disallow: "/" },
      { userAgent: "ImagesiftBot", disallow: "/" },
      { userAgent: "Scrapy", disallow: "/" },
      { userAgent: "AdsBot-Google", disallow: "/" },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
