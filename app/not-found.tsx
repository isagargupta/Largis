import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="bg-white">
      <div className="container flex min-h-[60vh] flex-col justify-center py-24">
        <p className="text-sm text-ink-subtle">404</p>
        <h1 className="display-1 mt-4">Page not found</h1>
        <p className="mt-6 max-w-md text-lg text-ink-muted">
          The page you are looking for does not exist or has moved.
        </p>
        <div>
          <ButtonLink href="/" variant="outline" className="mt-10">
            Back to home
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
