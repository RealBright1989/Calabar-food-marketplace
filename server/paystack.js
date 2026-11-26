import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3001);
const PAYSTACK_API = 'https://api.paystack.co';
const SESSION_TTL_MS = 15 * 60 * 1000;
const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

function readFirebaseConfig() {
  try {
    return JSON.parse(readFileSync(path.join(ROOT_DIR, 'firebase-applet-config.json'), 'utf8'));
  } catch {
    return {};
  }
}

const FIREBASE_CONFIG = readFirebaseConfig();
const FIRESTORE_DATABASE_ID =
  process.env.FIREBASE_FIRESTORE_DATABASE_ID || FIREBASE_CONFIG.firestoreDatabaseId || '(default)';

let adminApp = null;
let adminInitError = '';

function getAdminApp() {
  if (getApps().length) return getApp();
  if (adminApp) return adminApp;
  if (adminInitError) return null;

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      adminApp = initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
      return adminApp;
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      adminApp = initializeApp({ credential: applicationDefault() });
      return adminApp;
    }
    adminInitError =
      'Firebase Admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.';
    return null;
  } catch (error) {
    adminInitError = error instanceof Error ? error.message : 'Invalid Firebase Admin credentials.';
    return null;
  }
}

function getDb() {
  const app = getAdminApp();
  if (!app) throw new Error(adminInitError || 'Firebase Admin is not configured.');
  return getFirestore(app, FIRESTORE_DATABASE_ID);
}

function getAdminAuth() {
  const app = getAdminApp();
  if (!app) throw new Error(adminInitError || 'Firebase Admin is not configured.');
  return getAuth(app);
}

function gatewayConfigError() {
  const missing = [];
  if (!process.env.PAYSTACK_SECRET_KEY) missing.push('PAYSTACK_SECRET_KEY');
  if (!getAdminApp()) {
    missing.push(
      adminInitError || 'FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS',
    );
  }
  if (missing.length === 0) return null;
  return `Payment gateway is not configured: ${missing.join(', ')}.`;
}

function cleanString(value, maxLength, minLength = 1) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) return null;
  return trimmed;
}

function cleanAmount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function normalizeOrderDraft(input, uid) {
  if (!input || typeof input !== 'object') return null;

  const rawItems = Array.isArray(input.items) ? input.items.slice(0, 50) : [];
  const items = rawItems
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const menuItemId = cleanString(item.menuItemId, 128);
      const name = cleanString(item.name, 160);
      const quantity = cleanAmount(item.quantity);
      const unitPrice = cleanAmount(item.unitPrice);
      if (!menuItemId || !name || !quantity || quantity < 1 || unitPrice === null) return null;
      return {
        menuItemId,
        name,
        quantity,
        unitPrice,
        optionsText: cleanString(item.optionsText, 240, 0) || undefined,
      };
    })
    .filter(Boolean);

  const id = cleanString(input.id, 128);
  const orderNumber = cleanString(input.orderNumber, 40, 3);
  const customerName = cleanString(input.customerName, 120);
  const customerPhone = cleanString(input.customerPhone, 40, 5);
  const deliveryAddress = cleanString(input.deliveryAddress, 240, 3);
  const neighbourhood = cleanString(input.neighbourhood, 80, 2);
  const restaurantId = cleanString(input.restaurantId, 128);
  const restaurantOwnerUid = cleanString(input.restaurantOwnerUid, 128);
  const restaurantName = cleanString(input.restaurantName, 140, 2);
  const restaurantAddress = cleanString(input.restaurantAddress, 240, 0) || undefined;
  const restaurantPhone = cleanString(input.restaurantPhone, 40, 5);
  const estimatedDelivery = cleanString(input.estimatedDelivery, 60, 2);
  const placedAt = cleanString(input.placedAt, 60, 8) || new Date().toISOString();
  const deliveryInstructions = cleanString(input.deliveryInstructions, 300, 0) || undefined;
  const subtotal = cleanAmount(input.subtotal);
  const deliveryFee = cleanAmount(input.deliveryFee);
  const serviceCharge = cleanAmount(input.serviceCharge);
  const total = cleanAmount(input.total);
  const commissionRatePercent = cleanAmount(input.commissionRatePercent);

  const computedSubtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  if (
    !id ||
    !orderNumber ||
    !customerName ||
    !customerPhone ||
    !deliveryAddress ||
    !neighbourhood ||
    !restaurantId ||
    !restaurantOwnerUid ||
    !restaurantName ||
    !restaurantPhone ||
    !estimatedDelivery ||
    items.length === 0 ||
    subtotal === null ||
    deliveryFee === null ||
    serviceCharge === null ||
    total === null ||
    commissionRatePercent === null ||
    commissionRatePercent > 40 ||
    subtotal !== computedSubtotal ||
    total !== subtotal + deliveryFee + serviceCharge
  ) {
    return null;
  }

  return {
    id,
    orderNumber,
    customerId: uid,
    customerName,
    customerPhone,
    deliveryAddress,
    neighbourhood,
    deliveryInstructions,
    restaurantId,
    restaurantOwnerUid,
    restaurantName,
    restaurantAddress,
    restaurantPhone,
    items,
    subtotal,
    deliveryFee,
    serviceCharge,
    total,
    commissionRatePercent,
    estimatedDelivery,
    placedAt,
  };
}

