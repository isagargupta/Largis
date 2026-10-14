import Ionicons from "@expo/vector-icons/Ionicons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { Badge, Card, Divider, EmptyState, ErrorView, Loading, Notice, Screen, Stat, StatGrid, styles as ui } from "@/components/ui";
import { api } from "@/lib/api";
import { billingToday, effectiveInvoiceStatus } from "@/lib/billing";
import { config } from "@/lib/config";
import { must, useLoader } from "@/lib/data";
import type { Currency, InvoiceStatus, ServiceLine } from "@/lib/database.types";
import { formatDay, formatMoney, formatMoneyTotals, formatPeriod } from "@/lib/format";
import { billingCycleLabel, contractStatusMeta, invoiceStatusMeta, serviceLineLabel } from "@/lib/meta";
import { useActiveOrg } from "@/lib/org";
import { loadBillingSummary } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

type Kind = "invoices" | "contracts";

function invoiceDateLine(inv: { status: InvoiceStatus; paid_at: string | null; issue_date: string | null; due_date: string | null }) {
  if (inv.status === "paid") return `Paid ${formatDay(inv.paid_at)}`;
  if (inv.status === "void") return `Issued ${formatDay(inv.issue_date)} · Void`;
  return `${inv.status === "overdue" ? "Was due" : "Due"} ${formatDay(inv.due_date)}`;
}

export default function BillingScreen() {
  const { org, perms } = useActiveOrg();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, error, loading, refreshing, refresh } = useLoader(async () => {
    if (!perms.canViewBilling) return null;
    const now = Date.now();
    const today = billingToday(now);
    const [invoices, contracts, summary] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, number, status, currency, total_cents, issue_date, due_date, paid_at, pdf_path")
        .eq("organization_id", org.id)
        .neq("status", "draft")
        .order("issue_date", { ascending: false })
        .limit(500),
      supabase
        .from("contracts")
        .select("id, title, service_line, status, billing_cycle, currency, monthly_value_cents, start_date, end_date, document_path")
        .eq("organization_id", org.id)
        .eq("status", "active")
        .order("start_date"),
      loadBillingSummary(org.id, now),
    ]);
    return {
      invoices: (must(invoices, "Invoices") ?? []).map((inv) => ({
        ...inv,
        currency: inv.currency as Currency,
        status: effectiveInvoiceStatus(inv, today),
      })),
      contracts: (contracts.data ?? []).map((c) => ({ ...c, currency: c.currency as Currency, service_line: c.service_line as ServiceLine })),
      summary,
    };
  }, [org.id, perms]);

  async function download(kind: Kind, id: string) {
    setDownloading(id);
    setDownloadError(null);
    const result = await api<{ url: string; fileName: string }>(`/api/billing/${kind}/${id}?format=json`);
    if (!result.ok) {
      setDownloading(null);
      return setDownloadError(result.error);
    }
    try {
      const file = new File(Paths.cache, result.fileName);
      if (file.exists) file.delete();
      const saved = await File.downloadFileAsync(result.url, file);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(saved.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: result.fileName });
      } else {
        await Linking.openURL(result.url);
      }
    } catch {
      setDownloadError("The PDF could not be downloaded. Check your connection and try again.");
    } finally {
      setDownloading(null);
    }
  }

  if (!perms.canViewBilling) {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Billing is limited to owners, admins, and managers">
          {`Ask an owner or admin of ${org.name} if you need a copy of an invoice.`}
        </EmptyState>
      </Screen>
    );
  }
  if (loading) return <Loading />;
  if (!data) return <ErrorView message={error ?? "Billing could not be loaded."} onRetry={refresh} />;

  const zero = formatMoney(0, "INR");
  const { summary } = data;

  function PdfButton({ kind, id, available, label }: { kind: Kind; id: string; available: boolean; label: string }) {
    if (!available) return <Text style={ui.small}>PDF pending</Text>;
    return downloading === id ? (
      <ActivityIndicator color={colors.brand} />
    ) : (
      <Pressable
        onPress={() => download(kind, id)}
        disabled={downloading !== null}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        <Ionicons name="download-outline" size={16} color={colors.brand} />
        <Text style={ui.link}>PDF</Text>
      </Pressable>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text style={ui.muted}>
        {org.name} · Questions about an invoice? Email{" "}
        <Text style={ui.link} onPress={() => Linking.openURL(`mailto:${config.supportEmail}`)}>
          {config.supportEmail}
        </Text>
      </Text>

      <StatGrid>
        <Stat
          label="Outstanding"
          value={formatMoneyTotals(summary.outstanding, zero)}
          hint={`${summary.outstandingCount} ${summary.outstandingCount === 1 ? "invoice" : "invoices"} awaiting payment`}
        />
        <Stat
          label="Overdue"
          value={formatMoneyTotals(summary.overdue, zero)}
          tone={summary.overdueCount ? "danger" : undefined}
          hint={summary.overdueCount ? `${summary.overdueCount} past the due date` : "Nothing overdue"}
        />
        <Stat label="Paid this month" value={formatMoneyTotals(summary.paidThisMonth, zero)} />
      </StatGrid>

      {downloadError && <Notice tone="danger">{downloadError}</Notice>}

      <Card title="Invoices">
        {data.invoices.length === 0 ? (
          <EmptyState icon="receipt-outline" title="No invoices yet">
            Invoices from Largis appear here once issued, with a PDF you can download.
          </EmptyState>
        ) : (
          data.invoices.map((inv, i) => {
            const meta = invoiceStatusMeta[inv.status];
            return (
              <View key={inv.id}>
                {i > 0 && <Divider />}
                <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={ui.mono}>{inv.number ?? "Invoice"}</Text>
                    <Text
                      style={[
                        ui.rowTitle,
                        inv.status === "void" && { textDecorationLine: "line-through", color: colors.inkSubtle },
                      ]}
                    >
                      {formatMoney(inv.total_cents, inv.currency)}
                    </Text>
                    <Text style={[ui.small, inv.status === "overdue" && { color: colors.danger }]}>{invoiceDateLine(inv)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    <Badge tone={meta.tone} label={meta.label} />
                    <PdfButton kind="invoices" id={inv.id} available={Boolean(inv.pdf_path)} label={`Download ${inv.number ?? "invoice"}`} />
                  </View>
                </View>
              </View>
            );
          })
        )}
      </Card>

      <Card title="Active contracts">
        {data.contracts.length === 0 ? (
          <EmptyState icon="document-outline" title="No active contracts">
            Contracts appear here once Largis activates them.
          </EmptyState>
        ) : (
          data.contracts.map((c, i) => (
            <View key={c.id}>
              {i > 0 && <Divider />}
              <View style={{ padding: 16, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[ui.rowTitle, { flex: 1 }]}>{c.title}</Text>
                  <Badge tone={contractStatusMeta[c.status].tone} label={contractStatusMeta[c.status].label} />
                </View>
                <Text style={ui.small}>
                  {[serviceLineLabel[c.service_line], billingCycleLabel[c.billing_cycle], formatPeriod(c.start_date, c.end_date)]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  {c.monthly_value_cents > 0 ? (
                    <Text style={ui.body}>
                      {formatMoney(c.monthly_value_cents, c.currency)}
                      <Text style={ui.small}> / month</Text>
                    </Text>
                  ) : (
                    <View />
                  )}
                  {c.document_path && <PdfButton kind="contracts" id={c.id} available label={`Download ${c.title}`} />}
                </View>
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
