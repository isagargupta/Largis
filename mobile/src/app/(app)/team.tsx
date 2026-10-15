import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Badge, Button, Card, Chips, Divider, EmptyState, ErrorView, Loading, Notice, Screen, useUi } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getProfiles, must, useLoader } from "@/lib/data";
import type { OrgRole } from "@/lib/database.types";
import { displayName, formatDate } from "@/lib/format";
import { orgRoles, rolePermissions } from "@/lib/meta";
import { useActiveOrg } from "@/lib/org";
import { supabase } from "@/lib/supabase";

const rolePriority: Record<OrgRole, number> = { owner: 0, admin: 1, manager: 2, agent: 3, viewer: 4 };

type Member = { userId: string; name: string; email: string; role: OrgRole; joinedAt: string; isYou: boolean };

export default function TeamScreen() {
  const { org, perms } = useActiveOrg();
  const { user } = useAuth();
  const ui = useUi();
  const canManage = perms.canManageTeam;
  const canGrantOwner = org.role === "owner";
  const [editing, setEditing] = useState<string | null>(null);
  const [role, setRole] = useState<OrgRole>("viewer");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const { data, error, loading, refreshing, refresh, reload } = useLoader(async () => {
    const [memberships, invites] = await Promise.all([
      supabase.from("memberships").select("user_id, role, created_at").eq("organization_id", org.id),
      canManage
        ? supabase
            .from("invitations")
            .select("id, email, full_name, org_role, created_at")
            .eq("kind", "client")
            .eq("organization_id", org.id)
            .is("accepted_at", null)
            .is("revoked_at", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null }),
    ]);
    const rows = must(memberships, "Team") ?? [];
    const profiles = await getProfiles(rows.map((m) => m.user_id));
    const members: Member[] = rows
      .map((m) => {
        const p = profiles.get(m.user_id);
        return {
          userId: m.user_id,
          name: displayName(p),
          email: p?.email ?? "",
          role: m.role,
          joinedAt: m.created_at,
          isYou: m.user_id === user?.id,
        };
      })
      .sort((a, b) => rolePriority[a.role] - rolePriority[b.role] || a.name.localeCompare(b.name));
    return { members, invitations: invites.data ?? [] };
  }, [org.id, canManage, user?.id]);

  if (loading) return <Loading />;
  if (!data) return <ErrorView message={error ?? "The team could not be loaded."} onRetry={refresh} />;

  const ownerCount = data.members.filter((m) => m.role === "owner").length;
  const assignable = canGrantOwner ? orgRoles : orgRoles.filter((r) => r !== "owner");

  function canEditMember(m: Member) {
    if (!canManage || m.isYou) return false;
    return m.role !== "owner" || canGrantOwner;
  }

  function startEditing(m: Member) {
    setNotice(null);
    setRole(m.role);
    setEditing(editing === m.userId ? null : m.userId);
  }

  async function saveRole(m: Member) {
    setBusy(`role-${m.userId}`);
    const result = await api(`/api/mobile/team/members/${m.userId}`, { method: "PATCH", body: { organizationId: org.id, role } });
    setBusy(null);
    if (!result.ok) return setNotice({ tone: "danger", text: result.error });
    setNotice({ tone: "success", text: `${m.name} is now ${rolePermissions[role].label.toLowerCase()}.` });
    setEditing(null);
    reload();
  }

  function remove(m: Member) {
    Alert.alert(`Remove ${m.name}?`, `They will lose access to ${org.name} straight away. Records they created stay.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(`remove-${m.userId}`);
          const result = await api(`/api/mobile/team/members/${m.userId}?organizationId=${encodeURIComponent(org.id)}`, { method: "DELETE" });
          setBusy(null);
          if (!result.ok) return setNotice({ tone: "danger", text: result.error });
          setNotice({ tone: "success", text: `${m.name} was removed.` });
          setEditing(null);
          reload();
        },
      },
    ]);
  }

  function revoke(invite: { id: string; email: string }) {
    Alert.alert("Revoke invitation?", `${invite.email} won't be able to join with this invitation.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          setBusy(`invite-${invite.id}`);
          const result = await api(`/api/mobile/team/invitations/${invite.id}`, { method: "DELETE" });
          setBusy(null);
          if (!result.ok) return setNotice({ tone: "danger", text: result.error });
          setNotice({ tone: "success", text: `Invitation for ${invite.email} revoked.` });
          reload();
        },
      },
    ]);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text style={ui.muted}>
        {canManage
          ? `Invite colleagues to ${org.name} and choose what each person can see.`
          : `Everyone with access to ${org.name}. Owners and admins manage invitations and roles.`}
      </Text>
      {canManage && <Button title="Invite someone" icon="person-add-outline" onPress={() => router.push("/invite")} />}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <Card title={`${data.members.length} ${data.members.length === 1 ? "member" : "members"}`}>
        {data.members.map((m, i) => {
          const open = editing === m.userId;
          const editable = canEditMember(m);
          const lastOwner = m.role === "owner" && ownerCount === 1;
          return (
            <View key={m.userId}>
              {i > 0 && <Divider />}
              <Pressable
                onPress={editable ? () => startEditing(m) : undefined}
                disabled={!editable}
                accessibilityRole={editable ? "button" : undefined}
                accessibilityHint={editable ? "Change role or remove" : undefined}
                style={({ pressed }) => [{ padding: 16, gap: 4 }, pressed && ui.pressed]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[ui.rowTitle, { flex: 1 }]} numberOfLines={1}>
                    {m.name}
                    {m.isYou ? " (you)" : ""}
                  </Text>
                  <Badge tone={m.role === "owner" ? "brand" : "neutral"} label={rolePermissions[m.role].label} />
                </View>
                {m.email ? <Text style={ui.small}>{m.email}</Text> : null}
                <Text style={ui.small}>
                  {rolePermissions[m.role].scope} · Joined {formatDate(m.joinedAt)}
                </Text>
              </Pressable>
              {open && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
                  <Chips
                    label="Role"
                    options={assignable.map((r) => ({ value: r, label: rolePermissions[r].label }))}
                    value={role}
                    onChange={setRole}
                  />
                  <Text style={ui.small}>{rolePermissions[role].scope}</Text>
                  {lastOwner && <Notice tone="neutral">Every organisation needs an owner. Make someone else an owner first.</Notice>}
                  <Button
                    title="Save role"
                    onPress={() => saveRole(m)}
                    loading={busy === `role-${m.userId}`}
                    disabled={busy !== null || role === m.role || lastOwner}
                  />
                  <Button
                    title={`Remove ${m.name}`}
                    variant="secondary"
                    onPress={() => remove(m)}
                    loading={busy === `remove-${m.userId}`}
                    disabled={busy !== null || lastOwner}
                  />
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {canManage && (
        <Card title="Pending invitations">
          {data.invitations.length === 0 ? (
            <EmptyState icon="mail-outline" title="No pending invitations">
              People you invite appear here until they sign in for the first time.
            </EmptyState>
          ) : (
            data.invitations.map((inv, i) => (
              <View key={inv.id}>
                {i > 0 && <Divider />}
                <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={ui.rowTitle} numberOfLines={1}>
                      {inv.full_name || inv.email}
                    </Text>
                    {inv.full_name ? <Text style={ui.small}>{inv.email}</Text> : null}
                    <Text style={ui.small}>
                      {rolePermissions[inv.org_role ?? "viewer"].label} · Invited {formatDate(inv.created_at)}
                    </Text>
                  </View>
                  <Button
                    title="Revoke"
                    variant="ghost"
                    onPress={() => revoke(inv)}
                    loading={busy === `invite-${inv.id}`}
                    disabled={busy !== null}
                  />
                </View>
              </View>
            ))
          )}
        </Card>
      )}
    </Screen>
  );
}
