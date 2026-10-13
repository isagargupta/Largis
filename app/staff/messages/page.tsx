import type { Metadata } from "next";
import { StaffInbox } from "@/components/portal/StaffInbox";

export const metadata: Metadata = { title: "Messages" };

export default function StaffMessagesPage() {
  return <StaffInbox />;
}
