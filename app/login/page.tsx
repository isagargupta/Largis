import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to the Largis Venture client portal.",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <section className="bg-paper-soft">
      <div className="container flex min-h-[calc(100vh-72px)] items-center justify-center py-20">
        <div className="w-full max-w-md">
          <div className="border border-line bg-white p-8 sm:p-10">
            <h1 className="text-3xl">Sign in</h1>
            <p className="mt-3 text-[15px] text-ink-muted">Client portal for Largis Venture customers.</p>
            <div className="mt-8">
              <LoginForm />
            </div>
          </div>
          <p className="mt-6 text-center text-[15px] text-ink-muted">
            Not a client yet?{" "}
            <Link href="/contact" className="text-ink underline underline-offset-4 hover:text-brand-600">
              Schedule a consultation
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
