export const siteConfig = {
  name: "Largis Venture",
  legalName: "Largis Venture Private Limited",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://largis.co",
  description:
    "Largis Venture manages backend and wholesale systems and runs 24/7 live chat support teams for growing companies and large enterprises.",
  email: "sagar@largis.co",
  address: "Unit 101, Oxford Towers, HAL Old Airport Rd, Bangalore – 560008, India",
  cin: "U85499KA2024PTC187740",
  gstin: "29AANCR5772Q1Z6",
  responseSla: "Enterprise inquiries are reviewed within 2–4 business hours.",
} as const;

export type MenuLink = { label: string; href: string };

export type SocialLink = { label: string; handle: string; href: string; icon: "linkedin" | "reddit" };

export const socialLinks: SocialLink[] = [
  {
    label: "LinkedIn",
    handle: "Largis Venture",
    href: "https://www.linkedin.com/company/largisventure",
    icon: "linkedin",
  },
  { label: "Reddit", handle: "r/LargisVenture", href: "https://www.reddit.com/r/LargisVenture", icon: "reddit" },
];

export type MegaMenu = {
  label: string;
  href: string;
  intro: { title: string; text: string; cta: MenuLink };
  links: MenuLink[];
  /** Omit `image` to render the Largis software visual instead of a photo. */
  feature: { image?: string; title: string; href: string };
};

export const mainNav: MegaMenu[] = [
  {
    label: "Services",
    href: "/services",
    intro: {
      title: "Services",
      text: "We manage backend systems and run customer support teams for companies that need them working every hour of the day.",
      cta: { label: "View all services", href: "/services" },
    },
    links: [
      { label: "Backend & wholesale systems", href: "/services#backend" },
      { label: "Customer support operations", href: "/services#support" },
      { label: "How an engagement works", href: "/services#process" },
      { label: "Schedule a consultation", href: "/contact" },
    ],
    feature: {
      image: "/images/support-floor.jpg",
      title: "24/7 live chat support, staffed by trained people",
      href: "/services#support",
    },
  },
  {
    label: "Software Suite",
    href: "/software",
    intro: {
      title: "Software Suite",
      text: "Software we build and operate for our clients, starting with Sales Tracker and the client portal.",
      cta: { label: "Explore the software", href: "/software" },
    },
    links: [
      { label: "Sales Tracker", href: "/software#sales-tracker" },
      { label: "Client portal", href: "/software#portal" },
      { label: "Roles and access", href: "/software#access" },
      { label: "Open the live preview", href: "/app/sales-tracker" },
    ],
    feature: {
      title: "See revenue, leads, and response times in one place",
      href: "/app/sales-tracker",
    },
  },
  {
    label: "Security & Compliance",
    href: "/security",
    intro: {
      title: "Security & Compliance",
      text: "How we keep each client's data separate, protected, and encrypted.",
      cta: { label: "How we protect data", href: "/security" },
    },
    links: [
      { label: "Data isolation", href: "/security#isolation" },
      { label: "Network protection", href: "/security#network" },
      { label: "Encryption", href: "/security#encryption" },
      { label: "Security statement", href: "/legal/security" },
      { label: "Data processing addendum", href: "/legal/dpa" },
    ],
    feature: {
      image: "/images/data-center.jpg",
      title: "Every client's data is kept separate at the database level",
      href: "/security#isolation",
    },
  },
  {
    label: "Company",
    href: "/company",
    intro: {
      title: "Company",
      text: "Largis Venture Private Limited is based in Bangalore and works with clients in India and abroad.",
      cta: { label: "About Largis", href: "/company" },
    },
    links: [
      { label: "About us", href: "/company" },
      { label: "Corporate information", href: "/company#corporate" },
      { label: "Contact us", href: "/contact" },
      { label: "Privacy policy", href: "/legal/privacy" },
    ],
    feature: {
      image: "/images/city-towers.jpg",
      title: "Registered in Karnataka, India",
      href: "/company#corporate",
    },
  },
];

export const legalNav: MenuLink[] = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "DPA", href: "/legal/dpa" },
  { label: "Security Statement", href: "/legal/security" },
];

export const serviceInterests = [
  "Backend Support",
  "BPO Chat",
  "Sales Tracking Software",
  "Custom Enterprise Suite",
] as const;

export type ServiceInterest = (typeof serviceInterests)[number];
