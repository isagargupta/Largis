export type Portal = "app" | "staff";

export const PORTAL_HOST = process.env.NEXT_PUBLIC_PORTAL_HOST || "app.largis.co";
export const WORKSPACE_HOST = process.env.NEXT_PUBLIC_WORKSPACE_HOST || "workspace.largis.co";

/** Public marketing link to the client portal sign-in. */
export const CLIENT_LOGIN_URL = `${protocolFor(PORTAL_HOST)}://${PORTAL_HOST}/login`;

/** Route-segment prefix each portal lives under inside the Next.js app. */
export const portalPrefix: Record<Portal, string> = { app: "/app", staff: "/staff" };

const localSubdomain: Record<Portal, string> = { app: "app", staff: "workspace" };

function hostname(host: string) {
  return host.toLowerCase().replace(/:\d+$/, "");
}

function port(host: string) {
  return /:(\d+)$/.exec(host)?.[1] ?? null;
}

export function isLocalHost(host: string | null | undefined) {
  if (!host) return false;
  const name = hostname(host);
  return name === "localhost" || name === "127.0.0.1" || name.endsWith(".localhost");
}

function protocolFor(host: string) {
  return isLocalHost(host) ? "http" : "https";
}

/** Which portal a request host serves, or null for the marketing site. */
export function portalForHost(host: string | null | undefined): Portal | null {
  if (!host) return null;
  const name = hostname(host);
  if (name === hostname(PORTAL_HOST) || name === "app.localhost") return "app";
  if (name === hostname(WORKSPACE_HOST) || name === "workspace.localhost") return "staff";
  return null;
}

/** Origin of a portal. Local requests (localhost, *.localhost) stay on *.localhost with the same port. */
export function portalOrigin(portal: Portal, requestHost?: string | null) {
  if (requestHost && isLocalHost(requestHost)) {
    const p = port(requestHost);
    return `http://${localSubdomain[portal]}.localhost${p ? `:${p}` : ""}`;
  }
  const host = portal === "app" ? PORTAL_HOST : WORKSPACE_HOST;
  return `${protocolFor(host)}://${host}`;
}

/** Origin of the marketing site, as seen from a request host. */
export function marketingOrigin(siteUrl: string, requestHost?: string | null) {
  if (requestHost && isLocalHost(requestHost)) {
    const p = port(requestHost);
    return `http://localhost${p ? `:${p}` : ""}`;
  }
  return siteUrl.replace(/\/$/, "");
}

/**
 * Clean, host-relative URL for a portal route: `/app/sales-tracker` -> `/sales-tracker`,
 * `/staff` -> `/`. Paths without a portal prefix are returned unchanged.
 */
export function portalHref(path: string) {
  for (const prefix of Object.values(portalPrefix)) {
    if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) {
      const rest = path.slice(prefix.length);
      return rest.startsWith("/") ? rest : `/${rest}`;
    }
  }
  return path;
}

/** Absolute URL to a page on a portal, e.g. for links and redirects that cross hosts. */
export function portalUrl(portal: Portal, path: string, requestHost?: string | null) {
  return `${portalOrigin(portal, requestHost)}${portalHref(path)}`;
}

/** Only same-host, path-only destinations are accepted after sign-in. */
export function safeNextPath(next: string | null | undefined) {
  if (!next || next.length > 200) return null;
  const clean = portalHref(next);
  if (!/^\/(?!\/)[\w\-/]*(\?[\w=&%\-.]*)?$/.test(clean)) return null;
  if (clean === "/login" || clean.startsWith("/login?") || clean.startsWith("/api/") || clean.startsWith("/auth/")) {
    return null;
  }
  return clean;
}
