import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, Linking, Text, View } from "react-native";
import { Card, Divider, Row, Screen, styles as ui } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { useOrg } from "@/lib/org";
import { colors } from "@/lib/theme";

export default function MoreScreen() {
  const { orgs, active, perms, setActive, unread } = useOrg();
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text style={ui.small}>Signed in as</Text>
        <Text style={ui.rowTitle}>{user?.email}</Text>
        {active && perms && (
          <Text style={ui.small}>
            {perms.label} · {active.name} · {perms.scope}
          </Text>
        )}
      </View>

      {orgs.length > 1 && (
        <Card title="Organisation">
          {orgs.map((o, i) => (
            <View key={o.id}>
              {i > 0 && <Divider />}
              <Row
                icon="business-outline"
                title={o.name}
                subtitle={[o.plan, o.region, unread[o.id] ? `${unread[o.id]} unread` : null].filter(Boolean).join(" · ") || undefined}
                right={o.id === active?.id ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : undefined}
                onPress={o.id === active?.id ? undefined : () => setActive(o.id)}
              />
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Row icon="document-text-outline" title="Reports" onPress={() => router.push("/reports")} />
        {perms?.canViewBilling && (
          <>
            <Divider />
            <Row icon="receipt-outline" title="Billing" subtitle="Invoices and contracts" onPress={() => router.push("/billing")} />
          </>
        )}
        <Divider />
        <Row icon="person-circle-outline" title="Account and security" onPress={() => router.push("/account")} />
      </Card>

      <Card>
        <Row icon="mail-outline" title="Contact Largis" subtitle={config.supportEmail} onPress={() => Linking.openURL(`mailto:${config.supportEmail}`)} />
        <Divider />
        <Row icon="globe-outline" title="Largis website" onPress={() => WebBrowser.openBrowserAsync(config.websiteUrl)} />
        <Divider />
        <Row icon="shield-outline" title="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(`${config.websiteUrl}/legal/privacy`)} />
        <Divider />
        <Row icon="reader-outline" title="Terms of service" onPress={() => WebBrowser.openBrowserAsync(`${config.websiteUrl}/legal/terms`)} />
      </Card>

      <Card>
        <Row
          icon="log-out-outline"
          title="Sign out"
          danger
          onPress={() =>
            Alert.alert("Sign out?", "You'll need a new code from your email to sign in again.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => signOut() },
            ])
          }
        />
      </Card>

      <Text style={[ui.small, ui.textCenter]}>Largis Venture · Version {Constants.expoConfig?.version ?? "1.0.0"}</Text>
    </Screen>
  );
}
