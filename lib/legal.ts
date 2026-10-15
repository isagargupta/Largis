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
        heading: "Mobile app",
        body: "The Largis app for iOS and Android uses the same account as the client portal. If you allow notifications, we store a push token for your device so we can alert you to new messages, ticket replies, reports, and invoices; it is deleted when you sign out. The app asks for camera or photo library access only when you choose to attach a photo, and only the photos you pick are uploaded. If you turn on app lock, Face ID, Touch ID, or your fingerprint is checked by your device's operating system; Largis never receives your biometric data. The app does not use advertising or third-party tracking.",
      },
      {
        heading: "Files you attach",
        body: "Files attached to messages and support tickets are stored privately with your organisation's records and can be opened only by your organisation's members and the Largis team, through links that expire after a few minutes. Files that are uploaded but never sent are deleted within a day.",
      },
      {
        heading: "Service providers",
        body: "We use a small number of providers to run the portal and app: Vercel (hosting), Supabase (database, sign-in, and file storage), Resend (email), Expo (push notifications), and Sentry (crash and error reports). Crash reports contain technical details such as the device model, operating system, app version, and the error itself; we do not attach your name or email to them. Each provider processes data only on our instructions.",
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
        body: "Subject to applicable law, including India's Digital Personal Data Protection Act, 2023 and the GDPR where relevant, you may request access, correction, or deletion of your personal data. See Delete Your Account for how to delete your portal account.",
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
  "delete-account": {
    title: "Delete Your Account",
    summary: "How to delete your Largis client portal account and what happens to your data.",
    sections: [
      {
        heading: "Delete in the Largis app",
        body: "Open the Largis app for iOS or Android, go to More, then Account, and choose Delete account. Type DELETE to confirm. Your account is removed immediately and you are signed out on that device.",
      },
      {
        heading: "Request deletion by email",
        body: `If you don't have the app, email ${siteConfig.email} from the address you sign in with and ask us to delete your account. We confirm your identity, delete the account, and reply within 7 days.`,
      },
      {
        heading: "What is deleted",
        body: "Your sign-in, profile, organisation memberships, two-factor authentication settings, and the push notification tokens for your devices are deleted.",
      },
      {
        heading: "What is kept",
        body: "Records you created for your organisation, such as chat messages, support tickets, and sales leads, belong to that organisation and stay with it under its agreement with Largis. Invoices and contracts are kept as long as tax and accounting law requires, and audit records of account activity may be kept for security and legal purposes.",
      },
      { heading: "Contact", body: contactLine },
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
