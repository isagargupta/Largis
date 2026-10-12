"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ORG_COOKIE, getClientContext } from "@/lib/portal/session";

export async function switchOrganization(organizationId: string) {
  const ctx = await getClientContext();
  if (!ctx?.orgs.some((o) => o.id === organizationId)) return { ok: false };

  cookies().set(ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/app", "layout");
  return { ok: true };
}
