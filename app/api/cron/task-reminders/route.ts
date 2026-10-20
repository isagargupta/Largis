import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { taskReminderEmail } from "@/lib/emails/notifications";
import { hasVerifiedSender, isEmailConfigured, sendEmail } from "@/lib/email";
import { formatDateTime } from "@/lib/portal/format";
import { portalUrl } from "@/lib/portal/hosts";
import { leadTitle } from "@/lib/revenue/stages";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 100;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Hourly: one reminder email per overdue follow-up. The claim is cleared if sending fails,
 * so a retry cannot send a second email for a reminder that already went out.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "The database is not configured." }, { status: 503 });

  const { data: tasks, error } = await admin
    .from("lead_tasks")
    .select("id, lead_id, title, owner_id, due_at")
    .eq("status", "open")
    .is("reminded_at", null)
    .not("due_at", "is", null)
    .lt("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ ok: false, error: "Could not list follow-ups." }, { status: 500 });

  const due = tasks ?? [];
  const leadIds = Array.from(new Set(due.map((task) => task.lead_id)));
  const ownerIds = Array.from(new Set(due.map((task) => task.owner_id).filter((id): id is string => Boolean(id))));
  const [{ data: leads }, { data: profiles }] = await Promise.all([
    leadIds.length ? admin.from("leads").select("id, company, contact_name").in("id", leadIds) : Promise.resolve({ data: [] }),
    ownerIds.length ? admin.from("profiles").select("id, email, full_name").in("id", ownerIds) : Promise.resolve({ data: [] }),
  ]);
  const leadById = new Map((leads ?? []).map((lead) => [lead.id, lead]));
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  let sent = 0;
  let skipped = 0;
  const canSend = isEmailConfigured() && hasVerifiedSender();

  for (const task of due) {
    const claimedAt = new Date().toISOString();
    const { data: claimed } = await admin
      .from("lead_tasks")
      .update({ reminded_at: claimedAt })
      .eq("id", task.id)
      .is("reminded_at", null)
      .eq("status", "open")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const profile = task.owner_id ? profileById.get(task.owner_id) : undefined;
    const email = profile?.email;
    if (!canSend || !email) {
      skipped += 1;
      continue;
    }

    const lead = leadById.get(task.lead_id);
    const message = taskReminderEmail({
      lead: lead ? leadTitle(lead) : "a lead",
      task: task.title,
      due: task.due_at ? formatDateTime(task.due_at) : "earlier",
      link: portalUrl("app", `/app/sales-tracker/${task.lead_id}`),
      recipientName: profile?.full_name,
    });

    try {
      await sendEmail({ to: email, ...message });
      sent += 1;
    } catch (err) {
      console.error("[reminders] Could not send", task.id, err instanceof Error ? err.message : err);
      await admin.from("lead_tasks").update({ reminded_at: null }).eq("id", task.id).eq("reminded_at", claimedAt);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, checked: due.length });
}
