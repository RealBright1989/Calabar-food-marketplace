import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  CreditCard,
  Eye,
  FileCheck2,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Settings,
  ShieldCheck,
  Store,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { ORDER_TIMELINE_STEPS } from '../../data/calabarData';
import {
  ActivityLog,
  Announcement,
  CustomerProfile,
  Dispute,
  FoodCategoryDoc,
  MarketplaceSettings,
  MenuItem,
  Order,
  OrderStatus,
  Restaurant,
  TransactionRecord,
  UserRole,
  VendorApplication,
} from '../../types/marketplace';
import { formatOrderTime, formatShortDate } from '../../utils/format';
import {
  EmptyState,
  LoadingState,
  PriceDisplay,
  PrimaryButton,
  StatusBadge,
} from '../ui/Primitives';
import {
  ActivityLogsPanel,
  AnnouncementsPanel,
  FoodCatalogPanel,
  PaymentsLedgerPanel,
  PlatformSettingsPanel,
  ReportsAnalyticsPanel,
  RestaurantsPanel,
} from './AdminSubPanels';

type AdminTab =
  | 'overview'
  | 'vendors'
  | 'restaurants'
  | 'applications'
  | 'customers'
  | 'orders'
  | 'catalog'
  | 'payments'
  | 'disputes'
  | 'reports'
  | 'announcements'
  | 'settings'
  | 'logs';

