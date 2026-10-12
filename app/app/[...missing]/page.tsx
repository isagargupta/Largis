import { notFound } from "next/navigation";

/** Unknown portal paths render the portal's own 404 instead of the marketing one. */
export default function MissingPage() {
  notFound();
}
