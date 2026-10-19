import "server-only";
import { getStaffMember, getUser } from "@/lib/portal/session";

export async function onboardingManager() {
  const [user, staff] = await Promise.all([getUser(), getStaffMember()]);
  if (!user || !staff || (staff.role !== "admin" && staff.role !== "manager")) return null;
  return { user, staff };
}
