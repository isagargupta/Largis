import Constants from "expo-constants";

type Extra = { apiUrl: string; supabaseUrl: string; supabaseKey: string; sentryDsn: string; eas?: { projectId?: string } };

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const config = {
  apiUrl: (extra.apiUrl ?? "https://app.largis.co").replace(/\/+$/, ""),
  supabaseUrl: extra.supabaseUrl ?? "https://hnowkywozcoebafhlwgn.supabase.co",
  supabaseKey: extra.supabaseKey ?? "",
  sentryDsn: extra.sentryDsn || null,
  projectId: extra.eas?.projectId ?? Constants.easConfig?.projectId ?? null,
  websiteUrl: "https://largis.co",
  supportEmail: "sagar@largis.co",
};
