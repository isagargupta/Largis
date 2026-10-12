import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { portalForHost, portalPrefix, portalUrl, type Portal } from "@/lib/portal/hosts";
import { needsMfaChallenge, verifiedTotpFactors } from "@/lib/portal/mfa";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

const NOINDEX = "noindex, nofollow";
const PATH_HEADER = "x-largis-path";

/** Paths a portal host serves as-is instead of mapping them into the portal's route segment. */
function isPassthrough(pathname: string) {
  return (
    pathname === "/login" ||
    /^\/(api|auth|_next)(\/|$)/.test(pathname) ||
    /^\/(apple-icon|icon)(\/|\.|-|$)/.test(pathname) ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

function prefixedPortal(pathname: string): { portal: Portal; rest: string } | null {
  for (const portal of Object.keys(portalPrefix) as Portal[]) {
    const prefix = portalPrefix[portal];
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return { portal, rest: pathname.slice(prefix.length) || "/" };
    }
  }
  return null;
}

function noindex<T extends NextResponse>(response: T) {
  response.headers.set("X-Robots-Tag", NOINDEX);
  return response;
}

function marketing(request: NextRequest, host: string | null) {
  const { pathname, search } = request.nextUrl;
  const prefixed = prefixedPortal(pathname);
  if (prefixed) {
    return NextResponse.redirect(`${portalUrl(prefixed.portal, prefixed.rest, host)}${search}`, 308);
  }
  if (pathname === "/login") {
    return NextResponse.redirect(`${portalUrl("app", "/login", host)}${search}`, 308);
  }
  return NextResponse.next();
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const portal = portalForHost(host);
  if (!portal) return marketing(request, host);

  const { pathname, search } = request.nextUrl;

  // Portal URLs never show the internal /app or /staff segment.
  const prefixed = prefixedPortal(pathname);
  if (prefixed) {
    const target =
      prefixed.portal === portal
        ? new URL(`${prefixed.rest}${search}`, request.url)
        : `${portalUrl(prefixed.portal, prefixed.rest, host)}${search}`;
    return noindex(NextResponse.redirect(target, 308));
  }

  if (/^\/(api|auth|_next)(\/|$)/.test(pathname)) return noindex(NextResponse.next());

  const rewriteTo = isPassthrough(pathname)
    ? null
    : new URL(`${portalPrefix[portal]}${pathname === "/" ? "" : pathname}${search}`, request.url);
  // Layouts don't receive the pathname; they read it from this header (e.g. to allow MFA setup pages).
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set(PATH_HEADER, pathname);
    return rewriteTo ? NextResponse.rewrite(rewriteTo, { request: { headers } }) : NextResponse.next({ request: { headers } });
  };

  if (!supabaseUrl || !supabaseKey) {
    if (!rewriteTo) return noindex(forward());
    return noindex(NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + search)}`, request.url)));
  }

  let response = forward();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = forward();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (rewriteTo) {
    let signIn = !user;
    if (user && verifiedTotpFactors(user).length) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      signIn = needsMfaChallenge(user, session?.access_token);
    }
    if (signIn) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${pathname}${search}`);
      const redirect = NextResponse.redirect(login);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return noindex(redirect);
    }
  }

  return noindex(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
