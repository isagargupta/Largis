import type { MetadataRoute } from "next";
import { legalNav, siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/services",
    "/software",
    "/security",
    "/company",
    "/contact",
    ...legalNav.map((l) => l.href),
  ];
  return routes.map((path) => ({
    url: `${siteConfig.url}${path === "/" ? "" : path}`,
    changeFrequency: path.startsWith("/legal") ? "yearly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
