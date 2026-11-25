import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Plus,
  Settings,
  Store,
  Truck,
  Utensils,
} from 'lucide-react';
import { FOOD_CATEGORIES, IMAGES } from '../../data/calabarData';
import { FoodCategory, MenuItem, Order, OrderStatus, Restaurant } from '../../types/marketplace';
import { formatOrderTime, formatShortDate } from '../../utils/format';
import {
  ConfirmDialog,
  EmptyState,
  InputField,
  PriceDisplay,
  PrimaryButton,
  ResilientImage,
  StatusBadge,
} from '../ui/Primitives';

type VendorTab =
  | 'overview'
  | 'orders'
  | 'menu'
  | 'sales'
  | 'profile'
  | 'delivery'
  | 'account';

interface VendorDashboardProps {
  restaurants: Restaurant[];
  menuItems: MenuItem[];
  orders: Order[];
  selectedVendorId: string;
  onSelectVendorId: (id: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onToggleMenuItemAvailability: (itemId: string) => void;
  onAddMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  onUpdateRestaurant: (restaurantId: string, patch: Partial<Restaurant>) => void;
  isSignedIn: boolean;
  currentUid?: string;
  userRole?: string;
  onGoogleSignIn: () => Promise<void>;
  onOpenVendorApply: () => void;
  /** Dev-only local preview: expose every kitchen without an owner UID. */
  previewMode?: boolean;
}

export const VendorDashboard: React.FC<VendorDashboardProps> = ({
  restaurants,
  menuItems,
  orders,
  selectedVendorId,
  onSelectVendorId,
  onUpdateOrderStatus,
  onToggleMenuItemAvailability,
  onAddMenuItem,
  onUpdateRestaurant,
  isSignedIn,
  currentUid,
  userRole,
  onGoogleSignIn,
  onOpenVendorApply,
  previewMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<VendorTab>('overview');
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [showAddDish, setShowAddDish] = useState(false);

  // Add dish form state
  const [dishName, setDishName] = useState('');
  const [dishDesc, setDishDesc] = useState('');
  const [dishPrice, setDishPrice] = useState('3500');
  const [dishCategory, setDishCategory] = useState<FoodCategory>('Rice');
  const [dishSection, setDishSection] = useState('Chef Specials');

  const accessibleRestaurants = useMemo(() => {
    if (previewMode || userRole === 'admin') return restaurants;
    if (userRole === 'vendor' && currentUid) {
      return restaurants.filter((r) => r.ownerUid === currentUid);
    }
    return [];
  }, [previewMode, restaurants, userRole, currentUid]);

  const vendor =
    accessibleRestaurants.find((r) => r.id === selectedVendorId) ||
    accessibleRestaurants[0] ||
    restaurants[0];

  const vendorOrders = useMemo(
    () => (vendor ? orders.filter((o) => o.restaurantId === vendor.id) : []),
    [orders, vendor],
  );
  const vendorMenu = useMemo(
    () => menuItems.filter((m) => m.restaurantId === vendor.id),
    [menuItems, vendor.id],
  );

  // Store profile & delivery local form sync
  const [profileDesc, setProfileDesc] = useState(vendor.description);
  const [openingHours, setOpeningHours] = useState(vendor.openingHours);
  const [deliveryFee, setDeliveryFee] = useState(String(vendor.deliveryFee));
  const [minOrder, setMinOrder] = useState(String(vendor.minimumOrder));
  const [minMins, setMinMins] = useState(String(vendor.deliveryTimeMin));
  const [maxMins, setMaxMins] = useState(String(vendor.deliveryTimeMax));

  useEffect(() => {
    if (!vendor) return;
    setProfileDesc(vendor.description);
    setOpeningHours(vendor.openingHours);
    setDeliveryFee(String(vendor.deliveryFee));
    setMinOrder(String(vendor.minimumOrder));
    setMinMins(String(vendor.deliveryTimeMin));
    setMaxMins(String(vendor.deliveryTimeMax));
  }, [
    vendor?.id,
    vendor?.description,
    vendor?.openingHours,
    vendor?.deliveryFee,
    vendor?.minimumOrder,
    vendor?.deliveryTimeMin,
    vendor?.deliveryTimeMax,
  ]);

  const handleVendorSwitch = (newId: string) => {
    onSelectVendorId(newId);
    const next = restaurants.find((r) => r.id === newId);
    if (next) {
      setProfileDesc(next.description);
      setOpeningHours(next.openingHours);
      setDeliveryFee(String(next.deliveryFee));
      setMinOrder(String(next.minimumOrder));
      setMinMins(String(next.deliveryTimeMin));
      setMaxMins(String(next.deliveryTimeMax));
    }
  };

  const pendingOrders = vendorOrders.filter(
    (o) => o.status === 'Order placed' || o.status === 'Payment confirmed',
  );
  const completedOrders = vendorOrders.filter((o) => o.status === 'Delivered');
  const totalSales = vendorOrders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + o.subtotal, 0);

  const navItems: { id: VendorTab; label: string; Icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', Icon: ClipboardList },
    { id: 'menu', label: 'Menu management', Icon: Utensils },
    { id: 'sales', label: 'Sales', Icon: BarChart3 },
    { id: 'profile', label: 'Store profile', Icon: Store },
    { id: 'delivery', label: 'Delivery settings', Icon: Truck },
    { id: 'account', label: 'Account settings', Icon: Settings },
  ];

  const getNextVendorStep = (status: OrderStatus): OrderStatus | null => {
    switch (status) {
      case 'Vendor accepted':
        return 'Preparing your food';
      case 'Preparing your food':
        return 'Ready for delivery';
      case 'Ready for delivery':
        return 'Out for delivery';
      case 'Out for delivery':
        return 'Delivered';
      default:
        return null;
    }
  };

  const handleCreateDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (dishName.trim().length < 2 || Number(dishPrice) <= 0) return;

    const categoryImg =
      FOOD_CATEGORIES.find((c) => c.id === dishCategory)?.image || IMAGES.jollofChicken;

    onAddMenuItem({
      restaurantId: vendor.id,
      name: dishName.trim(),
      description:
        dishDesc.trim().length >= 2
          ? dishDesc.trim()
          : 'Freshly prepared to order at our Calabar kitchen.',
      category: dishCategory,
      menuSection: dishSection.trim() || 'Specials',
      price: Number(dishPrice),
      image: categoryImg,
      available: true,
      popular: false,
    });

    setDishName('');
    setDishDesc('');
    setDishPrice('3500');
    setShowAddDish(false);
  };

