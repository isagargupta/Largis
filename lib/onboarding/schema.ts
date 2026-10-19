import { z } from "zod";

/** Verhoeff checksum used on Aadhaar numbers. */
export function verhoeffValid(num: string) {
  const d = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  ];
  const p = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
  ];
  let c = 0;
  const digits = num.split("").reverse();
  for (let i = 0; i < digits.length; i++) {
    const n = digits[i];
    if (n === undefined || n < "0" || n > "9") return false;
    c = d[c]![p[i % 8]![Number(n)]!]!;
  }
  return c === 0;
}

export const indianStates = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const genderOptions = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
] as const;

export const maritalOptions = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
] as const;

export const bloodOptions = [
  { value: "A+", label: "A+" },
  { value: "A-", label: "A−" },
  { value: "B+", label: "B+" },
  { value: "B-", label: "B−" },
  { value: "O+", label: "O+" },
  { value: "O-", label: "O−" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB−" },
  { value: "unknown", label: "I don't know" },
] as const;

export const relationOptions = [
  { value: "parent", label: "Parent" },
  { value: "spouse", label: "Spouse" },
  { value: "sibling", label: "Sibling" },
  { value: "child", label: "Child" },
  { value: "friend", label: "Friend" },
  { value: "other", label: "Other" },
] as const;

export const employmentOptions = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "intern", label: "Intern" },
  { value: "contract", label: "Contract" },
] as const;

export const workModeOptions = [
  { value: "office", label: "From the office" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

export const accountTypeOptions = [
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
] as const;

export const shiftOptions = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "night", label: "Night" },
  { value: "flexible", label: "Flexible" },
  { value: "unsure", label: "Not sure yet" },
] as const;

export const onboardingSlots = ["photo", "aadhaar", "pan", "bank_proof", "tenth", "twelfth", "college"] as const;
export type OnboardingSlot = (typeof onboardingSlots)[number];

export const documentLabels: Record<OnboardingSlot, string> = {
  photo: "Passport-size photo",
  aadhaar: "Aadhaar card",
  pan: "PAN card",
  bank_proof: "Cancelled cheque or passbook",
  tenth: "Class 10 marksheet",
  twelfth: "Class 12 marksheet",
  college: "College marksheet or degree",
};

const text = () => z.string().transform((v) => String(v ?? "").replace(/\s+/g, " ").trim());

function normalizePhone(value: string) {
  return String(value ?? "")
    .replace(/[\s()-]/g, "")
    .replace(/^\+91/, "")
    .replace(/^0/, "");
}

const phone = () => z.string().transform((v) => normalizePhone(v));
const digits = () => z.string().transform((v) => String(v ?? "").replace(/\D/g, ""));
const upper = () => z.string().transform((v) => String(v ?? "").replace(/[\s-]/g, "").toUpperCase());

