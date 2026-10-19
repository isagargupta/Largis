"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/attachments";
import {
  accountTypeOptions,
  bloodOptions,
  documentLabels,
  employmentOptions,
  formatAadhaar,
  formatAccount,
  formatEsi,
  formatIfsc,
  formatPan,
  formatPhone,
  formatPin,
  formatUan,
  formatYear,
  genderOptions,
  indianStates,
  issuesToFields,
  maritalOptions,
  onboardingSchema,
  onboardingSteps,
  optionLabel,
  relationOptions,
  requiredSlots,
  shiftOptions,
  stepSlots,
  workModeOptions,
  type OnboardingInput,
  type OnboardingSlot,
  type OnboardingStepId,
} from "@/lib/onboarding/schema";
import { onboardingAccept, onboardingFileError } from "@/lib/onboarding/files";
import { SelectBox } from "@/components/portal/forms";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Uploaded = { name: string; size: number };

const slotHint: Record<OnboardingSlot, string> = {
  photo: "A recent photo of the face. JPG or PNG is best.",
  aadhaar: "The front of the card, or the e-Aadhaar PDF.",
  pan: "A clear photo or PDF of the PAN card.",
  bank_proof: "A cancelled cheque, or the passbook page with the account number and IFSC.",
  tenth: "The Class 10 marksheet. PDF or a clear photo.",
  twelfth: "The Class 12 marksheet. PDF or a clear photo.",
  college: "The marksheet or degree certificate. A provisional certificate is fine.",
};

