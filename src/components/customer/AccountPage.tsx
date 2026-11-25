import React, { useEffect, useState } from 'react';
import { MapPin, Package, Plus, Settings, Trash2, User } from 'lucide-react';
import { CALABAR_NEIGHBOURHOODS } from '../../data/calabarData';
import {
  CustomerProfile,
  NotificationPreferences,
  Order,
  SavedAddress,
} from '../../types/marketplace';
import { formatShortDate } from '../../utils/format';
import {
  EmptyState,
  InputField,
  PriceDisplay,
  PrimaryButton,
  StatusBadge,
} from '../ui/Primitives';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  smsOrderAlerts: true,
  emailReceipts: true,
};

interface AccountPageProps {
  customer: CustomerProfile;
  orders: Order[];
  onUpdateProfile: (updated: Partial<CustomerProfile>) => void;
  onTrackOrder: (orderId: string) => void;
  onBrowseRestaurants: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  customer,
  orders,
  onUpdateProfile,
  onTrackOrder,
  onBrowseRestaurants,
}) => {
  const [tab, setTab] = useState<'profile' | 'orders' | 'settings'>('orders');
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone);
  const [neighbourhood, setNeighbourhood] = useState(customer.neighbourhood);

  // Add address inline state
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrNeighbourhood, setAddrNeighbourhood] = useState('State Housing');

  // Account settings toggles
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    customer.notificationPreferences || DEFAULT_PREFERENCES,
  );

  useEffect(() => {
    setName(customer.name);
    setEmail(customer.email);
    setPhone(customer.phone);
    setNeighbourhood(customer.neighbourhood);
    setPreferences(customer.notificationPreferences || DEFAULT_PREFERENCES);
  }, [
    customer.id,
    customer.name,
    customer.email,
    customer.phone,
    customer.neighbourhood,
    customer.notificationPreferences,
  ]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({ name, email, phone, neighbourhood });
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrStreet.trim()) return;
    const nextAddr: SavedAddress = {
      id: `addr-${Date.now()}`,
      label: addrLabel.trim() || 'Saved location',
      street: addrStreet.trim(),
      neighbourhood: addrNeighbourhood,
    };
    const nextList = [...customer.savedAddresses, nextAddr].slice(0, 10);
    onUpdateProfile({ savedAddresses: nextList });
    setAddrStreet('');
    setShowAddAddress(false);
  };

  const handleRemoveAddress = (addressId: string) => {
    const nextList = customer.savedAddresses.filter((a) => a.id !== addressId);
    onUpdateProfile({ savedAddresses: nextList });
  };

  const handlePreferenceChange = (key: keyof NotificationPreferences) => {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    onUpdateProfile({ notificationPreferences: next });
  };

  const tabItems: { id: typeof tab; label: string; Icon: React.ElementType }[] = [
    { id: 'orders', label: 'Order history', Icon: Package },
    { id: 'profile', label: 'Profile & addresses', Icon: User },
    { id: 'settings', label: 'Account settings', Icon: Settings },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-8 md:py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-[#1C1917]">
            Customer account
          </h1>
          <p className="text-[15px] text-[#78716C] mt-1">
            Manage your Calabar delivery profile, order history, and account preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Responsive Navigation: horizontal scroll strip on mobile/tablet, vertical sidebar on lg+ */}
        <aside className="lg:col-span-3 bg-white border border-[#E7E5E4] rounded-[12px] p-2 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar lg:sticky lg:top-24">
          {tabItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`lg:w-full flex items-center gap-2.5 lg:gap-3 px-3.5 py-2.5 rounded-[8px] text-[14px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                tab === id
                  ? 'bg-[#FFF7ED] text-[#EA580C] font-semibold'
                  : 'text-[#1C1917] hover:bg-[#F5F5F4]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </aside>

        {/* Main Panel */}
        <div className="lg:col-span-9 min-w-0">
          {tab === 'orders' && (
            <div className="space-y-4">
              <h2 className="text-[20px] font-semibold text-[#1C1917]">Your orders</h2>
              {orders.length === 0 ? (
                <EmptyState
                  title="No orders placed yet"
                  description="When you order from Calabar restaurants, your receipts and live tracking links will appear here."
                  actionLabel="Browse restaurants"
                  onAction={onBrowseRestaurants}
                />
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-[14px] font-bold text-[#1C1917]">
                            {order.orderNumber}
                          </span>
                          <span className="text-[#78716C]">·</span>
                          <span className="text-[15px] font-semibold text-[#1C1917]">
                            {order.restaurantName}
                          </span>
                          <StatusBadge status={order.status} />
                        </div>
                        <p className="text-[13px] text-[#78716C]">
                          {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                        </p>
                        <p className="text-[13px] text-[#78716C]">
                          Placed {formatShortDate(order.placedAt)} · {order.neighbourhood}
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                        <PriceDisplay
                          amount={order.total}
                          className="text-[16px] font-bold text-[#1C1917]"
                        />
                        <PrimaryButton
                          size="sm"
                          variant="outline"
                          onClick={() => onTrackOrder(order.id)}
                        >
                          View tracking
                        </PrimaryButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'profile' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSave}
                className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 sm:p-6 space-y-4"
              >
                <h2 className="text-[20px] font-semibold text-[#1C1917]">Profile information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <InputField
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <InputField
                    label="Phone number"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0803 412 8890"
                  />
                  <div>
                    <label
                      htmlFor="acct-neighbourhood"
                      className="block text-[13px] font-medium text-[#1C1917] mb-1.5"
                    >
                      Default Calabar neighbourhood
                    </label>
                    <select
                      id="acct-neighbourhood"
                      value={neighbourhood}
                      onChange={(e) => setNeighbourhood(e.target.value)}
                      className="w-full h-12 px-3.5 rounded-[8px] border border-[#E7E5E4] bg-white text-[15px] text-[#1C1917]"
                    >
                      {CALABAR_NEIGHBOURHOODS.filter((a) => a !== 'All Calabar').map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pt-2">
                  <PrimaryButton type="submit">Save profile</PrimaryButton>
                </div>
              </form>

              <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[18px] font-semibold text-[#1C1917]">
                    Saved delivery addresses ({customer.savedAddresses.length}/10)
                  </h3>
                  {customer.savedAddresses.length < 10 && (
                    <PrimaryButton
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddAddress(!showAddAddress)}
                    >
                      <Plus className="w-4 h-4" />
                      <span>{showAddAddress ? 'Cancel' : 'Add address'}</span>
                    </PrimaryButton>
                  )}
                </div>

                {showAddAddress && (
                  <form
                    onSubmit={handleAddAddress}
                    className="p-4 rounded-[10px] bg-[#FFF7ED]/70 border border-[#E7E5E4] space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <InputField
                        label="Address label"
                        value={addrLabel}
                        onChange={(e) => setAddrLabel(e.target.value)}
                        placeholder="E.g. Home, Office"
                        required
                      />
                      <div>
                        <label
                          htmlFor="new-addr-area"
                          className="block text-[13px] font-medium text-[#1C1917] mb-1.5"
                        >
                          Calabar neighbourhood
                        </label>
                        <select
                          id="new-addr-area"
                          value={addrNeighbourhood}
                          onChange={(e) => setAddrNeighbourhood(e.target.value)}
                          className="w-full h-12 px-3.5 rounded-[8px] border border-[#E7E5E4] bg-white text-[15px] text-[#1C1917]"
                        >
                          {CALABAR_NEIGHBOURHOODS.filter((a) => a !== 'All Calabar').map((area) => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <InputField
                      label="Street address &amp; landmark"
                      value={addrStreet}
                      onChange={(e) => setAddrStreet(e.target.value)}
                      placeholder="E.g. 24 Marian Road, opposite Market Gate"
                      required
                    />
                    <div className="flex justify-end">
                      <PrimaryButton type="submit" size="sm">
                        Save address
                      </PrimaryButton>
                    </div>
                  </form>
                )}

                {customer.savedAddresses.length === 0 ? (
                  <p className="text-[14px] text-[#78716C]">
                    No saved delivery addresses yet. Add one above for faster Calabar checkout.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {customer.savedAddresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="p-4 rounded-[10px] border border-[#E7E5E4] flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <MapPin className="w-4 h-4 text-[#EA580C] mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[#1C1917] truncate">
                              {addr.label}
                            </p>
                            <p className="text-[13px] text-[#78716C] mt-0.5 break-words">
                              {addr.street}
                            </p>
                            <p className="text-[12px] text-[#78716C]">
                              {addr.neighbourhood}, Calabar
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAddress(addr.id)}
                          aria-label={`Remove ${addr.label} address`}
                          className="p-1.5 text-[#78716C] hover:text-[#DC2626] cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 sm:p-6 space-y-4">
              <h2 className="text-[20px] font-semibold text-[#1C1917]">Account settings</h2>
              <div className="divide-y divide-[#E7E5E4]">
                <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-[15px] font-medium text-[#1C1917]">SMS order alerts</p>
                    <p className="text-[13px] text-[#78716C]">
                      Receive text updates when your rider is outside.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.smsOrderAlerts}
                    onChange={() => handlePreferenceChange('smsOrderAlerts')}
                    className="w-4 h-4 accent-[#EA580C] shrink-0"
                  />
                </label>
                <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-[15px] font-medium text-[#1C1917]">Email order receipts</p>
                    <p className="text-[13px] text-[#78716C]">
                      Send itemized Naira receipts to {customer.email || 'your email'}.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.emailReceipts}
                    onChange={() => handlePreferenceChange('emailReceipts')}
                    className="w-4 h-4 accent-[#EA580C] shrink-0"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
