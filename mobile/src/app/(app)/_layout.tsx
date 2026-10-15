import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SecurityPanel } from "@/components/SecurityPanel";
import { Button, EmptyState, ErrorView, Loading, Screen, useUi } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { LockProvider } from "@/lib/lock";
import { OrgProvider, useOrg } from "@/lib/org";
import { pushTarget, registerPush } from "@/lib/push";
import { useTheme } from "@/lib/theme";

function NotificationRouter() {
  const { orgs, setActive } = useOrg();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response || !orgs.length) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const target = pushTarget(response.notification.request.content.data as Record<string, unknown>);
    if (!target) return;
    (async () => {
      if (target.organizationId && orgs.some((o) => o.id === target.organizationId)) await setActive(target.organizationId);
      router.push(target.path as never);
    })();
  }, [response, orgs, setActive]);

  return null;
}

function Gate() {
  const { loading, error, orgs, mustEnrollFor, reload } = useOrg();
  const { signOut, user } = useAuth();
  const { colors } = useTheme();
  const ui = useUi();

  if (loading) return <Loading />;
  if (error && !orgs.length) return <ErrorView message={error} onRetry={reload} />;

  if (!orgs.length) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <Screen>
          <EmptyState icon="business-outline" title="Your account isn't linked to an organisation yet">
            {`Contact your Largis account manager and they will add you. If you were invited recently, sign out and sign in again with the invited email address. Questions: ${config.supportEmail}`}
          </EmptyState>
          <Text style={[ui.small, ui.textCenter]}>Signed in as {user?.email}</Text>
          <Button title="Sign out" variant="secondary" onPress={signOut} />
        </Screen>
      </SafeAreaView>
    );
  }

  if (mustEnrollFor.length) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <Screen>
          <View style={{ gap: 6 }}>
            <Text style={ui.title}>Set up two-step verification</Text>
            <Text style={ui.muted}>
              {mustEnrollFor[0]} requires an authenticator app for everyone with access. Add one to continue.
            </Text>
          </View>
          <SecurityPanel />
          <Button title="Sign out" variant="ghost" onPress={signOut} />
        </Screen>
      </SafeAreaView>
    );
  }

  return (
    <>
      <NotificationRouter />
      <Stack
        screenOptions={{
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink },
          headerStyle: { backgroundColor: colors.paper },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ticket/[id]" options={{ title: "Ticket" }} />
        <Stack.Screen name="ticket/new" options={{ title: "New ticket", presentation: "modal" }} />
        <Stack.Screen name="lead/[id]" options={{ title: "Lead", presentation: "modal" }} />
        <Stack.Screen name="reports/index" options={{ title: "Reports" }} />
        <Stack.Screen name="reports/[id]" options={{ title: "Report" }} />
        <Stack.Screen name="billing" options={{ title: "Billing" }} />
        <Stack.Screen name="team" options={{ title: "Team" }} />
        <Stack.Screen name="invite" options={{ title: "Invite someone", presentation: "modal" }} />
        <Stack.Screen name="account" options={{ title: "Account" }} />
      </Stack>
    </>
  );
}

export default function AppLayout() {
  useEffect(() => {
    registerPush();
  }, []);

  return (
    <LockProvider>
      <OrgProvider>
        <Gate />
      </OrgProvider>
    </LockProvider>
  );
}
