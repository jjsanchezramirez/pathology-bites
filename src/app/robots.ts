// src/app/robots.ts
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pathologybites.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/privacy",
          "/terms",
          "/contact",
          "/faq",
          "/maintenance",
          "/tools",
          "/tools/*",
        ],
        disallow: [
          // API and protected areas
          "/api/",
          "/admin/",
          "/dashboard/",
          // Auth pages (explicit disallow)
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
          // Technical paths
          "/_next/",
          "/private/",
          "*.json",
          "/temp/",
          "/draft/",
        ],
      },
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
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
