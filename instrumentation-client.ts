import * as Sentry from "@sentry/nextjs";
import { scrubEvent, sentryOptions } from "@/lib/monitoring";

Sentry.init({
  ...sentryOptions,
  beforeSend: (event) => scrubEvent(event),
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "console") return null;
    if (typeof breadcrumb.data?.url === "string") breadcrumb.data.url = breadcrumb.data.url.split("?")[0];
    return breadcrumb;
  },
});
