import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Logo } from "@/components/Logo";
import { Button, Field, LinkText, Notice, useUi } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { makeStyles, palettes } from "@/lib/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { status, sendCode, verifyCode, verifyMfa, signOut } = useAuth();
  const ui = useUi();
  const s = useStyles();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submitEmail() {
    const value = email.trim().toLowerCase();
    if (!EMAIL.test(value)) return setError("Enter a valid work email address.");
    setBusy(true);
    setError(null);
    const result = await sendCode(value);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "The code could not be sent. Please try again.");
    setEmail(value);
    setCode("");
    setInfo(`If ${value} has access, a sign-in code is on its way. It expires in 10 minutes.`);
    setStep("code");
  }

  async function submitCode() {
    if (!/^\d{6,10}$/.test(code.trim())) return setError("Enter the code from your email.");
    setBusy(true);
    setError(null);
    const result = await verifyCode(email, code.trim());
    setBusy(false);
    if (!result.ok) setError(result.error ?? "That code is invalid or has expired.");
  }

  async function submitMfa() {
    if (!/^\d{6}$/.test(mfaCode.trim())) return setError("Enter the 6-digit code from your authenticator app.");
    setBusy(true);
    setError(null);
    const result = await verifyMfa(mfaCode);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "That code didn't match.");
  }

  const mfa = status === "mfa";

  return (
    <View style={{ flex: 1, backgroundColor: palettes.dark.night }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.brand}>
              <Logo size={44} />
              <Text style={s.brandName}>Largis Venture</Text>
              <Text style={s.brandSub}>Client portal</Text>
            </View>

            <View style={s.panel}>
              {mfa ? (
                <>
                  <Text style={s.heading}>Two-step verification</Text>
                  <Text style={ui.muted}>Enter the 6-digit code from your authenticator app to finish signing in.</Text>
                  <Field
                    label="Authenticator code"
                    value={mfaCode}
                    onChangeText={setMfaCode}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    onSubmitEditing={submitMfa}
                  />
                  {error && <Text style={ui.error}>{error}</Text>}
                  <Button title="Verify" onPress={submitMfa} loading={busy} />
                  <Button title="Use a different account" variant="ghost" onPress={() => signOut()} />
                </>
              ) : step === "email" ? (
                <>
                  <Text style={s.heading}>Sign in</Text>
                  <Text style={ui.muted}>Enter the work email your Largis account manager invited. We’ll email you a one-time code.</Text>
                  <Field
                    label="Work email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    placeholder="you@company.com"
                    returnKeyType="send"
                    onSubmitEditing={submitEmail}
                  />
                  {error && <Text style={ui.error}>{error}</Text>}
                  <Button title="Email me a code" onPress={submitEmail} loading={busy} />
                </>
              ) : (
                <>
                  <Text style={s.heading}>Check your email</Text>
                  {info && <Notice tone="info">{info}</Notice>}
                  <Field
                    label="Sign-in code"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    maxLength={10}
                    autoFocus
                    onSubmitEditing={submitCode}
                  />
                  {error && <Text style={ui.error}>{error}</Text>}
                  <Button title="Sign in" onPress={submitCode} loading={busy} />
                  <View style={s.links}>
                    <LinkText title="Resend code" onPress={submitEmail} />
                    <LinkText
                      title="Change email"
                      onPress={() => {
                        setStep("email");
                        setError(null);
                      }}
                    />
                  </View>
                </>
              )}
            </View>

            <View style={s.footer}>
              <Text style={s.footerText}>Access is by invitation. Need help? {config.supportEmail}</Text>
              <View style={s.links}>
                <LinkText title="Privacy" color="#c9cfe6" onPress={() => WebBrowser.openBrowserAsync(`${config.websiteUrl}/legal/privacy`)} />
                <LinkText title="Terms" color="#c9cfe6" onPress={() => WebBrowser.openBrowserAsync(`${config.websiteUrl}/legal/terms`)} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { flexGrow: 1, padding: 20, justifyContent: "center", gap: 24, width: "100%", maxWidth: 480, alignSelf: "center" },
  brand: { alignItems: "center", gap: 10 },
  brandName: { color: "#ffffff", fontSize: 22, fontWeight: "600", letterSpacing: -0.3 },
  brandSub: { color: "#a3a8b8", fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase" },
  panel: { backgroundColor: c.paper, borderRadius: 6, padding: 20, gap: 14 },
  heading: { fontSize: 20, fontWeight: "600", color: c.ink },
  links: { flexDirection: "row", justifyContent: "center", gap: 24 },
  footer: { alignItems: "center", gap: 10 },
  footerText: { color: "#a3a8b8", fontSize: 12, textAlign: "center" },
}));
