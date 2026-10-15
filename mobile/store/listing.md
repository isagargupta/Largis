# Store listing drafts

Drafts for App Store Connect and Google Play Console. Character limits are noted where the stores enforce them; every field below fits.

## Shared details

| Field | Value |
| --- | --- |
| App name | Largis |
| Bundle ID / package | `co.largis.app` |
| Category | Business (secondary: Productivity) |
| Price | Free, no in-app purchases |
| Age rating | 4+ (Apple), Everyone (Google): no objectionable content, no user-to-public sharing |
| Privacy policy URL | https://largis.co/legal/privacy |
| Account deletion URL | https://largis.co/legal/delete-account |
| Terms URL | https://largis.co/legal/terms |
| Support URL | https://largis.co/contact |
| Marketing URL | https://largis.co |
| Support email | sagar@largis.co |
| Copyright | © 2026 Largis Venture |

The app is for existing Largis clients. People can't create an organisation from the app; access starts with an invitation from Largis or from their organisation's owner. Say so in review notes (below) so reviewers don't treat it as a broken sign-up.

## App Store (Apple)

**Subtitle** (30 max)

> Your Largis client portal

**Promotional text** (170 max, can change without a new build)

> Message your Largis account team, follow support tickets against their service levels, and check reports, invoices, and your sales pipeline from your phone.

**Description** (4,000 max)

> Largis is the client portal for businesses that work with Largis Venture. Everything your team sees at app.largis.co, in your pocket.
>
> MESSAGES
> Chat directly with your Largis account team. Send screenshots, photos, PDFs, and Office documents, and get a notification as soon as someone replies.
>
> SUPPORT
> Open tickets, reply, attach files, and see where each request stands. Every ticket shows its first-response and resolution targets, so you always know what to expect and when.
>
> SALES
> Review your pipeline by stage, open any lead for its contact details and value, and keep notes up to date while you're away from your desk.
>
> REPORTS AND BILLING
> Read the reports Largis prepares for you, share them with colleagues, and check invoices and payment status at a glance.
>
> TEAM
> Owners and admins can see who has access, invite colleagues, change roles, and remove people who have left.
>
> SECURE BY DEFAULT
> • Sign in with a one-time code sent to your email, no password to remember
> • Two-step verification with an authenticator app
> • Optional Face ID, Touch ID, or fingerprint lock
> • Your organisation's data is isolated from every other client's
> • Files are stored privately and opened through short-lived links
>
> Largis is available to Largis Venture clients. If your organisation works with us and you don't have access yet, ask your organisation's owner or contact your account team.

**Keywords** (100 max, comma-separated, no spaces needed)

> client portal,support,tickets,sla,reports,invoices,billing,sales,leads,chat,account manager

**What's new** (first release)

> First release of the Largis app: messages, support tickets, sales pipeline, reports, billing, and team management for Largis clients.

### App Privacy ("nutrition label")

Tracking: **No**. The app has no advertising, analytics, or third-party tracking SDKs. Crash reports go to Sentry without any user identity.

Data linked to the user (all used for **App Functionality** only; none used for tracking, advertising, or analytics):

| Apple category | Data type | Why |
| --- | --- | --- |
| Contact Info | Name | Profile shown to your team and Largis staff |
| Contact Info | Email Address | Sign-in codes, notifications, account |
| User Content | Photos or Videos | Images attached to messages and tickets (photos only, no video) |
| User Content | Customer Support | Support tickets and replies |
| User Content | Other User Content | Chat messages, documents, sales leads and notes |
| Identifiers | User ID | Account ID used to load your organisation's data |

Data **not linked** to the user:

| Apple category | Data type | Why |
| --- | --- | --- |
| Diagnostics | Crash Data | Crash and error reports (Sentry), used for App Functionality |

Not collected: location, contacts, health, financial info (invoices are shown, but no payment details are entered in the app), browsing history, search history, purchases, performance data, sensitive info.

Push notification tokens are stored to deliver notifications and are deleted on sign-out; Apple doesn't require a separate disclosure for them.

### Review notes (App Review Information)

> Largis is a client portal for existing business clients, so there is no public sign-up. Please use this demo account:
>
> Email: appreview@largis.co
> Sign-in code: [paste the value of APP_REVIEW_CODE from Vercel]
>
> Enter the email, tap Continue, then enter the code. No email is sent to this address; the code is fixed for review. The account opens a demo organisation, "Northwind Retail (Demo)", with sample messages, tickets, leads, reports, and invoices.
>
> Account deletion: More → Account → Delete account. A web page with the same steps is at https://largis.co/legal/delete-account.
>
> Face ID is optional (More → Account → App lock). Camera and photo access are only requested when attaching a photo to a message or ticket.

Sign-in fields: tick "Sign-in required" and enter the email above; put the code in the password field.

## Google Play

**Short description** (80 max)

> Message your Largis team, track support tickets, and check reports on the go.

**Full description** (4,000 max): use the App Store description above; Play allows the same text.

**App category:** Business. **Tags:** Business, Productivity, Customer support.

**Contact details:** email sagar@largis.co, website https://largis.co.

### Data safety form

- Does the app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS/TLS everywhere)
- Do you provide a way for users to request that their data is deleted? **Yes**: in the app (More → Account) and at https://largis.co/legal/delete-account
- Shared with third parties: **No** (Supabase, Vercel, Expo push, Resend, and Sentry act as service providers, which Play doesn't count as sharing)

| Play category | Data type | Collected | Optional? | Purposes |
| --- | --- | --- | --- | --- |
| Personal info | Name | Yes | Optional | App functionality, Account management |
| Personal info | Email address | Yes | Required | App functionality, Account management, Developer communications |
| Personal info | User IDs | Yes | Required | App functionality, Account management |
| Messages | Other in-app messages | Yes | Optional | App functionality |
| Photos and videos | Photos | Yes | Optional | App functionality |
| Files and docs | Files and docs | Yes | Optional | App functionality |
| Device or other IDs | Device or other IDs (push token) | Yes | Optional | App functionality (notifications) |
| App info and performance | Crash logs | Yes | Required | Analytics (diagnosing and fixing crashes) |
| App info and performance | Diagnostics | Yes | Required | Analytics (diagnosing and fixing crashes) |

None of the data is processed ephemerally only, and none is used for advertising or analytics.

### Other Play declarations

- **Ads:** No ads.
- **App access:** "All or some functionality is restricted." Add the same demo email, plus instructions to enter the code from `APP_REVIEW_CODE`.
- **Target audience:** 18 and over. Not designed for children.
- **News app:** No. **Government app:** No. **Financial features:** None. **Health:** None.
- **Permissions:** camera and photos only when attaching files; notifications; biometric for the optional app lock.
- **Account deletion:** in-app path plus the web URL above (Play requires the web URL).

## Screenshots to capture

Use the review account on a light theme, plus one dark-mode shot.

- iPhone 6.9" (1320×2868) and iPad 13" (2064×2752), because the app supports tablets (content is centred at a readable width on iPad)
- Android phone (1080×1920 or larger), plus a 1024×500 feature graphic

Suggested order: Home overview, Messages with an image attachment, a support ticket with service levels, Sales pipeline, Reports, Account with Face ID lock, any screen in dark mode.
