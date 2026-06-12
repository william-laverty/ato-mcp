import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account", "/api/", "/onboard/verify"],
      },
    ],
    sitemap: "https://ato-mcp.com.au/sitemap.xml",
  };
}
