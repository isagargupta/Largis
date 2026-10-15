import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useOrg } from "@/lib/org";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const { active, unread } = useOrg();
  const { colors } = useTheme();
  const unreadCount = active ? unread[active.id] ?? 0 : 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkSubtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.ink },
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} />,
          tabBarBadge: unreadCount ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand },
        }}
      />
      <Tabs.Screen
        name="support"
        options={{ title: "Support", tabBarIcon: ({ color, size }) => <Ionicons name="help-buoy-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="sales"
        options={{ title: "Sales", tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
