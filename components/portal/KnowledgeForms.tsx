"use client";

import { useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { Field, FormAlert, Modal, SubmitButton, TextareaField } from "@/components/portal/forms";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import {
  deleteKnowledgeDocument,
  finishKnowledgeUpload,
  reprocessKnowledgeDocument,
  saveKnowledgeArticle,
  startKnowledgeUpload,
  updateKnowledgeDetails,
} from "@/lib/portal/actions/knowledge";
import { portalHref } from "@/lib/portal/hosts";
import { KNOWLEDGE_BUCKET, MAX_ARTICLE_LENGTH, knowledgeAccept, knowledgeFileError } from "@/lib/knowledge";
import { createClient } from "@/lib/supabase/client";

function CategoryField({ errors, defaultValue, categories }: { errors?: Record<string, string>; defaultValue?: string | null; categories: string[] }) {
  return (
    <>
      <Field
        name="category"
        label="Category (optional)"
        errors={errors}
        defaultValue={defaultValue ?? ""}
        maxLength={60}
        list="knowledge-categories"
        placeholder="e.g. Pricing, Policies, Services"
      />
      <datalist id="knowledge-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}

export function KnowledgeArticleForm({
  article,
  categories,
}: {
  article?: { id: string; title: string; category: string | null; body: string };
  categories: string[];
}) {
  const router = useRouter();
  const [state, action] = useFormState(async (prev: ActionState, formData: FormData) => {
    const result = await saveKnowledgeArticle(prev, formData);
    if (!article && result.id) router.push(portalHref(`/staff/knowledge/${result.id}`));
    return result;
  }, idleState);
  const [length, setLength] = useState(article?.body.length ?? 0);

  return (
    <form action={action} className="space-y-5">
      {article && <input type="hidden" name="id" value={article.id} />}
      <FormAlert state={state} />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field name="title" label="Title" errors={state.fieldErrors} defaultValue={article?.title} required maxLength={200} placeholder="e.g. Refund and cancellation policy" />
        <CategoryField errors={state.fieldErrors} defaultValue={article?.category} categories={categories} />
      </div>
      <TextareaField
        name="body"
        label="Content"
        errors={state.fieldErrors}
        defaultValue={article?.body}
        required
        rows={22}
        maxLength={MAX_ARTICLE_LENGTH}
        onChange={(e) => setLength(e.target.value.length)}
        className="font-mono text-[13px] leading-relaxed"
        placeholder={"## What it covers\nWrite the facts staff need: what we offer, prices, timelines, policies, who to contact.\n\n## Common client questions\n- **Can we pause a retainer?** Yes, with 30 days' notice…"}
        hint={
          <>
            Markdown works: <code>## Headings</code> split the article into sections Largis AI can cite, plus lists and **bold**.{" "}
            {length.toLocaleString("en-IN")} / {MAX_ARTICLE_LENGTH.toLocaleString("en-IN")} characters.
          </>
        }
      />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving and teaching Largis AI…">{article ? "Save changes" : "Add article"}</SubmitButton>
      </div>
    </form>
  );
}

export function KnowledgeDetailsForm({ doc, categories }: { doc: { id: string; title: string; category: string | null }; categories: string[] }) {
  const [state, action] = useFormState(updateKnowledgeDetails, idleState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={doc.id} />
      <FormAlert state={state} />
      <Field name="title" label="Title" errors={state.fieldErrors} defaultValue={doc.title} required maxLength={200} />
      <CategoryField errors={state.fieldErrors} defaultValue={doc.category} categories={categories} />
      <SubmitButton size="sm" pendingLabel="Saving…">
        Save details
      </SubmitButton>
    </form>
  );
}

type UploadRow = { key: string; name: string; state: "uploading" | "processing" | "done" | "error"; message?: string };

export function KnowledgeUploader({ categories }: { categories: string[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const busy = rows.some((r) => r.state === "uploading" || r.state === "processing");

  const update = (key: string, patch: Partial<UploadRow>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function uploadOne(file: File, key: string) {
    const invalid = knowledgeFileError(file);
    if (invalid) return update(key, { state: "error", message: invalid });

    const started = await startKnowledgeUpload({ name: file.name, type: file.type, size: file.size, category });
    if (!started.ok) return update(key, { state: "error", message: started.error });

    const { error } = await createClient().storage.from(KNOWLEDGE_BUCKET).upload(started.path, file, { contentType: file.type || undefined });
    if (error) {
      await deleteKnowledgeDocument(started.id);
      return update(key, { state: "error", message: "The upload failed. Check your connection and try again." });
    }

    update(key, { state: "processing" });
    const result = await finishKnowledgeUpload(started.id);
    update(key, result.status === "success" ? { state: "done", message: "Ready" } : { state: "error", message: result.message });
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const batch = Array.from(files).map((file) => ({ file, key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}` }));
    setRows((all) => [...batch.map(({ file, key }) => ({ key, name: file.name, state: "uploading" as const })), ...all]);
    for (const { file, key } of batch) {
      try {
        await uploadOne(file, key);
      } catch {
        update(key, { state: "error", message: "Something went wrong. Try again." });
      }
    }
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Upload documents
      </Button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Upload documents"
        description="PDF, Word (.docx), text, Markdown, or CSV, up to 15 MB each. Largis AI reads the text, so scanned PDFs need OCR first."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="upload-category" className="mb-1.5 block text-sm font-medium">
              Category (optional)
            </label>
            <input
              id="upload-category"
              value={category}
              onChange={(e) => setCategory(e.target.value.slice(0, 60))}
              list="knowledge-upload-categories"
              placeholder="e.g. Policies"
              className="w-full border border-line bg-white px-3 py-2 text-sm"
            />
            <datalist id="knowledge-upload-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <input ref={input} type="file" multiple accept={knowledgeAccept} className="sr-only" onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = "";
          }} />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 border border-dashed border-line px-6 py-10 text-sm text-ink-muted hover:border-brand-600 hover:text-ink disabled:opacity-60"
          >
            <Upload className="h-5 w-5" />
            {busy ? "Working on your files…" : "Choose files"}
          </button>
          {rows.length > 0 && (
            <ul className="divide-y divide-line border border-line text-sm">
              {rows.map((r) => (
                <li key={r.key} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0 truncate">{r.name}</span>
                  <span
                    className={
                      r.state === "error" ? "max-w-[60%] text-right text-xs text-red-700" : r.state === "done" ? "text-xs text-emerald-700" : "flex items-center gap-1.5 text-xs text-ink-subtle"
                    }
                  >
                    {(r.state === "uploading" || r.state === "processing") && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {r.state === "uploading" ? "Uploading…" : r.state === "processing" ? "Reading and indexing…" : r.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function KnowledgeDocumentActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(idleState);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3">
      <FormAlert state={state} onDismiss={() => setState(idleState)} />
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setState(await reprocessKnowledgeDocument(id));
              router.refresh();
            })
          }
        >
          {pending && !confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Process again
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(true)} className="text-red-700 hover:text-red-800">
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
      <Modal open={confirming} onClose={() => !pending && setConfirming(false)} title="Delete from the knowledge base?">
        <p className="text-sm text-ink-muted">
          Largis AI will stop using <strong className="text-ink">{title}</strong> straight away. Past answers that cited it keep their text, but the source link will stop working.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            className="bg-red-700 hover:bg-red-800"
            onClick={() =>
              start(async () => {
                const result = await deleteKnowledgeDocument(id);
                if (result.status === "success") {
                  router.push(portalHref("/staff/knowledge"));
                  router.refresh();
                } else {
                  setState(result);
                  setConfirming(false);
                }
              })
            }
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