export const onboardingSchema = z
  .object({
    full_name: text(),
    father_name: text(),
    mother_name: text(),
    date_of_birth: z.string().transform((v) => String(v ?? "").trim()),
    gender: z.string().transform((v) => String(v ?? "").trim()),
    marital_status: z.string().transform((v) => String(v ?? "").trim()),
    blood_group: z.string().transform((v) => String(v ?? "").trim()),
    nationality: text(),
    email: z.string().transform((v) => String(v ?? "").trim().toLowerCase()),
    phone: phone(),
    alternate_phone: phone(),
    address_line1: text(),
    address_line2: text(),
    city: text(),
    state: z.string().transform((v) => String(v ?? "").trim()),
    pin_code: digits(),
    permanent_same: z.string().transform((v) => String(v ?? "").trim()),
    permanent_line1: text(),
    permanent_line2: text(),
    permanent_city: text(),
    permanent_state: z.string().transform((v) => String(v ?? "").trim()),
    permanent_pin: digits(),
    emergency_name: text(),
    emergency_relation: z.string().transform((v) => String(v ?? "").trim()),
    emergency_phone: phone(),
    aadhaar: digits(),
    pan: upper(),
    account_holder: text(),
    account_number: digits(),
    account_number_confirm: digits(),
    ifsc: upper(),
    bank_name: text(),
    branch_name: text(),
    account_type: z.string().transform((v) => String(v ?? "").trim()),
    tenth_board: text(),
    tenth_school: text(),
    tenth_year: digits(),
    tenth_score: text(),
    twelfth_board: text(),
    twelfth_school: text(),
    twelfth_year: digits(),
    twelfth_score: text(),
    has_college: z.string().transform((v) => String(v ?? "").trim()),
    college_degree: text(),
    college_name: text(),
    college_year: digits(),
    college_score: text(),
    designation: text(),
    department: text(),
    employment_type: z.string().transform((v) => String(v ?? "").trim()),
    joining_date: z.string().transform((v) => String(v ?? "").trim()),
    work_mode: z.string().transform((v) => String(v ?? "").trim()),
    experience_years: z.string().transform((v) => String(v ?? "").trim().replace(/,/g, "")),
    previous_employer: text(),
    previous_designation: text(),
    uan: digits(),
    esi_number: digits(),
    languages: text(),
    shift_preference: z.string().transform((v) => String(v ?? "").trim()),
    declaration: z.boolean(),
  })
  .superRefine((data, ctx) => refineOnboarding(data, ctx));

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingData = z.output<typeof onboardingSchema>;

function issue(ctx: z.RefinementCtx, path: keyof OnboardingData, message: string) {
  ctx.addIssue({ code: "custom", path: [path], message });
}

