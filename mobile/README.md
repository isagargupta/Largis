# Largis mobile app

The Largis Venture client portal for iOS and Android, built with Expo (SDK 57) and Expo Router. Clients sign in with the same emailed code as `app.largis.co` and get Home, Messages, Support, Sales, Reports, Billing, and Account.

The app reads data straight from Supabase with the publishable key, so row-level security applies as on the web. Writes go through the website's `/api/mobile/*` routes, which reuse the portal's server actions.

## Run it

```sh
cd mobile
npm install
npm start
```

Scan the QR code with the iPhone Camera app, or from inside Expo Go on Android. `npm start` runs `expo start --go` with `EXPO_NO_REDIRECT_PAGE=1`: because `expo-dev-client` is installed, a plain `npx expo start` targets a development build or shows a "choose an app" page, and Expo Go can't open either. Your phone and Mac must be on the same Wi-Fi; if they aren't, run `npm start -- --tunnel`.

Push notifications need a development or store build (`npm run start:dev`); Expo Go doesn't support them.

To point the app at a local website, set `EXPO_PUBLIC_API_URL`, for example `http://192.168.1.20:3000`.

## Checks

```sh
npm run typecheck
npm run lint
npx expo-doctor
```

## Builds and push notifications

1. The app is linked to the EAS project `@sgupta43/largis`; its id is the default in `app.config.ts` (override with `EAS_PROJECT_ID`). Push registration is skipped in Expo Go.
2. Run `npx eas-cli@latest build --profile production --platform all`. EAS creates the signing credentials, and the APNs key for iOS push.
3. For Android push, add an FCM V1 service-account key with `npx eas-cli@latest credentials`.
4. Optional: set `EXPO_ACCESS_TOKEN` on Vercel if you enable enhanced push security in Expo.

Identifiers: bundle ID and Android package `co.largis.app`, deep-link scheme `largis://`.

## Store review

Reviewers sign in as `appreview@largis.co` with the fixed code stored in Vercel as `APP_REVIEW_CODE`. No email is sent for that address. It opens the "Northwind Retail (Demo)" organisation with sample data.

Listing text, privacy answers for both stores, and review notes are drafted in [`store/listing.md`](store/listing.md).

## Icons

`npm run icons` re-renders `assets/` from the Largis mark (run `npm i --no-save sharp` first).
