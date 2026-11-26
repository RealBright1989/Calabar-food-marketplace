import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  IMAGES,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_CUSTOMERS,
  INITIAL_DISPUTES,
  INITIAL_FOOD_CATEGORIES,
  INITIAL_MENU_ITEMS,
  INITIAL_ORDERS,
  INITIAL_RESTAURANTS,
  INITIAL_SETTINGS,
  INITIAL_TRANSACTIONS,
  INITIAL_VENDOR_APPLICATIONS,
} from '../data/calabarData';
import {
  db,
  getFirestoreErrorMessage,
  handleFirestoreError,
  OperationType,
  reportFirestoreListenerError,
  ROOT_ADMIN_EMAIL,
} from '../lib/firebase';
import {
  ActivityLog,
  Announcement,
  CustomerProfile,
  Dispute,
  FoodCategoryDoc,
  MarketplaceSettings,
  MenuItem,
  NotificationPreferences,
  Order,
  OrderStatus,
  Restaurant,
  TransactionRecord,
  UserRole,
  VendorApplication,
} from '../types/marketplace';

// -----------------------------------------------------------------------------
// Sanitization & Blueprint Boundary Helpers
// -----------------------------------------------------------------------------
function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || `id-${Date.now()}`;
}

function clampStr(val: string | undefined, maxLen: number, fallback = ''): string {
  const text = (val ?? fallback).trim();
  return text.slice(0, maxLen);
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  smsOrderAlerts: true,
  emailReceipts: true,
};

function sanitizeNotificationPreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_NOTIFICATION_PREFERENCES;
  const prefs = value as Partial<NotificationPreferences>;
  return {
    smsOrderAlerts:
      typeof prefs.smsOrderAlerts === 'boolean'
        ? prefs.smsOrderAlerts
        : DEFAULT_NOTIFICATION_PREFERENCES.smsOrderAlerts,
    emailReceipts:
      typeof prefs.emailReceipts === 'boolean'
        ? prefs.emailReceipts
        : DEFAULT_NOTIFICATION_PREFERENCES.emailReceipts,
  };
}

function tsToIso(val: unknown, fallback?: string): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return fallback || new Date().toISOString();
}

export function isQuotaExceededError(err: unknown): boolean {
  const msg = getFirestoreErrorMessage(err).toLowerCase();
  return msg.includes('quota exceeded');
}

function listenerErrorHandler(
  operationType: OperationType,
  path: string,
  onError?: (message: string) => void,
) {
  return (error: unknown) => {
    const message = getFirestoreErrorMessage(error);
    reportFirestoreListenerError(error, operationType, path);
    onError?.(message);
  };
}

// -----------------------------------------------------------------------------
// User Profile & Role Resolution
// -----------------------------------------------------------------------------
export interface ResolvedAuthProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  accountStatus: 'Active' | 'Suspended';
  vendorRestaurantId?: string;
  phone: string;
  neighbourhood: string;
  savedAddresses: CustomerProfile['savedAddresses'];
  notificationPreferences: NotificationPreferences;
  joinedAt: string;
  totalOrders: number;
  totalSpent: number;
}