interface AdminDashboardProps {
  authReady: boolean;
  isSignedIn: boolean;
  userEmail?: string;
  userName?: string;
  userRole: UserRole;
  authLoading: boolean;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  restaurants: Restaurant[];
  menuItems: MenuItem[];
  categories: FoodCategoryDoc[];
  applications: VendorApplication[];
  customers: CustomerProfile[];
  orders: Order[];
  transactions: TransactionRecord[];
  disputes: Dispute[];
  announcements: Announcement[];
  activityLogs: ActivityLog[];
  settings: MarketplaceSettings;
  onApproveApplication: (app: VendorApplication, reviewNote?: string) => Promise<void>;
  onRejectApplication: (app: VendorApplication, reviewNote: string) => Promise<void>;
  onToggleVendorStatus: (restaurant: Restaurant) => Promise<void>;
  onUpdateRestaurantDetails: (
    restaurantId: string,
    name: string,
    patch: Partial<Restaurant>,
  ) => Promise<void>;
  onToggleCustomerStatus: (customer: CustomerProfile) => Promise<void>;
  onUpdateOrderStatus: (order: Order, nextStatus: OrderStatus) => Promise<void>;
  onVerifyTransaction: (txn: TransactionRecord) => Promise<void>;
  onIssueTransactionRefund: (txn: TransactionRecord) => Promise<void>;
  onUpdateDisputeStatus: (
    dispute: Dispute,
    status: Dispute['status'],
    resolutionNote: string,
  ) => Promise<void>;
  onSaveCategory: (cat: FoodCategoryDoc, isNew: boolean) => Promise<void>;
  onToggleMenuItemAvailability: (item: MenuItem) => Promise<void>;
  onCreateAnnouncement: (payload: {
    title: string;
    message: string;
    targetAudience: Announcement['targetAudience'];
    priority: Announcement['priority'];
  }) => Promise<void>;
  onToggleAnnouncement: (ann: Announcement) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onUpdateSettings: (next: MarketplaceSettings) => Promise<void>;
  onReseedDatabase: () => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  authReady,
  isSignedIn,
  userEmail,
  userName,
  userRole,
  authLoading,
  onGoogleSignIn,
  onSignOut,
  restaurants,
  menuItems,
  categories,
  applications,
  customers,
  orders,
  transactions,
  disputes,
  announcements,
  activityLogs,
  settings,
  onApproveApplication,
  onRejectApplication,
  onToggleVendorStatus,
  onUpdateRestaurantDetails,
  onToggleCustomerStatus,
  onUpdateOrderStatus,
  onVerifyTransaction,
  onIssueTransactionRefund,
  onUpdateDisputeStatus,
  onSaveCategory,
  onToggleMenuItemAvailability,
  onCreateAnnouncement,
  onToggleAnnouncement,
  onDeleteAnnouncement,
  onUpdateSettings,
  onReseedDatabase,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorStatusFilter, setVendorStatusFilter] = useState<'all' | 'Active' | 'Suspended'>('all');
  const [selectedVendor, setSelectedVendor] = useState<Restaurant | null>(null);

  const [appFilter, setAppFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState('');

  const pendingApplications = applications.filter((a) => a.status === 'Pending');
  const activeRestaurants = restaurants.filter((r) => r.status === 'Active' && r.isOpen);
  const completedOrders = orders.filter((o) => o.status === 'Delivered');
  const pendingOrders = orders.filter(
    (o) => o.status !== 'Delivered' && o.status !== 'Cancelled',
  );
  const validOrders = orders.filter((o) => o.status !== 'Cancelled');
  const grossOrderValue = validOrders.reduce((sum, o) => sum + o.total, 0);
  const commissionEarned = validOrders.reduce(
    (sum, o) => sum + Math.round((o.subtotal * settings.commissionRatePercent) / 100),
    0,
  );
  const serviceFeeRevenue = validOrders.reduce((sum, o) => sum + o.serviceCharge, 0);
  const openDisputesCount = disputes.filter(
    (d) => d.status === 'Open' || d.status === 'Investigating',
  ).length;

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    return restaurants
      .filter((r) => (vendorStatusFilter === 'all' ? true : r.status === vendorStatusFilter))
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.neighbourhood.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q),
      );
  }, [restaurants, vendorSearch, vendorStatusFilter]);

  const filteredApplications = useMemo(
    () => applications.filter((a) => (appFilter === 'All' ? true : a.status === appFilter)),
    [applications, appFilter],
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return customers.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.neighbourhood.toLowerCase().includes(q) ||
        c.phone.includes(q),
    );
  }, [customers, customerSearch]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders
      .filter((o) => (orderStatusFilter === 'All' ? true : o.status === orderStatusFilter))
      .filter(
        (o) =>
          !q ||
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.restaurantName.toLowerCase().includes(q),
      );
  }, [orders, orderSearch, orderStatusFilter]);

  // ---------------------------------------------------------------------------
  // 1. Admin Authentication & RBAC Gate
  // ---------------------------------------------------------------------------
  if (!authReady) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-12">
        <LoadingState variant="rows" count={4} />
      </div>
    );
  }

  if (!isSignedIn || userRole !== 'admin') {
    return (
      <div className="max-w-[680px] mx-auto px-4 md:px-6 py-16">
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-8 space-y-5 text-center">
          <div className="w-12 h-12 rounded-[10px] bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-[24px] font-bold text-[#1C1917]">
              Administrator authentication required
            </h1>
            <p className="text-[15px] text-[#78716C] leading-relaxed">
              The Calabar Food Marketplace Admin Dashboard enforces strict role-based access control
              (RBAC). Only verified administrator accounts can inspect customer PII, approve
              vendors, verify Paystack transactions, or modify platform rules.
            </p>
          </div>

          {isSignedIn && (
            <div className="p-4 rounded-[10px] bg-[#FFF7ED] border border-[#E7E5E4] text-left space-y-1">
              <p className="text-[13px] text-[#78716C]">Currently signed in as</p>
              <p className="text-[15px] font-semibold text-[#1C1917]">
                {userName} ({userEmail})
              </p>
              <p className="text-[13px] font-semibold text-[#DC2626] capitalize">
                Role: {userRole} — Administrator permission denied
              </p>
            </div>
          )}

          {authError && <p className="text-[13px] text-[#DC2626]">{authError}</p>}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {!isSignedIn ? (
              <PrimaryButton
                size="lg"
                loading={authLoading}
                onClick={async () => {
                  setAuthError('');
                  try {
                    await onGoogleSignIn();
                  } catch (err) {
                    setAuthError(
                      err instanceof Error ? err.message : 'Unable to complete Google sign-in.',
                    );
                  }
                }}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Sign in with Admin Google Account</span>
              </PrimaryButton>
            ) : (
              <>
                <PrimaryButton
                  variant="outline"
                  loading={authLoading}
                  onClick={() => void onSignOut()}
                >
                  Sign out
                </PrimaryButton>
                <PrimaryButton
                  loading={authLoading}
                  onClick={async () => {
                    setAuthError('');
                    try {
                      await onGoogleSignIn();
                    } catch (err) {
                      setAuthError(
                        err instanceof Error ? err.message : 'Unable to switch Google account.',
                      );
                    }
                  }}
                >
                  Switch to Admin Google Account
                </PrimaryButton>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const navItems: { id: AdminTab; label: string; Icon: React.ElementType; badge?: number }[] = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'vendors', label: 'Vendor management', Icon: Store },
    { id: 'restaurants', label: 'Restaurants', Icon: Building2 },
    {
      id: 'applications',
      label: 'Vendor applications',
      Icon: FileCheck2,
      badge: pendingApplications.length,
    },
    { id: 'customers', label: 'Customers', Icon: Users },
    { id: 'orders', label: 'Orders', Icon: ClipboardList, badge: pendingOrders.length },
    { id: 'catalog', label: 'Food & categories', Icon: Tag },
    { id: 'payments', label: 'Payments & ledger', Icon: CreditCard },
    { id: 'disputes', label: 'Disputes', Icon: AlertTriangle, badge: openDisputesCount },
    { id: 'reports', label: 'Reports & analytics', Icon: BarChart3 },
    { id: 'announcements', label: 'Announcements', Icon: Bell },
    { id: 'settings', label: 'Platform settings', Icon: Settings },
    { id: 'logs', label: 'Activity logs', Icon: History },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-8">
      {/* Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-[#1C1917]">
            Marketplace admin
          </h1>
          <p className="text-[15px] text-[#78716C] mt-1">
            Central operations, vendor approvals, financial oversight, and platform governance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[#15803D]/10 border border-[#15803D]/20 text-[13px] text-[#15803D] font-medium min-w-0 max-w-full">
            <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Admin: {userEmail}
            </span>
          </div>
          <PrimaryButton size="sm" variant="outline" onClick={() => void onSignOut()}>
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Responsive Navigation: horizontal scroll strip on mobile/tablet, sticky sidebar on lg+ */}
        <aside className="lg:col-span-3 bg-white border border-[#E7E5E4] rounded-[12px] p-2 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar lg:sticky lg:top-24">
          {navItems.map(({ id, label, Icon, badge }) => (
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
              <span className="flex items-center gap-2.5 lg:gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
              {badge !== undefined && badge > 0 && (
                <span className="text-[12px] font-bold text-[#EA580C] tabular-nums shrink-0">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6 min-w-0">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Registered customers</p>
                  <p className="text-[26px] font-bold text-[#1C1917] mt-1 tabular-nums">
                    {customers.length}
                  </p>
                </div>
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Active restaurants</p>
                  <p className="text-[26px] font-bold text-[#15803D] mt-1 tabular-nums">
                    {activeRestaurants.length}
                  </p>
                </div>
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Registered vendors</p>
                  <p className="text-[26px] font-bold text-[#1C1917] mt-1 tabular-nums">
                    {restaurants.length}
                  </p>
                </div>
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Total orders</p>
                  <p className="text-[26px] font-bold text-[#1C1917] mt-1 tabular-nums">
                    {orders.length}
                  </p>
                </div>
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Completed orders</p>
                  <p className="text-[26px] font-bold text-[#15803D] mt-1 tabular-nums">
                    {completedOrders.length}
                  </p>
                </div>
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Pending orders</p>
                  <p className="text-[26px] font-bold text-[#D97706] mt-1 tabular-nums">
                    {pendingOrders.length}
                  </p>
                </div>
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">Gross order value</p>
                  <PriceDisplay
                    amount={grossOrderValue}
                    className="block text-[22px] font-bold text-[#1C1917] mt-1"
                  />
                </div>
                <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
                  <p className="text-[13px] text-[#78716C]">
                    Platform revenue ({settings.commissionRatePercent}% + fees)
                  </p>
                  <PriceDisplay
                    amount={commissionEarned + serviceFeeRevenue}
                    className="block text-[22px] font-bold text-[#EA580C] mt-1"
                  />
                </div>
              </div>

              {/* Pending Applications Quick Queue */}
              <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[18px] font-semibold text-[#1C1917]">
                    Pending vendor applications ({pendingApplications.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('applications')}
                    className="text-[13px] font-semibold text-[#EA580C] hover:underline cursor-pointer"
                  >
                    Review queue
                  </button>
                </div>
                {pendingApplications.length === 0 ? (
                  <p className="text-[14px] text-[#78716C]">
                    All vendor applications have been reviewed.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E7E5E4]">
                    {pendingApplications.slice(0, 4).map((app) => (
                      <div
                        key={app.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-[15px] font-semibold text-[#1C1917]">
                            {app.businessName}
                          </p>
                          <p className="text-[13px] text-[#78716C]">
                            {app.ownerName} · {app.cuisine} · {app.neighbourhood}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <PrimaryButton
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void onRejectApplication(
                                app,
                                'Rejected from overview queue by admin.',
                              )
                            }
                          >
                            Reject
                          </PrimaryButton>
                          <PrimaryButton
                            size="sm"
                            onClick={() => void onApproveApplication(app)}
                          >
                            Approve
                          </PrimaryButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Activity Logs */}
              <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[18px] font-semibold text-[#1C1917]">
                    Recent administrative activity
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('logs')}
                    className="text-[13px] font-semibold text-[#EA580C] hover:underline cursor-pointer"
                  >
                    View all logs
                  </button>
                </div>
                <div className="divide-y divide-[#E7E5E4]">
                  {activityLogs.slice(0, 4).map((log) => (
                    <div
                      key={log.id}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[13px]"
                    >
                      <p className="text-[#1C1917]">
                        <span className="font-semibold">{log.action}:</span> {log.summary}
                      </p>
                      <span className="text-[#78716C] shrink-0">{log.actorEmail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* VENDOR MANAGEMENT */}
          {activeTab === 'vendors' && (
            <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-semibold text-[#1C1917]">Vendor management</h2>
                  <p className="text-[13px] text-[#78716C]">
                    Approve, suspend, or inspect vendor kitchen accounts across Calabar.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    placeholder="Search vendors..."
                    className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] text-[13px] focus:border-[#EA580C] focus:outline-none w-full sm:w-48"
                  />
                  <select
                    value={vendorStatusFilter}
                    onChange={(e) =>
                      setVendorStatusFilter(e.target.value as typeof vendorStatusFilter)
                    }
                    className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] bg-white text-[13px] w-full sm:w-auto"
                  >
                    <option value="all">All statuses</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="border-b border-[#E7E5E4] text-[12px] text-[#78716C]">
                    <tr>
                      <th className="py-2.5 pr-4 font-medium">Vendor / Kitchen</th>
                      <th className="py-2.5 pr-4 font-medium">Area</th>
                      <th className="py-2.5 pr-4 text-right font-medium">Orders</th>
                      <th className="py-2.5 pr-4 text-right font-medium">Food sales</th>
                      <th className="py-2.5 pr-4 font-medium">Status</th>
                      <th className="py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E5E4]">
                    {filteredVendors.map((vendor) => {
                      const vOrders = validOrders.filter((o) => o.restaurantId === vendor.id);
                      const vRevenue = vOrders.reduce((s, o) => s + o.subtotal, 0);
                      return (
                        <tr key={vendor.id} className="h-12">
                          <td className="py-2.5 pr-4">
                            <p className="font-semibold text-[#1C1917]">{vendor.name}</p>
                            <p className="text-[12px] text-[#78716C]">{vendor.cuisine}</p>
                          </td>
                          <td className="py-2.5 pr-4 text-[#78716C]">{vendor.neighbourhood}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">{vOrders.length}</td>
                          <td className="py-2.5 pr-4 text-right font-medium">
                            <PriceDisplay amount={vRevenue} />
                          </td>
                          <td className="py-2.5 pr-4">
                            <StatusBadge status={vendor.status} />
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              <PrimaryButton
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedVendor(vendor)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Details</span>
                              </PrimaryButton>
                              <PrimaryButton
                                size="sm"
                                variant="outline"
                                onClick={() => void onToggleVendorStatus(vendor)}
                              >
                                {vendor.status === 'Active' ? 'Suspend' : 'Activate'}
                              </PrimaryButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RESTAURANT MANAGEMENT */}
          {activeTab === 'restaurants' && (
            <RestaurantsPanel
              restaurants={restaurants}
              orders={orders}
              menuItems={menuItems}
              onUpdateRestaurant={onUpdateRestaurantDetails}
            />
          )}

          {/* VENDOR APPLICATIONS */}
          {activeTab === 'applications' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[20px] font-semibold text-[#1C1917]">Vendor applications</h2>
                <div className="flex items-center gap-2">
                  {(['Pending', 'Approved', 'Rejected', 'All'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setAppFilter(status)}
                      className={`h-9 px-3 rounded-[8px] text-[13px] font-semibold cursor-pointer ${
                        appFilter === status
                          ? 'bg-[#EA580C] text-white'
                          : 'bg-white border border-[#E7E5E4] text-[#1C1917]'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {filteredApplications.length === 0 ? (
                <EmptyState
                  title={`No ${appFilter.toLowerCase()} applications`}
                  description="New kitchens applying via the Become a Vendor form will appear here for verification."
                />
              ) : (
                <div className="space-y-3">
                  {filteredApplications.map((app) => (
                    <div
                      key={app.id}
                      className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-[16px] font-semibold text-[#1C1917]">
                              {app.businessName}
                            </h3>
                            <StatusBadge status={app.status} />
                          </div>
                          <p className="text-[14px] text-[#78716C]">
                            Owner: {app.ownerName} · {app.phone} · {app.email}
                          </p>
                          <p className="text-[13px] text-[#78716C]">
                            {app.cuisine} · {app.neighbourhood} · Submitted{' '}
                            {formatShortDate(app.submittedAt)}
                          </p>
                          {app.reviewNote && (
                            <p className="text-[13px] text-[#1C1917] pt-1">
                              Review note: {app.reviewNote}
                            </p>
                          )}
                        </div>

                        {app.status === 'Pending' && (
                          <div className="flex items-center gap-2.5 shrink-0">
                            <PrimaryButton
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void onRejectApplication(
                                  app,
                                  reviewNotes[app.id] ||
                                    'Application did not pass verification review.',
                                )
                              }
                            >
                              Reject
                            </PrimaryButton>
                            <PrimaryButton
                              size="sm"
                              onClick={() =>
                                void onApproveApplication(app, reviewNotes[app.id])
                              }
                            >
                              Approve vendor
                            </PrimaryButton>
                          </div>
                        )}
                      </div>

                      {app.status === 'Pending' && (
                        <input
                          type="text"
                          value={reviewNotes[app.id] || ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
                          }
                          placeholder="Optional verification or rejection note..."
                          className="w-full h-10 px-3 rounded-[8px] border border-[#E7E5E4] text-[13px] focus:border-[#EA580C] focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CUSTOMER MANAGEMENT */}
          {activeTab === 'customers' && (
            <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-semibold text-[#1C1917]">
                    Customer management
                  </h2>
                  <p className="text-[13px] text-[#78716C]">
                    Inspect registered customers, review order histories, and suspend or reactivate
                    accounts.
                  </p>
                </div>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search name, email, phone..."
                  className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] text-[13px] focus:border-[#EA580C] focus:outline-none w-full sm:w-60"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="border-b border-[#E7E5E4] text-[12px] text-[#78716C]">
                    <tr>
                      <th className="py-2.5 pr-4 font-medium">Customer</th>
                      <th className="py-2.5 pr-4 font-medium">Phone &amp; Area</th>
                      <th className="py-2.5 pr-4 font-medium">Status</th>
                      <th className="py-2.5 pr-4 text-right font-medium">Orders / Spent</th>
                      <th className="py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E5E4]">
                    {filteredCustomers.map((c) => (
                      <tr key={c.id} className="h-14">
                        <td className="py-2.5 pr-4">
                          <p className="font-semibold text-[#1C1917]">{c.name}</p>
                          <p className="text-[12px] text-[#78716C]">{c.email}</p>
                        </td>
                        <td className="py-2.5 pr-4">
                          <p className="text-[13px] text-[#1C1917] tabular-nums">{c.phone || '—'}</p>
                          <p className="text-[12px] text-[#78716C]">{c.neighbourhood}</p>
                        </td>
                        <td className="py-2.5 pr-4">
                          <StatusBadge status={c.accountStatus || 'Active'} />
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          <p className="tabular-nums font-medium text-[#1C1917]">
                            {c.totalOrders} orders
                          </p>
                          <PriceDisplay
                            amount={c.totalSpent}
                            className="text-[12px] text-[#78716C]"
                          />
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <PrimaryButton
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedCustomer(c)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </PrimaryButton>
                            <PrimaryButton
                              size="sm"
                              variant="outline"
                              onClick={() => void onToggleCustomerStatus(c)}
                            >
                              {c.accountStatus === 'Suspended' ? 'Reactivate' : 'Suspend'}
                            </PrimaryButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ORDER MANAGEMENT */}
          {activeTab === 'orders' && (
            <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-semibold text-[#1C1917]">
                    Marketplace order management
                  </h2>
                  <p className="text-[13px] text-[#78716C]">
                    Track progress across all vendors, inspect items, update status, or process
                    cancellations.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Order #, customer, vendor..."
                    className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] text-[13px] focus:border-[#EA580C] focus:outline-none w-full sm:w-52"
                  />
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] bg-white text-[13px] w-full sm:w-auto"
                  >
                    <option value="All">All statuses</option>
                    {[...ORDER_TIMELINE_STEPS, 'Cancelled'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="border-b border-[#E7E5E4] text-[12px] text-[#78716C]">
                    <tr>
                      <th className="py-2.5 pr-4 font-medium">Order #</th>
                      <th className="py-2.5 pr-4 font-medium">Customer</th>
                      <th className="py-2.5 pr-4 font-medium">Vendor</th>
                      <th className="py-2.5 pr-4 font-medium">Status</th>
                      <th className="py-2.5 pr-4 text-right font-medium">Total</th>
                      <th className="py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E5E4]">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="h-12">
                        <td className="py-2.5 pr-4">
                          <p className="font-mono font-semibold text-[#1C1917]">
                            {order.orderNumber}
                          </p>
                          <p className="text-[12px] text-[#78716C]">
                            {formatOrderTime(order.placedAt)}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4 text-[#1C1917]">{order.customerName}</td>
                        <td className="py-2.5 pr-4 text-[#78716C]">{order.restaurantName}</td>
                        <td className="py-2.5 pr-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="py-2.5 pr-4 text-right font-semibold text-[#1C1917]">
                          <PriceDisplay amount={order.total} />
                        </td>
                        <td className="py-2.5 text-right">
                          <PrimaryButton
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrder(order)}
                          >
                            Manage
                          </PrimaryButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FOOD & CATEGORY MANAGEMENT */}
          {activeTab === 'catalog' && (
            <FoodCatalogPanel
              categories={categories}
              menuItems={menuItems}
              restaurants={restaurants}
              onSaveCategory={onSaveCategory}
              onToggleMenuItemAvailability={onToggleMenuItemAvailability}
            />
          )}

          {/* PAYMENTS & TRANSACTION LEDGER */}
          {activeTab === 'payments' && (
            <PaymentsLedgerPanel
              transactions={transactions}
              commissionRatePercent={settings.commissionRatePercent}
              onVerifyTransaction={onVerifyTransaction}
              onIssueRefund={onIssueTransactionRefund}
            />
          )}

          {/* DISPUTES */}
          {activeTab === 'disputes' && (
            <div className="space-y-4">
              <h2 className="text-[20px] font-semibold text-[#1C1917]">
                Customer disputes &amp; issues
              </h2>
              {disputes.length === 0 ? (
                <EmptyState
                  title="No reported disputes"
                  description="Customer delivery or order disputes will appear here for investigation."
                />
              ) : (
                <div className="space-y-3">
                  {disputes.map((d) => (
                    <div
                      key={d.id}
                      className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-[14px] font-bold text-[#1C1917]">
                              {d.orderNumber}
                            </span>
                            <span className="text-[14px] font-semibold text-[#1C1917]">
                              {d.restaurantName}
                            </span>
                            <StatusBadge status={d.status} />
                          </div>
                          <p className="text-[14px] text-[#78716C]">{d.reason}</p>
                          <p className="text-[13px] text-[#78716C]">
                            Customer: {d.customerName} · Claim:{' '}
                            <PriceDisplay
                              amount={d.amount}
                              className="font-semibold text-[#1C1917]"
                            />
                          </p>
                          {d.resolutionNote && (
                            <p className="text-[13px] text-[#15803D]">
                              Resolution: {d.resolutionNote}
                            </p>
                          )}
                        </div>
                        {d.status !== 'Resolved' && d.status !== 'Refunded' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <PrimaryButton
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void onUpdateDisputeStatus(
                                  d,
                                  'Refunded',
                                  disputeNotes[d.id] || 'Refund issued to customer.',
                                )
                              }
                            >
                              Issue refund
                            </PrimaryButton>
                            <PrimaryButton
                              size="sm"
                              onClick={() =>
                                void onUpdateDisputeStatus(
                                  d,
                                  'Resolved',
                                  disputeNotes[d.id] || 'Dispute resolved by admin.',
                                )
                              }
                            >
                              Mark resolved
                            </PrimaryButton>
                          </div>
                        )}
                      </div>
                      {d.status !== 'Resolved' && d.status !== 'Refunded' && (
                        <input
                          type="text"
                          value={disputeNotes[d.id] || ''}
                          onChange={(e) =>
                            setDisputeNotes((prev) => ({ ...prev, [d.id]: e.target.value }))
                          }
                          placeholder="Add investigation or resolution note..."
                          className="w-full h-10 px-3 rounded-[8px] border border-[#E7E5E4] text-[13px] focus:border-[#EA580C] focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REPORTS & ANALYTICS */}
          {activeTab === 'reports' && (
            <ReportsAnalyticsPanel
              orders={orders}
              restaurants={restaurants}
              customers={customers}
              commissionRatePercent={settings.commissionRatePercent}
            />
          )}

          {/* ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <AnnouncementsPanel
              announcements={announcements}
              onCreateAnnouncement={onCreateAnnouncement}
              onToggleAnnouncement={onToggleAnnouncement}
              onDeleteAnnouncement={onDeleteAnnouncement}
            />
          )}

          {/* PLATFORM SETTINGS */}
          {activeTab === 'settings' && (
            <PlatformSettingsPanel
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              onReseedDatabase={onReseedDatabase}
            />
          )}

          {/* ACTIVITY LOGS */}
          {activeTab === 'logs' && <ActivityLogsPanel logs={activityLogs} />}
        </div>
      </div>

      {/* Vendor Detail Modal */}
      {selectedVendor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white rounded-[12px] border border-[#E7E5E4] shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[18px] font-bold text-[#1C1917]">{selectedVendor.name}</h3>
                <p className="text-[13px] text-[#78716C]">{selectedVendor.address}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVendor(null)}
                className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[14px] text-[#1C1917]">{selectedVendor.description}</p>
            <div className="grid grid-cols-2 gap-3 text-[13px] p-4 rounded-[10px] bg-[#FFF7ED] border border-[#E7E5E4]">
              <div>
                <p className="text-[#78716C]">Delivery fee</p>
                <PriceDisplay amount={selectedVendor.deliveryFee} className="font-semibold" />
              </div>
              <div>
                <p className="text-[#78716C]">Minimum order</p>
                <PriceDisplay amount={selectedVendor.minimumOrder} className="font-semibold" />
              </div>
              <div>
                <p className="text-[#78716C]">Opening hours</p>
                <p className="font-semibold">{selectedVendor.openingHours}</p>
              </div>
              <div>
                <p className="text-[#78716C]">Owner UID</p>
                <p className="font-mono text-[12px] truncate">{selectedVendor.ownerUid || 'demo'}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <PrimaryButton variant="outline" onClick={() => setSelectedVendor(null)}>
                Close
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail & Reported Issues Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white rounded-[12px] border border-[#E7E5E4] shadow-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[18px] font-bold text-[#1C1917]">{selectedCustomer.name}</h3>
                <p className="text-[13px] text-[#78716C]">
                  {selectedCustomer.email} · {selectedCustomer.phone || 'No phone'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-[14px] font-semibold text-[#1C1917]">Recent orders</h4>
              {orders.filter((o) => o.customerId === selectedCustomer.id).length === 0 ? (
                <p className="text-[13px] text-[#78716C]">No orders linked to this customer ID.</p>
              ) : (
                orders
                  .filter((o) => o.customerId === selectedCustomer.id)
                  .map((o) => (
                    <div
                      key={o.id}
                      className="p-3 rounded-[8px] border border-[#E7E5E4] flex items-center justify-between text-[13px]"
                    >
                      <div>
                        <p className="font-mono font-semibold">{o.orderNumber}</p>
                        <p className="text-[#78716C]">{o.restaurantName}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={o.status} />
                        <PriceDisplay amount={o.total} className="block font-semibold mt-1" />
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="flex justify-end gap-2">
              <PrimaryButton variant="outline" onClick={() => setSelectedCustomer(null)}>
                Close
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail & Status Management Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white rounded-[12px] border border-[#E7E5E4] shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[18px] font-bold text-[#1C1917]">
                  Order {selectedOrder.orderNumber}
                </h3>
                <p className="text-[13px] text-[#78716C]">
                  {selectedOrder.restaurantName} · {selectedOrder.customerName} (
                  {selectedOrder.customerPhone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={selectedOrder.status} />
              <StatusBadge status={selectedOrder.paymentStatus} />
            </div>

            <div className="p-3.5 rounded-[8px] bg-[#FFF7ED] border border-[#E7E5E4] text-[13px] space-y-1">
              <p className="font-semibold text-[#1C1917]">Delivery address</p>
              <p className="text-[#78716C]">
                {selectedOrder.deliveryAddress} ({selectedOrder.neighbourhood})
              </p>
            </div>

            <div className="divide-y divide-[#E7E5E4] border-y border-[#E7E5E4]">
              {selectedOrder.items.map((it, idx) => (
                <div key={idx} className="py-2.5 flex justify-between text-[13px]">
                  <div>
                    <p className="font-medium text-[#1C1917]">
                      {it.quantity}× {it.name}
                    </p>
                    {it.optionsText && <p className="text-[#78716C]">{it.optionsText}</p>}
                  </div>
                  <PriceDisplay amount={it.unitPrice * it.quantity} className="font-semibold" />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#1C1917] mb-1.5">
                Update order status
              </label>
              <select
                value={selectedOrder.status}
                onChange={async (e) => {
                  const next = e.target.value as OrderStatus;
                  await onUpdateOrderStatus(selectedOrder, next);
                  setSelectedOrder({ ...selectedOrder, status: next });
                }}
                className="w-full h-11 px-3 rounded-[8px] border border-[#E7E5E4] bg-white text-[14px]"
              >
                {[...ORDER_TIMELINE_STEPS, 'Cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <PrimaryButton variant="outline" onClick={() => setSelectedOrder(null)}>
                Done
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
