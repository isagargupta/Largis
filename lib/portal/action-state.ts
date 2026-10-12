export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Sign-in link to share when an invitation email could not be sent. */
  link?: string;
  id?: string;
};

export const idleState: ActionState = { status: "idle" };

export function failure(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: "error", message, fieldErrors };
}

export function friendlyDbError(error: { code?: string; message: string }) {
  if (error.code === "42501") return "You don't have permission to do that.";
  if (error.code === "23505") return "That already exists.";
  if (error.code === "P0001") return error.message;
  return "Something went wrong. Please try again.";
}