export async function resolveAndEnsureUserProfile(
  firebaseUser: User,
): Promise<ResolvedAuthProfile> {
  const uid = sanitizeId(firebaseUser.uid);
  const userRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');
  const adminRef = doc(db, 'admins', uid);

  const isRootAdmin =
    Boolean(firebaseUser.emailVerified) &&
    firebaseUser.email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();

  let hasAdminDoc = false;
  try {
    const adminSnap = await getDoc(adminRef);
    hasAdminDoc = adminSnap.exists();
  } catch {
    hasAdminDoc = false;
  }

  let userSnap;
  try {
    userSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }

  let privateSnap;
  try {
    privateSnap = await getDoc(privateRef);
  } catch {
    privateSnap = null;
  }

  const fallbackName = clampStr(
    firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Calabar User',
    120,
  );
  const email = clampStr(firebaseUser.email || 'user@calabarfood.ng', 180);

  if (!userSnap.exists()) {
    const initialRole: UserRole = isRootAdmin
      ? 'super-admin'
      : hasAdminDoc
        ? 'admin'
        : 'customer';
    const joinedAt = new Date().toISOString().slice(0, 10);

    try {
      await setDoc(userRef, {
        uid,
        displayName: fallbackName,
        role: initialRole,
        accountStatus: 'Active',
        neighbourhood: 'State Housing',
        totalOrders: 0,
        totalSpent: 0,
        joinedAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    }

    try {
      await setDoc(privateRef, {
        uid,
        email,
        phone: clampStr(firebaseUser.phoneNumber || '', 40),
        savedAddresses: [],
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}/private/info`);
    }

    if (isRootAdmin && !hasAdminDoc) {
      try {
        await setDoc(adminRef, {
          uid,
          email,
          name: fallbackName,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Root admin token email is already verified by rules
      }
    }

    return {
      uid,
      email,
      displayName: fallbackName,
      role: initialRole,
      accountStatus: 'Active',
      phone: firebaseUser.phoneNumber || '',
      neighbourhood: 'State Housing',
      savedAddresses: [],
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      joinedAt,
      totalOrders: 0,
      totalSpent: 0,
    };
  }

  const data = userSnap.data();
  const privateData = privateSnap?.exists() ? privateSnap.data() : {};
  const storedRole = data.role as UserRole | undefined;
  const effectiveRole: UserRole =
    isRootAdmin || storedRole === 'super-admin'
      ? 'super-admin'
      : hasAdminDoc
        ? 'admin'
        : storedRole || 'customer';

  if (isRootAdmin && !hasAdminDoc) {
    try {
      await setDoc(adminRef, {
        uid,
        email,
        name: clampStr(String(data.displayName || fallbackName), 120),
        createdAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal
    }
  }

  if (!privateSnap?.exists()) {
    try {
      await setDoc(privateRef, {
        uid,
        email,
        phone: '',
        savedAddresses: [],
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal
    }
  }

  return {
    uid,
    email: String(privateData.email || email),
    displayName: String(data.displayName || fallbackName),
    role: effectiveRole,
    accountStatus: (data.accountStatus as 'Active' | 'Suspended') || 'Active',
    vendorRestaurantId: data.vendorRestaurantId ? String(data.vendorRestaurantId) : undefined,
    phone: String(privateData.phone || ''),
    neighbourhood: String(data.neighbourhood || 'State Housing'),
    savedAddresses: Array.isArray(privateData.savedAddresses)
      ? privateData.savedAddresses
      : [],
    notificationPreferences: sanitizeNotificationPreferences(
      privateData.notificationPreferences,
    ),
    joinedAt: String(data.joinedAt || new Date().toISOString().slice(0, 10)),
    totalOrders: Number(data.totalOrders || 0),
    totalSpent: Number(data.totalSpent || 0),
  };
}

// -----------------------------------------------------------------------------
// Admin-Triggered Database Seed (Populates Empty Firestore Collections)
// -----------------------------------------------------------------------------
export async function seedMarketplaceIfEmpty(
  adminUser: User,
  forceReseed = false,
): Promise<boolean> {
  const existingRest = await getDocs(collection(db, 'restaurants'));
  if (!existingRest.empty && !forceReseed) {
    return false;
  }

  const batch = writeBatch(db);
  const demoVendorUid = 'vendor-demo-owner';

  for (const r of INITIAL_RESTAURANTS) {
    const id = sanitizeId(r.id);
    batch.set(
      doc(db, 'restaurants', id),
      omitUndefined({
        ...r,
        id,
        ownerUid: r.ownerUid || demoVendorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  }

  for (const m of INITIAL_MENU_ITEMS) {
    const id = sanitizeId(m.id);
    batch.set(
      doc(db, 'menuItems', id),
      omitUndefined({
        ...m,
        id,
        ownerUid: m.ownerUid || demoVendorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  }

  for (const c of INITIAL_FOOD_CATEGORIES) {
    const id = sanitizeId(c.id);
    batch.set(doc(db, 'foodCategories', id), {
      ...c,
      id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  batch.set(doc(db, 'settings', 'marketplace'), {
    id: 'marketplace',
    ...INITIAL_SETTINGS,
    updatedByUid: sanitizeId(adminUser.uid),
    updatedAt: serverTimestamp(),
  });

  for (const cust of INITIAL_CUSTOMERS) {
    const cid = sanitizeId(cust.id);
    batch.set(doc(db, 'users', cid), {
      uid: cid,
      displayName: clampStr(cust.name, 120),
      role: 'customer',
      accountStatus: 'Active',
      neighbourhood: clampStr(cust.neighbourhood, 80),
      totalOrders: cust.totalOrders,
      totalSpent: cust.totalSpent,
      joinedAt: cust.joinedAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', cid, 'private', 'info'), {
      uid: cid,
      email: clampStr(cust.email, 180),
      phone: clampStr(cust.phone, 40),
      savedAddresses: cust.savedAddresses,
      updatedAt: serverTimestamp(),
    });
  }

  for (const ord of INITIAL_ORDERS) {
    const oid = sanitizeId(ord.id);
    batch.set(
      doc(db, 'orders', oid),
      omitUndefined({
        ...ord,
        id: oid,
        restaurantOwnerUid: ord.restaurantOwnerUid || demoVendorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  }

  for (const txn of INITIAL_TRANSACTIONS) {
    const tid = sanitizeId(txn.id);
    batch.set(
      doc(db, 'transactions', tid),
      omitUndefined({
        ...txn,
        id: tid,
        createdAt: serverTimestamp(),
      }),
    );
  }

  for (const app of INITIAL_VENDOR_APPLICATIONS) {
    const aid = sanitizeId(app.id);
    batch.set(
      doc(db, 'vendorApplications', aid),
      omitUndefined({
        ...app,
        id: aid,
        applicantUid: app.applicantUid || `applicant-${aid}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  }

  for (const disp of INITIAL_DISPUTES) {
    const did = sanitizeId(disp.id);
    batch.set(
      doc(db, 'disputes', did),
      omitUndefined({
        ...disp,
        id: did,
        customerId: disp.customerId || 'cust-3',
        restaurantId: disp.restaurantId || 'rest-creek-seafood',
        restaurantOwnerUid: disp.restaurantOwnerUid || demoVendorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  }

  for (const ann of INITIAL_ANNOUNCEMENTS) {
    const anid = sanitizeId(ann.id);
    batch.set(doc(db, 'announcements', anid), {
      ...ann,
      id: anid,
      createdByUid: sanitizeId(adminUser.uid),
      createdByEmail: clampStr(adminUser.email || ROOT_ADMIN_EMAIL, 180),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const log of INITIAL_ACTIVITY_LOGS) {
    const lid = sanitizeId(log.id);
    batch.set(doc(db, 'activityLogs', lid), {
      ...log,
      id: lid,
      actorUid: sanitizeId(adminUser.uid),
      actorEmail: clampStr(adminUser.email || ROOT_ADMIN_EMAIL, 180),
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch-seed-marketplace');
  }
}

// -----------------------------------------------------------------------------
// Public Storefront Subscriptions
// -----------------------------------------------------------------------------
export function subscribePublicCatalog(callbacks: {
  onRestaurants: (items: Restaurant[]) => void;
  onMenuItems: (items: MenuItem[]) => void;
  onCategories: (items: FoodCategoryDoc[]) => void;
  onSettings: (settings: MarketplaceSettings) => void;
  onAnnouncements: (items: Announcement[]) => void;
  onError?: (message: string) => void;
}): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      collection(db, 'restaurants'),
      (snap) => {
        if (!snap.empty) {
          callbacks.onRestaurants(
            snap.docs.map((d) => ({ ...(d.data() as Restaurant), id: d.id })),
          );
        }
      },
      listenerErrorHandler(OperationType.LIST, 'restaurants', callbacks.onError),
    ),
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'menuItems'),
      (snap) => {
        if (!snap.empty) {
          callbacks.onMenuItems(
            snap.docs.map((d) => ({ ...(d.data() as MenuItem), id: d.id })),
          );
        }
      },
      listenerErrorHandler(OperationType.LIST, 'menuItems', callbacks.onError),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'foodCategories'), orderBy('sortOrder', 'asc')),
      (snap) => {
        if (!snap.empty) {
          callbacks.onCategories(
            snap.docs.map((d) => ({ ...(d.data() as FoodCategoryDoc), id: d.id })),
          );
        }
      },
      listenerErrorHandler(OperationType.LIST, 'foodCategories', callbacks.onError),
    ),
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'marketplace'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          callbacks.onSettings({
            commissionRatePercent: Number(d.commissionRatePercent ?? 12),
            serviceChargeFlat: Number(d.serviceChargeFlat ?? 250),
            defaultDeliveryFee: Number(d.defaultDeliveryFee ?? 850),
            minPlatformOrder: Number(d.minPlatformOrder ?? 1500),
            defaultCity: String(d.defaultCity ?? 'Calabar'),
            paystackMode: (d.paystackMode as 'Test Preview' | 'Live') || 'Test Preview',
            autoAcceptOrders: Boolean(d.autoAcceptOrders),
          });
        }
      },
      listenerErrorHandler(OperationType.GET, 'settings/marketplace', callbacks.onError),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'announcements'), where('isActive', '==', true)),
      (snap) => {
        callbacks.onAnnouncements(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              title: String(raw.title || ''),
              message: String(raw.message || ''),
              targetAudience: (raw.targetAudience as Announcement['targetAudience']) || 'all',
              priority: (raw.priority as Announcement['priority']) || 'Normal',
              isActive: Boolean(raw.isActive),
              createdByUid: String(raw.createdByUid || ''),
              createdByEmail: String(raw.createdByEmail || ''),
              createdAt: tsToIso(raw.createdAt),
            };
          }),
        );
      },
      listenerErrorHandler(OperationType.LIST, 'announcements', callbacks.onError),
    ),
  );

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

