import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { SecurityPanel } from "@/components/SecurityPanel";
import { Button, Card, Field, Notice, Screen, SwitchRow, useUi } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { useAppLock } from "@/lib/lock";
import { rolePermissions } from "@/lib/meta";
import { useOrg } from "@/lib/org";

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { orgs } = useOrg();
  const lock = useAppLock();
  const ui = useUi();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockBusy, setLockBusy] = useState(false);

  async function toggleLock(value: boolean) {
    setLockBusy(true);
    await lock.setEnabled(value);
    setLockBusy(false);
  }

  function deleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your Largis login and removes you from every organisation. Your organisation's data stays with your organisation.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            setError(null);
            const result = await api("/api/mobile/account", { method: "DELETE" });
            setBusy(false);
            if (!result.ok) return setError(result.error);
            await signOut();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Card title="Profile" padded>
        <View style={{ gap: 2 }}>
          <Text style={ui.small}>Email</Text>
          <Text style={ui.body}>{user?.email}</Text>
        </View>
        {orgs.map((o) => (
          <View key={o.id} style={{ gap: 2 }}>
            <Text style={ui.small}>{o.name}</Text>
            <Text style={ui.body}>{rolePermissions[o.role].label}</Text>
          </View>
        ))}
        <Text style={ui.small}>To change your role or email, contact an owner of your organisation or {config.supportEmail}.</Text>
      </Card>

      <Card title="App lock">
        <SwitchRow
          icon={lock.biometry.icon}
          title={`Require ${lock.biometry.label}`}
          subtitle={
            lock.biometry.available
              ? "Asked when you open Largis and after a minute away."
              : "Set up Face ID, fingerprint, or a passcode in your phone’s settings to use this."
          }
          value={lock.enabled}
          onValueChange={toggleLock}
          disabled={lockBusy || (!lock.biometry.available && !lock.enabled)}
        />
      </Card>

      <SecurityPanel />

      <Card title="Delete account" padded>
        <Text style={ui.muted}>
          Deleting your account removes your login and your access to every organisation. Leads, tickets, and reports belong to your
          organisation and are kept. The Largis team is notified.
        </Text>
        <Field
          label='Type DELETE to confirm'
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {error && <Notice tone="danger">{error}</Notice>}
        <Button title="Delete my account" variant="danger" onPress={deleteAccount} disabled={confirm.trim() !== "DELETE"} loading={busy} />
      </Card>
    </Screen>
  );
}
