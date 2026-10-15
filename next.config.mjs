import { withSentryConfig } from "@sentry/nextjs/config";

const isDev = process.env.NODE_ENV !== "production";

/** Where browser error reports are sent; empty until NEXT_PUBLIC_SENTRY_DSN is set. */
function sentryOrigins() {
  try {
    return [new URL(process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").origin];
  } catch {
    return [];
  }
}

function supabaseOrigins() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return [url.origin, `wss://${url.host}`];
  } catch {
    return [];
  }
}

const cal = ["https://app.cal.com", "https://cal.com"];

/*
 * Enforced, not report-only: every third party the site loads is listed (Supabase for auth, data, and
 * realtime; Cal.com for the booking embed). Next.js App Router emits inline bootstrap scripts, so
 * script-src needs 'unsafe-inline' unless every page renders dynamically with a nonce; the value of
 * this policy is in restricting where scripts load from and where data can be sent.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${cal.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${cal.join(" ")}`,
  "font-src 'self' data:",
  `connect-src 'self' ${[...supabaseOrigins(), ...sentryOrigins(), ...cal].join(" ")}${isDev ? " ws:" : ""}`,
  `frame-src ${cal.join(" ")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { instrumentationHook: true },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

const sentryUpload = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

/* Without a DSN the site ships no Sentry code in the browser bundle. */
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      telemetry: false,
      widenClientFileUpload: true,
      sourcemaps: { disable: !sentryUpload, deleteSourcemapsAfterUpload: true },
      release: { create: sentryUpload },
      bundleSizeOptimizations: { excludeDebugStatements: true, excludeTracing: true },
    })
  : nextConfig;