// -----------------------------------------------------------------------------
// Role-Scoped Operational Subscriptions (Strict RBAC & Data Isolation)
// -----------------------------------------------------------------------------
export function subscribeRoleOperationalData(
  role: UserRole,
  uid: string,
  callbacks: {
    onOrders: (items: Order[]) => void;
    onTransactions: (items: TransactionRecord[]) => void;
    onApplications: (items: VendorApplication[]) => void;
    onDisputes: (items: Dispute[]) => void;
    onCustomers?: (items: CustomerProfile[]) => void;
    onAllAnnouncements?: (items: Announcement[]) => void;
    onActivityLogs?: (items: ActivityLog[]) => void;
    onError?: (message: string) => void;
  },
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  if (role === 'admin' || role === 'super-admin') {
    unsubs.push(
      onSnapshot(
        collection(db, 'orders'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Order), id: d.id }));
          list.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
          callbacks.onOrders(list);
        },
        listenerErrorHandler(OperationType.LIST, 'orders', callbacks.onError),
      ),
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'transactions'),
        (snap) => {
          const list = snap.docs.map((d) => {
            const raw = d.data();
            return {
              ...(raw as TransactionRecord),
              id: d.id,
              createdAt: tsToIso(raw.createdAt),
            };
          });
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          callbacks.onTransactions(list);
        },
        listenerErrorHandler(OperationType.LIST, 'transactions', callbacks.onError),
      ),
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'vendorApplications'),
        (snap) => {
          const list = snap.docs.map((d) => ({
            ...(d.data() as VendorApplication),
            id: d.id,
          }));
          list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
          callbacks.onApplications(list);
        },
        listenerErrorHandler(OperationType.LIST, 'vendorApplications', callbacks.onError),
      ),
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'disputes'),
        (snap) => {
          const list = snap.docs.map((d) => {
            const raw = d.data();
            return {
              ...(raw as Dispute),
              id: d.id,
              createdAt: tsToIso(raw.createdAt),
            };
          });
          list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          callbacks.onDisputes(list);
        },
        listenerErrorHandler(OperationType.LIST, 'disputes', callbacks.onError),
      ),
    );

    if (callbacks.onCustomers) {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          async (snap) => {
            const profiles: CustomerProfile[] = await Promise.all(
              snap.docs.map(async (uDoc) => {
                const u = uDoc.data();
                let email = '';
                let phone = '';
                let savedAddresses: CustomerProfile['savedAddresses'] = [];
                try {
                  const privSnap = await getDoc(doc(db, 'users', uDoc.id, 'private', 'info'));
                  if (privSnap.exists()) {
                    const p = privSnap.data();
                    email = String(p.email || '');
                    phone = String(p.phone || '');
                    savedAddresses = Array.isArray(p.savedAddresses) ? p.savedAddresses : [];
                  }
                } catch {
                  // Ignore if private info missing
                }
                return {
                  id: uDoc.id,
                  name: String(u.displayName || 'User'),
                  email,
                  phone,
                  neighbourhood: String(u.neighbourhood || 'Calabar'),
                  role: (u.role as UserRole) || 'customer',
                  accountStatus: (u.accountStatus as 'Active' | 'Suspended') || 'Active',
                  vendorRestaurantId: u.vendorRestaurantId
                    ? String(u.vendorRestaurantId)
                    : undefined,
                  savedAddresses,
                  joinedAt: String(u.joinedAt || ''),
                  totalOrders: Number(u.totalOrders || 0),
                  totalSpent: Number(u.totalSpent || 0),
                };
              }),
            );
            callbacks.onCustomers?.(profiles);
          },
          listenerErrorHandler(OperationType.LIST, 'users', callbacks.onError),
        ),
      );
    }

    if (callbacks.onAllAnnouncements) {
      unsubs.push(
        onSnapshot(
          collection(db, 'announcements'),
          (snap) => {
            const list = snap.docs.map((d) => {
              const raw = d.data();
              return {
                id: d.id,
                title: String(raw.title || ''),
                message: String(raw.message || ''),
                targetAudience:
                  (raw.targetAudience as Announcement['targetAudience']) || 'all',
                priority: (raw.priority as Announcement['priority']) || 'Normal',
                isActive: Boolean(raw.isActive),
                createdByUid: String(raw.createdByUid || ''),
                createdByEmail: String(raw.createdByEmail || ''),
                createdAt: tsToIso(raw.createdAt),
              };
            });
            list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            callbacks.onAllAnnouncements?.(list);
          },
      listenerErrorHandler(OperationType.LIST, 'announcements', callbacks.onError),

        ),
      );
    }

    if (callbacks.onActivityLogs) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc')),
          (snap) => {
            callbacks.onActivityLogs?.(
              snap.docs.map((d) => {
                const raw = d.data();
                return {
                  id: d.id,
                  actorUid: String(raw.actorUid || ''),
                  actorEmail: String(raw.actorEmail || ''),
                  action: String(raw.action || ''),
                  targetType: String(raw.targetType || ''),
                  targetId: String(raw.targetId || ''),
                  summary: String(raw.summary || ''),
                  createdAt: tsToIso(raw.createdAt),
                };
              }),
            );
          },
          listenerErrorHandler(OperationType.LIST, 'activityLogs', callbacks.onError),
        ),
      );
    }
  } else if (role === 'vendor') {
    // Vendors ONLY query records where restaurantOwnerUid == uid (strict vendor isolation)
    unsubs.push(
      onSnapshot(
        query(collection(db, 'orders'), where('restaurantOwnerUid', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Order), id: d.id }));
          list.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
          callbacks.onOrders(list);
        },
        listenerErrorHandler(OperationType.LIST, 'orders-vendor', callbacks.onError),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'transactions'), where('restaurantOwnerUid', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({
            ...(d.data() as TransactionRecord),
            id: d.id,
            createdAt: tsToIso(d.data().createdAt),
          }));
          callbacks.onTransactions(list);
        },
        listenerErrorHandler(OperationType.LIST, 'transactions-vendor', callbacks.onError),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'disputes'), where('restaurantOwnerUid', '==', uid)),
        (snap) => {
          callbacks.onDisputes(
            snap.docs.map((d) => ({
              ...(d.data() as Dispute),
              id: d.id,
              createdAt: tsToIso(d.data().createdAt),
            })),
          );
        },
        listenerErrorHandler(OperationType.LIST, 'disputes-vendor', callbacks.onError),
      ),
    );
  } else {
    // Customer ONLY queries their own orders, disputes, and vendor applications
    unsubs.push(
      onSnapshot(
        query(collection(db, 'orders'), where('customerId', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Order), id: d.id }));
          list.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
          callbacks.onOrders(list);
        },
        listenerErrorHandler(OperationType.LIST, 'orders-customer', callbacks.onError),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'vendorApplications'), where('applicantUid', '==', uid)),
        (snap) => {
          callbacks.onApplications(
            snap.docs.map((d) => ({ ...(d.data() as VendorApplication), id: d.id })),
          );
        },
        (error) =>
          handleFirestoreError(error, OperationType.LIST, 'vendorApplications-customer'),
      ),
    );
  }

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

