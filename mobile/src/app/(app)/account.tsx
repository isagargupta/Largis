import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { SecurityPanel } from "@/components/SecurityPanel";
import { Button, Card, Field, Notice, Screen, styles as ui } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { rolePermissions } from "@/lib/meta";
import { useOrg } from "@/lib/org";

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { orgs } = useOrg();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
