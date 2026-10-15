import Ionicons from "@expo/vector-icons/Ionicons";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Image, Platform, Pressable, Text, View } from "react-native";
import {
  attachmentType,
  attachmentTypes,
  attachmentUrl,
  discardAttachment,
  formatBytes,
  isImageAttachment,
  MAX_ATTACHMENTS,
  pickerTypes,
  uploadAttachment,
  type Attachment,
  type PickedFile,
} from "@/lib/attachments";
import { makeStyles, useTheme } from "@/lib/theme";

type Upload = { id: string; name: string; size: number | null; status: "uploading" | "done" | "error"; attachment?: Attachment; error?: string };

/** Uploads files as soon as they are picked, so sending only has to list them. */
export function useAttachmentUploads(organizationId: string) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const room = MAX_ATTACHMENTS - uploads.filter((u) => u.status !== "error").length;

  const add = useCallback(
    (files: PickedFile[]) => {
      const picked = files.slice(0, Math.max(0, room));
      if (!picked.length) return;
      const fresh: Upload[] = picked.map((f) => ({ id: Crypto.randomUUID(), name: f.name, size: f.size, status: "uploading" }));
      setUploads((prev) => [...prev, ...fresh]);
      picked.forEach((file, i) => {
        uploadAttachment(organizationId, file).then((result) => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id !== fresh[i].id
                ? u
                : result.ok
                  ? { ...u, status: "done", attachment: result.attachment, size: result.attachment.size }
                  : { ...u, status: "error", error: result.error },
            ),
          );
        });
      });
    },
    [organizationId, room],
  );

  const remove = useCallback(
    (id: string) => {
      const path = uploads.find((u) => u.id === id)?.attachment?.path;
      if (path) discardAttachment(path);
      setUploads((prev) => prev.filter((u) => u.id !== id));
    },
    [uploads],
  );
  const clear = useCallback(() => setUploads([]), []);

  const ready = uploads.flatMap((u) => (u.status === "done" && u.attachment ? [u.attachment] : []));
  return { uploads, ready, room, busy: uploads.some((u) => u.status === "uploading"), add, remove, clear };
}

export type AttachmentUploads = ReturnType<typeof useAttachmentUploads>;

function renamed(name: string, type: string | null) {
  const ext = type ? attachmentTypes[type] : undefined;
  return ext ? `${name.replace(/\.[^.]*$/, "") || "file"}.${ext}` : name;
}

async function fromLibrary(limit: number): Promise<PickedFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.8,
  });
  if (result.canceled) return [];
  return result.assets.map((a, i) => {
    const type = attachmentType(a.fileName ?? "photo.jpg", a.mimeType) ?? "image/jpeg";
    return { uri: a.uri, name: renamed(a.fileName ?? `photo-${i + 1}`, type), type, size: a.fileSize ?? null };
  });
}

async function fromCamera(): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Camera access is off", "Allow camera access for Largis in your phone’s settings to take a photo.");
    return [];
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, name: renamed(a.fileName ?? "photo", "image/jpeg"), type: "image/jpeg", size: a.fileSize ?? null }));
}

async function fromFiles(limit: number): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: pickerTypes, multiple: limit > 1, copyToCacheDirectory: true });
  if (result.canceled) return [];
  return result.assets.slice(0, limit).map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? null, size: a.size ?? null }));
}

/** Asks where to pick from, then returns the chosen files (empty if cancelled). */
function chooseFiles(limit: number): Promise<PickedFile[]> {
  const sources = [
    { label: "Photo library", pick: () => fromLibrary(limit) },
    { label: "Take photo", pick: fromCamera },
    { label: "Document", pick: () => fromFiles(limit) },
  ];
  return new Promise((resolve) => {
    const run = (i: number) => sources[i].pick().then(resolve, () => resolve([]));
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: "Attach", options: [...sources.map((s) => s.label), "Cancel"], cancelButtonIndex: sources.length },
        (index) => (index < sources.length ? run(index) : resolve([])),
      );
    } else {
      Alert.alert("Attach", "Images, PDFs, or Office files up to 10 MB.", sources.map((s, i) => ({ text: s.label, onPress: () => run(i) })), {
        cancelable: true,
        onDismiss: () => resolve([]),
      });
    }
  });
}