// -----------------------------------------------------------------------------
// Admin Write & Audit Operations
// -----------------------------------------------------------------------------
function buildLogPayload(
  adminUser: User,
  action: string,
  targetType: string,
  targetId: string,
  summary: string,
) {
  const id = sanitizeId(`log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  return {
    id,
    data: {
      id,
      actorUid: sanitizeId(adminUser.uid),
      actorEmail: clampStr(adminUser.email || ROOT_ADMIN_EMAIL, 180),
      action: clampStr(action, 80),
      targetType: clampStr(targetType, 40),
      targetId: clampStr(targetId, 128),
      summary: clampStr(summary, 400),
      createdAt: serverTimestamp(),
    },
  };
}

export async function adminApproveVendorApplication(
  app: VendorApplication,
  adminUser: User,
  reviewNote?: string,
): Promise<void> {
  const batch = writeBatch(db);
  const appId = sanitizeId(app.id);
  const restId = sanitizeId(`rest-${Date.now()}`);
  const initials =
    app.businessName
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'CF';

  const ownerUid = sanitizeId(app.applicantUid || `vendor-${restId}`);

  batch.set(doc(db, 'restaurants', restId), {
    id: restId,
    name: clampStr(app.businessName, 140),
    cuisine: clampStr(app.cuisine, 140),
    categories: ['Rice', 'Swallow'],
    restaurantCategories: ['Local Nigerian Food'],
    priceTier: '₦₦',
    averageMealPrice: 4000,
    neighbourhood: clampStr(app.neighbourhood, 80),
    address: clampStr(`${app.neighbourhood}, Calabar`, 240),
    description: clampStr(
      `Freshly onboarded Calabar kitchen led by ${app.ownerName}, specialising in ${app.cuisine}.`,
      600,
    ),
    coverImage: IMAGES.restaurantInterior,
    logoText: clampStr(initials, 6),
    deliveryTimeMin: 25,
    deliveryTimeMax: 40,
    deliveryFee: 850,
    minimumOrder: 1500,
    openingHours: '9:00 AM – 9:30 PM',
    isOpen: true,
    status: 'Active',
    rating: null,
    reviewCount: 0,
    popularityScore: 70,
    ownerUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(
    doc(db, 'vendorApplications', appId),
    omitUndefined({
      status: 'Approved',
      reviewNote: clampStr(reviewNote || 'Approved for Calabar Food Marketplace.', 400),
      reviewedByUid: sanitizeId(adminUser.uid),
      updatedAt: serverTimestamp(),
    }),
  );

  if (app.applicantUid) {
    const applicantRef = doc(db, 'users', sanitizeId(app.applicantUid));
    try {
      const snap = await getDoc(applicantRef);
      const applicantRole = snap.exists()
        ? (snap.data().role as UserRole | undefined)
        : undefined;
      if (
        snap.exists() &&
        applicantRole !== 'admin' &&
        applicantRole !== 'super-admin'
      ) {
        batch.update(applicantRef, {
          role: 'vendor',
          vendorRestaurantId: restId,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Skip promotion if applicant user doc does not exist
    }
  }

  const log = buildLogPayload(
    adminUser,
    'Approve Vendor Application',
    'VendorApplication',
    appId,
    `Approved ${app.businessName} (${app.neighbourhood}) and created storefront ${restId}.`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `vendorApplications/${appId}`);
  }
}

export async function adminRejectVendorApplication(
  app: VendorApplication,
  adminUser: User,
  reviewNote: string,
): Promise<void> {
  const batch = writeBatch(db);
  const appId = sanitizeId(app.id);

  batch.update(doc(db, 'vendorApplications', appId), {
    status: 'Rejected',
    reviewNote: clampStr(reviewNote || 'Application did not meet verification checks.', 400),
    reviewedByUid: sanitizeId(adminUser.uid),
    updatedAt: serverTimestamp(),
  });

  const log = buildLogPayload(
    adminUser,
    'Reject Vendor Application',
    'VendorApplication',
    appId,
    `Rejected vendor application for ${app.businessName}.`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vendorApplications/${appId}`);
  }
}