function oneOf(value: string, options: readonly { value: string }[]) {
  return options.some((option) => option.value === value);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

export function todayInIndia(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function ageInYears(dob: string, today = todayInIndia()) {
  if (!isIsoDate(dob) || !isIsoDate(today)) return null;
  let age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  if (today.slice(5) < dob.slice(5)) age -= 1;
  return age;
}

function validYear(value: string) {
  if (!/^\d{4}$/.test(value)) return false;
  const year = Number(value);
  return year >= 1970 && year <= new Date().getUTCFullYear() + 1;
}

function length(ctx: z.RefinementCtx, path: keyof OnboardingData, value: string, label: string, min: number, max: number) {
  if (!value) issue(ctx, path, `Enter ${label}.`);
  else if (value.length < min) issue(ctx, path, `Enter ${label}.`);
  else if (value.length > max) issue(ctx, path, `Keep this under ${max} characters.`);
}

function optionalLength(ctx: z.RefinementCtx, path: keyof OnboardingData, value: string, max: number) {
  if (value.length > max) issue(ctx, path, `Keep this under ${max} characters.`);
}

export function refineOnboarding(data: OnboardingData, ctx: z.RefinementCtx) {
  length(ctx, "full_name", data.full_name, "the full name, as on Aadhaar", 2, 120);
  length(ctx, "father_name", data.father_name, "the father's name", 2, 120);
  length(ctx, "mother_name", data.mother_name, "the mother's name", 2, 120);

  if (!data.date_of_birth) issue(ctx, "date_of_birth", "Enter the date of birth.");
  else if (!isIsoDate(data.date_of_birth)) issue(ctx, "date_of_birth", "Enter a valid date of birth.");
  else {
    const age = ageInYears(data.date_of_birth);
    if (age == null || age < 0 || age > 80) issue(ctx, "date_of_birth", "Check the date of birth.");
    else if (age < 18) issue(ctx, "date_of_birth", "The employee needs to be at least 18.");
  }

  if (!oneOf(data.gender, genderOptions)) issue(ctx, "gender", "Select a gender.");
  if (!oneOf(data.marital_status, maritalOptions)) issue(ctx, "marital_status", "Select a marital status.");
  if (data.blood_group && !oneOf(data.blood_group, bloodOptions)) issue(ctx, "blood_group", "Select a blood group.");
  length(ctx, "nationality", data.nationality, "a nationality", 2, 60);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254) issue(ctx, "email", "Enter a valid personal email address.");
  if (!/^[6-9]\d{9}$/.test(data.phone)) issue(ctx, "phone", "Enter a 10-digit Indian mobile number.");
  if (data.alternate_phone && !/^[6-9]\d{9}$/.test(data.alternate_phone)) {
    issue(ctx, "alternate_phone", "Enter a 10-digit Indian mobile number.");
  }
  if (data.alternate_phone && data.alternate_phone === data.phone) {
    issue(ctx, "alternate_phone", "Use a different number from the primary mobile.");
  }

  length(ctx, "address_line1", data.address_line1, "the current address", 3, 200);
  optionalLength(ctx, "address_line2", data.address_line2, 200);
  length(ctx, "city", data.city, "the city", 2, 80);
  if (!indianStates.includes(data.state as (typeof indianStates)[number])) issue(ctx, "state", "Select a state or union territory.");
  if (!/^[1-9]\d{5}$/.test(data.pin_code)) issue(ctx, "pin_code", "Enter a 6-digit PIN code.");

  if (data.permanent_same !== "yes" && data.permanent_same !== "no") {
    issue(ctx, "permanent_same", "Say whether the permanent address is the same.");
  } else if (data.permanent_same === "no") {
    length(ctx, "permanent_line1", data.permanent_line1, "the permanent address", 3, 200);
    optionalLength(ctx, "permanent_line2", data.permanent_line2, 200);
    length(ctx, "permanent_city", data.permanent_city, "the city", 2, 80);
    if (!indianStates.includes(data.permanent_state as (typeof indianStates)[number])) {
      issue(ctx, "permanent_state", "Select a state or union territory.");
    }
    if (!/^[1-9]\d{5}$/.test(data.permanent_pin)) issue(ctx, "permanent_pin", "Enter a 6-digit PIN code.");
  }

  length(ctx, "emergency_name", data.emergency_name, "an emergency contact", 2, 120);
  if (!oneOf(data.emergency_relation, relationOptions)) issue(ctx, "emergency_relation", "Select how you know this person.");
  if (!/^[6-9]\d{9}$/.test(data.emergency_phone)) issue(ctx, "emergency_phone", "Enter a 10-digit mobile number.");
  if (data.emergency_phone && data.emergency_phone === data.phone) {
    issue(ctx, "emergency_phone", "The emergency number should be someone other than the employee.");
  }

  if (!data.aadhaar) issue(ctx, "aadhaar", "Enter the 12-digit Aadhaar number.");
  else if (!/^[2-9]\d{11}$/.test(data.aadhaar) || /^(\d)\1{11}$/.test(data.aadhaar) || !verhoeffValid(data.aadhaar)) {
    issue(ctx, "aadhaar", "That Aadhaar number doesn't look right. Check the 12 digits on the card.");
  }

  if (!data.pan) issue(ctx, "pan", "Enter the PAN.");
  else if (!/^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/.test(data.pan)) {
    issue(ctx, "pan", "Enter a personal PAN, like ABCPD1234F. The fourth letter is P.");
  }

  length(ctx, "account_holder", data.account_holder, "the account holder name", 2, 120);
  if (!/^\d{9,18}$/.test(data.account_number)) issue(ctx, "account_number", "Enter the account number, 9 to 18 digits.");
  if (!data.account_number_confirm) issue(ctx, "account_number_confirm", "Enter the account number again.");
  else if (data.account_number_confirm !== data.account_number) issue(ctx, "account_number_confirm", "Those account numbers don't match.");
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.ifsc)) issue(ctx, "ifsc", "Enter the 11-character IFSC, like HDFC0001234.");
  length(ctx, "bank_name", data.bank_name, "the bank name", 2, 120);
  length(ctx, "branch_name", data.branch_name, "the branch name", 2, 120);
  if (!oneOf(data.account_type, accountTypeOptions)) issue(ctx, "account_type", "Select the type of account.");

  length(ctx, "tenth_board", data.tenth_board, "the Class 10 board", 2, 80);
  length(ctx, "tenth_school", data.tenth_school, "the Class 10 school", 2, 160);
  if (!validYear(data.tenth_year)) issue(ctx, "tenth_year", "Enter the Class 10 year of passing.");
  if (!data.tenth_score || !/\d/.test(data.tenth_score)) issue(ctx, "tenth_score", "Enter the percentage or CGPA, such as 86.5% or 8.6 CGPA.");
  else if (data.tenth_score.length > 20) issue(ctx, "tenth_score", "Keep this under 20 characters.");

  length(ctx, "twelfth_board", data.twelfth_board, "the Class 12 board", 2, 80);
  length(ctx, "twelfth_school", data.twelfth_school, "the Class 12 school", 2, 160);
  if (!validYear(data.twelfth_year)) issue(ctx, "twelfth_year", "Enter the Class 12 year of passing.");
  else if (validYear(data.tenth_year) && Number(data.twelfth_year) < Number(data.tenth_year)) {
    issue(ctx, "twelfth_year", "Class 12 can't be earlier than Class 10.");
  }
  if (!data.twelfth_score || !/\d/.test(data.twelfth_score)) issue(ctx, "twelfth_score", "Enter the percentage or CGPA, such as 86.5% or 8.6 CGPA.");
  else if (data.twelfth_score.length > 20) issue(ctx, "twelfth_score", "Keep this under 20 characters.");

  if (data.has_college !== "yes" && data.has_college !== "no") {
    issue(ctx, "has_college", "Say whether you have a college or university qualification.");
  } else if (data.has_college === "yes") {
    length(ctx, "college_degree", data.college_degree, "the degree or course", 2, 120);
    length(ctx, "college_name", data.college_name, "the college or university", 2, 160);
    if (!validYear(data.college_year)) issue(ctx, "college_year", "Enter the year of passing.");
    else if (validYear(data.twelfth_year) && Number(data.college_year) < Number(data.twelfth_year)) {
      issue(ctx, "college_year", "College can't be earlier than Class 12.");
    }
    if (!data.college_score || !/\d/.test(data.college_score)) issue(ctx, "college_score", "Enter the percentage or CGPA.");
    else if (data.college_score.length > 20) issue(ctx, "college_score", "Keep this under 20 characters.");
  }

  length(ctx, "designation", data.designation, "the role", 2, 120);
  optionalLength(ctx, "department", data.department, 80);
  if (!oneOf(data.employment_type, employmentOptions)) issue(ctx, "employment_type", "Select how this person will be employed.");
  if (data.joining_date) {
    if (!isIsoDate(data.joining_date)) issue(ctx, "joining_date", "Enter a valid joining date.");
    else if (data.joining_date < "2000-01-01" || data.joining_date > `${new Date().getUTCFullYear() + 2}-12-31`) {
      issue(ctx, "joining_date", "Enter a joining date within the next two years, or a recent one.");
    }
  }
  if (!oneOf(data.work_mode, workModeOptions)) issue(ctx, "work_mode", "Select where this person will work.");

  if (data.experience_years) {
    if (!/^\d{1,2}(\.\d)?$/.test(data.experience_years) || Number(data.experience_years) > 60) {
      issue(ctx, "experience_years", "Enter years of experience, like 3 or 2.5.");
    }
  }
  optionalLength(ctx, "previous_employer", data.previous_employer, 120);
  optionalLength(ctx, "previous_designation", data.previous_designation, 120);
  if (data.uan && !/^\d{12}$/.test(data.uan)) issue(ctx, "uan", "UAN is 12 digits. Leave it blank if you don't have one.");
  if (data.esi_number && !/^\d{10,17}$/.test(data.esi_number)) {
    issue(ctx, "esi_number", "ESI number is 10 to 17 digits. Leave it blank if you don't have one.");
  }
  optionalLength(ctx, "languages", data.languages, 160);
  if (data.shift_preference && !oneOf(data.shift_preference, shiftOptions)) issue(ctx, "shift_preference", "Select a shift.");

  if (!data.declaration) issue(ctx, "declaration", "Confirm that these details are true before submitting.");
}