export function AttachButton({ uploads, size = 40 }: { uploads: AttachmentUploads; size?: number }) {
  const { colors } = useTheme();
  const disabled = uploads.room <= 0;
  return (
    <Pressable
      onPress={() => chooseFiles(uploads.room).then((files) => uploads.add(files))}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Attach files"
      hitSlop={6}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}
    >
      <Ionicons name="attach" size={24} color={colors.inkMuted} />
    </Pressable>
  );
}

export function PendingAttachments({ uploads }: { uploads: AttachmentUploads }) {
  const s = useStyles();
  const { colors, tones } = useTheme();
  if (!uploads.uploads.length) return null;
  return (
    <View style={s.pendingList}>
      {uploads.uploads.map((u) => {
        const failed = u.status === "error";
        return (
          <View key={u.id} style={[s.pending, failed && { backgroundColor: tones.danger.bg, borderColor: tones.danger.bg }]}>
            {u.status === "uploading" ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name={failed ? "alert-circle-outline" : "document-attach-outline"} size={16} color={failed ? tones.danger.fg : colors.inkMuted} />
            )}
            <Text style={[s.pendingText, failed && { color: tones.danger.fg }]} numberOfLines={1}>
              {failed ? u.error : u.name}
            </Text>
            {!failed && u.size ? <Text style={s.meta}>{formatBytes(u.size)}</Text> : null}
            <Pressable onPress={() => uploads.remove(u.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${u.name}`}>
              <Ionicons name="close" size={16} color={colors.inkSubtle} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

async function openAttachment(a: Attachment) {
  const url = await attachmentUrl(a.path);
  if (!url) return Alert.alert("File unavailable", "The file could not be opened. Check your connection and try again.");
  await WebBrowser.openBrowserAsync(url);
}

function ImageAttachment({ item }: { item: Attachment }) {
  const s = useStyles();
  const { colors } = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    attachmentUrl(item.path).then((value) => {
      if (!live) return;
      if (value) setUrl(value);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [item.path]);

  return (
    <Pressable onPress={() => openAttachment(item)} accessibilityRole="imagebutton" accessibilityLabel={`Open ${item.name}`} style={s.image}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" onError={() => setFailed(true)} />
      ) : failed ? (
        <Ionicons name="image-outline" size={24} color={colors.inkSubtle} />
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </Pressable>
  );
}

function FileAttachment({ item, inverted }: { item: Attachment; inverted?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const [opening, setOpening] = useState(false);
  const fg = inverted ? colors.onBrand : colors.ink;
  return (
    <Pressable
      onPress={async () => {
        setOpening(true);
        await openAttachment(item);
        setOpening(false);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name}`}
      style={({ pressed }) => [s.file, inverted && s.fileInverted, pressed && { opacity: 0.7 }]}
    >
      {opening ? <ActivityIndicator size="small" color={fg} /> : <Ionicons name="document-text-outline" size={18} color={fg} />}
      <Text style={[s.fileName, { color: fg }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[s.meta, inverted && { color: colors.onBrand, opacity: 0.75 }]}>{formatBytes(item.size)}</Text>
    </Pressable>
  );
}

/** Files on a message: image thumbnails and file rows that open in the in-app browser. */
export function AttachmentList({ items, inverted }: { items: Attachment[]; inverted?: boolean }) {
  if (!items.length) return null;
  const images = items.filter(isImageAttachment);
  const files = items.filter((a) => !isImageAttachment(a));
  return (
    <View style={{ gap: 6 }}>
      {images.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {images.map((a) => (
            <ImageAttachment key={a.path} item={a} />
          ))}
        </View>
      )}
      {files.map((a) => (
        <FileAttachment key={a.path} item={a} inverted={inverted} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pendingList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.paperSoft,
  },
  pendingText: { fontSize: 13, color: c.ink, flexShrink: 1 },
  meta: { fontSize: 11, color: c.inkSubtle },
  image: {
    width: 150,
    height: 120,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: c.paperSoft,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  file: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    maxWidth: 280,
  },
  fileInverted: { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.35)" },
  fileName: { fontSize: 14, flexShrink: 1 },
}));