export async function adminToggleRestaurantStatus(
  restaurant: Restaurant,
  adminUser: User,
): Promise<void> {
  const restId = sanitizeId(restaurant.id);
  const nextStatus = restaurant.status === 'Active' ? 'Suspended' : 'Active';
  const batch = writeBatch(db);

  batch.update(doc(db, 'restaurants', restId), {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });

  const log = buildLogPayload(
    adminUser,
    nextStatus === 'Suspended' ? 'Suspend Vendor' : 'Activate Vendor',
    'Restaurant',
    restId,
    `Changed ${restaurant.name} status from ${restaurant.status} to ${nextStatus}.`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restId}`);
  }
}

export async function adminUpdateRestaurantDetails(
  restaurantId: string,
  restaurantName: string,
  patch: Partial<Restaurant>,
  adminUser: User,
): Promise<void> {
  const restId = sanitizeId(restaurantId);
  const batch = writeBatch(db);

  const safePatch = omitUndefined({
    name: patch.name !== undefined ? clampStr(patch.name, 140) : undefined,
    cuisine: patch.cuisine !== undefined ? clampStr(patch.cuisine, 140) : undefined,
    neighbourhood:
      patch.neighbourhood !== undefined ? clampStr(patch.neighbourhood, 80) : undefined,
    address: patch.address !== undefined ? clampStr(patch.address, 240) : undefined,
    openingHours:
      patch.openingHours !== undefined ? clampStr(patch.openingHours, 80) : undefined,
    deliveryFee: patch.deliveryFee,
    minimumOrder: patch.minimumOrder,
    deliveryTimeMin: patch.deliveryTimeMin,
    deliveryTimeMax: patch.deliveryTimeMax,
    isOpen: patch.isOpen,
    status: patch.status,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'restaurants', restId), safePatch);

  const log = buildLogPayload(
    adminUser,
    'Update Restaurant Details',
    'Restaurant',
    restId,
    `Updated operational details for ${restaurantName}.`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restId}`);
  }
}