export function OnboardingForm({
  endpoint,
  uploadEndpoint,
  initialValues,
  initialFiles,
  expiresLabel,
  redirectTo,
}: {
  endpoint: string;
  uploadEndpoint: string;
  initialValues: OnboardingInput;
  initialFiles: Partial<Record<OnboardingSlot, Uploaded>>;
  expiresLabel?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [files, setFiles] = useState(initialFiles);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileErrors, setFileErrors] = useState<Partial<Record<OnboardingSlot, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<OnboardingSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const formId = useId();
  const current = onboardingSteps[step]!;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  function setText<K extends Exclude<keyof OnboardingInput, "declaration">>(name: K, value: OnboardingInput[K]) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function fieldErrorsFor(index: number) {
    const parsed = onboardingSchema.safeParse(values);
    if (parsed.success) return {};
    const all = issuesToFields(parsed.error);
    const allowed = new Set<string>(onboardingSteps[index]!.fields);
    return Object.fromEntries(Object.entries(all).filter(([key]) => allowed.has(key)));
  }

  function fileErrorsFor(index: number) {
    const next: Partial<Record<OnboardingSlot, string>> = {};
    for (const slot of stepSlots(onboardingSteps[index]!.id, values.has_college)) {
      if (!files[slot]) next[slot] = "Upload this document.";
    }
    return next;
  }

  function goNext() {
    const nextErrors = fieldErrorsFor(step);
    const nextFiles = fileErrorsFor(step);
    setErrors(nextErrors);
    setFileErrors(nextFiles);
    setFormError(null);
    if (Object.keys(nextErrors).length || Object.keys(nextFiles).length) {
      const key = Object.keys(nextErrors)[0];
      if (key) document.getElementById(`${formId}-${key}`)?.focus();
      return;
    }
    const next = Math.min(step + 1, onboardingSteps.length - 1);
    setStep(next);
    setReached((value) => Math.max(value, next));
  }

  async function upload(slot: OnboardingSlot, list: FileList | null) {
    const file = list?.[0];
    if (!file || uploading) return;
    const rejected = onboardingFileError(file);
    if (rejected) {
      setFileErrors((prev) => ({ ...prev, [slot]: rejected }));
      return;
    }
    setUploading(slot);
    setFileErrors((prev) => ({ ...prev, [slot]: undefined }));
    try {
      const body = new FormData();
      body.set("slot", slot);
      body.set("file", file);
      const res = await fetch(uploadEndpoint, { method: "POST", body });
      const data = (await res.json()) as { ok?: boolean; error?: string; name?: string; size?: number };
      if (!res.ok || !data.ok || !data.name) {
        setFileErrors((prev) => ({ ...prev, [slot]: data.error ?? "That file could not be uploaded." }));
        return;
      }
      setFiles((prev) => ({ ...prev, [slot]: { name: data.name!, size: data.size ?? file.size } }));
    } catch {
      setFileErrors((prev) => ({ ...prev, [slot]: "That file could not be uploaded. Check your connection and try again." }));
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    const parsed = onboardingSchema.safeParse(values);
    const nextErrors = parsed.success ? {} : issuesToFields(parsed.error);
    const missing = requiredSlots(values.has_college).filter((slot) => !files[slot]);
    const nextFiles: Partial<Record<OnboardingSlot, string>> = {};
    for (const slot of missing) nextFiles[slot] = "Upload this document.";
    setErrors(nextErrors);
    setFileErrors(nextFiles);
    if (!parsed.success || missing.length) {
      const fields = new Set(Object.keys(nextErrors));
      const index = onboardingSteps.findIndex((item) => item.fields.some((field) => fields.has(field)) || stepSlots(item.id, values.has_college).some((slot) => nextFiles[slot]));
      if (index >= 0) setStep(index);
      setFormError(missing.length ? "Upload the missing documents, then submit." : "Please review the highlighted fields.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };
      if (res.status === 409) {
        setDone(true);
        return;
      }
      if (!res.ok || !data.ok) {
        const fieldErrors = data.fieldErrors ?? {};
        const textErrors: Record<string, string> = {};
        const uploads: Partial<Record<OnboardingSlot, string>> = {};
        for (const [key, message] of Object.entries(fieldErrors)) {
          if (key.startsWith("file_")) uploads[key.slice(5) as OnboardingSlot] = message;
          else textErrors[key] = message;
        }
        setErrors(textErrors);
        setFileErrors(uploads);
        const index = onboardingSteps.findIndex((item) => item.fields.some((field) => textErrors[field]) || stepSlots(item.id, values.has_college).some((slot) => uploads[slot]));
        if (index >= 0) setStep(index);
        setFormError(data.error ?? "The form could not be submitted.");
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
      setDone(true);
    } catch {
      setFormError("The form could not be submitted. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="border border-line bg-white px-6 py-10 sm:px-10" role="status">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        <h2 className="mt-6 text-3xl tracking-[-0.03em]">We&apos;ve received your details.</h2>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-muted">
          HR has your joining information, identity documents, and the account salary will be credited to. This link won&apos;t show the form again.
          We&apos;ll contact you if anything is missing.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting || uploading) return;
        if (step < onboardingSteps.length - 1) goNext();
        else void submit();
      }}
      className="border border-line bg-white"
    >
      <div className="border-b border-line px-5 py-5 sm:px-8">
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {onboardingSteps.map((item, index) => {
            const active = index === step;
            const complete = index < step;
            const open = index <= reached;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!open}
                  onClick={() => open && setStep(index)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 border px-2.5 py-2 text-left text-xs disabled:cursor-default",
                    active ? "border-brand-600 bg-brand-50 text-ink" : "border-line text-ink-muted hover:border-ink/30 disabled:hover:border-line",
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
                    {complete ? <Check className="inline h-3 w-3 text-emerald-700" /> : String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl tracking-[-0.03em] outline-none">
          {current.title}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{current.lede}</p>
        {expiresLabel && step === 0 && <p className="mt-3 text-xs text-ink-subtle">This private link works until {expiresLabel}.</p>}
        {formError && (
          <p role="alert" className="mt-5 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
            {formError}
          </p>
        )}

        <div className="mt-8">
          {current.id === "personal" && (
            <Grid>
              <TextField formId={formId} name="full_name" label="Full name" required value={values.full_name} error={errors.full_name} autoComplete="name" maxLength={120} placeholder="As printed on Aadhaar" onChange={(value) => setText("full_name", value)} span={2} />
              <TextField formId={formId} name="father_name" label="Father's name" required value={values.father_name} error={errors.father_name} maxLength={120} onChange={(value) => setText("father_name", value)} />
              <TextField formId={formId} name="mother_name" label="Mother's name" required value={values.mother_name} error={errors.mother_name} maxLength={120} onChange={(value) => setText("mother_name", value)} />
              <TextField formId={formId} name="date_of_birth" label="Date of birth" required type="date" value={values.date_of_birth} error={errors.date_of_birth} autoComplete="bday" onChange={(value) => setText("date_of_birth", value)} />
              <SelectField formId={formId} name="gender" label="Gender" required value={values.gender} error={errors.gender} options={genderOptions} onChange={(value) => setText("gender", value)} />
              <SelectField formId={formId} name="marital_status" label="Marital status" required value={values.marital_status} error={errors.marital_status} options={maritalOptions} onChange={(value) => setText("marital_status", value)} />
              <SelectField formId={formId} name="blood_group" label="Blood group" value={values.blood_group} error={errors.blood_group} options={bloodOptions} placeholder="Optional" onChange={(value) => setText("blood_group", value)} />
              <TextField formId={formId} name="nationality" label="Nationality" required value={values.nationality} error={errors.nationality} maxLength={60} onChange={(value) => setText("nationality", value)} />
              <TextField formId={formId} name="email" label="Personal email" required type="email" value={values.email} error={errors.email} autoComplete="email" inputMode="email" maxLength={254} onChange={(value) => setText("email", value)} />
              <TextField formId={formId} name="phone" label="Mobile number" required type="tel" value={values.phone} error={errors.phone} autoComplete="tel" inputMode="numeric" hint="10-digit Indian mobile." onChange={(value) => setText("phone", formatPhone(value))} />
              <TextField formId={formId} name="alternate_phone" label="Alternate mobile" type="tel" value={values.alternate_phone} error={errors.alternate_phone} inputMode="numeric" hint="Optional." onChange={(value) => setText("alternate_phone", formatPhone(value))} />
            </Grid>
          )}

          {current.id === "address" && (
            <div className="space-y-8">
              <Grid>
                <TextField formId={formId} name="address_line1" label="Current address" required value={values.address_line1} error={errors.address_line1} autoComplete="address-line1" maxLength={200} placeholder="House, street, area" onChange={(value) => setText("address_line1", value)} span={2} />
                <TextField formId={formId} name="address_line2" label="Address line 2" value={values.address_line2} error={errors.address_line2} autoComplete="address-line2" maxLength={200} hint="Optional." onChange={(value) => setText("address_line2", value)} span={2} />
                <TextField formId={formId} name="city" label="City" required value={values.city} error={errors.city} autoComplete="address-level2" maxLength={80} onChange={(value) => setText("city", value)} />
                <SelectField formId={formId} name="state" label="State or union territory" required value={values.state} error={errors.state} options={indianStates.map((state) => ({ value: state, label: state }))} onChange={(value) => setText("state", value)} />
                <TextField formId={formId} name="pin_code" label="PIN code" required value={values.pin_code} error={errors.pin_code} autoComplete="postal-code" inputMode="numeric" onChange={(value) => setText("pin_code", formatPin(value))} />
              </Grid>
              <fieldset>
                <legend className="text-sm text-ink">Is your permanent address the same?</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Radio name="permanent_same" value="yes" current={values.permanent_same} label="Yes, same as the current address" onChange={() => setText("permanent_same", "yes")} />
                  <Radio name="permanent_same" value="no" current={values.permanent_same} label="No, I'll enter it separately" onChange={() => setText("permanent_same", "no")} />
                </div>
                <FieldError id={`${formId}-permanent_same-error`} message={errors.permanent_same} />
              </fieldset>
              {values.permanent_same === "no" && (
                <Grid>
                  <TextField formId={formId} name="permanent_line1" label="Permanent address" required value={values.permanent_line1} error={errors.permanent_line1} maxLength={200} onChange={(value) => setText("permanent_line1", value)} span={2} />
                  <TextField formId={formId} name="permanent_line2" label="Address line 2" value={values.permanent_line2} error={errors.permanent_line2} maxLength={200} hint="Optional." onChange={(value) => setText("permanent_line2", value)} span={2} />
                  <TextField formId={formId} name="permanent_city" label="City" required value={values.permanent_city} error={errors.permanent_city} maxLength={80} onChange={(value) => setText("permanent_city", value)} />
                  <SelectField formId={formId} name="permanent_state" label="State or union territory" required value={values.permanent_state} error={errors.permanent_state} options={indianStates.map((state) => ({ value: state, label: state }))} onChange={(value) => setText("permanent_state", value)} />
                  <TextField formId={formId} name="permanent_pin" label="PIN code" required value={values.permanent_pin} error={errors.permanent_pin} inputMode="numeric" onChange={(value) => setText("permanent_pin", formatPin(value))} />
                </Grid>
              )}
              <div>
                <h3 className="text-lg tracking-[-0.02em]">Emergency contact</h3>
                <p className="mt-1 text-sm text-ink-muted">Someone other than you, whom we can call if we can&apos;t reach you.</p>
                <Grid className="mt-4">
                  <TextField formId={formId} name="emergency_name" label="Name" required value={values.emergency_name} error={errors.emergency_name} maxLength={120} onChange={(value) => setText("emergency_name", value)} />
                  <SelectField formId={formId} name="emergency_relation" label="Relationship" required value={values.emergency_relation} error={errors.emergency_relation} options={relationOptions} onChange={(value) => setText("emergency_relation", value)} />
                  <TextField formId={formId} name="emergency_phone" label="Mobile number" required type="tel" value={values.emergency_phone} error={errors.emergency_phone} inputMode="numeric" onChange={(value) => setText("emergency_phone", formatPhone(value))} />
                </Grid>
              </div>
            </div>
          )}

          {current.id === "identity" && (
            <div className="space-y-8">
              <Grid>
                <TextField formId={formId} name="aadhaar" label="Aadhaar number" required value={formatAadhaar(values.aadhaar)} error={errors.aadhaar} inputMode="numeric" autoComplete="off" hint="12 digits on the Aadhaar card." onChange={(value) => setText("aadhaar", formatAadhaar(value))} />
                <TextField formId={formId} name="pan" label="PAN" required value={formatPan(values.pan)} error={errors.pan} autoComplete="off" placeholder="ABCPD1234F" hint="Personal PAN. The fourth letter is P." onChange={(value) => setText("pan", formatPan(value))} />
              </Grid>
              <div>
                <h3 className="text-lg tracking-[-0.02em]">Salary account</h3>
                <p className="mt-1 text-sm text-ink-muted">This is the account the monthly salary will be credited to.</p>
                <Grid className="mt-4">
                  <TextField formId={formId} name="account_holder" label="Account holder name" required value={values.account_holder} error={errors.account_holder} maxLength={120} autoComplete="off" hint="As printed by the bank." onChange={(value) => setText("account_holder", value)} span={2} />
                  <TextField formId={formId} name="account_number" label="Account number" required value={values.account_number} error={errors.account_number} inputMode="numeric" autoComplete="off" onChange={(value) => setText("account_number", formatAccount(value))} />
                  <TextField formId={formId} name="account_number_confirm" label="Confirm account number" required value={values.account_number_confirm} error={errors.account_number_confirm} inputMode="numeric" autoComplete="off" onChange={(value) => setText("account_number_confirm", formatAccount(value))} />
                  <TextField formId={formId} name="ifsc" label="IFSC" required value={formatIfsc(values.ifsc)} error={errors.ifsc} autoComplete="off" placeholder="HDFC0001234" onChange={(value) => setText("ifsc", formatIfsc(value))} />
                  <SelectField formId={formId} name="account_type" label="Account type" required value={values.account_type} error={errors.account_type} options={accountTypeOptions} onChange={(value) => setText("account_type", value)} />
                  <TextField formId={formId} name="bank_name" label="Bank name" required value={values.bank_name} error={errors.bank_name} maxLength={120} placeholder="HDFC Bank" onChange={(value) => setText("bank_name", value)} />
                  <TextField formId={formId} name="branch_name" label="Branch" required value={values.branch_name} error={errors.branch_name} maxLength={120} onChange={(value) => setText("branch_name", value)} />
                </Grid>
              </div>
              <div className="space-y-3">
                <h3 className="text-lg tracking-[-0.02em]">Documents</h3>
                {(["photo", "aadhaar", "pan", "bank_proof"] as const).map((slot) => (
                  <UploadField key={slot} slot={slot} file={files[slot]} error={fileErrors[slot]} busy={uploading === slot} disabled={Boolean(uploading)} onPick={(list) => upload(slot, list)} />
                ))}
              </div>
            </div>
          )}

          {current.id === "education" && (
            <div className="space-y-8">
              <EducationBlock
                formId={formId}
                title="Class 10"
                board="tenth_board"
                school="tenth_school"
                year="tenth_year"
                score="tenth_score"
                values={values}
                errors={errors}
                onChange={setText}
              />
              <UploadField slot="tenth" file={files.tenth} error={fileErrors.tenth} busy={uploading === "tenth"} disabled={Boolean(uploading)} onPick={(list) => upload("tenth", list)} />
              <EducationBlock
                formId={formId}
                title="Class 12"
                board="twelfth_board"
                school="twelfth_school"
                year="twelfth_year"
                score="twelfth_score"
                values={values}
                errors={errors}
                onChange={setText}
              />
              <UploadField slot="twelfth" file={files.twelfth} error={fileErrors.twelfth} busy={uploading === "twelfth"} disabled={Boolean(uploading)} onPick={(list) => upload("twelfth", list)} />
              <fieldset>
                <legend className="text-sm text-ink">Do you have a college or university qualification?</legend>
                <p className="mt-1 text-xs text-ink-subtle">If you don&apos;t, you can&apos;t upload one. If you do, the marksheet or degree is required.</p>
                <div className="mt-3 grid gap-3">
                  <Radio name="has_college" value="yes" current={values.has_college} label="Yes. I have one, and I will upload the marksheet or degree." onChange={() => setText("has_college", "yes")} />
                  <Radio name="has_college" value="no" current={values.has_college} label="No. I don't have a college qualification." onChange={() => setText("has_college", "no")} />
                </div>
                <FieldError id={`${formId}-has_college-error`} message={errors.has_college} />
              </fieldset>
              {values.has_college === "yes" && (
                <>
                  <Grid>
                    <TextField formId={formId} name="college_degree" label="Degree or course" required value={values.college_degree} error={errors.college_degree} maxLength={120} placeholder="B.Com, B.Tech, MBA" onChange={(value) => setText("college_degree", value)} />
                    <TextField formId={formId} name="college_name" label="College or university" required value={values.college_name} error={errors.college_name} maxLength={160} onChange={(value) => setText("college_name", value)} />
                    <TextField formId={formId} name="college_year" label="Year of passing" required value={values.college_year} error={errors.college_year} inputMode="numeric" onChange={(value) => setText("college_year", formatYear(value))} />
                    <TextField formId={formId} name="college_score" label="Percentage or CGPA" required value={values.college_score} error={errors.college_score} maxLength={20} placeholder="8.2 CGPA" onChange={(value) => setText("college_score", value)} />
                  </Grid>
                  <UploadField slot="college" file={files.college} error={fileErrors.college} busy={uploading === "college"} disabled={Boolean(uploading)} onPick={(list) => upload("college", list)} />
                </>
              )}
              {values.has_college === "no" && (
                <p className="border border-line bg-paper-soft px-4 py-3 text-sm text-ink-muted">College upload is turned off. Class 10 and Class 12 are still required.</p>
              )}
            </div>
          )}

          {current.id === "work" && (
            <Grid>
              <TextField formId={formId} name="designation" label="Role" required value={values.designation} error={errors.designation} maxLength={120} placeholder="Support specialist" onChange={(value) => setText("designation", value)} />
              <TextField formId={formId} name="department" label="Department" value={values.department} error={errors.department} maxLength={80} hint="Optional." onChange={(value) => setText("department", value)} />
              <SelectField formId={formId} name="employment_type" label="Employment type" required value={values.employment_type} error={errors.employment_type} options={employmentOptions} onChange={(value) => setText("employment_type", value)} />
              <SelectField formId={formId} name="work_mode" label="Where you will work" required value={values.work_mode} error={errors.work_mode} options={workModeOptions} onChange={(value) => setText("work_mode", value)} />
              <TextField formId={formId} name="joining_date" label="Date of joining" type="date" value={values.joining_date} error={errors.joining_date} hint="Optional if it isn't fixed yet." onChange={(value) => setText("joining_date", value)} />
              <TextField formId={formId} name="experience_years" label="Years of experience" value={values.experience_years} error={errors.experience_years} inputMode="decimal" placeholder="2.5" hint="Optional. Use 0 if this is your first job." onChange={(value) => setText("experience_years", formatExperience(value))} />
              <TextField formId={formId} name="previous_employer" label="Previous employer" value={values.previous_employer} error={errors.previous_employer} maxLength={120} hint="Optional." onChange={(value) => setText("previous_employer", value)} />
              <TextField formId={formId} name="previous_designation" label="Previous role" value={values.previous_designation} error={errors.previous_designation} maxLength={120} hint="Optional." onChange={(value) => setText("previous_designation", value)} />
              <TextField formId={formId} name="uan" label="UAN" value={values.uan} error={errors.uan} inputMode="numeric" hint="12-digit PF number. Leave blank if you don't have one." onChange={(value) => setText("uan", formatUan(value))} />
              <TextField formId={formId} name="esi_number" label="ESI number" value={values.esi_number} error={errors.esi_number} inputMode="numeric" hint="Optional." onChange={(value) => setText("esi_number", formatEsi(value))} />
              <TextField formId={formId} name="languages" label="Languages you can work in" value={values.languages} error={errors.languages} maxLength={160} placeholder="English, Hindi, Kannada" hint="Optional." onChange={(value) => setText("languages", value)} span={2} />
              <SelectField formId={formId} name="shift_preference" label="Preferred shift" value={values.shift_preference} error={errors.shift_preference} options={shiftOptions} placeholder="Optional" onChange={(value) => setText("shift_preference", value)} />
            </Grid>
          )}

          {current.id === "review" && (
            <div className="space-y-6">
              <ReviewBlock title="Personal" step="personal" onEdit={setStep}>
                <Fact label="Full name" value={values.full_name} />
                <Fact label="Father's name" value={values.father_name} />
                <Fact label="Mother's name" value={values.mother_name} />
                <Fact label="Date of birth" value={values.date_of_birth} />
                <Fact label="Gender" value={optionLabel(genderOptions, values.gender)} />
                <Fact label="Marital status" value={optionLabel(maritalOptions, values.marital_status)} />
                <Fact label="Blood group" value={optionLabel(bloodOptions, values.blood_group)} />
                <Fact label="Nationality" value={values.nationality} />
                <Fact label="Email" value={values.email} />
                <Fact label="Mobile" value={values.phone} />
                <Fact label="Alternate mobile" value={values.alternate_phone} />
              </ReviewBlock>
              <ReviewBlock title="Address" step="address" onEdit={setStep}>
                <Fact label="Current address" value={lines(values.address_line1, values.address_line2, values.city, values.state, values.pin_code)} />
                <Fact label="Permanent address" value={values.permanent_same === "yes" ? "Same as current address" : lines(values.permanent_line1, values.permanent_line2, values.permanent_city, values.permanent_state, values.permanent_pin)} />
                <Fact label="Emergency contact" value={[values.emergency_name, optionLabel(relationOptions, values.emergency_relation), values.emergency_phone].filter(Boolean).join(" · ")} />
              </ReviewBlock>
              <ReviewBlock title="Identity and salary account" step="identity" onEdit={setStep}>
                <Fact label="Aadhaar" value={formatAadhaar(values.aadhaar)} />
                <Fact label="PAN" value={formatPan(values.pan)} />
                <Fact label="Account holder" value={values.account_holder} />
                <Fact label="Account number" value={values.account_number} />
                <Fact label="IFSC" value={formatIfsc(values.ifsc)} />
                <Fact label="Bank" value={[values.bank_name, values.branch_name, optionLabel(accountTypeOptions, values.account_type)].filter((part) => part && part !== "—").join(" · ")} />
                <Fact label="Documents" value={["photo", "aadhaar", "pan", "bank_proof"].map((slot) => files[slot as OnboardingSlot]?.name).filter(Boolean).join(", ")} />
              </ReviewBlock>
              <ReviewBlock title="Education" step="education" onEdit={setStep}>
                <Fact label="Class 10" value={study(values.tenth_school, values.tenth_board, values.tenth_year, values.tenth_score)} />
                <Fact label="Class 12" value={study(values.twelfth_school, values.twelfth_board, values.twelfth_year, values.twelfth_score)} />
                <Fact label="College" value={values.has_college === "yes" ? study(values.college_name, values.college_degree, values.college_year, values.college_score) : "No college qualification"} />
                <Fact label="Marksheets" value={["tenth", "twelfth", ...(values.has_college === "yes" ? ["college"] : [])].map((slot) => files[slot as OnboardingSlot]?.name).filter(Boolean).join(", ")} />
              </ReviewBlock>
              <ReviewBlock title="Role" step="work" onEdit={setStep}>
                <Fact label="Role" value={values.designation} />
                <Fact label="Department" value={values.department} />
                <Fact label="Employment" value={optionLabel(employmentOptions, values.employment_type)} />
                <Fact label="Work" value={optionLabel(workModeOptions, values.work_mode)} />
                <Fact label="Joining date" value={values.joining_date} />
                <Fact label="Experience" value={values.experience_years ? `${values.experience_years} years` : ""} />
                <Fact label="Previous employer" value={[values.previous_employer, values.previous_designation].filter(Boolean).join(" · ")} />
                <Fact label="UAN" value={values.uan} />
                <Fact label="ESI" value={values.esi_number} />
                <Fact label="Languages" value={values.languages} />
                <Fact label="Shift" value={optionLabel(shiftOptions, values.shift_preference)} />
              </ReviewBlock>
              <label className={cn("flex cursor-pointer items-start gap-3 border px-4 py-4", errors.declaration ? "border-red-600" : "border-line")}>
                <input
                  id={`${formId}-declaration`}
                  type="checkbox"
                  className="mt-1"
                  checked={values.declaration}
                  onChange={(event) => {
                    setValues((prev) => ({ ...prev, declaration: event.target.checked }));
                    setErrors((prev) => {
                      if (!prev.declaration) return prev;
                      const next = { ...prev };
                      delete next.declaration;
                      return next;
                    });
                  }}
                />
                <span className="text-sm leading-relaxed text-ink">
                  I confirm that these details and documents are true and complete. Largis Venture Private Limited may keep them for my employment, salary payments, and statutory records. I understand that false information can lead to the offer being withdrawn.
                  <FieldError id={`${formId}-declaration-error`} message={errors.declaration} />
                </span>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-8">
        <Button type="button" variant="outline" disabled={step === 0 || submitting || Boolean(uploading)} onClick={() => setStep((value) => Math.max(0, value - 1))}>
          Back
        </Button>
        <Button type="submit" disabled={submitting || Boolean(uploading)}>
          {(submitting || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
          {uploading ? "Uploading…" : submitting ? "Submitting…" : step === onboardingSteps.length - 1 ? "Submit joining form" : "Continue"}
        </Button>
      </div>
    </form>
  );
}

function formatExperience(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned.slice(0, 2);
  return `${cleaned.slice(0, dot).slice(0, 2)}.${cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 1)}`;
}

function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-5 sm:grid-cols-2", className)}>{children}</div>;
}

function TextField({
  formId,
  name,
  label,
  value,
  error,
  onChange,
  required,
  hint,
  span,
  type = "text",
  ...props
}: {
  formId: string;
  name: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  span?: 2;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "name">) {
  const id = `${formId}-${name}`;
  return (
    <div className={span === 2 ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="mb-2 block text-sm text-ink">
        {label}
        {required ? <span className="text-red-700"> *</span> : null}
      </label>
      <Input id={id} name={name} type={type} value={value} required={required} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} {...props} />
      {hint && !error ? <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function SelectField({
  formId,
  name,
  label,
  value,
  error,
  options,
  onChange,
  required,
  placeholder = "Select",
}: {
  formId: string;
  name: string;
  label: string;
  value: string;
  error?: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const id = `${formId}-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-ink">
        {label}
        {required ? <span className="text-red-700"> *</span> : null}
      </label>
      <SelectBox id={id} name={name} value={value} required={required} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectBox>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function Radio({ name, value, current, label, onChange }: { name: string; value: string; current: string; label: string; onChange: () => void }) {
  const selected = current === value;
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 border px-4 py-3 text-sm", selected ? "border-brand-600 bg-brand-50" : "border-line hover:border-ink/30")}>
      <input type="radio" name={name} value={value} checked={selected} onChange={onChange} className="mt-0.5" />
      <span>{label}</span>
    </label>
  );
}

function UploadField({
  slot,
  file,
  error,
  busy,
  disabled,
  onPick,
}: {
  slot: OnboardingSlot;
  file?: Uploaded;
  error?: string;
  busy: boolean;
  disabled: boolean;
  onPick: (list: FileList | null) => void;
}) {
  const id = `upload-${slot}`;
  return (
    <div className={cn("flex flex-col gap-3 border px-4 py-3 sm:flex-row sm:items-center sm:justify-between", error ? "border-red-600" : "border-line")}>
      <div className="min-w-0">
        <p className="text-sm text-ink">
          {documentLabels[slot]}
          <span className="text-red-700"> *</span>
        </p>
        <p className="mt-1 text-xs text-ink-subtle">{slotHint[slot]} PDF, JPG, PNG, WEBP, or HEIC. Up to 8 MB.</p>
        {file ? (
          <p className="mt-2 truncate text-sm text-ink">
            {file.name}
            <span className="text-ink-subtle"> · {formatBytes(file.size)}</span>
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
      <label className={cn("inline-flex h-9 shrink-0 cursor-pointer items-center justify-center border border-ink/25 bg-white px-4 text-[13px] font-semibold", disabled && "pointer-events-none opacity-50")}>
        <input id={id} type="file" accept={onboardingAccept} className="sr-only" disabled={disabled} onChange={(event) => { onPick(event.target.files); event.target.value = ""; }} />
        {busy ? "Uploading…" : file ? "Replace" : "Upload"}
      </label>
    </div>
  );
}

function EducationBlock({
  formId,
  title,
  board,
  school,
  year,
  score,
  values,
  errors,
  onChange,
}: {
  formId: string;
  title: string;
  board: "tenth_board" | "twelfth_board";
  school: "tenth_school" | "twelfth_school";
  year: "tenth_year" | "twelfth_year";
  score: "tenth_score" | "twelfth_score";
  values: OnboardingInput;
  errors: Record<string, string>;
  onChange: (name: typeof board | typeof school | typeof year | typeof score, value: string) => void;
}) {
  return (
    <div>
      <h3 className="text-lg tracking-[-0.02em]">{title}</h3>
      <Grid className="mt-4">
        <TextField formId={formId} name={board} label="Board" required value={values[board]} error={errors[board]} maxLength={80} placeholder="CBSE, ICSE, or state board" onChange={(value) => onChange(board, value)} />
        <TextField formId={formId} name={school} label="School" required value={values[school]} error={errors[school]} maxLength={160} onChange={(value) => onChange(school, value)} />
        <TextField formId={formId} name={year} label="Year of passing" required value={values[year]} error={errors[year]} inputMode="numeric" onChange={(value) => onChange(year, formatYear(value))} />
        <TextField formId={formId} name={score} label="Percentage or CGPA" required value={values[score]} error={errors[score]} maxLength={20} placeholder="86.5% or 8.6 CGPA" onChange={(value) => onChange(score, value)} />
      </Grid>
    </div>
  );
}

function ReviewBlock({ title, step, onEdit, children }: { title: string; step: OnboardingStepId; onEdit: (index: number) => void; children: ReactNode }) {
  const index = onboardingSteps.findIndex((item) => item.id === step);
  return (
    <section className="border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" onClick={() => onEdit(index)} className="text-xs font-medium text-brand-700 hover:text-brand-800">
          Edit
        </button>
      </div>
      <dl className="divide-y divide-line">{children}</dl>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr]">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="whitespace-pre-line text-sm text-ink">{value}</dd>
    </div>
  );
}

function lines(line1: string, line2: string, city: string, state: string, pin: string) {
  return [line1, line2, [city, state].filter(Boolean).join(", "), pin].filter(Boolean).join("\n");
}

function study(place: string, kind: string, year: string, score: string) {
  return [place, kind, year, score].filter(Boolean).join(" · ");
}
