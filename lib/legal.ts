import { siteConfig } from "@/lib/site";

export type LegalDoc = {
  title: string;
  summary: string;
  sections: { heading: string; body: string }[];
};

const contactLine = `Questions can be directed to ${siteConfig.email} or by post to ${siteConfig.legalName}, ${siteConfig.address}.`;

export const legalDocs: Record<string, LegalDoc> = {
  privacy: {
    title: "Privacy Policy",
    summary: "How we collect, use, and protect personal information.",
    sections: [
      {
        heading: "Information we collect",
        body: "We collect information you provide directly — such as your name, business email, company, and enquiry details — and limited technical data (IP address, browser type) required to operate and secure our services.",
      },
      {
        heading: "How we use information",
        body: "We use personal information to respond to enquiries, deliver contracted services, maintain security, and meet legal obligations. We do not sell personal information.",
      },
      {
        heading: "Data retention",
        body: "Enquiry data is retained for up to 24 months unless a commercial relationship is established. Client data is retained per the terms of the applicable agreement and DPA.",
      },
      {
        heading: "Your rights",
        body: "Subject to applicable law, including India's Digital Personal Data Protection Act, 2023 and the GDPR where relevant, you may request access, correction, or deletion of your personal data.",
      },
      { heading: "Contact", body: contactLine },
    ],
  },
  terms: {
    title: "Terms of Service",
    summary: "The terms governing use of this website and our client portal.",
    sections: [
      {
        heading: "Acceptance",
        body: "By accessing this website or the Largis client portal you agree to these terms. Commercial engagements are governed by the master services agreement executed with each client.",
      },
      {
        heading: "Acceptable use",
        body: "You may not attempt to gain unauthorized access, probe or scan for vulnerabilities outside our disclosure programme, or interfere with the availability of our services.",
      },
      {
        heading: "Intellectual property",
        body: "The Largis software suite, documentation, and site content are the property of Largis Venture Private Limited and are licensed, not sold.",
      },
      {
        heading: "Governing law",
        body: "These terms are governed by the laws of India, with exclusive jurisdiction of the courts at Bangalore, Karnataka.",
      },
      { heading: "Contact", body: contactLine },
    ],
  },
  dpa: {
    title: "Data Processing Addendum",
    summary: "Our commitments when processing personal data on behalf of clients.",
    sections: [
      {
        heading: "Roles",
        body: "When delivering services, Largis acts as a data processor and the client acts as the data controller. We process personal data only on documented client instructions.",
      },
      {
        heading: "Security measures",
        body: "We maintain technical and organizational measures including tenant isolation via row level security, encryption in transit and at rest, access logging, and least-privilege access.",
      },
      {
        heading: "Sub-processors",
        body: "Infrastructure sub-processors include Vercel (hosting), Cloudflare (edge security and DNS), and Supabase (database). Clients are notified of material changes.",
      },
      {
        heading: "Breach notification",
        body: "We notify affected clients without undue delay, and in any event within 72 hours, of becoming aware of a personal data breach.",
      },
      { heading: "Execution", body: `A countersigned DPA is available on request. ${contactLine}` },
    ],
  },
  security: {
    title: "Security Statement",
    summary: "An overview of the controls protecting client systems and data.",
    sections: [
      {
        heading: "Network & edge",
        body: "All public traffic is proxied through Cloudflare with WAF rules, bot management, rate limiting, and DDoS mitigation. Origins accept traffic only over TLS.",
      },
      {
        heading: "Data isolation",
        body: "Every tenant-owned record carries an organization_id. Postgres row level security policies restrict reads and writes to members of that organization, enforced at the database layer.",
      },
      {
        heading: "Encryption",
        body: "Data is encrypted in transit with TLS 1.2+ and at rest with AES-256. Backups are encrypted and access-controlled.",
      },
      {
        heading: "Access control",
        body: "Staff access to production follows least privilege, requires MFA, and is logged. BPO agents only access the client systems and records assigned to them.",
      },
      {
        heading: "Responsible disclosure",
        body: `Report suspected vulnerabilities to ${siteConfig.email}. We acknowledge reports within two business days.`,
      },
    ],
  },
};
