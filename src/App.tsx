import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { Bell, X } from 'lucide-react';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AccountPage } from './components/customer/AccountPage';
import { CartDrawer } from './components/customer/CartDrawer';
import { CheckoutPage } from './components/customer/CheckoutPage';
import { HomePage } from './components/customer/HomePage';
import { MealDetailModal } from './components/customer/MealDetailModal';
import { AuthModal, VendorApplyModal } from './components/customer/Modals';
import { OrderTrackingPage } from './components/customer/OrderTrackingPage';
import { RestaurantDetailPage } from './components/customer/RestaurantDetailPage';
import { RestaurantListingPage } from './components/customer/RestaurantListingPage';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { SuperAdminDashboard } from './components/superadmin/SuperAdminDashboard';
import { ConfirmDialog, ToastContainer } from './components/ui/Primitives';
import { VendorDashboard } from './components/vendor/VendorDashboard';
import {
  IMAGES,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_CUSTOMERS,
  INITIAL_CUSTOMER_PROFILE,
  INITIAL_DISPUTES,
  INITIAL_FOOD_CATEGORIES,
  INITIAL_MENU_ITEMS,
  INITIAL_ORDERS,
  INITIAL_RESTAURANTS,
  INITIAL_SETTINGS,
  INITIAL_TRANSACTIONS,
  INITIAL_VENDOR_APPLICATIONS,
} from './data/calabarData';
import {
  auth,
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  getFirestoreErrorMessage,
  googleProvider,
} from './lib/firebase';
import {
  adminApproveVendorApplication,
  adminCreateAnnouncement,
  adminDeleteAnnouncement,
  adminIssueTransactionRefund,
  adminRejectVendorApplication,
  adminSaveFoodCategory,
  adminToggleAnnouncement,
  adminToggleCustomerStatus,
  adminToggleMenuItemAvailability,
  adminToggleRestaurantStatus,
  adminUpdateDispute,
  adminUpdateOrderStatus,
  adminUpdateRestaurantDetails,
  adminUpdateSettings,
  adminVerifyTransaction,
  customerCreateOrderAndTransaction,
  customerSubmitVendorApplication,
  customerUpdateProfile,
  isQuotaExceededError,
  resolveAndEnsureUserProfile,
  seedMarketplaceIfEmpty,
  subscribePublicCatalog,
  subscribeRoleOperationalData,
  vendorAddMenuItem,
  vendorToggleMenuItem,
  vendorUpdateOrderStatus,
  vendorUpdateRestaurant,
} from './services/marketplaceDb';
import {
  ActivityLog,
  Announcement,
  AppView,
  CartItem,
  CustomerProfile,
  Dispute,
  FoodCategory,
  FoodCategoryDoc,
  MarketplaceSettings,
  MenuExtraOption,
  MenuItem,
  MenuSizeOption,
  Order,
  OrderStatus,
  Restaurant,
  RestaurantCategory,
  ToastMessage,
  TransactionRecord,
  UserRole,
  VendorApplication,
} from './types/marketplace';
import { generateOrderNumber } from './utils/format';

const CART_STORAGE_KEY = 'calabar-food-marketplace-cart-v1';

const APP_VIEWS: AppView[] = [
  'home',
  'restaurants',
  'restaurant-detail',
  'checkout',
  'order-tracking',
  'account',
  'vendor-dashboard',
  'admin-dashboard',
  'super-admin-dashboard',
];

function getViewFromHash(): AppView {
  if (typeof window === 'undefined') return 'home';
  const hash = window.location.hash.replace(/^#/, '') as AppView;
  return APP_VIEWS.includes(hash) ? hash : 'home';
}

function getDevPreviewRole(): UserRole | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const preview = new URLSearchParams(window.location.search).get('preview');
  return preview === 'admin' ||
    preview === 'vendor' ||
    preview === 'super-admin' ||
    preview === 'customer'
    ? preview
    : null;
}

function isStoredCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.cartItemId === 'string' &&
    typeof item.restaurantId === 'string' &&
    typeof item.unitPrice === 'number' &&
    typeof item.quantity === 'number' &&
    item.quantity > 0 &&
    Boolean(item.menuItem && typeof item.menuItem.name === 'string')
  );
}

function loadStoredCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredCartItem) : [];
  } catch {
    return [];
  }
}

interface PendingCartAddition {
  meal: MenuItem;
  quantity: number;
  selectedSize?: MenuSizeOption;
  selectedExtras: MenuExtraOption[];
  selectedToppings?: MenuExtraOption[];
  selectedSpice?: string;
  note?: string;
}

