import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { Button, Chips, Field, Notice, Screen, useUi } from "@/components/ui";
import { api } from "@/lib/api";
import type { OrgRole } from "@/lib/database.types";
import { orgRoles, rolePermissions } from "@/lib/meta";
import { useActiveOrg } from "@/lib/org";

export default function InviteScreen() {
  const { org, perms } = useActiveOrg();
  const ui = useUi();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<OrgRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ message: string; link?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!perms.canManageTeam) {
    return (
      <Screen>
        <Notice tone="neutral">Only owners and admins can invite people. Ask one of them to add your colleague.</Notice>
      </Screen>
    );
  }

  const roles = org.role === "owner" ? orgRoles : orgRoles.filter((r) => r !== "owner");

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const result = await api<{ message?: string; link?: string }>("/api/mobile/team/invitations", {
      body: { organizationId: org.id, email: email.trim(), fullName: fullName.trim(), role },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    setDone({ message: result.message ?? `Invitation sent to ${email.trim()}.`, link: result.link });
  }

  if (done) {
    return (
      <Screen>
        <Notice tone="success">{done.message}</Notice>
        {done.link && (
          <>
            <Text style={ui.muted}>The invitation email couldn’t be sent. Share this sign-in link with them instead.</Text>
            <Text selectable style={ui.mono}>
              {done.link}
            </Text>
            <Button
              title={copied ? "Link copied" : "Copy sign-in link"}
              variant="secondary"
              icon="copy-outline"
              onPress={async () => {
                await Clipboard.setStringAsync(done.link!);
                setCopied(true);
              }}
            />
          </>
        )}
        <Button title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={ui.muted}>They’ll get an email with a link to sign in to {org.name}. No password is needed.</Text>
      <Field
        label="Work email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        placeholder="name@company.com"
        error={fieldErrors.email}
      />
      <Field label="Full name (optional)" value={fullName} onChangeText={setFullName} maxLength={120} error={fieldErrors.fullName} />
      <Chips label="Role" options={roles.map((r) => ({ value: r, label: rolePermissions[r].label }))} value={role} onChange={setRole} />
      <Text style={ui.small}>{rolePermissions[role].scope}</Text>
      {fieldErrors.role && <Text style={ui.error}>{fieldErrors.role}</Text>}
      {error && <Notice tone="danger">{error}</Notice>}
      <Button title="Send invitation" icon="paper-plane-outline" onPress={submit} loading={busy} disabled={!email.trim()} />
    </Screen>
  );
}