  if (!isSignedIn) {
    return (
      <div className="max-w-[720px] mx-auto px-4 md:px-6 py-16">
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-[10px] bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center mx-auto">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-[24px] font-bold text-[#1C1917]">Vendor portal sign-in required</h1>
          <p className="text-[15px] text-[#78716C] max-w-md mx-auto leading-relaxed">
            Sign in with your approved vendor account to manage your restaurant menu, incoming
            orders, and payouts. Each vendor can only access their own kitchen records.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <PrimaryButton onClick={() => void onGoogleSignIn()}>
              Sign in with Google
            </PrimaryButton>
            <PrimaryButton variant="outline" onClick={onOpenVendorApply}>
              Apply to become a vendor
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  if (accessibleRestaurants.length === 0) {
    return (
      <div className="max-w-[720px] mx-auto px-4 md:px-6 py-16">
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-[10px] bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center mx-auto">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-[24px] font-bold text-[#1C1917]">
            No approved vendor kitchen linked
          </h1>
          <p className="text-[15px] text-[#78716C] max-w-md mx-auto leading-relaxed">
            Your current role is <strong className="capitalize">{userRole || 'customer'}</strong>.
            To protect merchant privacy, you can only view a vendor dashboard after your kitchen
            application is approved by an administrator.
          </p>
          <div className="pt-2">
            <PrimaryButton onClick={onOpenVendorApply}>Apply to become a vendor</PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-8">
      {/* Top Vendor Context Bar */}
      <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4 sm:p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[10px] bg-[#1C1917] text-white font-bold flex items-center justify-center shrink-0">
            {vendor.logoText}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[20px] font-bold text-[#1C1917]">{vendor.name}</h1>
              <span
                className={`text-[13px] font-semibold ${
                  vendor.isOpen ? 'text-[#15803D]' : 'text-[#DC2626]'
                }`}
              >
                · {vendor.isOpen ? 'Open for orders' : 'Closed'}
              </span>
            </div>
            <p className="text-[13px] text-[#78716C]">{vendor.address}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {accessibleRestaurants.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="vendor-select" className="text-[13px] text-[#78716C] whitespace-nowrap">
                {userRole === 'admin' ? 'Admin oversight:' : 'Switch kitchen:'}
              </label>
              <select
                id="vendor-select"
                value={vendor.id}
                onChange={(e) => handleVendorSwitch(e.target.value)}
                className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] bg-white text-[13px] font-medium text-[#1C1917] cursor-pointer"
              >
                {accessibleRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <PrimaryButton
            size="sm"
            variant={vendor.isOpen ? 'outline' : 'primary'}
            onClick={() => onUpdateRestaurant(vendor.id, { isOpen: !vendor.isOpen })}
          >
            {vendor.isOpen ? 'Close store' : 'Open store'}
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Responsive Navigation: horizontal scroll strip on mobile/tablet, sticky sidebar on lg+ */}
        <aside className="lg:col-span-3 bg-white border border-[#E7E5E4] rounded-[12px] p-2 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar lg:sticky lg:top-24">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`lg:w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-[8px] text-[14px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === id
                  ? 'bg-[#FFF7ED] text-[#EA580C] font-semibold'
                  : 'text-[#1C1917] hover:bg-[#F5F5F4]'
              }`}
            >
              <span className="flex items-center gap-2.5 lg:gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </span>
              {id === 'orders' && pendingOrders.length > 0 && (
                <span className="text-[12px] font-bold text-[#EA580C] tabular-nums">
                  {pendingOrders.length}
                </span>
              )}
            </button>
          ))}
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-9 space-y-6 min-w-0">
          {activeTab === 'overview' && (
            <>
              {/* Overview 4 KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Today&apos;s orders</p>
                  <p className="text-[26px] font-bold text-[#1C1917] mt-1 tabular-nums">
                    {vendorOrders.length}
                  </p>
                </div>
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Today&apos;s sales</p>
                  <PriceDisplay
                    amount={totalSales}
                    className="block text-[26px] font-bold text-[#1C1917] mt-1"
                  />
                </div>
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Pending orders</p>
                  <p className="text-[26px] font-bold text-[#D97706] mt-1 tabular-nums">
                    {pendingOrders.length}
                  </p>
                </div>
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Completed orders</p>
                  <p className="text-[26px] font-bold text-[#15803D] mt-1 tabular-nums">
                    {completedOrders.length}
                  </p>
                </div>
              </div>

              {/* Actionable Incoming Orders */}
              <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[18px] font-semibold text-[#1C1917]">
                    Recent &amp; active orders
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="text-[13px] font-semibold text-[#EA580C] hover:underline cursor-pointer"
                  >
                    Manage all orders
                  </button>
                </div>

                {vendorOrders.length === 0 ? (
                  <EmptyState
                    title="No orders yet for this kitchen"
                    description="New customer orders placed on the storefront will appear here automatically."
                  />
                ) : (
                  <div className="divide-y divide-[#E7E5E4]">
                    {vendorOrders.slice(0, 4).map((order) => (
                      <div
                        key={order.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-[14px] font-bold text-[#1C1917]">
                              {order.orderNumber}
                            </span>
                            <span className="text-[14px] font-medium text-[#1C1917]">
                              {order.customerName}
                            </span>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="text-[13px] text-[#78716C] mt-0.5">
                            {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <PriceDisplay
                            amount={order.total}
                            className="text-[15px] font-bold text-[#1C1917]"
                          />
                          {(order.status === 'Order placed' ||
                            order.status === 'Payment confirmed') && (
                            <PrimaryButton
                              size="sm"
                              onClick={() => onUpdateOrderStatus(order.id, 'Vendor accepted')}
                            >
                              Accept
                            </PrimaryButton>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h2 className="text-[20px] font-semibold text-[#1C1917]">Order management</h2>
              {vendorOrders.length === 0 ? (
                <EmptyState
                  title="No active orders"
                  description="Orders placed by Calabar customers for your kitchen will show up here with Accept and Reject actions."
                />
              ) : (
                <div className="space-y-4">
                  {vendorOrders.map((order) => {
                    const isAwaitingAction =
                      order.status === 'Order placed' || order.status === 'Payment confirmed';
                    const nextStep = getNextVendorStep(order.status);

                    return (
                      <div
                        key={order.id}
                        className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E7E5E4]">
                          <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-mono text-[15px] font-bold text-[#1C1917]">
                                {order.orderNumber}
                              </span>
                              <StatusBadge status={order.status} />
                              <StatusBadge status={order.paymentStatus} />
                            </div>
                            <p className="text-[13px] text-[#78716C] mt-1">
                              Placed at {formatOrderTime(order.placedAt)} · {order.customerName} (
                              {order.customerPhone})
                            </p>
                          </div>
                          <PriceDisplay
                            amount={order.total}
                            className="text-[18px] font-bold text-[#1C1917]"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[14px]">
                          <div>
                            <p className="text-[12px] font-medium text-[#78716C] mb-1">
                              Items ordered
                            </p>
                            <ul className="space-y-1 text-[#1C1917]">
                              {order.items.map((item, i) => (
                                <li key={i}>
                                  <span className="font-semibold tabular-nums">
                                    {item.quantity}×
                                  </span>{' '}
                                  {item.name}
                                  {item.optionsText && (
                                    <span className="text-[12px] text-[#78716C]">
                                      {' '}
                                      ({item.optionsText})
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[12px] font-medium text-[#78716C] mb-1">
                              Delivery address
                            </p>
                            <p className="text-[#1C1917]">
                              {order.deliveryAddress} ({order.neighbourhood})
                            </p>
                            {order.deliveryInstructions && (
                              <p className="text-[13px] text-[#78716C] mt-1">
                                Note: {order.deliveryInstructions}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#E7E5E4] flex flex-wrap items-center justify-end gap-2.5">
                          {isAwaitingAction && (
                            <>
                              <PrimaryButton
                                size="sm"
                                variant="outline"
                                onClick={() => setRejectOrderId(order.id)}
                              >
                                Reject order
                              </PrimaryButton>
                              <PrimaryButton
                                size="sm"
                                onClick={() => onUpdateOrderStatus(order.id, 'Vendor accepted')}
                              >
                                Accept order
                              </PrimaryButton>
                            </>
                          )}
                          {nextStep && (
                            <PrimaryButton
                              size="sm"
                              onClick={() => onUpdateOrderStatus(order.id, nextStep)}
                            >
                              Update to: {nextStep}
                            </PrimaryButton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-semibold text-[#1C1917]">Menu management</h2>
                  <p className="text-[14px] text-[#78716C]">
                    Mark dishes out of stock or add new meals to your Calabar menu.
                  </p>
                </div>
                <PrimaryButton size="sm" onClick={() => setShowAddDish(!showAddDish)}>
                  <Plus className="w-4 h-4" />
                  <span>{showAddDish ? 'Close form' : 'Add new meal'}</span>
                </PrimaryButton>
              </div>

              {showAddDish && (
                <form
                  onSubmit={handleCreateDish}
                  className="bg-[#FFF7ED]/70 border border-[#E7E5E4] rounded-[12px] p-5 space-y-4"
                >
                  <h3 className="text-[16px] font-semibold text-[#1C1917]">Add dish to menu</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField
                      label="Meal name"
                      value={dishName}
                      onChange={(e) => setDishName(e.target.value)}
                      placeholder="E.g. Ekpang Nkukwo Special"
                      required
                    />
                    <InputField
                      label="Price (NGN)"
                      type="number"
                      min={200}
                      value={dishPrice}
                      onChange={(e) => setDishPrice(e.target.value)}
                      required
                    />
                    <div>
                      <label className="block text-[13px] font-medium text-[#1C1917] mb-1.5">
                        Category
                      </label>
                      <select
                        value={dishCategory}
                        onChange={(e) => setDishCategory(e.target.value as FoodCategory)}
                        className="w-full h-12 px-3.5 rounded-[8px] border border-[#E7E5E4] bg-white text-[15px]"
                      >
                        {FOOD_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <InputField
                      label="Menu section"
                      value={dishSection}
                      onChange={(e) => setDishSection(e.target.value)}
                      placeholder="E.g. Signature Efik Soups"
                    />
                  </div>
                  <InputField
                    label="Short description"
                    value={dishDesc}
                    onChange={(e) => setDishDesc(e.target.value)}
                    placeholder="Describe ingredients and sides..."
                  />
                  <div className="flex justify-end gap-2">
                    <PrimaryButton variant="outline" onClick={() => setShowAddDish(false)}>
                      Cancel
                    </PrimaryButton>
                    <PrimaryButton type="submit">Save dish</PrimaryButton>
                  </div>
                </form>
              )}

              <div className="bg-white border border-[#E7E5E4] rounded-[12px] divide-y divide-[#E7E5E4]">
                {vendorMenu.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-16 h-12 rounded-[8px] overflow-hidden shrink-0 bg-[#F5F5F4]">
                        <ResilientImage
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[#1C1917] truncate">
                          {item.name}
                        </p>
                        <p className="text-[13px] text-[#78716C]">
                          {item.menuSection} ·{' '}
                          <PriceDisplay amount={item.price} className="font-medium text-[#1C1917]" />
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-[13px] font-semibold ${
                          item.available ? 'text-[#15803D]' : 'text-[#DC2626]'
                        }`}
                      >
                        {item.available ? 'Available' : 'Out of stock'}
                      </span>
                      <PrimaryButton
                        size="sm"
                        variant="outline"
                        onClick={() => onToggleMenuItemAvailability(item.id)}
                      >
                        {item.available ? 'Mark unavailable' : 'Mark available'}
                      </PrimaryButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-semibold text-[#1C1917]">Sales breakdown</h2>
                <PriceDisplay
                  amount={totalSales}
                  className="text-[18px] font-bold text-[#15803D]"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="border-b border-[#E7E5E4] text-[12px] text-[#78716C]">
                    <tr>
                      <th className="py-2.5 pr-4 font-medium">Order</th>
                      <th className="py-2.5 pr-4 font-medium">Date</th>
                      <th className="py-2.5 pr-4 font-medium">Customer</th>
                      <th className="py-2.5 pr-4 font-medium">Status</th>
                      <th className="py-2.5 text-right font-medium">Food subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E5E4]">
                    {vendorOrders.map((order) => (
                      <tr key={order.id} className="h-11">
                        <td className="py-2.5 pr-4 font-mono font-semibold text-[#1C1917]">
                          {order.orderNumber}
                        </td>
                        <td className="py-2.5 pr-4 text-[#78716C] tabular-nums">
                          {formatShortDate(order.placedAt)}
                        </td>
                        <td className="py-2.5 pr-4 text-[#1C1917]">{order.customerName}</td>
                        <td className="py-2.5 pr-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="py-2.5 text-right font-semibold text-[#1C1917]">
                          <PriceDisplay amount={order.subtotal} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateRestaurant(vendor.id, {
                  description: profileDesc,
                  openingHours,
                });
              }}
              className="bg-white border border-[#E7E5E4] rounded-[12px] p-6 space-y-4"
            >
              <h2 className="text-[20px] font-semibold text-[#1C1917]">Store profile</h2>
              <InputField
                label="Opening hours"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
              />
              <div>
                <label className="block text-[13px] font-medium text-[#1C1917] mb-1.5">
                  Store description
                </label>
                <textarea
                  rows={3}
                  value={profileDesc}
                  onChange={(e) => setProfileDesc(e.target.value)}
                  className="w-full p-3 rounded-[8px] border border-[#E7E5E4] focus:border-[#EA580C] focus:outline-none text-[15px]"
                />
              </div>
              <PrimaryButton type="submit">Save store profile</PrimaryButton>
            </form>
          )}

          {activeTab === 'delivery' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsedMin = Math.max(5, Math.min(180, Number(minMins) || 20));
                const parsedMax = Math.max(parsedMin, Math.min(240, Number(maxMins) || 35));
                onUpdateRestaurant(vendor.id, {
                  deliveryFee: Math.max(0, Number(deliveryFee) || 0),
                  minimumOrder: Math.max(0, Number(minOrder) || 0),
                  deliveryTimeMin: parsedMin,
                  deliveryTimeMax: parsedMax,
                });
              }}
              className="bg-white border border-[#E7E5E4] rounded-[12px] p-6 space-y-4"
            >
              <h2 className="text-[20px] font-semibold text-[#1C1917]">Delivery settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Delivery fee (NGN)"
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                />
                <InputField
                  label="Minimum order (NGN)"
                  type="number"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                />
                <InputField
                  label="Min delivery estimate (mins)"
                  type="number"
                  value={minMins}
                  onChange={(e) => setMinMins(e.target.value)}
                />
                <InputField
                  label="Max delivery estimate (mins)"
                  type="number"
                  value={maxMins}
                  onChange={(e) => setMaxMins(e.target.value)}
                />
              </div>
              <PrimaryButton type="submit">Save delivery settings</PrimaryButton>
            </form>
          )}

          {activeTab === 'account' && (
            <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-6 space-y-4">
              <h2 className="text-[20px] font-semibold text-[#1C1917]">Account &amp; payouts</h2>
              <p className="text-[14px] text-[#78716C]">
                Vendor settlement payouts are processed automatically after Paystack order
                confirmation, minus the marketplace commission.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <InputField label="Payout bank" defaultValue="Zenith Bank Nigeria" readOnly />
                <InputField label="Account number" defaultValue="2084193022" readOnly />
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(rejectOrderId)}
        title="Reject customer order?"
        description="Rejecting this order will mark it as Cancelled and initiate a Paystack refund to the customer."
        confirmLabel="Reject order"
        variant="danger"
        onCancel={() => setRejectOrderId(null)}
        onConfirm={() => {
          if (rejectOrderId) {
            onUpdateOrderStatus(rejectOrderId, 'Cancelled');
          }
          setRejectOrderId(null);
        }}
      />
    </div>
  );
};
