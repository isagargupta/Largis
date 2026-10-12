import { notFound } from "next/navigation";

/** Unknown workspace paths render the workspace's own 404 instead of the marketing one. */
export default function MissingPage() {
  notFound();
}
