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
