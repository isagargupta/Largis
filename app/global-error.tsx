"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-paper font-sans">
        <main className="container flex min-h-[60vh] flex-1 flex-col justify-center py-24">
          <p className="text-sm text-ink-subtle">Error</p>
          <h1 className="display-1 mt-4">Something went wrong</h1>
          <p className="mt-6 max-w-md text-lg text-ink-muted">
            The page couldn’t load. Try again, and if it keeps happening, email us and mention what you were doing.
          </p>
          <div className="mt-10 flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink hover:bg-paper-soft"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
