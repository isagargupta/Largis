"use client";

import { useEffect } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { CalendarDays } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

const NAMESPACE = "consultation";

function useCalTheme() {
  useEffect(() => {
    getCalApi({ namespace: NAMESPACE }).then((cal) => {
      cal("ui", {
        theme: "light",
        cssVarsPerTheme: { light: { "cal-brand": "#2f438e" }, dark: { "cal-brand": "#2f438e" } },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    });
  }, []);
}

/** Inline Cal.com scheduler, prefilled with the visitor's details when known. */
export function BookingCalendar({ name, email, notes }: { name?: string; email?: string; notes?: string }) {
  useCalTheme();
  if (!siteConfig.calLink) return null;

  return (
    <Cal
      namespace={NAMESPACE}
      calLink={siteConfig.calLink}
      config={{ layout: "month_view", theme: "light", ...(name && { name }), ...(email && { email }), ...(notes && { notes }) }}
      className="min-h-[560px] w-full overflow-auto border border-line bg-white"
    />
  );
}

/** Opens the Cal.com scheduler in a modal. */
export function BookCallButton({ className, label = "Book a 30-minute call" }: { className?: string; label?: string }) {
  useCalTheme();
  if (!siteConfig.calLink) return null;

  return (
    <button
      type="button"
      data-cal-namespace={NAMESPACE}
      data-cal-link={siteConfig.calLink}
      data-cal-config='{"layout":"month_view","theme":"light"}'
      className={cn(buttonVariants({ variant: "outline" }), className)}
    >
      <CalendarDays className="h-4 w-4" />
      {label}
    </button>
  );
}
