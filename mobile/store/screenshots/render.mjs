/**
 * Renders store screenshots from the same layout, colours, and demo data as the app.
 * Run: node store/screenshots/render.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const light = {
  ink: "#15171c",
  inkMuted: "#4a4f5c",
  inkSubtle: "#7a7f8c",
  line: "#e5e0d6",
  paper: "#fbfaf6",
  paperSoft: "#f3f0e8",
  surface: "#ffffff",
  onBrand: "#ffffff",
  brand: "#2f438e",
  accent: "#2f438e",
  gold: "#b48e4d",
  success: "#10b981",
  status: "#000000",
};
const dark = {
  ink: "#ecebe6",
  inkMuted: "#b6b9c2",
  inkSubtle: "#868b97",
  line: "#2b2e36",
  paper: "#0e0f12",
  paperSoft: "#1a1c21",
  surface: "#15171b",
  onBrand: "#ffffff",
  brand: "#3d53a8",
  accent: "#9aaaf0",
  gold: "#c9a467",
  success: "#34d399",
  status: "#000000",
};
const tones = {
  light: {
    neutral: ["#4a4f5c", "#f3f0e8"],
    info: ["#0b6aa2", "#e6f2fa"],
    brand: ["#2f438e", "#e8ecf8"],
    warning: ["#a15c07", "#fdf3e1"],
    success: ["#067647", "#e7f6ee"],
    danger: ["#b42318", "#fdecea"],
  },
  dark: {
    neutral: ["#b6b9c2", "#1a1c21"],
    info: ["#7cc4f0", "#10283a"],
    brand: ["#9aaaf0", "#1d2547"],
    warning: ["#f0b860", "#33240c"],
    success: ["#5fd39a", "#0f2e20"],
    danger: ["#f28b82", "#3a1512"],
  },
};
const stageDot = {
  new: "#a3a3a3",
  qualified: "#0ea5e9",
  proposal: "#4a5fb0",
  negotiation: "#f59e0b",
  won: "#10b981",
  lost: "#f87171",
};

function badge(scheme, tone, label) {
  const [fg, bg] = tones[scheme][tone];
  return `<span class="badge" style="color:${fg};background:${bg}">${label}</span>`;
}

function shell({ scheme, title, tab, platform, tablet, body }) {
  const c = scheme === "dark" ? dark : light;
  const tabs = [
    ["home", "Home"],
    ["chat", "Messages"],
    ["buoy", "Support"],
    ["trend", "Sales"],
    ["more", "More"],
  ];
  const icon = (name, active) => {
    const color = active ? c.accent : c.inkSubtle;
    const paths = {
      home: `<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" fill="none" stroke="${color}" stroke-width="1.6"/>`,
      chat: `<path d="M5 16.5 3.5 20.5 8 18.5A8.5 8.5 0 1 0 5 16.5Z" fill="none" stroke="${color}" stroke-width="1.6"/>`,
      buoy: `<circle cx="12" cy="12" r="7.2" fill="none" stroke="${color}" stroke-width="1.6"/><path d="M12 4.8v14.4M5.2 9.2h13.6M5.2 14.8h13.6" stroke="${color}" stroke-width="1.4"/>`,
      trend: `<path d="M4 16.5 9 11l3 2.5L20 6" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/><path d="M14 6h6v6" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>`,
      more: `<circle cx="6" cy="12" r="1.3" fill="${color}"/><circle cx="12" cy="12" r="1.3" fill="${color}"/><circle cx="18" cy="12" r="1.3" fill="${color}"/>`,
    };
    return `<svg viewBox="0 0 24 24" width="23" height="23">${paths[name]}</svg>`;
  };
  const status =
    platform === "android"
      ? `<div class="status android" style="color:${c.ink}"><span>9:41</span><span class="status-right">LTE 100%</span></div>`
      : `<div class="status ios" style="color:${scheme === "dark" ? "#fff" : "#000"}"><span class="time">9:41</span><span class="status-right">●●●● LTE ▮</span></div>`;
  return `<div class="app" style="background:${c.paper};color:${c.ink}">
    ${status}
    <div class="header" style="background:${c.paper};color:${c.ink}">${title}</div>
    <div class="scroll ${tablet ? "tablet" : ""}">${body}</div>
    <div class="tabs" style="background:${c.surface};border-color:${c.line}">
      ${tabs
        .map(
          ([id, label]) =>
            `<div class="tab" style="color:${id === tab ? c.accent : c.inkSubtle}">${icon(id, id === tab)}<span>${label}</span></div>`,
        )
        .join("")}
    </div>
  </div>`;
}

function css(c) {
  return `
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .app { width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
    .status { height: 54px; display: flex; align-items: flex-end; justify-content: space-between; padding: 0 22px 8px; font-size: 15px; font-weight: 600; }
    .status.android { height: 28px; align-items: center; padding: 0 14px; font-size: 12px; font-weight: 500; }
    .header { height: 44px; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 600; }
    .scroll { flex: 1; overflow: hidden; padding: 8px 16px 24px; display: flex; flex-direction: column; gap: 16px; }
    .scroll.tablet > * { width: 100%; max-width: 760px; margin-left: auto; margin-right: auto; }
    .tabs { height: 78px; border-top: 0.5px solid; display: flex; padding: 6px 4px 22px; }
    .tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 10px; font-weight: 500; }
    .eyebrow { font-size: 11px; letter-spacing: 1.4px; text-transform: uppercase; color: ${c.gold}; font-weight: 600; }
    h1 { font-size: 24px; font-weight: 600; letter-spacing: -0.4px; margin: 4px 0 0; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
    .small { font-size: 12px; line-height: 17px; color: ${c.inkSubtle}; }
    .muted { font-size: 14px; line-height: 20px; color: ${c.inkMuted}; }
    .body { font-size: 15px; line-height: 22px; }
    .badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 3px; }
    .stats { display: flex; flex-wrap: wrap; gap: 10px; }
    .stat { flex: 1 1 46%; background: ${c.surface}; border: 0.5px solid ${c.line}; border-radius: 4px; padding: 14px; }
    .stat b { display: block; font-size: 22px; font-weight: 600; letter-spacing: -0.4px; margin: 2px 0; }
    .card { background: ${c.surface}; border: 0.5px solid ${c.line}; border-radius: 4px; }
    .card h2 { font-size: 15px; margin: 0; padding: 12px 16px; border-bottom: 0.5px solid ${c.line}; display: flex; justify-content: space-between; }
    .card h2 span { color: ${c.accent}; font-weight: 500; font-size: 14px; }
    .line { display: flex; align-items: center; gap: 10px; padding: 11px 16px; border-top: 0.5px solid ${c.line}; }
    .line:first-child { border-top: 0; }
    .dot { width: 10px; height: 10px; }
    .bar { display: flex; height: 8px; margin: 16px 16px 4px; background: ${c.paperSoft}; overflow: hidden; }
    .pad { padding: 16px; }
    .bubble-row { display: flex; flex-direction: column; max-width: 85%; gap: 2px; }
    .bubble { padding: 9px 12px; border-radius: 14px; font-size: 15px; line-height: 21px; }
    .mine { align-self: flex-end; align-items: flex-end; }
    .mine .bubble { background: ${c.brand}; color: ${c.onBrand}; border-bottom-right-radius: 4px; }
    .staff { align-self: flex-start; }
    .staff .bubble { background: ${c.surface}; border: 1px solid ${c.line}; border-bottom-left-radius: 4px; }
    .composer { margin-top: auto; background: ${c.surface}; border-top: 0.5px solid ${c.line}; padding: 8px; display: flex; gap: 8px; align-items: center; }
    .composer .field { flex: 1; border: 1px solid ${c.line}; background: ${c.paper}; border-radius: 20px; padding: 10px 14px; color: ${c.inkSubtle}; }
    .send { width: 40px; height: 40px; border-radius: 20px; background: ${c.brand}; color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .switch { width: 51px; height: 31px; border-radius: 16px; background: #e5e5ea; position: relative; }
    .switch i { position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 14px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
    .mono { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: ${c.inkSubtle}; }
  `;
}

function home(scheme) {
  const c = scheme === "dark" ? dark : light;
  const stages = [
    ["New", 1, stageDot.new],
    ["Qualified", 1, stageDot.qualified],
    ["Proposal", 1, stageDot.proposal],
    ["Negotiation", 1, stageDot.negotiation],
    ["Closed Won", 1, stageDot.won],
    ["Closed Lost", 1, stageDot.lost],
  ];
  return `
    <div><div class="eyebrow">Overview</div><h1>Northwind Retail (Demo)</h1>
      <div class="row">${badge(scheme, "success", "Active")}<span class="small">Growth plan</span><span class="mono">ap-south-1</span></div>
    </div>
    <div class="stats">
      <div class="stat"><span class="small">Open leads</span><b>4</b><span class="small">New through negotiation</span></div>
      <div class="stat"><span class="small">Open pipeline</span><b>$18,050,000</b><span class="small">$6,800,000 won to date</span></div>
      <div class="stat"><span class="small">Open tickets</span><b>2</b><span class="small">2 past an SLA target</span></div>
      <div class="stat"><span class="small">Replies within SLA</span><b>100%</b><span class="small">Last 30 days</span></div>
    </div>
    <div class="card"><h2>Pipeline by stage <span>Sales</span></h2>
      <div class="bar">${stages.map(([, n, color]) => `<i style="flex:${n};background:${color}"></i>`).join("")}</div>
      ${stages.map(([label, n, color]) => `<div class="line"><i class="dot" style="background:${color}"></i><span class="body" style="flex:1">${label}</span><span class="muted">${n}</span></div>`).join("")}
    </div>
    <div class="card"><h2>Billing <span>Invoices</span></h2>
      <div class="pad"><div class="small">Outstanding balance</div><div style="font-size:22px;font-weight:600">₹2,18,300.00</div><div class="small">1 open invoice, none overdue</div></div>
    </div>
    <div class="card"><h2>Engagements</h2>
      <div class="pad">
        <div style="display:flex;justify-content:space-between;gap:8px"><div><b>Customer support operations</b><div class="small">Support · From 14 Aug 2026</div></div>${badge(scheme, "success", "Active")}</div>
        <div class="row"><div style="flex:1;height:6px;background:${c.paperSoft};border-radius:3px;overflow:hidden"><i style="display:block;width:50%;height:100%;background:${c.success}"></i></div><span class="small">2 of 4 milestones</span></div>
        <div class="small">Next: Weekend coverage · due 23 Oct 2026</div>
      </div>
    </div>`;
}

function messages(scheme) {
  const c = scheme === "dark" ? dark : light;
  const items = [
    ["mine", "", "Hi team, can we move Thursday's review call to Friday?", "15:12"],
    ["staff", "Largis team · Largis", "Of course. Friday at 11:00 IST works for us. I'll send an updated invite.", "15:18"],
    ["mine", "", "Perfect, thanks!", "15:19"],
    ["staff", "Largis team · Largis", "Invite sent. See you Friday.", "15:21"],
  ];
  return `<div class="small" style="text-align:center">13 Oct 2026</div>
    ${items
      .map(
        ([kind, who, text, time]) => `<div class="bubble-row ${kind}">
          ${who ? `<span class="small">${who}</span>` : ""}
          <div class="bubble">${text}</div>
          <span class="small" style="font-size:11px">${time}</span>
        </div>`,
      )
      .join("")}
    <div class="composer" style="margin-top:auto;margin-left:-16px;margin-right:-16px;margin-bottom:-8px;background:${c.surface}">
      <div style="width:32px;text-align:center;color:${c.inkMuted}">＋</div>
      <div class="field">Message the Largis team</div>
      <div class="send">↑</div>
    </div>`;
}

function ticket(scheme) {
  return `
    <div>
      <h1 style="font-size:21px">Weekly order report shows duplicate rows</h1>
      <div class="row">${badge(scheme, "info", "In progress")}${badge(scheme, "warning", "High priority")}</div>
    </div>
    <div class="card"><h2>Service levels</h2>
      <div class="line" style="align-items:flex-start">
        <div style="flex:1"><div class="body">First response</div><div class="small">Target 1h</div></div>
        <div class="small" style="flex:1;text-align:right;color:${tones[scheme].success[0]}">Answered in 0m, within target</div>
      </div>
      <div class="line" style="align-items:flex-start">
        <div style="flex:1"><div class="body">Resolution</div><div class="small">Target 8h</div></div>
        <div class="small" style="flex:1;text-align:right;color:${tones[scheme].danger[0]}">Overdue by 5d (due 13 Oct, 23:55 UTC)</div>
      </div>
    </div>
    <div class="card"><h2>Conversation</h2>
      <div class="pad" style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between"><b style="font-size:13px">App Reviewer</b><span class="small">13 Oct, 15:55 UTC</span></div>
        <div class="small">Opened via client portal</div>
        <div class="body">The order report for last week lists some orders twice. Can you check the export?</div>
      </div>
      <div class="pad" style="border-top:0.5px solid ${scheme === "dark" ? dark.line : light.line};background:${scheme === "dark" ? dark.paperSoft : light.paperSoft}">
        <div style="display:flex;justify-content:space-between"><b style="font-size:13px">Largis team · Largis</b><span class="small">13 Oct, 16:10 UTC</span></div>
        <div class="body" style="margin-top:6px">Thanks for flagging this. We found the cause in the export job and are re-running it now.</div>
      </div>
    </div>`;
}

function sales(scheme) {
  const leads = [
    ["Kestrel Apparel", "$9,600,000", "Daniel Ruiz · Referral", "warning", "Negotiation"],
    ["Brightline Foods", "$4,200,000", "Asha Menon · Inbound", "brand", "Proposal"],
    ["Harbor Pharmacy Group", "$2,750,000", "Meera Iyer · BPO Chat", "info", "Qualified"],
    ["Summit Electronics", "$1,500,000", "Liam Chen · Outbound", "neutral", "New"],
    ["Orchard Home", "$6,800,000", "Priya Nair · Partner", "success", "Closed Won"],
    ["Delta Logistics", "$3,100,000", "Omar Haddad · Inbound", "danger", "Closed Lost"],
  ];
  return `
    <div style="background:${scheme === "dark" ? dark.brand : light.brand};color:white;text-align:center;padding:12px;border-radius:4px;font-weight:600">Add lead</div>
    <div style="border:1px solid ${scheme === "dark" ? dark.line : light.line};background:${scheme === "dark" ? dark.surface : light.surface};border-radius:4px;padding:12px 14px;color:${scheme === "dark" ? dark.inkSubtle : light.inkSubtle}">Search company, contact, or email</div>
    <div class="card"><h2>6 leads <span style="color:${scheme === "dark" ? dark.inkMuted : light.inkMuted};font-weight:400">$27,950,000</span></h2>
      ${leads
        .map(
          ([company, value, meta, tone, label]) => `<div class="pad" style="border-top:0.5px solid ${scheme === "dark" ? dark.line : light.line}">
            <div style="display:flex;gap:8px"><b style="flex:1;font-weight:500">${company}</b><span>${value}</span></div>
            <div class="small">${meta}</div>
            <div class="row">${badge(scheme, tone, label)}</div>
          </div>`,
        )
        .join("")}
    </div>`;
}

function reports() {
  return `
    <div class="muted">Performance and delivery reports the Largis team has published for Northwind Retail (Demo).</div>
    <div class="card"><h2>1 report</h2>
      <div class="pad">
        <b>Monthly support performance</b>
        <div class="small">1 Sep 2026 – 30 Sep 2026</div>
        <div class="muted" style="margin-top:4px">First response times improved 18% while volume grew 12%.</div>
      </div>
    </div>`;
}

function account(scheme) {
  const c = scheme === "dark" ? dark : light;
  return `
    <div class="card"><h2>Profile</h2>
      <div class="pad" style="display:flex;flex-direction:column;gap:12px">
        <div><div class="small">Email</div><div class="body">appreview@largis.co</div></div>
        <div><div class="small">Northwind Retail (Demo)</div><div class="body">Owner</div></div>
        <div class="small">To change your role or email, contact an owner of your organisation or sagar@largis.co.</div>
      </div>
    </div>
    <div class="card"><h2>App lock</h2>
      <div class="pad" style="display:flex;gap:12px;align-items:center">
        <div style="flex:1"><b>Require Face ID</b><div class="small">Asked when you open Largis and after a minute away.</div></div>
        <div class="switch"><i></i></div>
      </div>
    </div>
    <div class="card"><h2>Two-step verification</h2>
      <div class="pad">
        <div class="muted">Protect your account with a 6-digit code from an authenticator app such as Google Authenticator, Microsoft Authenticator, or 1Password.</div>
        <div style="margin-top:12px;background:${c.brand};color:white;text-align:center;padding:12px;border-radius:4px;font-weight:600">Set up authenticator app</div>
      </div>
    </div>
    <div class="card"><h2>Delete account</h2>
      <div class="pad">
        <div class="muted">Deleting your account removes your login and your access to every organisation. Leads, tickets, and reports belong to your organisation and are kept. The Largis team is notified.</div>
        <div class="small" style="margin-top:12px">Type DELETE to confirm</div>
        <div style="margin-top:6px;border:1px solid ${c.line};border-radius:4px;padding:12px;color:${c.inkSubtle}">DELETE</div>
        <div style="margin-top:12px;background:${scheme === "dark" ? "#e5534b" : "#b42318"};color:white;text-align:center;padding:12px;border-radius:4px;font-weight:600">Delete my account</div>
      </div>
    </div>`;
}

const screens = {
  home: { title: "Home", tab: "home", render: home },
  messages: { title: "Messages", tab: "chat", render: messages },
  ticket: { title: "LV-1001", tab: "buoy", render: ticket },
  sales: { title: "Sales", tab: "trend", render: sales },
  reports: { title: "Reports", tab: "more", render: reports },
  account: { title: "Account", tab: "more", render: account },
};

function page({ cssWidth, cssHeight, scale, scheme, platform, tablet, screen }) {
  const c = scheme === "dark" ? dark : light;
  const spec = screens[screen];
  const pxW = cssWidth * scale;
  const pxH = cssHeight * scale;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin:0; width:${pxW}px; height:${pxH}px; overflow:hidden; background:${c.paper}; }
    #frame { width:${cssWidth}px; height:${cssHeight}px; transform: scale(${scale}); transform-origin: top left; }
    ${css(c)}
  </style></head><body><div id="frame">${shell({
    scheme,
    title: spec.title,
    tab: spec.tab,
    platform,
    tablet,
    body: spec.render(scheme),
  })}</div></body></html>`;
}

function shoot(html, out, width, height) {
  const file = join(root, ".frame.html");
  writeFileSync(file, html);
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    `--screenshot=${out}`,
    `file://${file}`,
  ], { stdio: "ignore" });
}

const jobs = [
  { dir: "iphone", w: 440, h: 956, scale: 3, platform: "ios", screens: ["home", "messages", "ticket", "sales", "reports", "account"], dark: ["home"] },
  { dir: "ipad", w: 1032, h: 1376, scale: 2, platform: "ios", tablet: true, screens: ["home", "messages", "sales"], dark: [] },
  { dir: "android", w: 360, h: 800, scale: 3, platform: "android", screens: ["home", "messages", "ticket", "sales", "reports", "account"], dark: ["home"] },
];

for (const job of jobs) {
  const dir = join(root, job.dir);
  mkdirSync(dir, { recursive: true });
  for (const name of job.screens) {
    const out = join(dir, `${name}.png`);
    shoot(page({ cssWidth: job.w, cssHeight: job.h, scale: job.scale, scheme: "light", platform: job.platform, tablet: job.tablet, screen: name }), out, job.w * job.scale, job.h * job.scale);
    console.log(out);
  }
  for (const name of job.dark) {
    const out = join(dir, `${name}-dark.png`);
    shoot(page({ cssWidth: job.w, cssHeight: job.h, scale: job.scale, scheme: "dark", platform: job.platform, tablet: job.tablet, screen: name }), out, job.w * job.scale, job.h * job.scale);
    console.log(out);
  }
}

const feature = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin:0; width:1024px; height:500px; overflow:hidden; background:#0b0b0d; color:white; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .wrap { height:500px; display:flex; align-items:center; padding:0 72px; gap:48px; }
  h1 { font-size:64px; font-weight:600; letter-spacing:-1px; margin:0 0 8px; }
  p { margin:0; font-size:24px; color:#c9a467; }
  .sub { margin-top:14px; font-size:18px; color:#b6b9c2; }
</style></head><body><div class="wrap">
  <img src="file://${join(root, "../../assets/icon.png")}" width="220" height="220" alt="">
  <div><h1>Largis</h1><p>Your client portal</p><div class="sub">Messages, support tickets, sales, reports, and billing.</div></div>
</div></body></html>`;
shoot(feature, join(root, "feature-graphic.png"), 1024, 500);
console.log(join(root, "feature-graphic.png"));
rmSync(join(root, ".frame.html"), { force: true });
