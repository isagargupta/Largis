import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { KnowledgeArticleForm } from "@/components/portal/KnowledgeForms";
import { PageHeader, Panel } from "@/components/portal/ui";
import { portalHref } from "@/lib/portal/hosts";
import { requireStaff } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New article" };
export const maxDuration = 60;

export default async function NewKnowledgeArticlePage() {
  const { staff } = await requireStaff();
  if (staff.role !== "admin" && staff.role !== "manager") redirect(portalHref("/staff/knowledge"));

  const { data } = await createClient().from("kb_documents").select("category").not("category", "is", null).limit(1000);
  const categories = Array.from(new Set((data ?? []).map((c) => c.category).filter((c): c is string => Boolean(c)))).sort();

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
          <li className="text-ink">New article</li>
        </ol>
      </nav>
      <PageHeader
        title="Write an article"
        description="One topic per article works best: a service, a policy, a process, or a set of common client questions. Use headings to split it into sections."
      />
      <Panel bodyClassName="p-5 sm:p-6">
        <KnowledgeArticleForm categories={categories} />
      </Panel>
    </div>
  );
}
