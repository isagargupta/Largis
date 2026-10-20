import type { Json } from "@/lib/supabase/types";
import { onboardingSlots, type OnboardingSlot } from "@/lib/onboarding/schema";

export type { OnboardingSlot };

export const ONBOARDING_BUCKET = "onboarding";
export const ONBOARDING_MAX_BYTES = 8 * 1024 * 1024;
export const ONBOARDING_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const onboardingAccept = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

const extensions = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif"];

export type OnboardingFile = { path: string; name: string; type: string; size: number };

export function onboardingExtension(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return extensions.includes(ext) ? ext : null;
}

export function onboardingFileError(file: { name: string; size: number }) {
  if (!onboardingExtension(file.name)) return `${file.name} needs to be a PDF or a photo (JPG, PNG, WEBP, or HEIC).`;
  if (file.size > ONBOARDING_MAX_BYTES) return `${file.name} is larger than 8 MB.`;
  if (file.size <= 0) return `${file.name} is empty.`;
  return null;
}

/** Confirms the bytes match a PDF or photo, regardless of the name the browser sent. */
export function sniffOnboardingFile(bytes: Uint8Array): { type: string; ext: string } | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return { type: "application/pdf", ext: "pdf" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { type: "image/png", ext: "png" };
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { type: "image/webp", ext: "webp" };
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (["heic", "heif", "heix", "hevc", "mif1", "msf1"].includes(brand)) return { type: "image/heic", ext: "heic" };
  }
  return null;
}

export function isOnboardingSlot(value: unknown): value is OnboardingSlot {
  return typeof value === "string" && (onboardingSlots as readonly string[]).includes(value);
}

export function readDocuments(value: Json | null | undefined): Partial<Record<OnboardingSlot, OnboardingFile>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Partial<Record<OnboardingSlot, OnboardingFile>> = {};
  for (const slot of onboardingSlots) {
    const item = value[slot];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const path = item.path;
    const name = item.name;
    const type = item.type;
    const size = item.size;
    if (typeof path !== "string" || typeof name !== "string") continue;
    const bytes = typeof size === "number" ? size : typeof size === "string" && /^\d+$/.test(size) ? Number(size) : 0;
    out[slot] = { path, name, type: typeof type === "string" ? type : "", size: bytes };
  }
  return out;
}

export function documentNames(value: Json | null | undefined) {
  const files = readDocuments(value);
  const names: Partial<Record<OnboardingSlot, { name: string; size: number }>> = {};
  for (const slot of onboardingSlots) {
    const file = files[slot];
    if (file) names[slot] = { name: file.name, size: file.size };
  }
  return names;
}