export async function adminToggleCustomerStatus(
  customer: CustomerProfile,
  adminUser: User,
): Promise<void> {
  const uid = sanitizeId(customer.id);
  const nextStatus = customer.accountStatus === 'Suspended' ? 'Active' : 'Suspended';
  const batch = writeBatch(db);

  batch.update(doc(db, 'users', uid), {
    accountStatus: nextStatus,
    updatedAt: serverTimestamp(),
  });

  const log = buildLogPayload(
    adminUser,
    nextStatus === 'Suspended' ? 'Suspend Customer Account' : 'Reactivate Customer Account',
    'User',
    uid,
    `Set ${customer.name} account status to ${nextStatus}.`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function adminUpdateOrderStatus(
  order: Order,
  nextStatus: OrderStatus,
  adminUser: User,
): Promise<void> {
  const oid = sanitizeId(order.id);
  const batch = writeBatch(db);

  const nextPaymentStatus =
    nextStatus === 'Cancelled' && order.paymentStatus === 'Paid'
      ? 'Refunded'
      : order.paymentStatus;

  batch.update(doc(db, 'orders', oid), {
    status: nextStatus,
    paymentStatus: nextPaymentStatus,
    updatedAt: serverTimestamp(),
  });

  if (nextStatus === 'Cancelled' && order.paymentStatus === 'Paid') {
    const refundId = sanitizeId(`txn-ref-${Date.now()}`);
    batch.set(doc(db, 'transactions', refundId), {
      id: refundId,
      orderId: oid,
      orderNumber: order.orderNumber,
      restaurantId: sanitizeId(order.restaurantId),
      restaurantOwnerUid: clampStr(order.restaurantOwnerUid || 'vendor-demo-owner', 128),
      restaurantName: clampStr(order.restaurantName, 140),
      customerId: clampStr(order.customerId, 128),
      customerName: clampStr(order.customerName, 120),
      reference: `PSK-REF-${order.orderNumber}-${Date.now().toString().slice(-4)}`,
      gateway: 'Paystack',
      type: 'Refund',
      grossAmount: order.total,
      subtotalAmount: order.subtotal,
      commissionRatePercent: 0,
      commissionAmount: 0,
      vendorPayout: 0,
      serviceCharge: order.serviceCharge,
      verificationStatus: 'Refunded',
      verifiedByUid: sanitizeId(adminUser.uid),
      verifiedAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
  }

  const log = buildLogPayload(
    adminUser,
    'Update Order Status',
    'Order',
    oid,
    `Updated order ${order.orderNumber} (${order.restaurantName}) to "${nextStatus}".`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${oid}`);
  }
}

export async function adminVerifyTransaction(
  txn: TransactionRecord,
  adminUser: User,
): Promise<void> {
  const tid = sanitizeId(txn.id);
  const batch = writeBatch(db);

  // Only updates verification metadata; amounts remain strictly immutable
  batch.update(doc(db, 'transactions', tid), {
    verificationStatus: 'Verified',
    verifiedByUid: sanitizeId(adminUser.uid),
    verifiedAt: new Date().toISOString(),
  });

  const log = buildLogPayload(
    adminUser,
    'Verify Paystack Payment',
    'Transaction',
    tid,
    `Verified payment ${txn.reference} for order ${txn.orderNumber}.`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions/${tid}`);
  }
}

export async function adminIssueTransactionRefund(
  txn: TransactionRecord,
  adminUser: User,
): Promise<void> {
  const tid = sanitizeId(txn.id);
  const refundId = sanitizeId(`txn-ref-${Date.now()}`);
  const batch = writeBatch(db);

  batch.update(doc(db, 'transactions', tid), {
    verificationStatus: 'Refunded',
    verifiedByUid: sanitizeId(adminUser.uid),
    verifiedAt: new Date().toISOString(),
  });

  batch.set(doc(db, 'transactions', refundId), {
    id: refundId,
    orderId: sanitizeId(txn.orderId),
    orderNumber: txn.orderNumber,
    restaurantId: sanitizeId(txn.restaurantId),
    restaurantOwnerUid: clampStr(txn.restaurantOwnerUid, 128),
    restaurantName: clampStr(txn.restaurantName, 140),
    customerId: clampStr(txn.customerId, 128),
    customerName: clampStr(txn.customerName, 120),
    reference: `REF-${txn.reference}`,
    gateway: txn.gateway,
    type: 'Refund',
    grossAmount: txn.grossAmount,
    subtotalAmount: txn.subtotalAmount,
    commissionRatePercent: txn.commissionRatePercent,
    commissionAmount: txn.commissionAmount,
    vendorPayout: txn.vendorPayout,
    serviceCharge: txn.serviceCharge,
    verificationStatus: 'Refunded',
    verifiedByUid: sanitizeId(adminUser.uid),
    verifiedAt: new Date().toISOString(),
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, 'orders', sanitizeId(txn.orderId)), {
    paymentStatus: 'Refunded',
    status: 'Cancelled',
    updatedAt: serverTimestamp(),
  });

  const log = buildLogPayload(
    adminUser,
    'Issue Payment Refund',
    'Transaction',
    tid,
    `Issued full Paystack refund (${txn.reference}) for order ${txn.orderNumber}.`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `transactions/${tid}`);
  }
}

export async function adminUpdateDispute(
  dispute: Dispute,
  status: Dispute['status'],
  resolutionNote: string,
  adminUser: User,
): Promise<void> {
  const did = sanitizeId(dispute.id);
  const batch = writeBatch(db);

  batch.update(doc(db, 'disputes', did), {
    status,
    resolutionNote: clampStr(resolutionNote, 400),
    updatedAt: serverTimestamp(),
  });

  const log = buildLogPayload(
    adminUser,
    'Resolve Customer Dispute',
    'Dispute',
    did,
    `Marked dispute on ${dispute.orderNumber} as ${status}.`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `disputes/${did}`);
  }
}

export async function adminSaveFoodCategory(
  category: FoodCategoryDoc,
  isNew: boolean,
  adminUser: User,
): Promise<void> {
  const cid = sanitizeId(category.id || category.label.toLowerCase().replace(/\s+/g, '-'));
  const batch = writeBatch(db);

  if (isNew) {
    batch.set(doc(db, 'foodCategories', cid), {
      id: cid,
      label: clampStr(category.label, 60),
      subtitle: clampStr(category.subtitle, 160),
      image: clampStr(category.image || IMAGES.jollofChicken, 400),
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(doc(db, 'foodCategories', cid), {
      label: clampStr(category.label, 60),
      subtitle: clampStr(category.subtitle, 160),
      image: clampStr(category.image || IMAGES.jollofChicken, 400),
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      updatedAt: serverTimestamp(),
    });
  }

  const log = buildLogPayload(
    adminUser,
    isNew ? 'Create Food Category' : 'Update Food Category',
    'FoodCategory',
    cid,
    `${isNew ? 'Created' : 'Updated'} marketplace category "${category.label}".`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `foodCategories/${cid}`);
  }
}

export async function adminToggleMenuItemAvailability(
  item: MenuItem,
  adminUser: User,
): Promise<void> {
  const mid = sanitizeId(item.id);
  const nextAvail = !item.available;
  const batch = writeBatch(db);

  batch.update(doc(db, 'menuItems', mid), {
    available: nextAvail,
    updatedAt: serverTimestamp(),
  });

  const log = buildLogPayload(
    adminUser,
    'Toggle Product Availability',
    'MenuItem',
    mid,
    `Marked "${item.name}" as ${nextAvail ? 'Available' : 'Sold out'}.`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `menuItems/${mid}`);
  }
}

export async function adminCreateAnnouncement(
  payload: {
    title: string;
    message: string;
    targetAudience: Announcement['targetAudience'];
    priority: Announcement['priority'];
  },
  adminUser: User,
): Promise<void> {
  const aid = sanitizeId(`ann-${Date.now()}`);
  const batch = writeBatch(db);

  batch.set(doc(db, 'announcements', aid), {
    id: aid,
    title: clampStr(payload.title, 140),
    message: clampStr(payload.message, 600),
    targetAudience: payload.targetAudience,
    priority: payload.priority,
    isActive: true,
    createdByUid: sanitizeId(adminUser.uid),
    createdByEmail: clampStr(adminUser.email || ROOT_ADMIN_EMAIL, 180),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const log = buildLogPayload(
    adminUser,
    'Publish Announcement',
    'Announcement',
    aid,
    `Published "${payload.title}" to ${payload.targetAudience}.`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `announcements/${aid}`);
  }
}

export async function adminToggleAnnouncement(
  ann: Announcement,
  adminUser: User,
): Promise<void> {
  const aid = sanitizeId(ann.id);
  const nextActive = !ann.isActive;
  const batch = writeBatch(db);

  batch.update(doc(db, 'announcements', aid), {
    isActive: nextActive,
    updatedAt: serverTimestamp(),
  });

  const log = buildLogPayload(
    adminUser,
    nextActive ? 'Activate Announcement' : 'Archive Announcement',
    'Announcement',
    aid,
    `${nextActive ? 'Activated' : 'Archived'} announcement "${ann.title}".`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `announcements/${aid}`);
  }
}

export async function adminDeleteAnnouncement(
  annId: string,
  adminUser: User,
): Promise<void> {
  const aid = sanitizeId(annId);
  try {
    await deleteDoc(doc(db, 'announcements', aid));
    const log = buildLogPayload(
      adminUser,
      'Delete Announcement',
      'Announcement',
      aid,
      `Deleted announcement ${aid}.`,
    );
    await setDoc(doc(db, 'activityLogs', log.id), log.data);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `announcements/${aid}`);
  }
}

