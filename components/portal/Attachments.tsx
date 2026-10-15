"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, Paperclip, X } from "lucide-react";
import {
  attachmentAccept,
  attachmentHref,
  discardAttachment,
  formatBytes,
  isImageAttachment,
  MAX_ATTACHMENTS,
  uploadAttachment,
  type Attachment,
} from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Upload = { id: string; name: string; size: number; status: "uploading" | "done" | "error"; attachment?: Attachment; error?: string };

/** Uploads files as soon as they are picked, so sending only has to list them. */
export function useAttachmentUploads(organizationId: string | null) {
  const [uploads, setUploads] = useState<Upload[]>([]);

  const add = useCallback(
    (files: FileList | File[]) => {
      if (!organizationId) return;
      const room = MAX_ATTACHMENTS - uploads.filter((u) => u.status !== "error").length;
      const picked = Array.from(files).slice(0, Math.max(0, room));
      if (!picked.length) return;
      const supabase = createClient();
      const fresh = picked.map((file) => ({ id: crypto.randomUUID(), name: file.name, size: file.size, status: "uploading" as const }));
      setUploads((prev) => [...prev, ...fresh]);
      picked.forEach((file, i) => {
        void uploadAttachment(supabase, organizationId, file).then((result) => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id !== fresh[i].id
                ? u
                : result.ok
                  ? { ...u, status: "done", attachment: result.attachment }
                  : { ...u, status: "error", error: result.error },
            ),
          );
        });
      });
    },
    [organizationId, uploads],
  );

  const remove = useCallback(
    (id: string) => {
      const path = uploads.find((u) => u.id === id)?.attachment?.path;
      if (path) discardAttachment(createClient(), path);
      setUploads((prev) => prev.filter((u) => u.id !== id));
    },
    [uploads],
  );
  const clear = useCallback(() => setUploads([]), []);

  const ready = uploads.flatMap((u) => (u.status === "done" && u.attachment ? [u.attachment] : []));
  const busy = uploads.some((u) => u.status === "uploading");
  return { uploads, ready, busy, add, remove, clear, full: uploads.filter((u) => u.status !== "error").length >= MAX_ATTACHMENTS };
}

export type AttachmentUploads = ReturnType<typeof useAttachmentUploads>;

export function AttachButton({ uploads, disabled, className }: { uploads: AttachmentUploads; disabled?: boolean; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept={attachmentAccept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploads.add(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled || uploads.full}
        aria-label="Attach files"
        title={uploads.full ? `Up to ${MAX_ATTACHMENTS} files` : "Attach files (images, PDFs, Office documents, up to 10 MB each)"}
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center border border-line bg-white text-ink-muted transition-colors hover:text-ink disabled:opacity-50",
          className,
        )}
      >
        <Paperclip className="h-4 w-4" />
      </button>
    </>
  );
}

/** Picked files with progress; also submits them with a form as the `attachments` field. */
export function PendingAttachments({ uploads, name = "attachments" }: { uploads: AttachmentUploads; name?: string }) {
  return (
    <>
      <input type="hidden" name={name} value={JSON.stringify(uploads.ready.map(({ path, name: n }) => ({ path, name: n })))} />
      {uploads.uploads.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Files to send">
          {uploads.uploads.map((u) => (
            <li
              key={u.id}
              className={cn(
                "flex max-w-full items-center gap-2 border px-2.5 py-1.5 text-xs",
                u.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-line bg-paper text-ink-muted",
              )}
            >
              {u.status === "uploading" ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : u.status === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="min-w-0 truncate" title={u.error ?? u.name}>
                {u.status === "error" ? u.error : u.name}
              </span>
              {u.status !== "error" && <span className="shrink-0 text-ink-subtle">{formatBytes(u.size)}</span>}
              <button type="button" onClick={() => uploads.remove(u.id)} aria-label={`Remove ${u.name}`} className="shrink-0 hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Files on a message: image thumbnails and download links, opened through the access-checked route. */
export function AttachmentList({ items, className, inverted }: { items: Attachment[]; className?: string; inverted?: boolean }) {
  if (!items.length) return null;
  const images = items.filter(isImageAttachment);
  const files = items.filter((a) => !isImageAttachment(a));
  return (
    <div className={cn("space-y-2", className)}>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <a key={a.path} href={attachmentHref(a.path)} target="_blank" rel="noopener noreferrer" className="block" title={a.name}>
              {/* eslint-disable-next-line @next/next/no-img-element -- private, short-lived signed URLs can't go through next/image */}
              <img
                src={attachmentHref(a.path)}
                alt={a.name}
                loading="lazy"
                className="h-32 w-auto max-w-[220px] border border-line bg-paper-soft object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {files.map((a) => (
        <a
          key={a.path}
          href={attachmentHref(a.path, true)}
          className={cn(
            "flex max-w-xs items-center gap-2.5 border px-3 py-2 text-sm transition-colors",
            inverted ? "border-white/30 text-white hover:bg-white/10" : "border-line bg-white text-ink hover:bg-paper-soft",
          )}
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{a.name}</span>
          <span className={cn("shrink-0 text-xs", inverted ? "text-white/70" : "text-ink-subtle")}>{formatBytes(a.size)}</span>
        </a>
      ))}
    </div>
  );
}