async function applyServerPricing(order, db) {
  const restaurantSnap = await db.collection('restaurants').doc(order.restaurantId).get();
  if (!restaurantSnap.exists) return null;
  const restaurant = restaurantSnap.data() || {};
  const settingsSnap = await db.doc('settings/marketplace').get();
  const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};

  const deliveryFee = cleanAmount(restaurant.deliveryFee);
  const serviceCharge = cleanAmount(settings.serviceChargeFlat);
  const commissionRatePercent = cleanAmount(settings.commissionRatePercent);
  if (deliveryFee === null || serviceCharge === null) return null;

  return {
    ...order,
    restaurantOwnerUid: cleanString(restaurant.ownerUid, 128) || order.restaurantOwnerUid,
    restaurantName: cleanString(restaurant.name, 140, 2) || order.restaurantName,
    restaurantAddress: cleanString(restaurant.address, 240, 0) || order.restaurantAddress,
    restaurantPhone: cleanString(restaurant.phone, 40, 5) || order.restaurantPhone,
    deliveryFee,
    serviceCharge,
    total: order.subtotal + deliveryFee + serviceCharge,
    commissionRatePercent:
      commissionRatePercent !== null && commissionRatePercent <= 40
        ? commissionRatePercent
        : order.commissionRatePercent,
  };
}

function makeReference() {
  const stamp = Date.now().toString().slice(-8);
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `PSK-CAL-${stamp}-${suffix}`;
}

