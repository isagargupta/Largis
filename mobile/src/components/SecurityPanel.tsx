import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Badge, Button, Card, Divider, Field, Notice, Row, useUi } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { supabase } from "@/lib/supabase";

type Enrollment = { factorId: string; qr: string | null; secret: string; uri: string };

function svgFromQr(qr: string) {
  const markup = qr.startsWith("data:") ? qr.slice(qr.indexOf(",") + 1) : qr;
  try {
    return markup.trim().startsWith("<") ? markup : decodeURIComponent(markup);
  } catch {
    return null;
  }
}

export function SecurityPanel() {
  const { factors, refreshUser } = useAuth();
  const { orgs } = useOrg();
  const ui = useUi();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const required = orgs.some((o) => o.requireMfa);

  async function start() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { data: list, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setBusy(false);
      return setError("Two-step verification isn't available right now. Please try again.");
    }
    // Abandoned set-ups block new ones with the same name; clear them first.
    for (const f of list.all.filter((f) => f.factor_type === "totp" && f.status === "unverified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const taken = new Set(list.totp.map((f) => f.friendly_name));
    let friendlyName = "Authenticator app";
    for (let n = 2; taken.has(friendlyName) && n < 20; n++) friendlyName = `Authenticator app ${n}`;

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName, issuer: "Largis Venture" });
    setBusy(false);
    if (enrollError || !data) return setError("The authenticator could not be set up. Please try again.");
    setCode("");
    setEnrollment({ factorId: data.id, qr: svgFromQr(data.totp.qr_code), secret: data.totp.secret, uri: data.totp.uri });
  }

  async function confirm() {
    if (!enrollment) return;
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from your authenticator app.");
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: code.trim() });
    setBusy(false);
    if (verifyError) return setError("That code didn't match. Check the time on your phone and enter the newest code.");
    setEnrollment(null);
    setMessage("Two-step verification is on. You'll enter a code from the app each time you sign in.");
    await refreshUser();
  }

  function remove(factor: { id: string; name: string }) {
    if (factors.length === 1 && required) {
      return Alert.alert(
        "Two-step verification is required",
        "Your organisation requires two-step verification. Add another authenticator before removing this one.",
      );
    }
    Alert.alert("Remove authenticator?", `${factor.name} will no longer be asked for when you sign in.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
          setBusy(false);
          if (removeError) return setError("The authenticator could not be removed. Sign out, sign in again, and retry.");
          await supabase.auth.refreshSession();
          await refreshUser();
          setMessage(`${factor.name} removed.`);
        },
      },
    ]);
  }

  return (
    <Card title="Two-step verification">
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={ui.muted}>
          Protect your account with a 6-digit code from an authenticator app such as Google Authenticator, Microsoft Authenticator,
          or 1Password.
        </Text>
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
      </View>

      {factors.map((f) => (
        <View key={f.id}>
          <Divider />
          <Row
            icon="shield-checkmark-outline"
            title={f.name}
            right={<Badge tone="success" label="Active" />}
            subtitle="Tap to remove"
            onPress={() => remove(f)}
          />
        </View>
      ))}

      <Divider />
      <View style={{ padding: 16, gap: 14 }}>
        {enrollment ? (
          <>
            <Text style={ui.label}>1. Add Largis Venture to your authenticator app</Text>
            <Button title="Open authenticator app" variant="secondary" icon="open-outline" onPress={() => Linking.openURL(enrollment.uri).catch(() => setError("No authenticator app could open the link. Enter the setup key instead."))} />
            {enrollment.qr && (
              <View style={{ alignItems: "center", gap: 6 }}>
                <View style={{ padding: 8, backgroundColor: "#ffffff", borderRadius: 4 }}>
                  <SvgXml xml={enrollment.qr} width={180} height={180} />
                </View>
                <Text style={ui.small}>Or scan this from another device</Text>
              </View>
            )}
            <View style={{ gap: 6 }}>
              <Text style={ui.small}>Setup key</Text>
              <Text selectable style={[ui.mono, ui.body, { fontFamily: "Menlo", fontSize: 14 }]}>
                {enrollment.secret}
              </Text>
              <Button
                title="Copy setup key"
                variant="ghost"
                icon="copy-outline"
                onPress={async () => {
                  await Clipboard.setStringAsync(enrollment.secret);
                  setMessage("Setup key copied.");
                }}
              />
            </View>
            <Text style={ui.label}>2. Enter the 6-digit code it shows</Text>
            <Field
              label="Code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              onSubmitEditing={confirm}
            />
            <Button title="Turn on two-step verification" onPress={confirm} loading={busy} />
            <Button title="Cancel" variant="ghost" onPress={() => setEnrollment(null)} />
          </>
        ) : (
          <Button
            title={factors.length ? "Add another authenticator" : "Set up authenticator app"}
            variant={factors.length ? "secondary" : "primary"}
            icon="add"
            onPress={start}
            loading={busy}
          />
        )}
      </View>
    </Card>
  );
}
