import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Download,
  Edit3,
  History,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tag,
  Trash2,
} from 'lucide-react';
import { CALABAR_NEIGHBOURHOODS, IMAGES } from '../../data/calabarData';
import {
  ActivityLog,
  Announcement,
  CustomerProfile,
  FoodCategoryDoc,
  MarketplaceSettings,
  MenuItem,
  Order,
  Restaurant,
  TransactionRecord,
} from '../../types/marketplace';
import { formatNaira, formatOrderTime, formatShortDate } from '../../utils/format';
import { InputField, PriceDisplay, PrimaryButton, ResilientImage, StatusBadge } from '../ui/Primitives';

/* ============================================================================
 * 1. Restaurant Management Panel + Edit Modal
 * ============================================================================ */
interface RestaurantsPanelProps {
  restaurants: Restaurant[];
  orders: Order[];
  menuItems: MenuItem[];
  onUpdateRestaurant: (
    restaurantId: string,
    name: string,
    patch: Partial<Restaurant>,
  ) => Promise<void>;
}

export const RestaurantsPanel: React.FC<RestaurantsPanelProps> = ({
  restaurants,
  orders,
  menuItems,
  onUpdateRestaurant,
}) => {
  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'open' | 'closed' | 'suspended'>('all');
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formCuisine, setFormCuisine] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNeighbourhood, setFormNeighbourhood] = useState('');
  const [formHours, setFormHours] = useState('');
  const [formDeliveryFee, setFormDeliveryFee] = useState('850');
  const [formMinOrder, setFormMinOrder] = useState('1500');
  const [formMinTime, setFormMinTime] = useState('20');
  const [formMaxTime, setFormMaxTime] = useState('35');
  const [formIsOpen, setFormIsOpen] = useState(true);

  const openEdit = (r: Restaurant) => {
    setEditing(r);
    setFormName(r.name);
    setFormCuisine(r.cuisine);
    setFormAddress(r.address);
    setFormNeighbourhood(r.neighbourhood);
    setFormHours(r.openingHours);
    setFormDeliveryFee(String(r.deliveryFee));
    setFormMinOrder(String(r.minimumOrder));
    setFormMinTime(String(r.deliveryTimeMin));
    setFormMaxTime(String(r.deliveryTimeMax));
    setFormIsOpen(r.isOpen);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return restaurants
      .filter((r) => {
        if (availabilityFilter === 'open') return r.status === 'Active' && r.isOpen;
        if (availabilityFilter === 'closed') return r.status === 'Active' && !r.isOpen;
        if (availabilityFilter === 'suspended') return r.status === 'Suspended';
        return true;
      })
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.neighbourhood.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q),
      );
  }, [restaurants, search, availabilityFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await onUpdateRestaurant(editing.id, editing.name, {
        name: formName.trim() || editing.name,
        cuisine: formCuisine.trim() || editing.cuisine,
        address: formAddress.trim() || editing.address,
        neighbourhood: formNeighbourhood,
        openingHours: formHours.trim() || editing.openingHours,
        deliveryFee: Math.max(0, Number(formDeliveryFee) || 0),
        minimumOrder: Math.max(0, Number(formMinOrder) || 0),
        deliveryTimeMin: Math.max(5, Number(formMinTime) || 20),
        deliveryTimeMax: Math.max(10, Number(formMaxTime) || 35),
        isOpen: formIsOpen,
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#1C1917]">Restaurant management</h2>
            <p className="text-[13px] text-[#78716C]">
              Monitor store activity, update restaurant details, and control open/closed availability.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search restaurant or area..."
              className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] text-[13px] text-[#1C1917] focus:border-[#EA580C] focus:outline-none w-full sm:w-52"
            />
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as typeof availabilityFilter)}
              className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] bg-white text-[13px] text-[#1C1917] w-full sm:w-auto"
            >
              <option value="all">All stores</option>
              <option value="open">Open now</option>
              <option value="closed">Closed</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="border-b border-[#E7E5E4] text-[12px] text-[#78716C]">
              <tr>
                <th className="py-2.5 pr-4 font-medium">Restaurant</th>
                <th className="py-2.5 pr-4 font-medium">Location &amp; hours</th>
                <th className="py-2.5 pr-4 text-right font-medium">Dishes</th>
                <th className="py-2.5 pr-4 text-right font-medium">Orders</th>
                <th className="py-2.5 pr-4 font-medium">Availability</th>
                <th className="py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]">
              {filtered.map((r) => {
                const dishCount = menuItems.filter((m) => m.restaurantId === r.id).length;
                const orderCount = orders.filter((o) => o.restaurantId === r.id).length;
                return (
                  <tr key={r.id} className="h-14">
                    <td className="py-2.5 pr-4">
                      <p className="font-semibold text-[#1C1917]">{r.name}</p>
                      <p className="text-[12px] text-[#78716C]">
                        {r.cuisine} · Fee <PriceDisplay amount={r.deliveryFee} />
                      </p>
                    </td>
                    <td className="py-2.5 pr-4">
                      <p className="text-[13px] text-[#1C1917]">{r.neighbourhood}</p>
                      <p className="text-[12px] text-[#78716C]">{r.openingHours}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-[#1C1917]">
                      {dishCount}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-[#1C1917]">
                      {orderCount}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={r.status} />
                        <span
                          className={`text-[12px] font-medium ${
                            r.isOpen ? 'text-[#15803D]' : 'text-[#78716C]'
                          }`}
                        >
                          {r.isOpen ? 'Open for delivery' : 'Kitchen closed'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <PrimaryButton
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void onUpdateRestaurant(r.id, r.name, { isOpen: !r.isOpen })
                          }
                        >
                          {r.isOpen ? 'Set closed' : 'Set open'}
                        </PrimaryButton>
                        <PrimaryButton size="sm" variant="ghost" onClick={() => openEdit(r)}>
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
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

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg bg-white rounded-[12px] border border-[#E7E5E4] shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-[18px] font-bold text-[#1C1917]">
              Edit restaurant: {editing.name}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Restaurant name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
              <InputField
                label="Cuisine"
                value={formCuisine}
                onChange={(e) => setFormCuisine(e.target.value)}
                required
              />
              <div>
                <label className="block text-[13px] font-medium text-[#1C1917] mb-1.5">
                  Neighbourhood
                </label>
                <select
                  value={formNeighbourhood}
                  onChange={(e) => setFormNeighbourhood(e.target.value)}
                  className="w-full h-12 px-3.5 rounded-[8px] border border-[#E7E5E4] bg-white text-[15px]"
                >
                  {CALABAR_NEIGHBOURHOODS.filter((n) => n !== 'All Calabar').map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <InputField
                label="Opening hours"
                value={formHours}
                onChange={(e) => setFormHours(e.target.value)}
              />
              <InputField
                label="Delivery fee (NGN)"
                type="number"
                min={0}
                value={formDeliveryFee}
                onChange={(e) => setFormDeliveryFee(e.target.value)}
              />
              <InputField
                label="Minimum order (NGN)"
                type="number"
                min={0}
                value={formMinOrder}
                onChange={(e) => setFormMinOrder(e.target.value)}
              />
              <InputField
                label="Min delivery (mins)"
                type="number"
                min={5}
                value={formMinTime}
                onChange={(e) => setFormMinTime(e.target.value)}
              />
              <InputField
                label="Max delivery (mins)"
                type="number"
                min={10}
                value={formMaxTime}
                onChange={(e) => setFormMaxTime(e.target.value)}
              />
            </div>
            <InputField
              label="Street address"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
            />
            <label className="flex items-center gap-2.5 text-[14px] text-[#1C1917] cursor-pointer">
              <input
                type="checkbox"
                checked={formIsOpen}
                onChange={(e) => setFormIsOpen(e.target.checked)}
                className="w-4 h-4 accent-[#EA580C]"
              />
              <span>Store open for customer deliveries</span>
            </label>
            <div className="flex justify-end gap-2.5 pt-2">
              <PrimaryButton variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </PrimaryButton>
              <PrimaryButton type="submit" loading={saving}>
                Save changes
              </PrimaryButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 2. Food Categories & Marketplace Products Management
 * ============================================================================ */
interface FoodCatalogPanelProps {
  categories: FoodCategoryDoc[];
  menuItems: MenuItem[];
  restaurants: Restaurant[];
  onSaveCategory: (cat: FoodCategoryDoc, isNew: boolean) => Promise<void>;
  onToggleMenuItemAvailability: (item: MenuItem) => Promise<void>;
}

export const FoodCatalogPanel: React.FC<FoodCatalogPanelProps> = ({
  categories,
  menuItems,
  restaurants,
  onSaveCategory,
  onToggleMenuItemAvailability,
}) => {
  const [showAddCat, setShowAddCat] = useState(false);
  const [catLabel, setCatLabel] = useState('');
  const [catSubtitle, setCatSubtitle] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const restaurantMap = useMemo(
    () => new Map(restaurants.map((r) => [r.id, r.name])),
    [restaurants],
  );

  const filteredItems = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return menuItems
      .filter((m) => (restaurantFilter === 'all' ? true : m.restaurantId === restaurantFilter))
      .filter((m) => (categoryFilter === 'all' ? true : m.category === categoryFilter))
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q),
      );
  }, [menuItems, productSearch, restaurantFilter, categoryFilter]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catLabel.trim()) return;
    await onSaveCategory(
      {
        id: catLabel.trim().toLowerCase().replace(/\s+/g, '-'),
        label: catLabel.trim(),
        subtitle: catSubtitle.trim() || 'Calabar marketplace dishes',
        image: IMAGES.jollofChicken,
        isActive: true,
        sortOrder: categories.length + 1,
      },
      true,
    );
    setCatLabel('');
    setCatSubtitle('');
    setShowAddCat(false);
  };

  return (
    <div className="space-y-6">
      {/* Food Categories */}
      <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#1C1917]">
              Marketplace food categories
            </h2>
            <p className="text-[13px] text-[#78716C]">
              Manage storefront food categories across Calabar vendors.
            </p>
          </div>
          <PrimaryButton size="sm" onClick={() => setShowAddCat(!showAddCat)}>
            <Plus className="w-4 h-4" />
            <span>{showAddCat ? 'Close form' : 'Add category'}</span>
          </PrimaryButton>
        </div>

        {showAddCat && (
          <form
            onSubmit={(e) => void handleAddCategory(e)}
            className="p-4 rounded-[10px] bg-[#FFF7ED]/70 border border-[#E7E5E4] grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
          >
            <InputField
              label="Category name"
              value={catLabel}
              onChange={(e) => setCatLabel(e.target.value)}
              placeholder="E.g. Pepper Soup"
              required
            />
            <InputField
              label="Subtitle"
              value={catSubtitle}
              onChange={(e) => setCatSubtitle(e.target.value)}
              placeholder="E.g. Goat meat & catfish pots"
            />
            <PrimaryButton type="submit">Save category</PrimaryButton>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="p-3.5 rounded-[10px] border border-[#E7E5E4] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Tag className="w-4 h-4 text-[#EA580C] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#1C1917] truncate">{cat.label}</p>
                  <p className="text-[12px] text-[#78716C] truncate">{cat.subtitle}</p>
                </div>
              </div>
              <PrimaryButton
                size="sm"
                variant="outline"
                onClick={() => void onSaveCategory({ ...cat, isActive: !cat.isActive }, false)}
              >
                {cat.isActive ? 'Active' : 'Hidden'}
              </PrimaryButton>
            </div>
          ))}
        </div>
      </div>

      {/* Listed Menu Products */}
      <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#1C1917]">
              Listed products ({filteredItems.length})
            </h2>
            <p className="text-[13px] text-[#78716C]">
              Monitor all dishes across kitchens and toggle availability if items violate standards or
              sell out.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search dishes..."
              className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] text-[13px] focus:border-[#EA580C] focus:outline-none w-full sm:w-44"
            />
            <select
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] bg-white text-[13px] w-full sm:w-auto"
            >
              <option value="all">All restaurants</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] bg-white text-[13px]"
            >
              <option value="all">All categories</option>
              {Array.from(new Set(menuItems.map((m) => m.category))).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="divide-y divide-[#E7E5E4]">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-11 rounded-[8px] overflow-hidden bg-[#F5F5F4] shrink-0">
                  <ResilientImage
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#1C1917] truncate">{item.name}</p>
                  <p className="text-[12px] text-[#78716C] truncate">
                    {restaurantMap.get(item.restaurantId) || item.restaurantId} · {item.category} ·{' '}
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
                  {item.available ? 'Available' : 'Sold out'}
                </span>
                <PrimaryButton
                  size="sm"
                  variant="outline"
                  onClick={() => void onToggleMenuItemAvailability(item)}
                >
                  {item.available ? 'Mark sold out' : 'Mark available'}
                </PrimaryButton>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. Payments & Immutable Transaction Ledger Panel
 * ============================================================================ */
interface PaymentsLedgerPanelProps {
  transactions: TransactionRecord[];
  commissionRatePercent: number;
  onVerifyTransaction: (txn: TransactionRecord) => Promise<void>;
  onIssueRefund: (txn: TransactionRecord) => Promise<void>;
}

export const PaymentsLedgerPanel: React.FC<PaymentsLedgerPanelProps> = ({
  transactions,
  commissionRatePercent,
  onVerifyTransaction,
  onIssueRefund,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'Charge' | 'Refund'>('all');

  const filtered = transactions.filter((t) => (filterType === 'all' ? true : t.type === filterType));
  const netCommission = transactions
    .filter((t) => t.type === 'Charge' && t.verificationStatus !== 'Refunded')
    .reduce((sum, t) => sum + t.commissionAmount, 0);
  const totalRefunds = transactions
    .filter((t) => t.type === 'Refund')
    .reduce((sum, t) => sum + t.grossAmount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
          <p className="text-[13px] text-[#78716C]">Verified &amp; active commissions</p>
          <PriceDisplay
            amount={netCommission}
            className="block text-[24px] font-bold text-[#EA580C] mt-1"
          />
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
          <p className="text-[13px] text-[#78716C]">Total refunded volume</p>
          <PriceDisplay
            amount={totalRefunds}
            className="block text-[24px] font-bold text-[#DC2626] mt-1"
          />
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
          <p className="text-[13px] text-[#78716C]">Ledger integrity</p>
          <p className="text-[14px] font-semibold text-[#15803D] mt-1.5 flex items-center gap-1.5">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Immutable amounts · {commissionRatePercent}% rate</span>
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#1C1917]">
              Paystack payments &amp; commission ledger
            </h2>
            <p className="text-[13px] text-[#78716C]">
              Amounts are locked at checkout. Admins can verify gateway settlement or append a
              refund record.
            </p>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] bg-white text-[13px]"
          >
            <option value="all">All records</option>
            <option value="Charge">Charges only</option>
            <option value="Refund">Refunds only</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#E7E5E4] text-[12px] text-[#78716C]">
              <tr>
                <th className="py-2.5 pr-4 font-medium">Reference / Order</th>
                <th className="py-2.5 pr-4 font-medium">Vendor</th>
                <th className="py-2.5 pr-4 font-medium">Type</th>
                <th className="py-2.5 pr-4 text-right font-medium">Gross</th>
                <th className="py-2.5 pr-4 text-right font-medium">Commission</th>
                <th className="py-2.5 pr-4 text-right font-medium">Vendor payout</th>
                <th className="py-2.5 pr-4 font-medium">Status</th>
                <th className="py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]">
              {filtered.map((txn) => (
                <tr key={txn.id} className="h-12">
                  <td className="py-2.5 pr-4">
                    <p className="font-mono font-semibold text-[#1C1917]">{txn.reference}</p>
                    <p className="text-[12px] text-[#78716C]">
                      {txn.orderNumber} · {txn.customerName}
                    </p>
                  </td>
                  <td className="py-2.5 pr-4 text-[#1C1917]">{txn.restaurantName}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`font-semibold ${
                        txn.type === 'Refund' ? 'text-[#DC2626]' : 'text-[#1C1917]'
                      }`}
                    >
                      {txn.type}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-[#1C1917]">
                    <PriceDisplay amount={txn.grossAmount} />
                  </td>
                  <td className="py-2.5 pr-4 text-right text-[#EA580C] font-medium">
                    <PriceDisplay amount={txn.commissionAmount} />
                  </td>
                  <td className="py-2.5 pr-4 text-right text-[#15803D] font-medium">
                    <PriceDisplay amount={txn.vendorPayout} />
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge
                      status={
                        txn.verificationStatus === 'Verified'
                          ? 'Paid'
                          : txn.verificationStatus === 'Refunded'
                            ? 'Refunded'
                            : 'Pending'
                      }
                    />
                  </td>
                  <td className="py-2.5 text-right">
                    {txn.type === 'Charge' && txn.verificationStatus === 'Pending Verification' && (
                      <div className="inline-flex gap-2">
                        <PrimaryButton
                          size="sm"
                          onClick={() => void onVerifyTransaction(txn)}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify</span>
                        </PrimaryButton>
                      </div>
                    )}
                    {txn.type === 'Charge' && txn.verificationStatus === 'Verified' && (
                      <PrimaryButton
                        size="sm"
                        variant="outline"
                        onClick={() => void onIssueRefund(txn)}
                      >
                        Refund
                      </PrimaryButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. Reports & Analytics Panel (Daily / Weekly / Monthly + CSV Export)
 * ============================================================================ */
interface ReportsAnalyticsPanelProps {
  orders: Order[];
  restaurants: Restaurant[];
  customers: CustomerProfile[];
  commissionRatePercent: number;
}

export const ReportsAnalyticsPanel: React.FC<ReportsAnalyticsPanelProps> = ({
  orders,
  restaurants,
  customers,
  commissionRatePercent,
}) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const periodDays = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
  const periodOrders = useMemo(() => {
    const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const filtered = orders.filter((o) => {
      const ts = new Date(o.placedAt).getTime();
      return Number.isNaN(ts) || ts >= cutoff;
    });
    return filtered.length > 0 ? filtered : orders;
  }, [orders, periodDays]);

  const validOrders = periodOrders.filter((o) => o.status !== 'Cancelled');
  const completedCount = periodOrders.filter((o) => o.status === 'Delivered').length;
  const completionRate =
    periodOrders.length > 0 ? Math.round((completedCount / periodOrders.length) * 100) : 0;
  const grossSales = validOrders.reduce((s, o) => s + o.total, 0);
  const commissionRevenue = validOrders.reduce(
    (s, o) => s + Math.round((o.subtotal * commissionRatePercent) / 100),
    0,
  );

  const vendorPerformance = useMemo(() => {
    return restaurants
      .map((r) => {
        const vOrders = validOrders.filter((o) => o.restaurantId === r.id);
        const subtotal = vOrders.reduce((s, o) => s + o.subtotal, 0);
        return {
          id: r.id,
          name: r.name,
          neighbourhood: r.neighbourhood,
          orderCount: vOrders.length,
          subtotal,
          commission: Math.round((subtotal * commissionRatePercent) / 100),
        };
      })
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [restaurants, validOrders, commissionRatePercent]);

  const neighbourhoodBreakdown = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>();
    for (const o of validOrders) {
      const prev = map.get(o.neighbourhood) || { orders: 0, revenue: 0 };
      map.set(o.neighbourhood, {
        orders: prev.orders + 1,
        revenue: prev.revenue + o.total,
      });
    }
    return Array.from(map.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [validOrders]);

  const handleExportCsv = () => {
    const rows = [
      ['OrderNumber', 'PlacedAt', 'Customer', 'Neighbourhood', 'Restaurant', 'Status', 'Payment', 'TotalNGN'],
      ...periodOrders.map((o) => [
        o.orderNumber,
        o.placedAt,
        `"${o.customerName}"`,
        `"${o.neighbourhood}"`,
        `"${o.restaurantName}"`,
        `"${o.status}"`,
        o.paymentStatus,
        String(o.total),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `calabar-marketplace-${period}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-[#1C1917]">Reports &amp; analytics</h2>
          <p className="text-[13px] text-[#78716C]">
            Sales, order completion, vendor performance, and neighbourhood demand across Calabar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`h-9 px-3.5 rounded-[8px] text-[13px] font-semibold capitalize cursor-pointer ${
                period === p
                  ? 'bg-[#EA580C] text-white'
                  : 'bg-white border border-[#E7E5E4] text-[#1C1917]'
              }`}
            >
              {p}
            </button>
          ))}
          <PrimaryButton size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
          <p className="text-[13px] text-[#78716C]">Period sales ({period})</p>
          <PriceDisplay amount={grossSales} className="block text-[24px] font-bold text-[#1C1917] mt-1" />
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
          <p className="text-[13px] text-[#78716C]">Platform commission</p>
          <PriceDisplay
            amount={commissionRevenue}
            className="block text-[24px] font-bold text-[#EA580C] mt-1"
          />
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
          <p className="text-[13px] text-[#78716C]">Orders &amp; completion</p>
          <p className="text-[24px] font-bold text-[#15803D] mt-1 tabular-nums">
            {periodOrders.length} <span className="text-[14px] font-medium">({completionRate}%)</span>
          </p>
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-4">
          <p className="text-[13px] text-[#78716C]">Active customer base</p>
          <p className="text-[24px] font-bold text-[#1C1917] mt-1 tabular-nums">
            {customers.filter((c) => c.accountStatus !== 'Suspended').length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-3">
          <h3 className="text-[16px] font-semibold text-[#1C1917]">Vendor performance</h3>
          <div className="divide-y divide-[#E7E5E4]">
            {vendorPerformance.slice(0, 6).map((vp) => (
              <div key={vp.id} className="py-2.5 flex items-center justify-between text-[13px]">
                <div>
                  <p className="font-semibold text-[#1C1917]">{vp.name}</p>
                  <p className="text-[#78716C]">
                    {vp.neighbourhood} · {vp.orderCount} orders
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[#1C1917] tabular-nums">
                    {formatNaira(vp.subtotal)}
                  </p>
                  <p className="text-[12px] text-[#EA580C] tabular-nums">
                    Fee: {formatNaira(vp.commission)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-3">
          <h3 className="text-[16px] font-semibold text-[#1C1917]">Neighbourhood demand</h3>
          {neighbourhoodBreakdown.length === 0 ? (
            <p className="text-[14px] text-[#78716C]">No order activity in selected range.</p>
          ) : (
            <div className="space-y-3">
              {neighbourhoodBreakdown.map(([area, stats]) => (
                <div key={area} className="flex items-center justify-between text-[14px]">
                  <div>
                    <p className="font-medium text-[#1C1917]">{area}</p>
                    <p className="text-[12px] text-[#78716C] tabular-nums">{stats.orders} orders</p>
                  </div>
                  <PriceDisplay amount={stats.revenue} className="font-semibold text-[#1C1917]" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. Announcements & Notifications Panel
 * ============================================================================ */
interface AnnouncementsPanelProps {
  announcements: Announcement[];
  onCreateAnnouncement: (payload: {
    title: string;
    message: string;
    targetAudience: Announcement['targetAudience'];
    priority: Announcement['priority'];
  }) => Promise<void>;
  onToggleAnnouncement: (ann: Announcement) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
}

export const AnnouncementsPanel: React.FC<AnnouncementsPanelProps> = ({
  announcements,
  onCreateAnnouncement,
  onToggleAnnouncement,
  onDeleteAnnouncement,
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<Announcement['targetAudience']>('all');
  const [priority, setPriority] = useState<Announcement['priority']>('Normal');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await onCreateAnnouncement({
        title: title.trim(),
        message: message.trim(),
        targetAudience,
        priority,
      });
      setTitle('');
      setMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#EA580C]" />
          <h2 className="text-[18px] font-semibold text-[#1C1917]">
            Broadcast marketplace announcement
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <InputField
              label="Headline"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g. Holiday delivery hours"
              required
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1C1917] mb-1.5">
              Target audience
            </label>
            <select
              value={targetAudience}
              onChange={(e) =>
                setTargetAudience(e.target.value as Announcement['targetAudience'])
              }
              className="w-full h-12 px-3.5 rounded-[8px] border border-[#E7E5E4] bg-white text-[15px]"
            >
              <option value="all">All users</option>
              <option value="vendors">Vendors only</option>
              <option value="customers">Customers only</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1C1917] mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Announcement['priority'])}
              className="w-full h-12 px-3.5 rounded-[8px] border border-[#E7E5E4] bg-white text-[15px]"
            >
              <option value="Normal">Normal</option>
              <option value="Important">Important</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#1C1917] mb-1.5">Message</label>
          <textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share operational updates, fee notices, or Calabar delivery advisories..."
            className="w-full p-3 rounded-[8px] border border-[#E7E5E4] focus:border-[#EA580C] focus:outline-none text-[15px]"
            required
          />
        </div>
        <PrimaryButton type="submit" loading={submitting}>
          Publish announcement
        </PrimaryButton>
      </form>

      <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-3">
        <h3 className="text-[16px] font-semibold text-[#1C1917]">Published announcements</h3>
        {announcements.length === 0 ? (
          <p className="text-[14px] text-[#78716C]">No announcements published yet.</p>
        ) : (
          <div className="divide-y divide-[#E7E5E4]">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-semibold text-[#1C1917]">{a.title}</span>
                    <span className="text-[12px] text-[#78716C] capitalize">
                      · {a.targetAudience} · {a.priority}
                    </span>
                    <span
                      className={`text-[12px] font-semibold ${
                        a.isActive ? 'text-[#15803D]' : 'text-[#78716C]'
                      }`}
                    >
                      · {a.isActive ? 'Live' : 'Archived'}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#78716C]">{a.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PrimaryButton
                    size="sm"
                    variant="outline"
                    onClick={() => void onToggleAnnouncement(a)}
                  >
                    {a.isActive ? 'Archive' : 'Activate'}
                  </PrimaryButton>
                  <PrimaryButton
                    size="sm"
                    variant="ghost"
                    aria-label="Delete announcement"
                    onClick={() => void onDeleteAnnouncement(a.id)}
                  >
                    <Trash2 className="w-4 h-4 text-[#DC2626]" />
                  </PrimaryButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 6. Platform Settings Panel
 * ============================================================================ */
interface PlatformSettingsPanelProps {
  settings: MarketplaceSettings;
  onUpdateSettings: (next: MarketplaceSettings) => Promise<void>;
  onReseedDatabase: () => Promise<void>;
}

export const PlatformSettingsPanel: React.FC<PlatformSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onReseedDatabase,
}) => {
  const [commissionRate, setCommissionRate] = useState(String(settings.commissionRatePercent));
  const [serviceCharge, setServiceCharge] = useState(String(settings.serviceChargeFlat));
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(
    String(settings.defaultDeliveryFee ?? 850),
  );
  const [minPlatformOrder, setMinPlatformOrder] = useState(
    String(settings.minPlatformOrder ?? 1500),
  );
  const [defaultCity, setDefaultCity] = useState(settings.defaultCity);
  const [paystackMode, setPaystackMode] = useState<MarketplaceSettings['paystackMode']>(
    settings.paystackMode,
  );
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(settings.autoAcceptOrders);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCommissionRate(String(settings.commissionRatePercent));
    setServiceCharge(String(settings.serviceChargeFlat));
    setDefaultDeliveryFee(String(settings.defaultDeliveryFee ?? 850));
    setMinPlatformOrder(String(settings.minPlatformOrder ?? 1500));
    setDefaultCity(settings.defaultCity);
    setPaystackMode(settings.paystackMode);
    setAutoAcceptOrders(settings.autoAcceptOrders);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateSettings({
        commissionRatePercent: Math.max(0, Math.min(40, Number(commissionRate) || 12)),
        serviceChargeFlat: Math.max(0, Number(serviceCharge) || 0),
        defaultDeliveryFee: Math.max(0, Number(defaultDeliveryFee) || 0),
        minPlatformOrder: Math.max(0, Number(minPlatformOrder) || 0),
        defaultCity: defaultCity.trim() || 'Calabar',
        paystackMode,
        autoAcceptOrders,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-white border border-[#E7E5E4] rounded-[12px] p-6 space-y-5"
      >
        <div>
          <h2 className="text-[20px] font-semibold text-[#1C1917]">Platform settings</h2>
          <p className="text-[13px] text-[#78716C]">
            Configure commission rates, delivery fees, payment gateway mode, and marketplace rules.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Platform commission rate (%)"
            type="number"
            min={0}
            max={40}
            value={commissionRate}
            onChange={(e) => setCommissionRate(e.target.value)}
          />
          <InputField
            label="Customer service charge (NGN)"
            type="number"
            min={0}
            value={serviceCharge}
            onChange={(e) => setServiceCharge(e.target.value)}
          />
          <InputField
            label="Default vendor delivery fee (NGN)"
            type="number"
            min={0}
            value={defaultDeliveryFee}
            onChange={(e) => setDefaultDeliveryFee(e.target.value)}
          />
          <InputField
            label="Minimum platform order (NGN)"
            type="number"
            min={0}
            value={minPlatformOrder}
            onChange={(e) => setMinPlatformOrder(e.target.value)}
          />
          <InputField
            label="Operating city"
            value={defaultCity}
            onChange={(e) => setDefaultCity(e.target.value)}
          />
          <div>
            <label className="block text-[13px] font-medium text-[#1C1917] mb-1.5">
              Paystack gateway mode
            </label>
            <select
              value={paystackMode}
              onChange={(e) =>
                setPaystackMode(e.target.value as MarketplaceSettings['paystackMode'])
              }
              className="w-full h-12 px-3.5 rounded-[8px] border border-[#E7E5E4] bg-white text-[15px]"
            >
              <option value="Test Preview">Test Preview</option>
              <option value="Live">Live</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-[14px] text-[#1C1917] cursor-pointer">
          <input
            type="checkbox"
            checked={autoAcceptOrders}
            onChange={(e) => setAutoAcceptOrders(e.target.checked)}
            className="w-4 h-4 accent-[#EA580C]"
          />
          <span>Auto-confirm paid orders to Vendor accepted on Paystack webhook</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E7E5E4]">
          <PrimaryButton type="submit" loading={saving}>
            <CheckCircle2 className="w-4 h-4" />
            <span>Save marketplace settings</span>
          </PrimaryButton>
          <PrimaryButton variant="outline" onClick={() => void onReseedDatabase()}>
            <RefreshCw className="w-4 h-4" />
            <span>Sync demo catalog to Firestore</span>
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
};

/* ============================================================================
 * 7. Immutable Activity Audit Logs Panel
 * ============================================================================ */
interface ActivityLogsPanelProps {
  logs: ActivityLog[];
}

export const ActivityLogsPanel: React.FC<ActivityLogsPanelProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(
      (l) =>
        !q ||
        l.action.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.actorEmail.toLowerCase().includes(q),
    );
  }, [logs, search]);

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#EA580C]" />
          <div>
            <h2 className="text-[18px] font-semibold text-[#1C1917]">Admin activity logs</h2>
            <p className="text-[13px] text-[#78716C]">
              Append-only audit trail of administrative approvals, suspensions, refunds, and
              settings changes.
            </p>
          </div>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter audit logs..."
          className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] text-[13px] focus:border-[#EA580C] focus:outline-none w-full sm:w-56"
        />
      </div>

      <div className="divide-y divide-[#E7E5E4]">
        {filtered.length === 0 ? (
          <p className="py-6 text-[14px] text-[#78716C]">No matching activity log entries.</p>
        ) : (
          filtered.map((log) => (
            <div
              key={log.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <p className="text-[14px] font-semibold text-[#1C1917]">
                  {log.action}{' '}
                  <span className="text-[12px] font-normal text-[#78716C]">
                    · {log.targetType} ({log.targetId})
                  </span>
                </p>
                <p className="text-[13px] text-[#78716C]">{log.summary}</p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-[12px] font-medium text-[#1C1917]">{log.actorEmail}</p>
                <p className="text-[12px] text-[#78716C] tabular-nums">
                  {log.createdAt
                    ? `${formatShortDate(log.createdAt)} · ${formatOrderTime(log.createdAt)}`
                    : 'Just now'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
