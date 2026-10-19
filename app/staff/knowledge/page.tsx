import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileText, HelpCircle, PenLine, Search } from "lucide-react";
import { compactControl } from "@/components/portal/control-styles";
import { SelectBox } from "@/components/portal/forms";
import { KnowledgeUploader } from "@/components/portal/KnowledgeForms";
import { EmptyState, PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { isAssistantConfigured } from "@/lib/assistant/openai";
import { knowledgeStatusMeta } from "@/lib/knowledge";
import { formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { cleanQuery } from "@/lib/portal/params";
import { requireStaff } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Knowledge base" };
export const maxDuration = 60;

const STUCK_AFTER_MS = 10 * 60 * 1000;

export default async function KnowledgePage({ searchParams }: { searchParams: { q?: string; category?: string } }) {
  const { staff } = await requireStaff();
  const canManage = staff.role === "admin" || staff.role === "manager";
  const q = cleanQuery(searchParams.q);
  const category = cleanQuery(searchParams.category);
  const supabase = createClient();

  let query = supabase
    .from("kb_documents")
    .select("id, title, category, kind, file_name, status, error, chunk_count, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (q) query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%,file_name.ilike.%${q}%`);
  if (category) query = query.eq("category", category);

  const [{ data, error }, { data: allCategories }, gaps] = await Promise.all([
    query,
    supabase.from("kb_documents").select("category").not("category", "is", null).limit(1000),
    canManage ? supabase.rpc("assistant_gaps", { p_limit: 15 }) : Promise.resolve({ data: null }),
  ]);
  const rows = data ?? [];
  const categories = Array.from(new Set((allCategories ?? []).map((c) => c.category).filter((c): c is string => Boolean(c)))).sort((a, b) =>
    a.localeCompare(b),
  );
  const filtered = Boolean(q || category);
  const listPath = portalHref("/staff/knowledge");
  const configured = isAssistantConfigured();
  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge base"
        title="What Largis AI knows"
        description={
          canManage
            ? "Largis AI answers staff questions only from these articles and documents. Keep them accurate: if it's here, the assistant will repeat it."
            : "Largis AI answers only from these articles and documents. Ask an admin or manager to add or correct anything."
        }
        actions={
          canManage ? (
            <>
              <KnowledgeUploader categories={categories} />
              <ButtonLink href={portalHref("/staff/knowledge/new")}>
                <PenLine className="h-4 w-4" />
                Write article
              </ButtonLink>
            </>
          ) : undefined
        }
      />

      {!configured && (
        <p role="status" className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Largis AI isn&apos;t switched on yet: the OpenAI API key is missing on this deployment. You can still add content now; choose
          &ldquo;Process again&rdquo; on each item once the key is in place.
        </p>
      )}

      <form action={listPath} method="get" role="search" className="flex flex-col gap-3 border border-line bg-white p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="kb-q" className="mb-1.5 block text-xs text-ink-subtle">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input id="kb-q" name="q" type="search" defaultValue={q} placeholder="Title, category, or file name" className={cn(compactControl, "w-full pl-9")} />
          </div>
        </div>
        {categories.length > 0 && (
          <div className="sm:w-52">
            <label htmlFor="kb-category" className="mb-1.5 block text-xs text-ink-subtle">
              Category
            </label>
            <SelectBox compact id="kb-category" name="category" defaultValue={category}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectBox>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm">
            Apply
          </Button>
          {filtered && (
            <Link href={listPath} className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      <Panel title={`${rows.length.toLocaleString("en-US")} ${rows.length === 1 ? "item" : "items"}`}>
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            The knowledge base could not be loaded. Please refresh the page.
          </p>
        ) : rows.length === 0 ? (
          <EmptyState icon={<BookOpen className="h-5 w-5" />} title={filtered ? "Nothing matches" : "The knowledge base is empty"}>
            {filtered
              ? "Try a different search or category."
              : canManage
                ? "Write articles or upload documents about your services, pricing, policies, processes, and common client questions."
                : "An admin or manager needs to add company information before Largis AI can answer."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((d) => {
              const stuck = d.status === "processing" && now - new Date(d.updated_at).getTime() > STUCK_AFTER_MS;
              const meta = knowledgeStatusMeta[stuck ? "error" : d.status];
              return (
                <li key={d.id}>
                  <Link
                    href={portalHref(`/staff/knowledge/${d.id}`)}
                    className="grid gap-2 px-4 py-3.5 hover:bg-paper-soft/70 sm:px-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] md:items-center md:gap-6"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      {d.kind === "file" ? (
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                      ) : (
                        <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{d.title}</span>
                        <span className="block truncate text-xs text-ink-subtle">{d.kind === "file" ? d.file_name : "Article"}</span>
                      </span>
                    </span>
                    <span className="min-w-0 text-xs text-ink-muted">
                      <span className="block truncate">{d.category ?? "Uncategorised"}</span>
                      <span className="block truncate text-ink-subtle">
                        {d.status === "ready" ? `${d.chunk_count} ${d.chunk_count === 1 ? "section" : "sections"}` : stuck ? "Processing stopped" : d.error ?? "Being read…"}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 md:justify-end">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span className="whitespace-nowrap text-xs text-ink-subtle">{formatDateTime(d.updated_at)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {canManage && (
        <Panel title="Questions Largis AI couldn't answer">
          {gaps.data && gaps.data.length > 0 ? (
            <>
              <p className="border-b border-line px-4 py-3 text-xs text-ink-subtle sm:px-5">
                Recent staff questions that weren&apos;t covered or got a thumbs-down. Adding the missing information fixes them for everyone.
              </p>
              <ul className="divide-y divide-line">
                {gaps.data.map((g, i) => (
                  <li key={`${g.asked_at}-${i}`} className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5">
                    <span className="min-w-0 text-sm">{g.question}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <Badge tone={g.reason === "unhelpful" ? "warning" : "neutral"}>{g.reason === "unhelpful" ? "Unhelpful" : "Not covered"}</Badge>
                      <span className="hidden whitespace-nowrap text-xs text-ink-subtle sm:inline">{formatDateTime(g.asked_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState icon={<HelpCircle className="h-5 w-5" />} title="No gaps found">
              When staff ask something the knowledge base doesn&apos;t cover, the question shows up here so you know what to add.
            </EmptyState>
          )}
        </Panel>
      )}
    </div>
  );
}