export function issuesToFields(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const item of error.issues) {
    const key = String(item.path[0] ?? "form");
    if (!out[key]) out[key] = item.message;
  }
  return out;
}

export function blankOnboardingInput(prefill: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    full_name: "",
    father_name: "",
    mother_name: "",
    date_of_birth: "",
    gender: "",
    marital_status: "",
    blood_group: "",
    nationality: "Indian",
    email: "",
    phone: "",
    alternate_phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pin_code: "",
    permanent_same: "yes",
    permanent_line1: "",
    permanent_line2: "",
    permanent_city: "",
    permanent_state: "",
    permanent_pin: "",
    emergency_name: "",
    emergency_relation: "",
    emergency_phone: "",
    aadhaar: "",
    pan: "",
    account_holder: "",
    account_number: "",
    account_number_confirm: "",
    ifsc: "",
    bank_name: "",
    branch_name: "",
    account_type: "",
    tenth_board: "",
    tenth_school: "",
    tenth_year: "",
    tenth_score: "",
    twelfth_board: "",
    twelfth_school: "",
    twelfth_year: "",
    twelfth_score: "",
    has_college: "",
    college_degree: "",
    college_name: "",
    college_year: "",
    college_score: "",
    designation: "",
    department: "",
    employment_type: "",
    joining_date: "",
    work_mode: "",
    experience_years: "",
    previous_employer: "",
    previous_designation: "",
    uan: "",
    esi_number: "",
    languages: "",
    shift_preference: "",
    declaration: false,
    ...prefill,
  };
}

