import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { AttachButton, PendingAttachments, useAttachmentUploads } from "@/components/Attachments";
import { Button, Chips, Field, Notice, Screen, useUi } from "@/components/ui";
import { api } from "@/lib/api";
import type { TicketPriority } from "@/lib/database.types";
import { ticketPriorities, ticketPriorityMeta } from "@/lib/meta";
import { useActiveOrg } from "@/lib/org";

export default function NewTicketScreen() {
  const { org, perms } = useActiveOrg();
  const ui = useUi();
  const uploads = useAttachmentUploads(org.id);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!perms.canEdit) {
    return (
      <Screen>
        <Notice>Your role can read tickets but not open them. Ask an owner or admin if you need help.</Notice>
      </Screen>
    );
  }

  async function submit() {
    if (uploads.busy) return setError("Wait for your files to finish uploading.");
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const result = await api<{ id: string }>("/api/mobile/tickets", {
      body: {
        organizationId: org.id,
        subject,
        description,
        priority,
        attachments: uploads.ready.map(({ path, name }) => ({ path, name })),
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.fieldErrors?.attachments ?? result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    router.replace(`/ticket/${result.id}`);
  }

  return (
    <Screen>
      <Text style={ui.muted}>Tell the Largis support team what you need. You’ll be notified when they reply.</Text>
      <Field label="Subject" value={subject} onChangeText={setSubject} maxLength={200} error={fieldErrors.subject} placeholder="e.g. Order sync delayed" />
      <Chips
        label="Priority"
        options={ticketPriorities.map((p) => ({ value: p, label: ticketPriorityMeta[p].label }))}
        value={priority}
        onChange={setPriority}
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={10000}
        error={fieldErrors.description}
        placeholder="What happened, what you expected, and any reference numbers."
      />
      <View style={{ gap: 8 }}>
        <PendingAttachments uploads={uploads} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <AttachButton uploads={uploads} />
          <Text style={[ui.small, { flex: 1 }]}>Add screenshots or documents (images, PDFs, Office files, up to 10 MB each).</Text>
        </View>
      </View>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button title="Open ticket" onPress={submit} loading={busy} disabled={uploads.busy} />
    </Screen>
  );
}
