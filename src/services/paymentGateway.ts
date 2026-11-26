import type { DeliverySource } from '../../shared/delivery';
import { GeoPoint } from '../types/marketplace';

export interface PaystackOrderDraft {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  neighbourhood: string;
  deliveryInstructions?: string;
  pickupLocation: GeoPoint;
  deliveryLocation: GeoPoint;
  deliveryDistanceKm: number;
  deliveryDurationMin: number;
  locationSource: DeliverySource;
  restaurantId: string;
  restaurantOwnerUid: string;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone: string;
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    optionsText?: string;
  }>;
  subtotal: number;
  deliveryFee: number;
  serviceCharge: number;
  total: number;
  commissionRatePercent: number;
  estimatedDelivery: string;
  placedAt: string;
}

export interface InitializePaymentResponse {
  reference: string;
  accessCode: string;
  authorizationUrl: string;
}

export interface VerifyPaymentResponse {
  verified: boolean;
  reference: string;
  orderId: string;
  transactionId: string;
}

interface PaystackCheckoutOptions {
  key: string;
  email: string;
  amount: number;
  currency?: string;
  reference: string;
  accessCode?: string;
  access_code?: string;
  onSuccess: (response: { reference?: string }) => void;
  onClose: () => void;
}

interface PaystackInlineHandler {
  newTransaction: () => void;
}

interface PaystackInlineFactory {
  new: (options: PaystackCheckoutOptions) => PaystackInlineHandler;
}

declare global {
  interface Window {
    PaystackPop?: PaystackInlineFactory;
  }
}

const API_BASE = (import.meta.env.VITE_PAYMENT_API_BASE || '').replace(/\/$/, '');
const PAYSTACK_SCRIPT_URL = 'https://js.paystack.co/v1/inline.js';

async function postJson<T>(path: string, body: unknown, idToken: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : `Payment request failed (${response.status}).`,
    );
  }
  return payload as T;
}

export function getPaystackPublicKey(): string {
  return import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';
}

export async function initializePaystackPayment(payload: {
  order: PaystackOrderDraft;
  idToken: string;
}): Promise<InitializePaymentResponse> {
  return postJson<InitializePaymentResponse>(
    '/api/payments/initialize',
    { order: payload.order },
    payload.idToken,
  );
}

export async function verifyPaystackPayment(payload: {
  reference: string;
  idToken: string;
}): Promise<VerifyPaymentResponse> {
  return postJson<VerifyPaymentResponse>(
    '/api/payments/verify',
    { reference: payload.reference },
    payload.idToken,
  );
}

function loadPaystackScript(): Promise<PaystackInlineFactory> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Paystack is only available in a browser.'));
  }
  if (window.PaystackPop) return Promise.resolve(window.PaystackPop);

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${PAYSTACK_SCRIPT_URL}"]`,
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => {
        if (window.PaystackPop) resolve(window.PaystackPop);
        else reject(new Error('Paystack could not be loaded.'));
      });
      existing.addEventListener('error', () =>
        reject(new Error('Paystack could not be loaded. Check your connection and retry.')),
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PAYSTACK_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.PaystackPop) resolve(window.PaystackPop);
      else reject(new Error('Paystack could not be loaded.'));
    };
    script.onerror = () =>
      reject(new Error('Paystack could not be loaded. Check your connection and retry.'));
    document.head.appendChild(script);
  });
}

export async function openPaystackCheckout(options: {
  email: string;
  amount: number;
  reference: string;
  accessCode: string;
  publicKey: string;
}): Promise<string | null> {
  const paystack = await loadPaystackScript();
  return new Promise((resolve, reject) => {
    try {
      const handler = paystack.new({
        key: options.publicKey,
        email: options.email,
        amount: Math.round(options.amount * 100),
        currency: 'NGN',
        reference: options.reference,
        access_code: options.accessCode,
        onSuccess: (response) => resolve(response.reference || options.reference),
        onClose: () => resolve(null),
      });
      handler.newTransaction();
    } catch (error) {
      reject(
        error instanceof Error
          ? error
          : new Error('Paystack checkout could not be opened.'),
      );
    }
  });
}
