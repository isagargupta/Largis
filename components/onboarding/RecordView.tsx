import Link from "next/link";
import { CopyButton, ShareLink } from "@/components/portal/forms";
import { PrintButton } from "@/components/portal/PrintButton";
import { ReviewActions } from "@/components/onboarding/ReviewActions";
import { PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatBytes } from "@/lib/attachments";
import { documentNames, readDocuments } from "@/lib/onboarding/files";
import {
  accountTypeOptions,
  bloodOptions,
  documentLabels,
  employmentOptions,
  formatAadhaar,
  genderOptions,
  maritalOptions,
  onboardingSlots,
  optionLabel,
  relationOptions,
  shiftOptions,
  workModeOptions,
} from "@/lib/onboarding/schema";
import { formatDateTime, formatDay } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import type { Database, OnboardingStatus } from "@/lib/supabase/types";

type Row = Database["public"]["Tables"]["employee_onboardings"]["Row"];

const statusMeta: Record<OnboardingStatus, { label: string; tone: "brand" | "success" | "warning" | "danger" }> = {
  open: { label: "Waiting for the employee", tone: "warning" },
  submitted: { label: "Ready to review", tone: "brand" },
  reviewed: { label: "Reviewed", tone: "success" },
  revoked: { label: "Link revoked", tone: "danger" },
};

