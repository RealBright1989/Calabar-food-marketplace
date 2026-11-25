/**
 * Dirty Dozen Security Rules Verification Matrix
 * Documents the 12 adversarial payloads tested against firestore.rules invariants.
 * All 12 payloads are blocked by explicit rule gates and yield PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: string;
  title: string;
  actorRole: 'anonymous' | 'customer' | 'vendor' | 'admin' | 'unverified-email';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByGate: string;
}

export const DIRTY_DOZEN_PAYLOADS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    title: 'Self-assigned admin role during user creation',
    actorRole: 'customer',
    operation: 'create',
    path: '/users/cust_attacker',
    payload: {
      uid: 'cust_attacker',
      displayName: 'Attacker',
      role: 'admin',
      accountStatus: 'Active',
      totalOrders: 0,
      totalSpent: 0,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: "incoming().role == 'customer'",
  },
  {
    id: 'DD-02',
    title: 'Unverified admin email spoofing attempt',
    actorRole: 'unverified-email',
    operation: 'get',
    path: '/activityLogs/log_1',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: 'request.auth.token.email_verified == true',
  },
  {
    id: 'DD-03',
    title: 'Shadow ghost field injection on user profile update',
    actorRole: 'customer',
    operation: 'update',
    path: '/users/cust_1',
    payload: {
      displayName: 'Ekaette Bassey',
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: "affectedKeys().hasOnly(['displayName', 'neighbourhood', 'updatedAt'])",
  },
  {
    id: 'DD-04',
    title: 'Cross-customer private PII read',
    actorRole: 'customer',
    operation: 'get',
    path: '/users/cust-2/private/info',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: 'request.auth.uid == userId || isAdmin()',
  },
  {
    id: 'DD-05',
    title: 'Cross-vendor order data snooping',
    actorRole: 'vendor',
    operation: 'get',
    path: '/orders/ord-101',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: 'existing().restaurantOwnerUid == request.auth.uid',
  },
  {
    id: 'DD-06',
    title: 'Suspended vendor attempts to self-activate restaurant',
    actorRole: 'vendor',
    operation: 'update',
    path: '/restaurants/rest-efio-ette',
    payload: {
      status: 'Active',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: 'incoming().status == existing().status',
  },
  {
    id: 'DD-07',
    title: 'Order financial total tampering after placement',
    actorRole: 'vendor',
    operation: 'update',
    path: '/orders/ord-101',
    payload: {
      total: 100,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: "affectedKeys().hasOnly(['status', 'updatedAt'])",
  },
  {
    id: 'DD-08',
    title: 'Transaction ledger commission/payout manipulation',
    actorRole: 'admin',
    operation: 'update',
    path: '/transactions/txn-101',
    payload: {
      commissionAmount: 0,
      vendorPayout: 999999,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate:
      "incoming().commissionAmount == existing().commissionAmount && affectedKeys().hasOnly(['verificationStatus', 'verifiedByUid', 'verifiedAt'])",
  },
  {
    id: 'DD-09',
    title: 'Activity audit log deletion attempt',
    actorRole: 'admin',
    operation: 'delete',
    path: '/activityLogs/log-1',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: 'allow update, delete: if false;',
  },
  {
    id: 'DD-10',
    title: 'Vendor reverts terminal Delivered order status',
    actorRole: 'vendor',
    operation: 'update',
    path: '/orders/ord-103',
    payload: {
      status: 'Preparing your food',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: "existing().status != 'Delivered' && existing().status != 'Cancelled'",
  },
  {
    id: 'DD-11',
    title: 'Document ID path poisoning with invalid characters',
    actorRole: 'customer',
    operation: 'create',
    path: '/orders/bad$id..hack',
    payload: {
      id: 'bad$id..hack',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: "isValidId(orderId) -> matches('^[a-zA-Z0-9_\\\\-]+$')",
  },
  {
    id: 'DD-12',
    title: 'Forged client-side createdAt timestamp on order creation',
    actorRole: 'customer',
    operation: 'create',
    path: '/orders/ord-999',
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByGate: 'incoming().createdAt == request.time',
  },
];
