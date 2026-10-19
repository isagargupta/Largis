import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Download } from "lucide-react";
import { Markdown } from "@/components/portal/Markdown";
import { KnowledgeArticleForm, KnowledgeDetailsForm, KnowledgeDocumentActions } from "@/components/portal/KnowledgeForms";
import { PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { KNOWLEDGE_BUCKET, knowledgeStatusMeta } from "@/lib/knowledge";
import { displayName, formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { isUuid } from "@/lib/portal/params";
import { getProfiles, requireStaff } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Knowledge base" };
export const maxDuration = 60;

const PREVIEW_CHARS = 20_000;

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function KnowledgeDocumentPage({ params, searchParams }: { params: { id: string }; searchParams: { edit?: string } }) {
  if (!isUuid(params.id)) notFound();
  const { staff } = await requireStaff();
  const canManage = staff.role === "admin" || staff.role === "manager";
  const supabase = createClient();

  const [{ data: doc }, { data: allCategories }] = await Promise.all([
    supabase
      .from("kb_documents")
      .select("id, title, category, kind, body, file_path, file_name, file_size, status, error, chunk_count, created_by, updated_by, created_at, updated_at")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("kb_documents").select("category").not("category", "is", null).limit(1000),
  ]);
  if (!doc) notFound();

  const categories = Array.from(new Set((allCategories ?? []).map((c) => c.category).filter((c): c is string => Boolean(c)))).sort();
  const people = await getProfiles([doc.created_by, doc.updated_by]);
  const download =
    doc.kind === "file" && doc.file_path
      ? (await supabase.storage.from(KNOWLEDGE_BUCKET).createSignedUrl(doc.file_path, 300, { download: doc.file_name ?? undefined })).data?.signedUrl
      : null;
  const status = knowledgeStatusMeta[doc.status];
  const editing = canManage && doc.kind === "article" && searchParams.edit === "1";
  const selfPath = portalHref(`/staff/knowledge/${doc.id}`);

  const details: [string, React.ReactNode][] = [
    ["Type", doc.kind === "file" ? "Uploaded document" : "Article"],
    ["Category", doc.category ?? "Uncategorised"],
    ["Sections", doc.status === "ready" ? doc.chunk_count : "—"],
    ...(doc.kind === "file" ? ([["File", `${doc.file_name ?? "—"} (${formatBytes(doc.file_size)})`]] as [string, React.ReactNode][]) : []),
    ["Added", `${formatDateTime(doc.created_at)}${doc.created_by ? ` by ${displayName(people.get(doc.created_by))}` : ""}`],
    ["Last updated", `${formatDateTime(doc.updated_at)}${doc.updated_by ? ` by ${displayName(people.get(doc.updated_by))}` : ""}`],
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-ink-subtle">
          <li>
            <Link href={portalHref("/staff/knowledge")} className="hover:text-ink">
              Knowledge base
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li className="min-w-0 truncate text-ink">{doc.title}</li>
        </ol>
      </nav>

      <PageHeader
        title={doc.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {doc.category && <span>{doc.category}</span>}
          </span>
        }
        actions={
          <>
            {download && (
              <a href={download} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Download className="h-4 w-4" />
                Download original
              </a>
            )}
            {canManage && doc.kind === "article" && !editing && (
              <Link href={`${selfPath}?edit=1`} className={buttonVariants({ size: "sm" })}>
                Edit article
              </Link>
            )}
          </>
        }
      />

      {doc.status === "error" && doc.error && (
        <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
          {doc.error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {editing && doc.kind === "article" ? (
            <Panel title="Edit article" actions={<Link href={selfPath} className="text-sm text-ink-muted hover:text-ink">Cancel</Link>} bodyClassName="p-5 sm:p-6">
              <KnowledgeArticleForm article={{ id: doc.id, title: doc.title, category: doc.category, body: doc.body }} categories={categories} />
            </Panel>
          ) : (
            <Panel title={doc.kind === "file" ? "Text Largis AI reads from this file" : "Article"} bodyClassName="p-5 sm:p-6">
              {doc.body.trim() ? (
                doc.kind === "file" ? (
                  <>
                    <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink-muted">
                      {doc.body.slice(0, PREVIEW_CHARS)}
                    </pre>
                    {doc.body.length > PREVIEW_CHARS && (
                      <p className="mt-3 text-xs text-ink-subtle">
                        Showing the first {PREVIEW_CHARS.toLocaleString("en-IN")} of {doc.body.length.toLocaleString("en-IN")} characters.
                      </p>
                    )}
                  </>
                ) : (
                  <Markdown source={doc.body} />
                )
              ) : (
                <p className="text-sm text-ink-subtle">
                  {doc.status === "processing" ? "This file is still being read." : "No text has been extracted from this file yet."}
                </p>
              )}
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Details">
            <dl className="divide-y divide-line text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-3 sm:px-5">
                  <dt className="text-ink-subtle">{label}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {canManage && doc.kind === "file" && (
            <Panel title="Title and category" bodyClassName="p-4 sm:p-5">
              <KnowledgeDetailsForm doc={{ id: doc.id, title: doc.title, category: doc.category }} categories={categories} />
            </Panel>
          )}
          {canManage && (
            <Panel title="Manage" bodyClassName="p-4 sm:p-5">
              <p className="mb-4 text-xs text-ink-subtle">
                Process again after changing the OpenAI setup or if something went wrong. Deleting removes it from Largis AI immediately.
              </p>
              <KnowledgeDocumentActions id={doc.id} title={doc.title} />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