export const onboardingSteps = [
  {
    id: "personal",
    label: "Personal",
    title: "Personal details",
    lede: "Use the name and date of birth exactly as they appear on Aadhaar.",
    fields: [
      "full_name",
      "father_name",
      "mother_name",
      "date_of_birth",
      "gender",
      "marital_status",
      "blood_group",
      "nationality",
      "email",
      "phone",
      "alternate_phone",
    ],
  },
  {
    id: "address",
    label: "Address",
    title: "Address and emergency contact",
    lede: "Where you live now, and someone we can call if we can't reach you.",
    fields: [
      "address_line1",
      "address_line2",
      "city",
      "state",
      "pin_code",
      "permanent_same",
      "permanent_line1",
      "permanent_line2",
      "permanent_city",
      "permanent_state",
      "permanent_pin",
      "emergency_name",
      "emergency_relation",
      "emergency_phone",
    ],
  },
  {
    id: "identity",
    label: "Bank & identity",
    title: "Identity and salary account",
    lede: "Salary is credited to this bank account. The account holder name should match the bank.",
    fields: ["aadhaar", "pan", "account_holder", "account_number", "account_number_confirm", "ifsc", "bank_name", "branch_name", "account_type"],
  },
  {
    id: "education",
    label: "Education",
    title: "Education",
    lede: "Class 10 and Class 12 marksheets are required. A college document is required only if you have a qualification.",
    fields: [
      "tenth_board",
      "tenth_school",
      "tenth_year",
      "tenth_score",
      "twelfth_board",
      "twelfth_school",
      "twelfth_year",
      "twelfth_score",
      "has_college",
      "college_degree",
      "college_name",
      "college_year",
      "college_score",
    ],
  },
  {
    id: "work",
    label: "Role",
    title: "Role and experience",
    lede: "The role you are joining, and the work you have done before.",
    fields: [
      "designation",
      "department",
      "employment_type",
      "joining_date",
      "work_mode",
      "experience_years",
      "previous_employer",
      "previous_designation",
      "uan",
      "esi_number",
      "languages",
      "shift_preference",
    ],
  },
  {
    id: "review",
    label: "Review",
    title: "Review and confirm",
    lede: "Check the identity numbers and bank account before you submit. You can't change this link afterwards.",
    fields: ["declaration"],
  },
] as const;

