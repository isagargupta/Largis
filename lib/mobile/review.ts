import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * App Store and Google Play reviewers can't receive our emails, so one demo account signs in with a
 * fixed code instead. All three variables must be set; the account only belongs to a demo organization.
 */
function reviewConfig() {
  const email = process.env.APP_REVIEW_EMAIL?.trim().toLowerCase();
  const code = process.env.APP_REVIEW_CODE?.trim();
  const password = process.env.APP_REVIEW_PASSWORD;
  return email && code && password ? { email, code, password } : null;
}

export function isReviewEmail(email: string) {
  return reviewConfig()?.email === email.trim().toLowerCase();
}

/** The demo account's password when the email and fixed code match, otherwise null. */
export function reviewPasswordFor(email: string, code: string) {
  const config = reviewConfig();
  if (!config || config.email !== email.trim().toLowerCase()) return null;
  const a = Buffer.from(code);
  const b = Buffer.from(config.code);
  return a.length === b.length && timingSafeEqual(a, b) ? config.password : null;
}
