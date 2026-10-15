import * as Sentry from "@sentry/nextjs";
import { scrubEvent, sentryOptions } from "@/lib/monitoring";

Sentry.init({ ...sentryOptions, beforeSend: (event) => scrubEvent(event) });
