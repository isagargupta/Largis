import type { Metadata } from "next";
import { CtaBand } from "@/components/CtaBand";
import { EngagementSteps } from "@/components/EngagementSteps";
import { PageHero } from "@/components/PageHero";
import { ServiceDetail } from "@/components/ServiceDetail";

export const metadata: Metadata = {
  title: "Services",
  description: "Backend and wholesale systems support and 24/7 customer support operations from Largis Venture.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        crumb="Services"
        title="Backend systems and customer support, run to agreed service levels"
        intro="We look after the systems that move your orders and stock, and the teams that answer your customers. Both are delivered under written service levels and reported every month."
        image="/images/server-rack.jpg"
      />

      <ServiceDetail
        id="backend"
        index="01"
        title="Backend & wholesale systems"
        intro="For wholesale and multi-channel businesses whose orders, stock, and partner data have to stay accurate across every system."
        image="/images/backend-code.jpg"
        imageAlt="Monitoring dashboards and source code on an engineer's screens"
        items={[
          {
            title: "Process automation",
            text: "Repetitive back-office work such as order routing, invoicing, and stock updates handled automatically.",
          },
          {
            title: "Inventory sync",
            text: "Stock levels kept consistent across warehouses, marketplaces, storefronts, and your ERP.",
          },
          {
            title: "Custom API integration",
            text: "Connections to suppliers, logistics partners, and internal tools, built and maintained by our engineers.",
          },
          {
            title: "Real-time monitoring",
            text: "Checks on every integration and job, with alerts routed to an on-call engineer.",
          },
        ]}
        commitments={[
          "99.9% uptime commitment in the service contract",
          "Written summary of cause and prevention after every incident",
          "Named engineers who know your systems",
          "Monthly report on uptime, incidents, and changes",
        ]}
      />

      <ServiceDetail
        id="support"
        index="02"
        tone="soft"
        title="Customer support operations"
        intro="Dedicated live chat teams that work in your tools, follow your processes, and represent your brand."
        image="/images/support-floor.jpg"
        imageAlt="Support team working at desks in an open-plan office"
        items={[
          {
            title: "24/7 human-led support",
            text: "Trained agents on every shift, every day of the year. Customers always reach a person.",
          },
          {
            title: "Tier 1 to Tier 3 escalation",
            text: "Common questions are answered directly. Technical issues move to our engineers without a hand-off to you.",
          },
          {
            title: "Response times in the contract",
            text: "First-response and resolution targets are agreed in writing and measured on every conversation.",
          },
          {
            title: "Your playbooks, your tone",
            text: "Agents are trained on your products, policies, and style before they speak to a customer.",
          },
        ]}
        commitments={[
          "Service levels set out in the contract",
          "Weekly quality reviews of sampled conversations",
          "Response times visible live in the client portal",
        ]}
      />

      <EngagementSteps id="process" />

      <CtaBand />
    </>
  );
}