export type OnboardingStepId = (typeof onboardingSteps)[number]["id"];

export function requiredSlots(hasCollege: string): OnboardingSlot[] {
  const slots: OnboardingSlot[] = ["photo", "aadhaar", "pan", "bank_proof", "tenth", "twelfth"];
  if (hasCollege === "yes") slots.push("college");
  return slots;
}

export function stepSlots(step: OnboardingStepId, hasCollege: string): OnboardingSlot[] {
  if (step === "identity") return ["photo", "aadhaar", "pan", "bank_proof"];
  if (step === "education") return hasCollege === "yes" ? ["tenth", "twelfth", "college"] : ["tenth", "twelfth"];
  return [];
}

export function optionLabel(options: readonly { value: string; label: string }[], value: string | null | undefined) {
  if (!value) return "—";
  return options.find((option) => option.value === value)?.label ?? value;
}

export function formatAadhaar(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 12)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim();
}

export function formatPan(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);
}

export function formatIfsc(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 11);
}

export function formatAccount(value: string) {
  return value.replace(/\D/g, "").slice(0, 18);
}

export function formatPin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function formatPhone(value: string) {
  return normalizePhone(value).replace(/\D/g, "").slice(0, 10);
}

export function formatUan(value: string) {
  return value.replace(/\D/g, "").slice(0, 12);
}

export function formatEsi(value: string) {
  return value.replace(/\D/g, "").slice(0, 17);
}

export function formatYear(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

const inviteText = (max: number) =>
  z
    .string()
    .transform((v) => String(v ?? "").replace(/\s+/g, " ").trim())
    .refine((v) => v.length <= max, `Keep this under ${max} characters.`);

export const onboardingInviteSchema = z.object({
  invite_name: inviteText(120).refine((v) => v.length >= 2, "Enter the employee's name."),
  invite_email: z
    .string()
    .transform((v) => String(v ?? "").trim().toLowerCase())
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254, "Enter a valid email address."),
  invite_phone: z
    .string()
    .transform((v) => normalizePhone(v))
    .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "Enter a 10-digit mobile number.")
    .transform((v) => v || null),
  designation: inviteText(120).transform((v) => v || null),
  department: inviteText(80).transform((v) => v || null),
  employment_type: z
    .string()
    .transform((v) => String(v ?? "").trim())
    .refine((v) => v === "" || employmentOptions.some((option) => option.value === v), "Select a valid employment type.")
    .transform((v) => v || null),
  work_mode: z
    .string()
    .transform((v) => String(v ?? "").trim())
    .refine((v) => v === "" || workModeOptions.some((option) => option.value === v), "Select a valid work mode.")
    .transform((v) => v || null),
  joining_date: z
    .string()
    .transform((v) => String(v ?? "").trim())
    .refine((v) => v === "" || isIsoDate(v), "Enter a valid joining date.")
    .transform((v) => v || null),
  shift_preference: z
    .string()
    .transform((v) => String(v ?? "").trim())
    .refine((v) => v === "" || shiftOptions.some((option) => option.value === v), "Select a valid shift.")
    .transform((v) => v || null),
});

export const onboardingHrSchema = z.object({
  offered_monthly_inr: z
    .string()
    .transform((v) => String(v ?? "").replace(/[,\s]/g, ""))
    .refine((v) => v === "" || /^\d{1,8}$/.test(v), "Enter the monthly salary in rupees.")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || v >= 1000, "Enter the monthly salary in rupees."),
  staff_notes: z
    .string()
    .transform((v) => String(v ?? "").trim())
    .refine((v) => v.length <= 2000, "Keep notes under 2,000 characters.")
    .transform((v) => v || null),
});

