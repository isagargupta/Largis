/**
 * Shared Sentry settings for the browser, server, and edge runtimes. Reporting stays off until
 * NEXT_PUBLIC_SENTRY_DSN is set, and events never carry request bodies, cookies, auth headers, or
 * user identity.
 */
export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

export const sentryEnvironment = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || "development";

type Scrubbable = {
  request?: { data?: unknown; cookies?: unknown; query_string?: unknown; headers?: Record<string, string> };
  user?: unknown;
};

export function scrubEvent<T extends Scrubbable>(event: T): T {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (/^(authorization|cookie|x-supabase-auth)$/i.test(key)) delete event.request.headers[key];
      }
    }
  }
  delete event.user;
  return event;
}

export const sentryOptions = {
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn) && process.env.NODE_ENV === "production",
  environment: sentryEnvironment,
  sendDefaultPii: false,
  tracesSampleRate: 0,
};
