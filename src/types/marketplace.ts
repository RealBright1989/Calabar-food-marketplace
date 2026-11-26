export type FoodCategory =
  | 'Rice'
  | 'Soups'
  | 'Swallow'
  | 'Fast food'
  | 'Grills'
  | 'Seafood'
  | 'Drinks'
  | 'Snacks'
  | 'Desserts';

export type RestaurantCategory =
  | 'Local Nigerian Food'
  | 'Fast Food'
  | 'Pizza'
  | 'Seafood'
  | 'Grills'
  | 'Drinks';

export type PriceTier = '₦' | '₦₦' | '₦₦₦';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type UserRole = 'customer' | 'vendor' | 'admin' | 'super-admin';

export type OrderStatus =
  | 'Order placed'
  | 'Payment confirmed'
  | 'Vendor accepted'
  | 'Preparing your food'
  | 'Ready for delivery'
  | 'Out for delivery'
  | 'Delivered'
  | 'Cancelled';

export type PaymentStatus = 'Paid' | 'Pending' | 'Refunded';

export type AppView =
  | 'home'
  | 'restaurants'
  | 'restaurant-detail'
  | 'checkout'
  | 'order-tracking'
  | 'account'
  | 'vendor-dashboard'
  | 'admin-dashboard'
  | 'super-admin-dashboard';

export interface MenuSizeOption {
  id: string;
  label: string;
  priceDelta: number;
}

export interface MenuExtraOption {
  id: string;
  label: string;
  price: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  ownerUid?: string;
  name: string;
  description: string;
  category: FoodCategory;
  menuSection: string;
  price: number;
  image: string;
  available: boolean;
  popular?: boolean;
  sizes?: MenuSizeOption[];
  extras?: MenuExtraOption[];
  toppings?: MenuExtraOption[];
  spiceLevels?: string[];
}

export interface FoodCategoryDoc {
  id: string;
  label: string;
  subtitle: string;
  image: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  categories: FoodCategory[];
  restaurantCategories: RestaurantCategory[];
  priceTier: PriceTier;
  averageMealPrice: number;
  neighbourhood: string;
  address: string;
  location?: GeoPoint;
  description: string;
  coverImage: string;
  logoText: string;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  deliveryFee: number;
  minimumOrder: number;
  openingHours: string;
  isOpen: boolean;
  status: 'Active' | 'Suspended';
  rating: number | null;
  reviewCount: number;
  popularityScore: number;
  ownerUid?: string;
}

export interface CartItem {
  cartItemId: string;
  menuItem: MenuItem;
  restaurantId: string;
  restaurantName: string;
  quantity: number;
  selectedSize?: MenuSizeOption;
  selectedExtras: MenuExtraOption[];
  selectedToppings?: MenuExtraOption[];
  selectedSpice?: string;
  note?: string;
  unitPrice: number;
}

export interface OrderItemSummary {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  optionsText?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  neighbourhood: string;
  deliveryInstructions?: string;
  pickupLocation?: GeoPoint;
  deliveryLocation?: GeoPoint;
  deliveryDistanceKm?: number;
  deliveryDurationMin?: number;
  locationSource?: 'google' | 'estimated';
  restaurantId: string;
  restaurantOwnerUid?: string;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone: string;
  items: OrderItemSummary[];
  subtotal: number;
  deliveryFee: number;
  serviceCharge: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  placedAt: string;
  estimatedDelivery: string;
  paymentMethod: 'Paystack';
}

export interface TransactionRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  restaurantOwnerUid: string;
  restaurantName: string;
  customerId: string;
  customerName: string;
  reference: string;
  gateway: string;
  type: 'Charge' | 'Refund';
  grossAmount: number;
  subtotalAmount: number;
  commissionRatePercent: number;
  commissionAmount: number;
  vendorPayout: number;
  serviceCharge: number;
  verificationStatus: 'Pending Verification' | 'Verified' | 'Refunded';
  verifiedByUid?: string;
  verifiedAt?: string;
  createdAt?: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  street: string;
  neighbourhood: string;
  lat?: number;
  lng?: number;
}

export interface NotificationPreferences {
  smsOrderAlerts: boolean;
  emailReceipts: boolean;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  neighbourhood: string;
  role?: UserRole;
  accountStatus?: 'Active' | 'Suspended';
  vendorRestaurantId?: string;
  savedAddresses: SavedAddress[];
  notificationPreferences?: NotificationPreferences;
  joinedAt: string;
  totalOrders: number;
  totalSpent: number;
}

export interface VendorApplication {
  id: string;
  applicantUid?: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  neighbourhood: string;
  cuisine: string;
  submittedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewNote?: string;
  reviewedByUid?: string;
}

export interface Dispute {
  id: string;
  orderNumber: string;
  orderId?: string;
  customerId?: string;
  customerName: string;
  restaurantId?: string;
  restaurantOwnerUid?: string;
  restaurantName: string;
  reason: string;
  amount: number;
  status: 'Open' | 'Investigating' | 'Resolved' | 'Refunded';
  resolutionNote?: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  targetAudience: 'all' | 'vendors' | 'customers';
  priority: 'Normal' | 'Important';
  isActive: boolean;
  createdByUid: string;
  createdByEmail: string;
  createdAt?: string;
}

export interface ActivityLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt?: string;
}

export interface MarketplaceSettings {
  commissionRatePercent: number;
  serviceChargeFlat: number;
  defaultDeliveryFee: number;
  minPlatformOrder: number;
  defaultCity: string;
  paystackMode: 'Test Preview' | 'Live';
  autoAcceptOrders: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