export function RecordView({ row, joinUrl, reviewer }: { row: Row; joinUrl: string; reviewer: string | null }) {
  const submitted = Boolean(row.full_name);
  const expired = row.status === "open" && new Date(row.expires_at).getTime() <= Date.now();
  const meta = expired ? { label: "Link expired", tone: "warning" as const } : statusMeta[row.status];
  const files = readDocuments(row.documents);
  const name = row.full_name ?? row.invite_name ?? "New hire";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Onboarding"
        title={name}
        description="Identity, bank account, education, and the documents needed to put this person on payroll."
        actions={
          <>
            {row.status !== "revoked" && (
              <ButtonLink href={portalHref(`/staff/onboarding/${row.id}/edit`)} variant="outline" size="sm">
                {submitted ? "Correct details" : "Fill in the form"}
              </ButtonLink>
            )}
            <PrintButton />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <span className="text-sm text-ink-muted">{row.designation ?? "Role not set"}</span>
        {row.joining_date ? <span className="text-sm text-ink-subtle">Joining {formatDay(row.joining_date)}</span> : null}
      </div>

      {row.status === "open" && (
        <Panel title={expired ? "This link has expired" : "Private joining link"}>
          <div className="space-y-3 px-5 py-4 text-sm text-ink-muted">
            <p>
              {expired
                ? "Renew it before sending it again. The employee can't open an expired link."
                : `Send this to ${row.invite_email ?? "the employee"}. It works until ${formatWhen(row.expires_at)}, and it stops showing the form after they submit.`}
            </p>
            {!expired && <ShareLink link={joinUrl} />}
          </div>
        </Panel>
      )}

      {submitted ? (
        <>
          <Section title="Personal">
            <Fact label="Full name" value={row.full_name} copy={row.full_name} />
            {row.invite_name && row.invite_name !== row.full_name ? <Fact label="Name on the invite" value={row.invite_name} /> : null}
            <Fact label="Father's name" value={row.father_name} />
            <Fact label="Mother's name" value={row.mother_name} />
            <Fact label="Date of birth" value={formatDay(row.date_of_birth)} />
            <Fact label="Gender" value={optionLabel(genderOptions, row.gender)} />
            <Fact label="Marital status" value={optionLabel(maritalOptions, row.marital_status)} />
            <Fact label="Blood group" value={optionLabel(bloodOptions, row.blood_group)} />
            <Fact label="Nationality" value={row.nationality} />
            <Fact label="Email" value={row.email} copy={row.email} />
            <Fact label="Mobile" value={row.phone} copy={row.phone} />
            <Fact label="Alternate mobile" value={row.alternate_phone} />
          </Section>
          <Section title="Address">
            <Fact label="Current address" value={address(row.address_line1, row.address_line2, row.city, row.state, row.pin_code)} />
            <Fact
              label="Permanent address"
              value={row.permanent_same ? "Same as current address" : address(row.permanent_line1, row.permanent_line2, row.permanent_city, row.permanent_state, row.permanent_pin)}
            />
            <Fact label="Emergency contact" value={[row.emergency_name, optionLabel(relationOptions, row.emergency_relation), row.emergency_phone].filter(Boolean).join(" · ")} />
          </Section>
          <Section title="Identity and salary account">
            <Fact label="Aadhaar" value={row.aadhaar ? formatAadhaar(row.aadhaar) : null} copy={row.aadhaar} />
            <Fact label="PAN" value={row.pan} copy={row.pan} />
            <Fact label="Account holder" value={row.account_holder} copy={row.account_holder} />
            <Fact label="Account number" value={row.account_number} copy={row.account_number} />
            <Fact label="IFSC" value={row.ifsc} copy={row.ifsc} />
            <Fact label="Bank" value={[row.bank_name, row.branch_name].filter(Boolean).join(", ")} />
            <Fact label="Account type" value={optionLabel(accountTypeOptions, row.account_type)} />
          </Section>
          <Section title="Education">
            <Fact label="Class 10" value={study(row.tenth_school, row.tenth_board, row.tenth_year, row.tenth_score)} />
            <Fact label="Class 12" value={study(row.twelfth_school, row.twelfth_board, row.twelfth_year, row.twelfth_score)} />
            <Fact
              label="College"
              value={row.has_college ? study(row.college_name, row.college_degree, row.college_year, row.college_score) : "No college qualification"}
            />
          </Section>
          <Section title="Role">
            <Fact label="Role" value={row.designation} />
            <Fact label="Department" value={row.department} />
            <Fact label="Employment" value={optionLabel(employmentOptions, row.employment_type)} />
            <Fact label="Work" value={optionLabel(workModeOptions, row.work_mode)} />
            <Fact label="Joining date" value={formatDay(row.joining_date)} />
            <Fact label="Experience" value={row.experience_years != null ? `${row.experience_years} years` : null} />
            <Fact label="Previous employer" value={[row.previous_employer, row.previous_designation].filter(Boolean).join(" · ")} />
            <Fact label="UAN" value={row.uan} copy={row.uan} />
            <Fact label="ESI" value={row.esi_number} copy={row.esi_number} />
            <Fact label="Languages" value={row.languages} />
            <Fact label="Shift" value={optionLabel(shiftOptions, row.shift_preference)} />
          </Section>
          <Panel title="Documents">
            <ul className="divide-y divide-line">
              {onboardingSlots.map((slot) => {
                const file = files[slot];
                if (slot === "college" && !row.has_college) return null;
                return (
                  <li key={slot} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      <span className="block text-ink">{documentLabels[slot]}</span>
                      <span className="text-xs text-ink-subtle">{file ? `${file.name} · ${formatBytes(file.size)}` : "Missing"}</span>
                    </span>
                    {file ? (
                      <a href={`/api/staff/onboarding/${row.id}/file?slot=${slot}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                        Open
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </>
      ) : (
        <Panel title="What we already know">
          <dl className="divide-y divide-line">
            <Fact label="Name" value={row.invite_name} />
            <Fact label="Email" value={row.invite_email} />
            <Fact label="Mobile" value={row.invite_phone} />
            <Fact label="Role" value={row.designation} />
            <Fact label="Department" value={row.department} />
            <Fact label="Employment" value={optionLabel(employmentOptions, row.employment_type)} />
            <Fact label="Work" value={optionLabel(workModeOptions, row.work_mode)} />
            <Fact label="Joining" value={formatDay(row.joining_date)} />
          </dl>
          {Object.keys(documentNames(row.documents)).length > 0 && (
            <p className="border-t border-line px-5 py-3 text-sm text-ink-muted">Some documents are already uploaded. The rest of the form is still open.</p>
          )}
        </Panel>
      )}

      <Panel title="HR">
        <div className="space-y-4 px-5 py-4">
          {row.reviewed_at && (
            <p className="text-sm text-ink-muted">
              Reviewed {formatDateTime(row.reviewed_at)}
              {reviewer ? ` by ${reviewer}` : ""}.
            </p>
          )}
          <ReviewActions id={row.id} status={row.status} notes={row.staff_notes} salary={row.offered_monthly_inr} expired={expired} />
        </div>
      </Panel>

      <p className="text-xs text-ink-subtle">
        <Link href={portalHref("/staff/onboarding")} className="hover:text-ink">
          All onboarding
        </Link>
        <span> · Created {formatDateTime(row.created_at)}</span>
        {row.submitted_at ? <span> · Submitted {formatDateTime(row.submitted_at)}</span> : null}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel title={title}>
      <dl className="divide-y divide-line">{children}</dl>
    </Panel>
  );
}

function Fact({ label, value, copy }: { label: string; value: string | null | undefined; copy?: string | null }) {
  if (!value || value === "—") return null;
  return (
    <div className="grid gap-1 px-5 py-3 sm:grid-cols-[200px_1fr] sm:items-start sm:gap-4">
      <dt className="text-sm text-ink-subtle">{label}</dt>
      <dd className="flex items-start justify-between gap-3 whitespace-pre-line text-sm text-ink">
        <span>{value}</span>
        {copy ? <CopyButton value={copy} label="Copy" /> : null}
      </dd>
    </div>
  );
}

function address(line1: string | null, line2: string | null, city: string | null, state: string | null, pin: string | null) {
  return [line1, line2, [city, state].filter(Boolean).join(", "), pin].filter(Boolean).join("\n");
}

function study(place: string | null, kind: string | null, year: number | null, score: string | null) {
  return [place, kind, year, score].filter((part) => part != null && part !== "").join(" · ");
}

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