export function emptyToNull(value: string) {
  return value.trim() ? value.trim() : null;
}

export function submissionColumns(data: OnboardingData) {
  const college = data.has_college === "yes";
  const sameAddress = data.permanent_same === "yes";
  return {
    full_name: data.full_name,
    father_name: data.father_name,
    mother_name: data.mother_name,
    date_of_birth: data.date_of_birth,
    gender: data.gender as "female" | "male" | "other",
    marital_status: data.marital_status as "single" | "married" | "divorced" | "widowed",
    blood_group: emptyToNull(data.blood_group),
    nationality: data.nationality,
    email: data.email,
    phone: data.phone,
    alternate_phone: emptyToNull(data.alternate_phone),
    address_line1: data.address_line1,
    address_line2: emptyToNull(data.address_line2),
    city: data.city,
    state: data.state,
    pin_code: data.pin_code,
    permanent_same: sameAddress,
    permanent_line1: sameAddress ? null : data.permanent_line1,
    permanent_line2: sameAddress ? null : emptyToNull(data.permanent_line2),
    permanent_city: sameAddress ? null : data.permanent_city,
    permanent_state: sameAddress ? null : data.permanent_state,
    permanent_pin: sameAddress ? null : data.permanent_pin,
    emergency_name: data.emergency_name,
    emergency_relation: data.emergency_relation,
    emergency_phone: data.emergency_phone,
    aadhaar: data.aadhaar,
    pan: data.pan,
    account_holder: data.account_holder,
    account_number: data.account_number,
    ifsc: data.ifsc,
    bank_name: data.bank_name,
    branch_name: data.branch_name,
    account_type: data.account_type as "savings" | "current",
    tenth_board: data.tenth_board,
    tenth_school: data.tenth_school,
    tenth_year: Number(data.tenth_year),
    tenth_score: data.tenth_score,
    twelfth_board: data.twelfth_board,
    twelfth_school: data.twelfth_school,
    twelfth_year: Number(data.twelfth_year),
    twelfth_score: data.twelfth_score,
    has_college: college,
    college_degree: college ? data.college_degree : null,
    college_name: college ? data.college_name : null,
    college_year: college ? Number(data.college_year) : null,
    college_score: college ? data.college_score : null,
    designation: data.designation,
    department: emptyToNull(data.department),
    employment_type: data.employment_type as "full_time" | "part_time" | "intern" | "contract",
    joining_date: emptyToNull(data.joining_date),
    work_mode: data.work_mode as "office" | "remote" | "hybrid",
    experience_years: data.experience_years ? Number(data.experience_years) : null,
    previous_employer: emptyToNull(data.previous_employer),
    previous_designation: emptyToNull(data.previous_designation),
    uan: emptyToNull(data.uan),
    esi_number: emptyToNull(data.esi_number),
    languages: emptyToNull(data.languages),
    shift_preference: emptyToNull(data.shift_preference) as "morning" | "afternoon" | "night" | "flexible" | "unsure" | null,
    declaration_accepted: true,
  };
}

