import type { Tone } from "@/lib/meta";

export const colors = {
  ink: "#15171c",
  inkMuted: "#4a4f5c",
  inkSubtle: "#7a7f8c",
  line: "#e5e0d6",
  paper: "#fbfaf6",
  paperSoft: "#f3f0e8",
  white: "#ffffff",
  brand: "#2f438e",
  brandSoft: "#e8ecf8",
  gold: "#b48e4d",
  night: "#0b0b0d",
  danger: "#b42318",
  dangerSoft: "#fdecea",
  success: "#067647",
  successSoft: "#e7f6ee",
  warning: "#a15c07",
  warningSoft: "#fdf3e1",
  info: "#0b6aa2",
  infoSoft: "#e6f2fa",
};

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.inkMuted, bg: colors.paperSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  brand: { fg: colors.brand, bg: colors.brandSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
};

export const stageDot = {
  new: "#a3a3a3",
  qualified: "#0ea5e9",
  proposal: "#4a5fb0",
  negotiation: "#f59e0b",
  won: "#10b981",
  lost: "#f87171",
} as const;
