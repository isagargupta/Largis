"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PortalLoading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="h-3 w-24 bg-line" />
      <div className="h-8 w-64 max-w-full bg-line" />
      <div className="grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-white" />
        ))}
      </div>
      <div className="h-64 border border-line bg-white" />
    </div>
  );
}

export function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-xl border border-line bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid h-11 w-11 place-items-center border border-line text-red-700">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-[15px] font-medium">This page could not be loaded</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        Please try again. If it keeps happening, sign out and back in.
      </p>
      <Button variant="outline" size="sm" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
