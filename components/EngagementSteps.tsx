import { SectionHeading } from "@/components/ui/card";

const steps = [
  {
    title: "Consultation",
    text: "A 30-minute call to understand your systems, volumes, and what needs to improve.",
  },
  {
    title: "Assessment",
    text: "We review your current setup and send a written scope with pricing and service levels.",
  },
  {
    title: "Transition",
    text: "We document your processes, set up access, and train the assigned team before go-live.",
  },
  {
    title: "Operation and reporting",
    text: "We run the service day to day and report against the agreed targets every month.",
  },
];

export function EngagementSteps({ id, index }: { id?: string; index?: string }) {
  return (
    <section id={id} className="scroll-mt-20 bg-paper">
      <div className="container py-24 sm:py-28">
        <SectionHeading
          index={index}
          eyebrow="Engagement"
          title="How an engagement works"
          description="Four steps from the first call to day-to-day operation."
        />
        <ol className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {steps.map((step, i) => (
            <li key={step.title} className="rule-accent pt-6">
              <p className="font-mono text-sm text-gold-700">Step {String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em]">{step.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
