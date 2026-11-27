<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ad39e5a3-c3ad-48b4-bd40-1db033f8742a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
4. Open `http://localhost:3000` on the computer running the app. If you open it from another device
   (for example `http://10.10.3.126:3000`), add that hostname in Firebase Console > Authentication >
   Settings > Authorized domains, or Google sign-in will fail with `auth/unauthorized-domain`.
   The app cache-busts Firebase's project-config request so a stale allowlist is not reused after
   you add a domain.
5. In Firebase Console > Authentication > Sign-in method, enable **Email/Password**. The sign-in
   modal then supports email sign-in and customer account creation. New accounts are customers;
   vendor, admin, and super-admin roles are assigned in Firestore after approval.

## Paystack gateway

The app ships with a sandbox **Test Preview** mode that simulates payments locally. **Live** mode
uses a small Express gateway in `server/paystack.js`:

- `POST /api/payments/initialize` verifies the Firebase ID token, stores a server-only payment
  session, and initializes a Paystack transaction.
- Paystack Inline handles card/bank details in its own secure popup.
- `POST /api/payments/verify` verifies the reference with Paystack and atomically creates the paid
  order and ledger transaction.
- `POST /api/payments/webhook` verifies the Paystack HMAC signature and finalizes payments
  idempotently.

Copy `.env.example` to `.env.local` and set:

- `VITE_PAYSTACK_PUBLIC_KEY` — Paystack public key (browser-safe)
- `PAYSTACK_SECRET_KEY` — Paystack secret key (server only)
- `PAYSTACK_WEBHOOK_SECRET` — Paystack webhook signing secret (server only)
- `FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS` — Firebase Admin credentials
- `FIREBASE_FIRESTORE_DATABASE_ID` — Firestore database id

Run the gateway alongside Vite:

```bash
npm run server
npm run dev
```

Vite proxies `/api/payments` to `http://localhost:3001` in development. For production, run
`npm run build`, then `npm start`; the gateway serves `dist/` and `/api/payments` from the same
origin. Configure Paystack's webhook URL as `https://your-domain/api/payments/webhook`.

After adding keys to `.env.local`, restart the gateway and open
`http://localhost:3001/api/payments/health`. It reports only missing key names, never key values.
Do not commit `.env.local` or service-account JSON.

## Delivery map and distance pricing

Checkout includes an interactive map. Customers can search an address, click the map, drag the
green marker, or use browser location. The selected coordinates, road distance, travel time, and
delivery fee are carried into the order and the Paystack payment session.

The default map needs no API key: it uses OpenStreetMap tiles, Nominatim address search, and the
public OSRM demo router. Those free services are rate-limited, so for production traffic set
`VITE_GOOGLE_MAPS_API_KEY` in `.env.local` and enable:

- Maps JavaScript API
- Places API (New) or Places API
- Geocoding API
- Distance Matrix API
- Maps Static API

The pricing rule lives in `shared/delivery.js` and is reused by the gateway, so customer and server
totals follow the same formula:

- restaurant's base delivery fee covers the first 2 km
- `₦150` is added for each extra kilometre
- total delivery fee is capped at `₦3000`

Server pricing is authoritative and ignores client-supplied prices. It prefers Google Distance
Matrix when `GOOGLE_MAPS_SERVER_KEY` is set, then uses the free OSRM route, then falls back to the
shared coordinate estimate. `GET /api/payments/health` reports key names that are missing without
printing any secret values.