type StoredForm = {
  invite_name?: string | null;
  invite_email?: string | null;
  invite_phone?: string | null;
  full_name?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  blood_group?: string | null;
  nationality?: string | null;
  email?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  permanent_same?: boolean | null;
  permanent_line1?: string | null;
  permanent_line2?: string | null;
  permanent_city?: string | null;
  permanent_state?: string | null;
  permanent_pin?: string | null;
  emergency_name?: string | null;
  emergency_relation?: string | null;
  emergency_phone?: string | null;
  aadhaar?: string | null;
  pan?: string | null;
  account_holder?: string | null;
  account_number?: string | null;
  ifsc?: string | null;
  bank_name?: string | null;
  branch_name?: string | null;
  account_type?: string | null;
  tenth_board?: string | null;
  tenth_school?: string | null;
  tenth_year?: number | string | null;
  tenth_score?: string | null;
  twelfth_board?: string | null;
  twelfth_school?: string | null;
  twelfth_year?: number | string | null;
  twelfth_score?: string | null;
  has_college?: boolean | null;
  college_degree?: string | null;
  college_name?: string | null;
  college_year?: number | string | null;
  college_score?: string | null;
  designation?: string | null;
  department?: string | null;
  employment_type?: string | null;
  joining_date?: string | null;
  work_mode?: string | null;
  experience_years?: number | string | null;
  previous_employer?: string | null;
  previous_designation?: string | null;
  uan?: string | null;
  esi_number?: string | null;
  languages?: string | null;
  shift_preference?: string | null;
  declaration_accepted?: boolean | null;
};

function asText(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

function day(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

/** Rebuilds the form from a saved record. An unsubmitted invite only prefills what HR already knows. */
export function inputFromOnboarding(row: StoredForm): OnboardingInput {
  const started = Boolean(row.full_name);
  return blankOnboardingInput({
    full_name: row.full_name ?? row.invite_name ?? "",
    father_name: asText(row.father_name),
    mother_name: asText(row.mother_name),
    date_of_birth: day(row.date_of_birth),
    gender: asText(row.gender),
    marital_status: asText(row.marital_status),
    blood_group: asText(row.blood_group),
    nationality: row.nationality ?? "Indian",
    email: row.email ?? row.invite_email ?? "",
    phone: row.phone ?? row.invite_phone ?? "",
    alternate_phone: asText(row.alternate_phone),
    address_line1: asText(row.address_line1),
    address_line2: asText(row.address_line2),
    city: asText(row.city),
    state: asText(row.state),
    pin_code: asText(row.pin_code),
    permanent_same: row.permanent_same == null ? "yes" : row.permanent_same ? "yes" : "no",
    permanent_line1: asText(row.permanent_line1),
    permanent_line2: asText(row.permanent_line2),
    permanent_city: asText(row.permanent_city),
    permanent_state: asText(row.permanent_state),
    permanent_pin: asText(row.permanent_pin),
    emergency_name: asText(row.emergency_name),
    emergency_relation: asText(row.emergency_relation),
    emergency_phone: asText(row.emergency_phone),
    aadhaar: formatAadhaar(asText(row.aadhaar)),
    pan: asText(row.pan),
    account_holder: asText(row.account_holder),
    account_number: asText(row.account_number),
    account_number_confirm: asText(row.account_number),
    ifsc: asText(row.ifsc),
    bank_name: asText(row.bank_name),
    branch_name: asText(row.branch_name),
    account_type: asText(row.account_type),
    tenth_board: asText(row.tenth_board),
    tenth_school: asText(row.tenth_school),
    tenth_year: asText(row.tenth_year),
    tenth_score: asText(row.tenth_score),
    twelfth_board: asText(row.twelfth_board),
    twelfth_school: asText(row.twelfth_school),
    twelfth_year: asText(row.twelfth_year),
    twelfth_score: asText(row.twelfth_score),
    has_college: !started || row.has_college == null ? "" : row.has_college ? "yes" : "no",
    college_degree: asText(row.college_degree),
    college_name: asText(row.college_name),
    college_year: asText(row.college_year),
    college_score: asText(row.college_score),
    designation: asText(row.designation),
    department: asText(row.department),
    employment_type: asText(row.employment_type),
    joining_date: day(row.joining_date),
    work_mode: asText(row.work_mode),
    experience_years: asText(row.experience_years),
    previous_employer: asText(row.previous_employer),
    previous_designation: asText(row.previous_designation),
    uan: asText(row.uan),
    esi_number: asText(row.esi_number),
    languages: asText(row.languages),
    shift_preference: asText(row.shift_preference),
    declaration: Boolean(row.declaration_accepted),
  });
}