export async function adminUpdateSettings(
  patch: MarketplaceSettings,
  adminUser: User,
): Promise<void> {
  const batch = writeBatch(db);

  batch.set(doc(db, 'settings', 'marketplace'), {
    id: 'marketplace',
    commissionRatePercent: Math.max(0, Math.min(40, patch.commissionRatePercent)),
    serviceChargeFlat: Math.max(0, patch.serviceChargeFlat),
    defaultDeliveryFee: Math.max(0, patch.defaultDeliveryFee),
    minPlatformOrder: Math.max(0, patch.minPlatformOrder),
    defaultCity: clampStr(patch.defaultCity, 60, 'Calabar'),
    paystackMode: patch.paystackMode,
    autoAcceptOrders: patch.autoAcceptOrders,
    updatedByUid: sanitizeId(adminUser.uid),
    updatedAt: serverTimestamp(),
  });

  const log = buildLogPayload(
    adminUser,
    'Update Platform Settings',
    'Settings',
    'marketplace',
    `Updated commission (${patch.commissionRatePercent}%), service charge (₦${patch.serviceChargeFlat}), delivery fee (₦${patch.defaultDeliveryFee}), mode (${patch.paystackMode}).`,
  );
  batch.set(doc(db, 'activityLogs', log.id), log.data);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/marketplace');
  }
}