export default function App() {
  // Auth & RBAC state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('customer');
  const [previewRole] = useState<UserRole | null>(getDevPreviewRole);
  const [firestoreQuotaExceeded, setFirestoreQuotaExceeded] = useState(false);

  const isPreview = previewRole !== null;
  const effectiveRole = previewRole ?? userRole;
  const effectiveIsSignedIn = Boolean(firebaseUser) || isPreview;
  const previewUid = isPreview ? `preview-${previewRole}` : undefined;
  const previewEmail = isPreview ? `preview-${previewRole}@calabarfood.ng` : undefined;

  // Dev-only preview helpers: simulate writes against local React state so the
  // portals are fully explorable without Firebase Auth or Firestore access.
  const nextPreviewId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const addPreviewLog = (
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
  ) => {
    if (!isPreview || !previewUid || !previewEmail) return;
    setActivityLogs((prev) => [
      {
        id: nextPreviewId('log'),
        actorUid: previewUid,
        actorEmail: previewEmail,
        action,
        targetType,
        targetId,
        summary,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  // Navigation & UI state
  const [currentView, setCurrentView] = useState<AppView>(getViewFromHash);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(
    INITIAL_RESTAURANTS[0].id,
  );
  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    INITIAL_RESTAURANTS[0].id,
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Filters & search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'All'>('All');
  const [selectedRestaurantCategory, setSelectedRestaurantCategory] = useState<
    RestaurantCategory | 'All'
  >('All');
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState('All Calabar');

  // Marketplace data state (live-synced with Firestore)
  const [restaurants, setRestaurants] = useState<Restaurant[]>(INITIAL_RESTAURANTS);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  const [foodCategories, setFoodCategories] =
    useState<FoodCategoryDoc[]>(INITIAL_FOOD_CATEGORIES);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [transactions, setTransactions] =
    useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);
  const [customers, setCustomers] = useState<CustomerProfile[]>(INITIAL_CUSTOMERS);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile>(
    INITIAL_CUSTOMER_PROFILE,
  );
  const [applications, setApplications] = useState<VendorApplication[]>(
    INITIAL_VENDOR_APPLICATIONS,
  );
  const [disputes, setDisputes] = useState<Dispute[]>(INITIAL_DISPUTES);
  const [announcements, setAnnouncements] =
    useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [adminAnnouncements, setAdminAnnouncements] =
    useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [activityLogs, setActivityLogs] =
    useState<ActivityLog[]>(INITIAL_ACTIVITY_LOGS);
  const [settings, setSettings] = useState<MarketplaceSettings>(INITIAL_SETTINGS);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<string[]>([]);

  // Modals & notifications
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authRequiredRole, setAuthRequiredRole] = useState<UserRole | undefined>(undefined);
  const [portalAuthError, setPortalAuthError] = useState('');
  const pendingPortalRole = useRef<UserRole | null>(null);
  const [vendorApplyOpen, setVendorApplyOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeMealModal, setActiveMealModal] = useState<MenuItem | null>(null);
  const [pendingCartAddition, setPendingCartAddition] = useState<PendingCartAddition | null>(
    null,
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>(loadStoredCart);

  const addToast = (message: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDbError = (err: unknown, fallbackMessage: string) => {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
      addToast('Firestore free daily read/write quota reached.', 'error');
      return;
    }
    addToast(getFirestoreErrorMessage(err) || fallbackMessage, 'error');
  };

  const handleListenerError = (message: string) => {
    if (message.toLowerCase().includes('quota exceeded')) {
      setFirestoreQuotaExceeded(true);
      return;
    }
    addToast(message, 'error');
  };

  useEffect(() => {
    const handleQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentView, selectedRestaurantId]);

  useEffect(() => {
    const handleHashChange = () => setCurrentView(getViewFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const nextHash = `#${currentView}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}${nextHash}`,
      );
    }
  }, [currentView]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {}
  }, [cartItems]);

  // Public Firestore catalog listeners
  useEffect(() => {
    try {
      return subscribePublicCatalog({
        onRestaurants: setRestaurants,
        onMenuItems: setMenuItems,
        onCategories: setFoodCategories,
        onSettings: setSettings,
        onAnnouncements: setAnnouncements,
        onError: handleListenerError,
      });
    } catch (err) {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      return undefined;
    }
  }, []);

  // Firebase Auth & RBAC state listener
  useEffect(() => {
    let roleUnsub: (() => void) | undefined;

    const authUnsub = onAuthStateChanged(auth, async (user) => {
      roleUnsub?.();
      roleUnsub = undefined;
      setFirebaseUser(user);

      if (!user) {
        setUserRole('customer');
        setCustomerProfile(INITIAL_CUSTOMER_PROFILE);
        setAuthReady(true);
        return;
      }

      try {
        const profile = await resolveAndEnsureUserProfile(user);
        setUserRole(profile.role);
        setCustomerProfile({
          id: profile.uid,
          name: profile.displayName,
          email: profile.email,
          phone: profile.phone,
          neighbourhood: profile.neighbourhood,
          role: profile.role,
          accountStatus: profile.accountStatus,
          vendorRestaurantId: profile.vendorRestaurantId,
          savedAddresses: profile.savedAddresses,
          notificationPreferences: profile.notificationPreferences,
          joinedAt: profile.joinedAt,
          totalOrders: profile.totalOrders,
          totalSpent: profile.totalSpent,
        });

        if (profile.vendorRestaurantId) {
          setSelectedVendorId(profile.vendorRestaurantId);
        }

        // A portal sign-in only succeeds when the verified Firestore role
        // matches the portal that requested it.
        if (pendingPortalRole.current) {
          const requiredRole = pendingPortalRole.current;
          pendingPortalRole.current = null;
          setAuthLoading(false);

          if (profile.role !== requiredRole) {
            setPortalAuthError(
              `This Google account is registered as ${profile.role}. Please sign in with a ${requiredRole} account to open the ${requiredRole} portal.`,
            );
            await signOut(auth);
            return;
          }

          setAuthModalOpen(false);
          setPortalAuthError('');
          setCurrentView(requiredRole === 'vendor' ? 'vendor-dashboard' : 'admin-dashboard');
          addToast(`Signed in as ${profile.displayName || profile.email}`);
        }

        if (profile.role === 'admin' || profile.role === 'super-admin') {
          await seedMarketplaceIfEmpty(user, false);
        }

        roleUnsub = subscribeRoleOperationalData(profile.role, profile.uid, {
          onOrders: (list) => {
            setOrders(list);
            if (list.length > 0) setSelectedOrderId((prev) => prev || list[0].id);
          },
          onTransactions: setTransactions,
          onApplications: setApplications,
          onDisputes: setDisputes,
          onCustomers: setCustomers,
          onAllAnnouncements: setAdminAnnouncements,
          onActivityLogs: setActivityLogs,
          onError: handleListenerError,
        });
      } catch (err) {
        if (pendingPortalRole.current) {
          pendingPortalRole.current = null;
          setAuthLoading(false);
          setPortalAuthError('Could not verify your role. Please try again.');
        }
        if (isQuotaExceededError(err)) {
          setFirestoreQuotaExceeded(true);
        }
      } finally {
        setAuthReady(true);
      }
    });

    return () => {
      roleUnsub?.();
      authUnsub();
    };
  }, []);

  const handleGoogleSignIn = async (requiredRole?: UserRole) => {
    setAuthLoading(true);
    setPortalAuthError('');
    pendingPortalRole.current = requiredRole ?? null;
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (!requiredRole) {
        setAuthModalOpen(false);
        addToast(`Signed in as ${cred.user.displayName || cred.user.email}`);
      }
      // Portal roles are validated in the auth listener after the Firestore
      // profile resolves. That listener closes the modal and opens the portal.
    } catch (err) {
      pendingPortalRole.current = null;
      setAuthLoading(false);
      setPortalAuthError(
        err instanceof Error ? err.message : 'Could not complete Google sign-in.',
      );
      throw err;
    } finally {
      if (!requiredRole) setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    pendingPortalRole.current = null;
    setAuthLoading(true);
    try {
      await signOut(auth);
      addToast('Signed out', 'info');
    } finally {
      setAuthLoading(false);
    }
  };

  const openCustomerAuth = () => {
    setAuthRequiredRole(undefined);
    setPortalAuthError('');
    setAuthModalOpen(true);
  };

  const openPortal = (role: 'vendor' | 'admin' | 'super-admin', view: AppView) => {
    if (isPreview || effectiveRole === role) {
      setCurrentView(view);
      return;
    }
    setAuthRequiredRole(role);
    setPortalAuthError('');
    setAuthModalOpen(true);
  };

  const openVendorPortal = () => openPortal('vendor', 'vendor-dashboard');
  const openAdminPortal = () => openPortal('admin', 'admin-dashboard');
  const openSuperAdminPortal = () => openPortal('super-admin', 'super-admin-dashboard');

  const cartRestaurant = useMemo(() => {
    if (cartItems.length === 0) return null;
    const restId = cartItems[0].restaurantId;
    return restaurants.find((r) => r.id === restId) || null;
  }, [cartItems, restaurants]);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const commitAddToCart = (payload: PendingCartAddition, replaceCart = false) => {
    const vendor = restaurants.find((r) => r.id === payload.meal.restaurantId);
    if (!vendor) return;

    const unitPrice =
      payload.meal.price +
      (payload.selectedSize?.priceDelta || 0) +
      (payload.selectedToppings?.reduce((sum, top) => sum + top.price, 0) || 0) +
      payload.selectedExtras.reduce((sum, ext) => sum + ext.price, 0);

    const newItem: CartItem = {
      cartItemId: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItem: payload.meal,
      restaurantId: vendor.id,
      restaurantName: vendor.name,
      quantity: payload.quantity,
      selectedSize: payload.selectedSize,
      selectedExtras: payload.selectedExtras,
      selectedToppings: payload.selectedToppings,
      selectedSpice: payload.selectedSpice,
      note: payload.note,
      unitPrice,
    };

    setCartItems((prev) => (replaceCart ? [newItem] : [...prev, newItem]));
    setActiveMealModal(null);
    addToast(`Added ${payload.meal.name} to cart`);
  };

  const handleRequestAddToCart = (payload: PendingCartAddition) => {
    const existingRestaurantId = cartItems[0]?.restaurantId;
    if (existingRestaurantId && existingRestaurantId !== payload.meal.restaurantId) {
      setPendingCartAddition(payload);
      return;
    }
    commitAddToCart(payload, false);
  };

  const handleUpdateCartQty = (cartItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const handlePlaceOrder = async (details: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    neighbourhood: string;
    deliveryInstructions: string;
    paymentReference: string;
  }): Promise<boolean> => {
    if (!cartRestaurant || cartItems.length === 0) return false;

    if (!firebaseUser && !isPreview) {
      openCustomerAuth();
      addToast('Please sign in with Google to place and track your order.', 'warning');
      return false;
    }

    const subtotal = cartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const deliveryFee = cartRestaurant.deliveryFee;
    const serviceCharge = settings.serviceChargeFlat;
    const total = subtotal + deliveryFee + serviceCharge;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: generateOrderNumber(),
      customerId: firebaseUser?.uid || previewUid || 'preview-customer',
      customerName: details.customerName,
      customerPhone: details.customerPhone,
      deliveryAddress: details.deliveryAddress,
      neighbourhood: details.neighbourhood,
      deliveryInstructions: details.deliveryInstructions || undefined,
      restaurantId: cartRestaurant.id,
      restaurantOwnerUid: cartRestaurant.ownerUid || 'vendor-demo-owner',
      restaurantName: cartRestaurant.name,
      restaurantAddress: cartRestaurant.address,
      restaurantPhone: '0809 555 0142',
      items: cartItems.map((ci) => ({
        menuItemId: ci.menuItem.id,
        name: ci.menuItem.name,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        optionsText:
          [
            ci.selectedSize?.label,
            ci.selectedSpice,
            ...(ci.selectedToppings?.map((t) => t.label) || []),
            ...ci.selectedExtras.map((e) => e.label),
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
      })),
      subtotal,
      deliveryFee,
      serviceCharge,
      total,
      status: settings.autoAcceptOrders ? 'Vendor accepted' : 'Payment confirmed',
      paymentStatus: 'Paid',
      placedAt: new Date().toISOString(),
      estimatedDelivery: `${cartRestaurant.deliveryTimeMin}–${cartRestaurant.deliveryTimeMax} mins`,
      paymentMethod: 'Paystack',
    };

    if (isPreview) {
      const commissionAmount = Math.round(subtotal * settings.commissionRatePercent) / 100;
      const previewTransaction: TransactionRecord = {
        id: nextPreviewId('txn'),
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        restaurantId: cartRestaurant.id,
        restaurantOwnerUid: newOrder.restaurantOwnerUid || 'vendor-demo-owner',
        restaurantName: cartRestaurant.name,
        customerId: newOrder.customerId,
        customerName: details.customerName,
        reference: details.paymentReference,
        gateway: 'Paystack',
        type: 'Charge',
        grossAmount: total,
        subtotalAmount: subtotal,
        commissionRatePercent: settings.commissionRatePercent,
        commissionAmount,
        vendorPayout: subtotal - commissionAmount,
        serviceCharge,
        verificationStatus: 'Verified',
        verifiedByUid: previewUid,
        verifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setOrders((prev) => [newOrder, ...prev]);
      setTransactions((prev) => [previewTransaction, ...prev]);
      setCartItems([]);
      setSelectedOrderId(newOrder.id);
      setCurrentView('order-tracking');
      addToast(
        `Preview payment ${details.paymentReference} verified! Order ${newOrder.orderNumber} placed.`,
      );
      return true;
    }

    try {
      await customerCreateOrderAndTransaction(
        newOrder,
        settings.commissionRatePercent,
        firebaseUser!,
        details.paymentReference,
      );
      setCartItems([]);
      setSelectedOrderId(newOrder.id);
      setCurrentView('order-tracking');
      addToast(`Payment ${details.paymentReference} verified! Order ${newOrder.orderNumber} placed.`);
      return true;
    } catch (err) {
      handleDbError(err, 'Could not place order. Please check your permissions.');
      return false;
    }
  };

  const handleVendorUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (isPreview) {
      const order = orders.find((o) => o.id === orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      addPreviewLog(
        'Update Order Status',
        'Order',
        orderId,
        `Preview: ${order?.orderNumber || orderId} moved to ${status}.`,
      );
      addToast(`Order updated to "${status}"`, status === 'Cancelled' ? 'warning' : 'success');
      return;
    }
    try {
      await vendorUpdateOrderStatus(orderId, status);
      addToast(`Order updated to "${status}"`, status === 'Cancelled' ? 'warning' : 'success');
    } catch (err) {
      handleDbError(err, 'Could not update order status.');
    }
  };

  const handleVendorToggleMenuItem = async (itemId: string) => {
    const item = menuItems.find((m) => m.id === itemId);
    if (!item) return;
    if (isPreview) {
      setMenuItems((prev) =>
        prev.map((m) => (m.id === itemId ? { ...m, available: !m.available } : m)),
      );
      addPreviewLog(
        'Toggle Menu Item',
        'MenuItem',
        itemId,
        `Preview: ${item.name} is now ${item.available ? 'unavailable' : 'available'}.`,
      );
      addToast('Menu item availability updated');
      return;
    }
    try {
      await vendorToggleMenuItem(item);
      addToast('Menu item availability updated');
    } catch (err) {
      handleDbError(err, 'Could not update menu item.');
    }
  };

  const handleVendorAddMenuItem = async (newDish: Omit<MenuItem, 'id'>) => {
    if (!firebaseUser && !isPreview) return;
    if (isPreview) {
      const dishId = nextPreviewId('dish');
      setMenuItems((prev) => [...prev, { ...newDish, id: dishId }]);
      addPreviewLog('Add Menu Item', 'MenuItem', dishId, `Preview: ${newDish.name} added to menu.`);
      addToast(`${newDish.name} added to menu`);
      return;
    }
    try {
      await vendorAddMenuItem(newDish, firebaseUser!.uid);
      addToast(`${newDish.name} added to menu`);
    } catch (err) {
      handleDbError(err, 'Could not add dish.');
    }
  };

  const handleVendorUpdateRestaurant = async (
    restaurantId: string,
    patch: Partial<Restaurant>,
  ) => {
    if (isPreview) {
      const restaurant = restaurants.find((r) => r.id === restaurantId);
      setRestaurants((prev) => prev.map((r) => (r.id === restaurantId ? { ...r, ...patch } : r)));
      addPreviewLog(
        'Update Store Settings',
        'Restaurant',
        restaurantId,
        `Preview: settings updated for ${restaurant?.name || restaurantId}.`,
      );
      addToast('Store settings saved');
      return;
    }
    try {
      await vendorUpdateRestaurant(restaurantId, patch);
      addToast('Store settings saved');
    } catch (err) {
      handleDbError(err, 'Could not update restaurant settings.');
    }
  };

  const activeRestaurant =
    restaurants.find((r) => r.id === selectedRestaurantId) || restaurants[0];

  const activeRestaurantMenu = useMemo(
    () => menuItems.filter((m) => m.restaurantId === activeRestaurant.id),
    [menuItems, activeRestaurant.id],
  );

  const modalRestaurant = activeMealModal
    ? restaurants.find((r) => r.id === activeMealModal.restaurantId)
    : null;

  const visibleAnnouncements = useMemo(() => {
    const audienceFilter =
      currentView === 'vendor-dashboard'
        ? ['all', 'vendors']
        : currentView === 'admin-dashboard' || currentView === 'super-admin-dashboard'
          ? []
          : ['all', 'customers'];

    return announcements.filter(
      (a) =>
        a.isActive &&
        audienceFilter.includes(a.targetAudience) &&
        !dismissedAnnouncementIds.includes(a.id),
    );
  }, [announcements, currentView, dismissedAnnouncementIds]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#1C1917] overflow-x-clip">
      {firestoreQuotaExceeded && (
        <div className="bg-red-50 border-b border-red-200 text-red-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50">
          <span>
            Firestore free daily quota exceeded. Data resets tomorrow, or you can manage billing in{' '}
            <a
              href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              Firebase Console
            </a>
            .
          </span>
        </div>
      )}

      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {previewRole && (
        <div className="bg-[#FFF7ED] border-b border-[#EA580C]/30 text-[#1C1917] px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50">
          <span>
            <strong className="font-semibold capitalize">{previewRole} portal preview</strong> —
            local development only. Actions are simulated in this browser and are not saved to
            Firebase.{' '}
            <a
              className="font-semibold underline underline-offset-2 hover:text-[#EA580C]"
              href={`${window.location.pathname}#home`}
            >
              Exit preview
            </a>
          </span>
        </div>
      )}

      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        isLoggedIn={effectiveIsSignedIn}
        customerName={
          previewRole === 'super-admin'
            ? 'Super Admin Preview'
            : previewRole === 'admin'
              ? 'Admin Preview'
              : previewRole === 'vendor'
                ? 'Vendor Preview'
                : customerProfile.name
        }
        userRole={effectiveRole}
        onOpenAuth={openCustomerAuth}
        onOpenVendorPortal={openVendorPortal}
        onOpenAdminPortal={openAdminPortal}
        onOpenSuperAdminPortal={openSuperAdminPortal}
      />

      {visibleAnnouncements.length > 0 && (
        <div className="bg-[#FFF7ED] border-b border-[#E7E5E4] px-4 py-2.5">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3 text-[13px]">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-[#EA580C] shrink-0" aria-hidden="true" />
              <p className="text-[#1C1917] truncate">
                <strong className="font-semibold">{visibleAnnouncements[0].title}:</strong>{' '}
                <span className="text-[#78716C]">{visibleAnnouncements[0].message}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setDismissedAnnouncementIds((prev) => [...prev, visibleAnnouncements[0].id])
              }
              aria-label="Dismiss announcement"
              className="text-[#78716C] hover:text-[#1C1917] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {currentView === 'home' && (
          <HomePage
            selectedNeighbourhood={selectedNeighbourhood}
            onSelectNeighbourhood={setSelectedNeighbourhood}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={() => setCurrentView('restaurants')}
            onSelectCategory={(category) => {
              setSelectedCategory(category);
              setCurrentView('restaurants');
            }}
            restaurants={restaurants}
            menuItems={menuItems}
            onSelectRestaurant={(id) => {
              setSelectedRestaurantId(id);
              setCurrentView('restaurant-detail');
            }}
            onSelectMeal={(meal) => setActiveMealModal(meal)}
            onExploreRestaurants={() => setCurrentView('restaurants')}
            onOpenVendorApply={() => setVendorApplyOpen(true)}
            onOpenVendorPortal={openVendorPortal}
            onOpenAdminPortal={openAdminPortal}
            onOpenSuperAdminPortal={openSuperAdminPortal}
          />
        )}

        {currentView === 'restaurants' && (
          <RestaurantListingPage
            restaurants={restaurants}
            menuItems={menuItems}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedRestaurantCategory={selectedRestaurantCategory}
            onRestaurantCategoryChange={setSelectedRestaurantCategory}
            selectedNeighbourhood={selectedNeighbourhood}
            onNeighbourhoodChange={setSelectedNeighbourhood}
            onSelectRestaurant={(id) => {
              setSelectedRestaurantId(id);
              setCurrentView('restaurant-detail');
            }}
          />
        )}

        {currentView === 'restaurant-detail' && activeRestaurant && (
          <RestaurantDetailPage
            restaurant={activeRestaurant}
            menuItems={activeRestaurantMenu}
            cartItems={cartItems}
            cartRestaurant={cartRestaurant}
            serviceCharge={settings.serviceChargeFlat}
            onBack={() => setCurrentView('restaurants')}
            onSelectMeal={(meal) => setActiveMealModal(meal)}
            onUpdateCartQty={handleUpdateCartQty}
            onRemoveCartItem={handleRemoveCartItem}
            onClearCart={() => {
              setCartItems([]);
              addToast('Cart cleared', 'info');
            }}
            onOpenCart={() => setCartOpen(true)}
            onProceedToCheckout={() => setCurrentView('checkout')}
          />
        )}

        {currentView === 'checkout' && (
          <CheckoutPage
            items={cartItems}
            restaurant={cartRestaurant}
            customer={customerProfile}
            serviceCharge={settings.serviceChargeFlat}
            paystackMode={settings.paystackMode}
            isSignedIn={effectiveIsSignedIn}
            onOpenAuth={openCustomerAuth}
            onBackToMenu={() => {
              if (cartRestaurant) {
                setSelectedRestaurantId(cartRestaurant.id);
                setCurrentView('restaurant-detail');
              } else {
                setCurrentView('restaurants');
              }
            }}
            onPlaceOrder={(details) => handlePlaceOrder(details)}
          />
        )}

        {currentView === 'order-tracking' && (
          <OrderTrackingPage
            orders={orders}
            selectedOrderId={selectedOrderId}
            canAdvanceStatus={
              effectiveRole === 'super-admin' ||
              effectiveRole === 'admin' ||
              effectiveRole === 'vendor'
            }
            onSelectOrder={setSelectedOrderId}
            onAdvanceOrderStatus={(oid, st) => void handleVendorUpdateOrderStatus(oid, st)}
            onBrowseRestaurants={() => setCurrentView('restaurants')}
          />
        )}

        {currentView === 'account' && (
          <AccountPage
            customer={customerProfile}
            orders={orders}
            onUpdateProfile={async (updated) => {
              setCustomerProfile((prev) => ({ ...prev, ...updated }));
              if (firebaseUser) {
                try {
                  await customerUpdateProfile(firebaseUser.uid, updated);
                  addToast('Customer profile saved to database');
                } catch (err) {
                  handleDbError(err, 'Could not save profile changes.');
                }
              } else {
                addToast('Profile updated locally');
              }
            }}
            onTrackOrder={(orderId) => {
              setSelectedOrderId(orderId);
              setCurrentView('order-tracking');
            }}
            onBrowseRestaurants={() => setCurrentView('restaurants')}
          />
        )}

        {currentView === 'vendor-dashboard' && (
          <VendorDashboard
            restaurants={restaurants}
            menuItems={menuItems}
            orders={orders}
            selectedVendorId={selectedVendorId}
            onSelectVendorId={setSelectedVendorId}
            onUpdateOrderStatus={(oid, st) => void handleVendorUpdateOrderStatus(oid, st)}
            onToggleMenuItemAvailability={(id) => void handleVendorToggleMenuItem(id)}
            onAddMenuItem={(dish) => void handleVendorAddMenuItem(dish)}
            onUpdateRestaurant={(rid, patch) => void handleVendorUpdateRestaurant(rid, patch)}
            isSignedIn={effectiveIsSignedIn}
            currentUid={firebaseUser?.uid}
            userRole={effectiveRole}
            onGoogleSignIn={() => handleGoogleSignIn('vendor')}
            onSignOut={handleSignOut}
            authError={portalAuthError}
            onOpenVendorApply={() => setVendorApplyOpen(true)}
            previewMode={isPreview}
          />
        )}

        {currentView === 'admin-dashboard' && (
          <AdminDashboard
            authReady={authReady || previewRole !== null}
            isSignedIn={effectiveIsSignedIn}
            userEmail={firebaseUser?.email || previewEmail}
            userName={isPreview ? 'Preview Account' : customerProfile.name}
            userRole={effectiveRole}
            authLoading={authLoading && !isPreview}
            portalAuthError={portalAuthError}
            onGoogleSignIn={() => handleGoogleSignIn('admin')}
            onSignOut={
              isPreview
                ? async () => {
                    window.location.href = `${window.location.pathname}#home`;
                  }
                : handleSignOut
            }
            restaurants={restaurants}
            menuItems={menuItems}
            categories={foodCategories}
            applications={applications}
            customers={customers}
            orders={orders}
            transactions={transactions}
            disputes={disputes}
            announcements={adminAnnouncements}
            activityLogs={activityLogs}
            settings={settings}
            onApproveApplication={async (app, note) => {
              if (isPreview) {
                const restId = nextPreviewId('rest');
                const initials =
                  app.businessName
                    .split(' ')
                    .slice(0, 2)
                    .map((word) => word[0]?.toUpperCase() || '')
                    .join('') || 'CF';
                const newRestaurant: Restaurant = {
                  id: restId,
                  name: app.businessName,
                  cuisine: app.cuisine,
                  categories: ['Rice', 'Swallow'],
                  restaurantCategories: ['Local Nigerian Food'],
                  priceTier: '₦₦',
                  averageMealPrice: 4000,
                  neighbourhood: app.neighbourhood,
                  address: `${app.neighbourhood}, Calabar`,
                  description: `Freshly onboarded Calabar kitchen led by ${app.ownerName}, specialising in ${app.cuisine}.`,
                  coverImage: IMAGES.restaurantInterior,
                  logoText: initials,
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
                  ownerUid: app.applicantUid || `vendor-${restId}`,
                };
                setApplications((prev) =>
                  prev.map((a) =>
                    a.id === app.id
                      ? {
                          ...a,
                          status: 'Approved',
                          reviewNote: note || 'Approved for Calabar Food Marketplace.',
                          reviewedByUid: previewUid,
                        }
                      : a,
                  ),
                );
                setRestaurants((prev) => [...prev, newRestaurant]);
                addPreviewLog(
                  'Approve Vendor Application',
                  'VendorApplication',
                  app.id,
                  `Approved ${app.businessName} and created storefront ${restId}.`,
                );
                addToast(`${app.businessName} approved and added to Calabar Food Marketplace`);
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminApproveVendorApplication(app, firebaseUser, note);
                addToast(`${app.businessName} approved and added to Calabar Food Marketplace`);
              } catch (err) {
                handleDbError(err, 'Could not approve vendor application.');
              }
            }}
            onRejectApplication={async (app, note) => {
              if (isPreview) {
                setApplications((prev) =>
                  prev.map((a) =>
                    a.id === app.id
                      ? { ...a, status: 'Rejected', reviewNote: note, reviewedByUid: previewUid }
                      : a,
                  ),
                );
                addPreviewLog(
                  'Reject Vendor Application',
                  'VendorApplication',
                  app.id,
                  `Rejected application for ${app.businessName}.`,
                );
                addToast(`Application for ${app.businessName} rejected`, 'warning');
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminRejectVendorApplication(app, firebaseUser, note);
                addToast(`Application for ${app.businessName} rejected`, 'warning');
              } catch (err) {
                handleDbError(err, 'Could not reject vendor application.');
              }
            }}
            onToggleVendorStatus={async (restaurant) => {
              if (isPreview) {
                const nextStatus = restaurant.status === 'Active' ? 'Suspended' : 'Active';
                setRestaurants((prev) =>
                  prev.map((r) => (r.id === restaurant.id ? { ...r, status: nextStatus } : r)),
                );
                addPreviewLog(
                  'Toggle Vendor Status',
                  'Restaurant',
                  restaurant.id,
                  `${restaurant.name} is now ${nextStatus}.`,
                );
                addToast(`${restaurant.name} status updated`);
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminToggleRestaurantStatus(restaurant, firebaseUser);
                addToast(`${restaurant.name} status updated`);
              } catch (err) {
                handleDbError(err, 'Could not update vendor status.');
              }
            }}
            onUpdateRestaurantDetails={async (restaurantId, name, patch) => {
              if (isPreview) {
                setRestaurants((prev) =>
                  prev.map((r) => (r.id === restaurantId ? { ...r, ...patch, name } : r)),
                );
                addPreviewLog(
                  'Update Restaurant Details',
                  'Restaurant',
                  restaurantId,
                  `Updated ${name}.`,
                );
                addToast(`${name} updated`);
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminUpdateRestaurantDetails(restaurantId, name, patch, firebaseUser);
                addToast(`${name} updated`);
              } catch (err) {
                handleDbError(err, 'Could not update restaurant details.');
              }
            }}
            onToggleCustomerStatus={async (customer) => {
              if (isPreview) {
                const nextStatus = customer.accountStatus === 'Active' ? 'Suspended' : 'Active';
                setCustomers((prev) =>
                  prev.map((c) =>
                    c.id === customer.id ? { ...c, accountStatus: nextStatus } : c,
                  ),
                );
                addPreviewLog(
                  'Toggle Customer Status',
                  'User',
                  customer.id,
                  `${customer.name} is now ${nextStatus}.`,
                );
                addToast(`Account updated for ${customer.name}`);
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminToggleCustomerStatus(customer, firebaseUser);
                addToast(`Account updated for ${customer.name}`);
              } catch (err) {
                handleDbError(err, 'Could not update customer status.');
              }
            }}
            onUpdateOrderStatus={async (order, nextStatus) => {
              if (isPreview) {
                setOrders((prev) =>
                  prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)),
                );
                addPreviewLog(
                  'Update Order Status',
                  'Order',
                  order.id,
                  `${order.orderNumber} moved to ${nextStatus}.`,
                );
                addToast(`Order ${order.orderNumber} updated to "${nextStatus}"`);
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminUpdateOrderStatus(order, nextStatus, firebaseUser);
                addToast(`Order ${order.orderNumber} updated to "${nextStatus}"`);
              } catch (err) {
                handleDbError(err, 'Could not update order status.');
              }
            }}
            onVerifyTransaction={async (txn) => {
              if (isPreview) {
                setTransactions((prev) =>
                  prev.map((t) =>
                    t.id === txn.id
                      ? {
                          ...t,
                          verificationStatus: 'Verified' as const,
                          verifiedByUid: previewUid,
                          verifiedAt: new Date().toISOString(),
                        }
                      : t,
                  ),
                );
                addPreviewLog(
                  'Verify Payment',
                  'Transaction',
                  txn.id,
                  `Verified ${txn.reference} for ${txn.orderNumber}.`,
                );
                addToast(`Payment ${txn.reference} verified`);
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminVerifyTransaction(txn, firebaseUser);
                addToast(`Payment ${txn.reference} verified`);
              } catch (err) {
                handleDbError(err, 'Could not verify transaction.');
              }
            }}
            onIssueTransactionRefund={async (txn) => {
              if (isPreview) {
                const now = new Date().toISOString();
                setTransactions((prev) => [
                  ...prev.map((t) =>
                    t.id === txn.id
                      ? {
                          ...t,
                          verificationStatus: 'Refunded' as const,
                          verifiedByUid: previewUid,
                          verifiedAt: now,
                        }
                      : t,
                  ),
                  {
                    ...txn,
                    id: nextPreviewId('txn-ref'),
                    reference: `REF-${txn.reference}`,
                    type: 'Refund',
                    verificationStatus: 'Refunded',
                    verifiedByUid: previewUid,
                    verifiedAt: now,
                    createdAt: now,
                  },
                ]);
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === txn.orderId ? { ...o, status: 'Cancelled', paymentStatus: 'Refunded' } : o,
                  ),
                );
                addPreviewLog(
                  'Issue Payment Refund',
                  'Transaction',
                  txn.id,
                  `Issued full refund for ${txn.orderNumber}.`,
                );
                addToast(`Refund issued for ${txn.orderNumber}`, 'warning');
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminIssueTransactionRefund(txn, firebaseUser);
                addToast(`Refund issued for ${txn.orderNumber}`, 'warning');
              } catch (err) {
                handleDbError(err, 'Could not issue refund.');
              }
            }}
            onUpdateDisputeStatus={async (dispute, status, resolutionNote) => {
              if (isPreview) {
                setDisputes((prev) =>
                  prev.map((d) =>
                    d.id === dispute.id ? { ...d, status, resolutionNote } : d,
                  ),
                );
                addPreviewLog(
                  'Update Dispute',
                  'Dispute',
                  dispute.id,
                  `${dispute.orderNumber} marked ${status}.`,
                );
                addToast(`Dispute ${dispute.orderNumber} marked ${status}`);
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminUpdateDispute(dispute, status, resolutionNote, firebaseUser);
                addToast(`Dispute ${dispute.orderNumber} marked ${status}`);
              } catch (err) {
                handleDbError(err, 'Could not update dispute.');
              }
            }}
            onSaveCategory={async (cat, isNew) => {
              if (isPreview) {
                setFoodCategories((prev) =>
                  isNew
                    ? [...prev, cat]
                    : prev.map((c) => (c.id === cat.id ? cat : c)),
                );
                addPreviewLog(
                  'Save Food Category',
                  'FoodCategory',
                  cat.id,
                  `Saved category "${cat.label}".`,
                );
                addToast(`Category "${cat.label}" saved`);
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminSaveFoodCategory(cat, isNew, firebaseUser);
                addToast(`Category "${cat.label}" saved`);
              } catch (err) {
                handleDbError(err, 'Could not save category.');
              }
            }}
            onToggleMenuItemAvailability={async (item) => {
              if (isPreview) {
                setMenuItems((prev) =>
                  prev.map((m) => (m.id === item.id ? { ...m, available: !m.available } : m)),
                );
                addPreviewLog(
                  'Toggle Menu Item',
                  'MenuItem',
                  item.id,
                  `${item.name} availability updated.`,
                );
                addToast(`"${item.name}" availability updated`);
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminToggleMenuItemAvailability(item, firebaseUser);
                addToast(`"${item.name}" availability updated`);
              } catch (err) {
                handleDbError(err, 'Could not update menu item.');
              }
            }}
            onCreateAnnouncement={async (payload) => {
              if (isPreview) {
                const announcement: Announcement = {
                  id: nextPreviewId('ann'),
                  ...payload,
                  isActive: true,
                  createdByUid: previewUid || 'preview-admin',
                  createdByEmail: previewEmail || 'preview-admin@calabarfood.ng',
                  createdAt: new Date().toISOString(),
                };
                setAdminAnnouncements((prev) => [announcement, ...prev]);
                setAnnouncements((prev) => [announcement, ...prev]);
                addPreviewLog(
                  'Create Announcement',
                  'Announcement',
                  announcement.id,
                  `Published "${payload.title}".`,
                );
                addToast(`Announcement "${payload.title}" published`);
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminCreateAnnouncement(payload, firebaseUser);
                addToast(`Announcement "${payload.title}" published`);
              } catch (err) {
                handleDbError(err, 'Could not publish announcement.');
              }
            }}
            onToggleAnnouncement={async (ann) => {
              if (isPreview) {
                const update = (prev: Announcement[]) =>
                  prev.map((a) => (a.id === ann.id ? { ...a, isActive: !a.isActive } : a));
                setAdminAnnouncements(update);
                setAnnouncements(update);
                addPreviewLog(
                  'Toggle Announcement',
                  'Announcement',
                  ann.id,
                  `${ann.title} status updated.`,
                );
                addToast('Announcement status updated');
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminToggleAnnouncement(ann, firebaseUser);
                addToast('Announcement status updated');
              } catch (err) {
                handleDbError(err, 'Could not toggle announcement.');
              }
            }}
            onDeleteAnnouncement={async (id) => {
              if (isPreview) {
                setAdminAnnouncements((prev) => prev.filter((a) => a.id !== id));
                setAnnouncements((prev) => prev.filter((a) => a.id !== id));
                addPreviewLog('Delete Announcement', 'Announcement', id, 'Announcement deleted.');
                addToast('Announcement deleted', 'info');
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminDeleteAnnouncement(id, firebaseUser);
                addToast('Announcement deleted', 'info');
              } catch (err) {
                handleDbError(err, 'Could not delete announcement.');
              }
            }}
            onUpdateSettings={async (next) => {
              if (isPreview) {
                setSettings(next);
                addPreviewLog(
                  'Update Platform Settings',
                  'Settings',
                  'platform',
                  'Platform settings updated in preview.',
                );
                addToast('Platform settings saved locally (preview)');
                return;
              }
              if (!firebaseUser) return;
              try {
                await adminUpdateSettings(next, firebaseUser);
                addToast('Platform settings saved to Firestore');
              } catch (err) {
                handleDbError(err, 'Could not save settings.');
              }
            }}
            onReseedDatabase={async () => {
              if (isPreview) {
                setRestaurants(INITIAL_RESTAURANTS);
                setMenuItems(INITIAL_MENU_ITEMS);
                setFoodCategories(INITIAL_FOOD_CATEGORIES);
                setOrders(INITIAL_ORDERS);
                setTransactions(INITIAL_TRANSACTIONS);
                setCustomers(INITIAL_CUSTOMERS);
                setApplications(INITIAL_VENDOR_APPLICATIONS);
                setDisputes(INITIAL_DISPUTES);
                setAdminAnnouncements(INITIAL_ANNOUNCEMENTS);
                setAnnouncements(INITIAL_ANNOUNCEMENTS);
                setActivityLogs(INITIAL_ACTIVITY_LOGS);
                setSettings(INITIAL_SETTINGS);
                addToast('Demo catalog restored in preview');
                return;
              }
              if (!firebaseUser) return;
              try {
                await seedMarketplaceIfEmpty(firebaseUser, true);
                addToast('Calabar catalog synced to Firestore');
              } catch (err) {
                handleDbError(err, 'Could not sync catalog.');
              }
            }}
          />
        )}

        {currentView === 'super-admin-dashboard' && (
          <SuperAdminDashboard
            authReady={authReady || previewRole !== null}
            isSignedIn={effectiveIsSignedIn}
            userEmail={firebaseUser?.email || previewEmail}
            userName={isPreview ? 'Super Admin Preview' : customerProfile.name}
            userRole={effectiveRole}
            authLoading={authLoading && !isPreview}
            authError={portalAuthError}
            onGoogleSignIn={() => handleGoogleSignIn('super-admin')}
            onSignOut={
              isPreview
                ? async () => {
                    window.location.href = `${window.location.pathname}#home`;
                  }
                : handleSignOut
            }
            restaurants={restaurants}
            menuItems={menuItems}
            customers={customers}
            orders={orders}
            transactions={transactions}
            applications={applications}
            disputes={disputes}
            announcements={adminAnnouncements}
            activityLogs={activityLogs}
            settings={settings}
            onOpenAdminPortal={openAdminPortal}
          />
        )}
      </main>

      <Footer
        onNavigate={setCurrentView}
        onOpenVendorApply={() => setVendorApplyOpen(true)}
        onOpenVendorPortal={openVendorPortal}
        onOpenAdminPortal={openAdminPortal}
        onOpenSuperAdminPortal={openSuperAdminPortal}
        onShowInfoToast={(msg) => addToast(msg, 'info')}
      />

      {/* Slide-over Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        restaurant={cartRestaurant}
        serviceCharge={settings.serviceChargeFlat}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => {
          setCartItems([]);
          addToast('Cart cleared', 'info');
        }}
        onProceedToCheckout={() => {
          setCartOpen(false);
          setCurrentView('checkout');
        }}
        onBrowseRestaurants={() => setCurrentView('restaurants')}
      />

      {/* Product Detail Panel Modal */}
      <MealDetailModal
        meal={activeMealModal}
        restaurantName={modalRestaurant?.name || 'Calabar Kitchen'}
        restaurantIsOpen={modalRestaurant?.isOpen ?? true}
        onClose={() => setActiveMealModal(null)}
        onAddToCart={handleRequestAddToCart}
      />

      {/* One-Restaurant-Per-Cart Enforcement Dialog */}
      <ConfirmDialog
        open={Boolean(pendingCartAddition)}
        title="Start a new cart?"
        description={
          pendingCartAddition && cartRestaurant
            ? `Your cart currently contains meals from ${cartRestaurant.name}. In Calabar Food Marketplace, orders are placed with one restaurant at a time. Clear your existing cart to add "${pendingCartAddition.meal.name}"?`
            : ''
        }
        confirmLabel="Clear cart & add"
        cancelLabel="Keep current cart"
        onCancel={() => setPendingCartAddition(null)}
        onConfirm={() => {
          if (pendingCartAddition) {
            commitAddToCart(pendingCartAddition, true);
            setPendingCartAddition(null);
          }
        }}
      />

      {/* Login / Sign up Modal (Firebase Google Auth) */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        isSignedIn={Boolean(firebaseUser)}
        userEmail={firebaseUser?.email || undefined}
        userName={customerProfile.name}
        userRole={userRole}
        authLoading={authLoading}
        requiredRole={authRequiredRole}
        authError={portalAuthError}
        onGoogleSignIn={() => handleGoogleSignIn(authRequiredRole)}
        onSignOut={handleSignOut}
      />

      {/* Become a Vendor Modal */}
      <VendorApplyModal
        open={vendorApplyOpen}
        onClose={() => setVendorApplyOpen(false)}
        onSubmitApplication={async (payload) => {
          if (isPreview) {
            const application: VendorApplication = {
              id: nextPreviewId('app'),
              applicantUid: previewUid,
              ...payload,
              submittedAt: new Date().toISOString(),
              status: 'Pending',
            };
            setApplications((prev) => [application, ...prev]);
            addPreviewLog(
              'Submit Vendor Application',
              'VendorApplication',
              application.id,
              `${payload.businessName} applied to become a vendor.`,
            );
            setVendorApplyOpen(false);
            addToast('Vendor application submitted to Admin review queue (preview)');
            return;
          }
          if (!firebaseUser) {
            setVendorApplyOpen(false);
            openCustomerAuth();
            addToast('Please sign in with Google first to submit your kitchen application.', 'warning');
            return;
          }
          try {
            await customerSubmitVendorApplication(payload, firebaseUser);
            setVendorApplyOpen(false);
            addToast('Vendor application submitted to Admin review queue!');
          } catch (err) {
            handleDbError(err, 'Could not submit vendor application.');
          }
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
