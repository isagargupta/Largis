import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

export type ApiErrorCode = "unauthenticated" | "mfa_required" | "mfa_enrollment_required" | "forbidden" | "invalid";

export type ApiResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: ApiErrorCode; fieldErrors?: Record<string, string>; status: number };

type GateListener = (code: "unauthenticated" | "mfa_required" | "mfa_enrollment_required") => void;
const gateListeners = new Set<GateListener>();

/** The auth provider listens here so any screen's request can send the user back to sign-in or MFA. */
export function onApiGate(listener: GateListener) {
  gateListeners.add(listener);
  return () => {
    gateListeners.delete(listener);
  };
}

export async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function api<T = Record<string, unknown>>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; auth?: boolean } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.auth !== false) {
    const token = await accessToken();
    if (!token) {
      gateListeners.forEach((l) => l("unauthenticated"));
      return { ok: false, error: "Sign in again to continue.", code: "unauthenticated", status: 401 };
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return { ok: false, error: "You appear to be offline. Check your connection and try again.", status: 0 };
  }

  let json: Record<string, unknown> = {};
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    json = ((await response.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  } else {
    const text = await response.text().catch(() => "");
    json = response.ok ? { ok: true } : { ok: false, error: text.slice(0, 200) };
  }

  if (response.ok && json.ok !== false) return { ...(json as T), ok: true };

  const code = typeof json.code === "string" ? (json.code as ApiErrorCode) : response.status === 401 ? "unauthenticated" : undefined;
  if (code === "unauthenticated" || code === "mfa_required" || code === "mfa_enrollment_required") {
    gateListeners.forEach((l) => l(code));
  }
  return {
    ok: false,
    error: typeof json.error === "string" && json.error ? json.error : "Something went wrong. Please try again.",
    code,
    fieldErrors: (json.fieldErrors as Record<string, string> | undefined) ?? undefined,
    status: response.status,
  };
}
