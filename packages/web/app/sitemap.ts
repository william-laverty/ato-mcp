import type { MetadataRoute } from "next";

const SITE = "https://ato-mcp.com.au";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/onboard`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