// -----------------------------------------------------------------------------
// Vendor & Customer Firestore Operations
// -----------------------------------------------------------------------------
export async function vendorUpdateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<void> {
  const oid = sanitizeId(orderId);
  try {
    await updateDoc(
      doc(db, 'orders', oid),
      omitUndefined({
        status: nextStatus,
        updatedAt: serverTimestamp(),
      }),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${oid}`);
  }
}

export async function vendorToggleMenuItem(item: MenuItem): Promise<void> {
  const mid = sanitizeId(item.id);
  try {
    await updateDoc(doc(db, 'menuItems', mid), {
      available: !item.available,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `menuItems/${mid}`);
  }
}

export async function vendorAddMenuItem(
  item: Omit<MenuItem, 'id'>,
  ownerUid: string,
): Promise<void> {
  const mid = sanitizeId(`meal-${Date.now()}`);
  try {
    await setDoc(
      doc(db, 'menuItems', mid),
      omitUndefined({
        ...item,
        id: mid,
        restaurantId: sanitizeId(item.restaurantId),
        ownerUid: sanitizeId(ownerUid),
        name: clampStr(item.name, 140),
        description: clampStr(item.description, 500, 'Freshly prepared Calabar dish.'),
        category: clampStr(item.category, 40, 'Rice'),
        menuSection: clampStr(item.menuSection, 80, 'Specials'),
        price: Math.max(0, Number(item.price) || 0),
        image: clampStr(item.image || IMAGES.jollofChicken, 400),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `menuItems/${mid}`);
  }
}

export async function vendorUpdateRestaurant(
  restaurantId: string,
  patch: Partial<Restaurant>,
): Promise<void> {
  const restId = sanitizeId(restaurantId);
  try {
    await updateDoc(
      doc(db, 'restaurants', restId),
      omitUndefined({
        description:
          patch.description !== undefined ? clampStr(patch.description, 600) : undefined,
        openingHours:
          patch.openingHours !== undefined ? clampStr(patch.openingHours, 80) : undefined,
        isOpen: patch.isOpen,
        deliveryFee: patch.deliveryFee,
        minimumOrder: patch.minimumOrder,
        deliveryTimeMin: patch.deliveryTimeMin,
        deliveryTimeMax: patch.deliveryTimeMax,
        updatedAt: serverTimestamp(),
      }),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restId}`);
  }
}

export async function customerCreateOrderAndTransaction(
  order: Order,
  commissionRatePercent: number,
  user: User,
  paymentReference?: string,
): Promise<void> {
  const oid = sanitizeId(order.id);
  const tid = sanitizeId(`txn-${Date.now()}`);
  const batch = writeBatch(db);

  batch.set(
    doc(db, 'orders', oid),
    omitUndefined({
      ...order,
      id: oid,
      customerId: sanitizeId(user.uid),
      customerName: clampStr(order.customerName, 120),
      customerPhone: clampStr(order.customerPhone, 40),
      deliveryAddress: clampStr(order.deliveryAddress, 240),
      neighbourhood: clampStr(order.neighbourhood, 80),
      deliveryInstructions: order.deliveryInstructions
        ? clampStr(order.deliveryInstructions, 300)
        : undefined,
      restaurantOwnerUid: clampStr(order.restaurantOwnerUid || 'vendor-demo-owner', 128),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );

  const commissionAmount = Math.round((order.subtotal * commissionRatePercent) / 100);
  const vendorPayout = Math.max(0, order.subtotal - commissionAmount);
  const safeRef = clampStr(
    paymentReference || `PSK-${order.orderNumber}-${Date.now().toString().slice(-4)}`,
    80,
  );

  batch.set(doc(db, 'transactions', tid), {
    id: tid,
    orderId: oid,
    orderNumber: order.orderNumber,
    restaurantId: sanitizeId(order.restaurantId),
    restaurantOwnerUid: clampStr(order.restaurantOwnerUid || 'vendor-demo-owner', 128),
    restaurantName: clampStr(order.restaurantName, 140),
    customerId: sanitizeId(user.uid),
    customerName: clampStr(order.customerName, 120),
    reference: safeRef,
    gateway: 'Paystack',
    type: 'Charge',
    grossAmount: order.total,
    subtotalAmount: order.subtotal,
    commissionRatePercent,
    commissionAmount,
    vendorPayout,
    serviceCharge: order.serviceCharge,
    verificationStatus: 'Pending Verification',
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${oid}`);
  }
}

export async function customerSubmitVendorApplication(
  payload: Omit<VendorApplication, 'id' | 'submittedAt' | 'status'>,
  user: User,
): Promise<void> {
  const aid = sanitizeId(`app-${Date.now()}`);
  try {
    await setDoc(doc(db, 'vendorApplications', aid), {
      id: aid,
      applicantUid: sanitizeId(user.uid),
      businessName: clampStr(payload.businessName, 140),
      ownerName: clampStr(payload.ownerName, 120),
      email: clampStr(payload.email, 180),
      phone: clampStr(payload.phone, 40),
      neighbourhood: clampStr(payload.neighbourhood, 80),
      cuisine: clampStr(payload.cuisine, 160),
      submittedAt: new Date().toISOString().slice(0, 10),
      status: 'Pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `vendorApplications/${aid}`);
  }
}

export async function customerUpdateProfile(
  uid: string,
  patch: Partial<CustomerProfile>,
): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const batch = writeBatch(db);
  let hasWrites = false;

  if (patch.name || patch.neighbourhood) {
    batch.update(
      doc(db, 'users', cleanUid),
      omitUndefined({
        displayName: patch.name ? clampStr(patch.name, 120) : undefined,
        neighbourhood: patch.neighbourhood ? clampStr(patch.neighbourhood, 80) : undefined,
        updatedAt: serverTimestamp(),
      }),
    );
    hasWrites = true;
  }

  if (
    patch.email ||
    patch.phone !== undefined ||
    patch.savedAddresses !== undefined ||
    patch.notificationPreferences !== undefined
  ) {
    batch.update(
      doc(db, 'users', cleanUid, 'private', 'info'),
      omitUndefined({
        email: patch.email && patch.email.trim().length >= 3 ? clampStr(patch.email, 180) : undefined,
        phone: patch.phone !== undefined ? clampStr(patch.phone, 40) : undefined,
        savedAddresses: patch.savedAddresses ? patch.savedAddresses.slice(0, 10) : undefined,
        notificationPreferences: patch.notificationPreferences
          ? sanitizeNotificationPreferences(patch.notificationPreferences)
          : undefined,
        updatedAt: serverTimestamp(),
      }),
    );
    hasWrites = true;
  }

  if (!hasWrites) return;

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${cleanUid}`);
  }
}
