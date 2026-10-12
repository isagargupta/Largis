import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { portalForHost } from "@/lib/portal/hosts";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (portalForHost(headers().get("host"))) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/staff/", "/api/", "/auth/", "/login"] }],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