async function paystackRequest(apiPath, options = {}) {
  const response = await fetch(`${PAYSTACK_API}${apiPath}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status === false) {
    throw new Error(payload.message || `Paystack request failed (${response.status}).`);
  }
  return payload.data;
}

async function verifyIdToken(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Sign in again before starting a payment.' });
    return null;
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!decoded.email_verified) {
      res.status(403).json({ error: 'Please verify your email before paying.' });
      return null;
    }
    return decoded;
  } catch {
    res.status(401).json({ error: 'Your sign-in session expired. Please sign in again.' });
    return null;
  }
}

function safeDocId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140);
}

function matchesPaystackSuccess(data, session) {
  return (
    data &&
    data.status === 'success' &&
    data.amount === session.amountKobo &&
    data.currency === 'NGN' &&
    data.reference === session.reference
  );
}

async function finalizePayment(session, paystackData) {
  const db = getDb();
  const reference = session.reference;
  const transactionId = safeDocId(`txn_${reference}`);
  const transactionRef = db.collection('transactions').doc(transactionId);
  const sessionRef = db.collection('paymentSessions').doc(reference);
  const orderRef = db.collection('orders').doc(safeDocId(session.order.id));

  const existingTransaction = await transactionRef.get();
  if (existingTransaction.exists && existingTransaction.data()?.verificationStatus === 'Verified') {
    const existing = existingTransaction.data();
    return { orderId: existing.orderId, transactionId };
  }

  const settingsSnap = await db.doc('settings/marketplace').get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const autoAcceptOrders = settings.autoAcceptOrders === true;
  const commissionRatePercent =
    typeof settings.commissionRatePercent === 'number' &&
    settings.commissionRatePercent >= 0 &&
    settings.commissionRatePercent <= 40
      ? settings.commissionRatePercent
      : session.order.commissionRatePercent;
  const commissionAmount = Math.round((session.order.subtotal * commissionRatePercent) / 100);
  const vendorPayout = Math.max(0, session.order.subtotal - commissionAmount);
  const paidAt =
    cleanString(paystackData.paidAt, 60, 8) || new Date().toISOString();

  const order = {
    ...session.order,
    id: orderRef.id,
    status: autoAcceptOrders ? 'Vendor accepted' : 'Payment confirmed',
    paymentStatus: 'Paid',
    paymentMethod: 'Paystack',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  delete order.commissionRatePercent;

  const transaction = {
    id: transactionId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    restaurantId: order.restaurantId,
    restaurantOwnerUid: order.restaurantOwnerUid,
    restaurantName: order.restaurantName,
    customerId: order.customerId,
    customerName: order.customerName,
    reference,
    gateway: 'Paystack',
    type: 'Charge',
    grossAmount: order.total,
    subtotalAmount: order.subtotal,
    commissionRatePercent,
    commissionAmount,
    vendorPayout,
    serviceCharge: order.serviceCharge,
    verificationStatus: 'Verified',
    verifiedByUid: 'paystack-server',
    verifiedAt: paidAt,
    createdAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  batch.set(orderRef, order);
  batch.set(transactionRef, transaction);
  batch.set(db.collection('activityLogs').doc(safeDocId(`log_${reference}`)), {
    actorUid: order.customerId,
    actorEmail: session.email || '',
    action: 'Paystack Payment Verified',
    targetType: 'Order',
    targetId: order.id,
    summary: `Paystack payment ${reference} verified for order ${order.orderNumber}.`,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.update(sessionRef, {
    status: 'paid',
    orderId: order.id,
    transactionId,
    paidAt,
    verifiedAt: paidAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return { orderId: order.id, transactionId };
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret || typeof signature !== 'string') return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.PAYMENT_CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.post(
  '/api/payments/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  async (req, res) => {
    const configError = gatewayConfigError();
    if (configError || !process.env.PAYSTACK_WEBHOOK_SECRET) {
      res.status(503).json({ error: configError || 'Paystack webhook secret is not configured.' });
      return;
    }
    if (!verifyWebhookSignature(req.body, req.headers['x-paystack-signature'])) {
      res.status(401).json({ error: 'Invalid Paystack webhook signature.' });
      return;
    }

    let event;
    try {
      event = JSON.parse(req.body.toString('utf8'));
    } catch {
      res.status(400).json({ error: 'Invalid webhook payload.' });
      return;
    }

    if (event.event === 'charge.success' && event.data?.reference) {
      try {
        const db = getDb();
        const sessionRef = db.collection('paymentSessions').doc(event.data.reference);
        const snap = await sessionRef.get();
        if (snap.exists && snap.data()?.status !== 'paid') {
          const session = snap.data();
          if (matchesPaystackSuccess(event.data, session)) {
            await finalizePayment(session, event.data);
          }
        }
      } catch (error) {
        console.error('Paystack webhook finalization failed:', error);
        res.status(500).json({ error: 'Webhook processing failed.' });
        return;
      }
    }

    res.sendStatus(200);
  },
);

app.use(express.json({ limit: '512kb' }));

app.get('/api/payments/health', (_req, res) => {
  res.json({ ok: true, configured: gatewayConfigError() === null });
});

app.post('/api/payments/initialize', async (req, res) => {
  const configError = gatewayConfigError();
  if (configError) {
    res.status(503).json({ error: configError });
    return;
  }

  const decoded = await verifyIdToken(req, res);
  if (!decoded) return;

  const draft = normalizeOrderDraft(req.body?.order, decoded.uid);
  if (!draft) {
    res.status(400).json({ error: 'The checkout details are incomplete or invalid.' });
    return;
  }

  const db = getDb();
  const order = await applyServerPricing(draft, db);
  if (!order) {
    res.status(400).json({ error: 'The selected kitchen or marketplace pricing is unavailable.' });
    return;
  }

  const reference = makeReference();
  const sessionRef = db.collection('paymentSessions').doc(reference);
  const amountKobo = order.total * 100;

  await sessionRef.set({
    reference,
    uid: decoded.uid,
    email: decoded.email || '',
    amountKobo,
    currency: 'NGN',
    order,
    status: 'initializing',
    expiresAt: Date.now() + SESSION_TTL_MS,
    refundWindowExpiresAt: Date.now() + REFUND_WINDOW_MS,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const payment = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: {
        email: decoded.email || '',
        amount: amountKobo,
        currency: 'NGN',
        reference,
        callback_url: process.env.PAYMENT_RETURN_URL || undefined,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: decoded.uid,
          customerName: order.customerName,
          restaurantName: order.restaurantName,
          custom_fields: [
            {
              display_name: 'Order number',
              variable_name: 'order_number',
              value: order.orderNumber,
            },
          ],
        },
      },
    });

    await sessionRef.update({
      authorizationUrl: payment.authorization_url || '',
      accessCode: payment.access_code || '',
      status: 'initialized',
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({
      reference,
      accessCode: payment.access_code || '',
      authorizationUrl: payment.authorization_url || '',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Paystack initialization failed.';
    await sessionRef.update({
      status: 'failed',
      error: message.slice(0, 400),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.status(502).json({ error: message });
  }
});

app.post('/api/payments/verify', async (req, res) => {
  const configError = gatewayConfigError();
  if (configError) {
    res.status(503).json({ error: configError });
    return;
  }

  const decoded = await verifyIdToken(req, res);
  if (!decoded) return;

  const reference = cleanString(req.body?.reference, 80);
  if (!reference) {
    res.status(400).json({ error: 'A payment reference is required.' });
    return;
  }

  try {
    const db = getDb();
    const sessionRef = db.collection('paymentSessions').doc(reference);
    const snap = await sessionRef.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Payment session not found.' });
      return;
    }

    const session = snap.data();
    if (session.uid !== decoded.uid) {
      res.status(403).json({ error: 'This payment belongs to another account.' });
      return;
    }
    if (session.status === 'paid' && session.orderId && session.transactionId) {
      res.json({
        verified: true,
        orderId: session.orderId,
        transactionId: session.transactionId,
        reference,
      });
      return;
    }
    if (Date.now() > session.expiresAt) {
      res.status(410).json({ error: 'This payment session has expired. Please try again.' });
      return;
    }

    const payment = await paystackRequest(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    if (!matchesPaystackSuccess(payment, session)) {
      await sessionRef.update({
        status: 'failed',
        error: 'Paystack did not confirm this payment.',
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(402).json({ error: 'Paystack did not confirm a successful payment.' });
      return;
    }

    const result = await finalizePayment(session, payment);
    res.json({ verified: true, ...result, reference });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment verification failed.';
    res.status(502).json({ error: message });
  }
});

const distDir = path.join(ROOT_DIR, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    next();
    return;
  }
  res.sendFile(path.join(distDir, 'index.html'), (error) => {
    if (error) next();
  });
});

app.use((error, _req, res, _next) => {
  console.error('Payment gateway error:', error);
  res.status(500).json({ error: 'The payment gateway could not complete this request.' });
});

app.listen(PORT, () => {
  console.log(`Calabar payment gateway listening on http://localhost:${PORT}`);
  const configError = gatewayConfigError();
  if (configError) console.warn(configError);
});
