import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";
import { config } from "@/lib/config";

/**
 * Crash and error reports, sent only from release builds and only when a DSN is configured. Reports
 * carry no user identity: default PII is off and request bodies, cookies, and auth headers are dropped.
 */
export function initSentry() {
  if (!config.sentryDsn || __DEV__) return;
  Sentry.init({
    dsn: config.sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    environment: Updates.channel || "production",
    initialScope: { tags: { "expo-update-id": Updates.updateId ?? "embedded" } },
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) delete event.request.headers.Authorization;
      }
      delete event.user;
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console") return null;
      if (breadcrumb.data?.url && typeof breadcrumb.data.url === "string") {
        breadcrumb.data.url = breadcrumb.data.url.split("?")[0];
      }
      return breadcrumb;
    },
  });
}

export const wrapRoot = Sentry.wrap;
