import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CreditCard, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  CALABAR_NEIGHBOURHOODS,
  INITIAL_CUSTOMER_PROFILE,
} from '../../data/calabarData';
import {
  fetchOsrmRoute,
  pointForNeighbourhood,
  quoteDelivery,
} from '../../../shared/delivery.js';
import type { DeliveryQuote, DeliverySource } from '../../../shared/delivery';
import {
  CartItem,
  CustomerProfile,
  GeoPoint,
  MarketplaceSettings,
  Restaurant,
} from '../../types/marketplace';
import {
  DeliveryLocationSelection,
  DeliveryMapPicker,
  deliverySourceLabel,
} from './DeliveryMapPicker';
import { InputField, PriceDisplay, PrimaryButton } from '../ui/Primitives';

export interface CheckoutDetails {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  neighbourhood: string;
  deliveryInstructions: string;
  pickupLocation: GeoPoint;
  deliveryLocation: GeoPoint;
  deliveryDistanceKm: number;
  deliveryDurationMin: number;
  deliveryFee: number;
  locationSource: DeliverySource;
}

export interface PaymentResult {
  ok: boolean;
  error?: string;
}

interface CheckoutPageProps {
  items: CartItem[];
  restaurant: Restaurant | null;
  customer: CustomerProfile;
  serviceCharge: number;
  paystackMode: MarketplaceSettings['paystackMode'];
  isSignedIn: boolean;
  onOpenAuth: () => void;
  onBackToMenu: () => void;
  onPlaceOrder: (details: CheckoutDetails & { paymentReference: string }) => Promise<boolean>;
  onPayWithPaystack: (details: CheckoutDetails) => Promise<PaymentResult>;
}

type TestPaymentOutcome = 'success' | 'declined';

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  items,
  restaurant,
  customer,
  serviceCharge,
  paystackMode,
  isSignedIn,
  onOpenAuth,
  onBackToMenu,
  onPlaceOrder,
  onPayWithPaystack,
}) => {
  const defaultAddress = customer.savedAddresses[0];
  const [customerName, setCustomerName] = useState(customer.name);
  const [customerPhone, setCustomerPhone] = useState(customer.phone);
  const [neighbourhood, setNeighbourhood] = useState(
    defaultAddress?.neighbourhood || customer.neighbourhood || 'State Housing',
  );
  const [deliveryAddress, setDeliveryAddress] = useState(defaultAddress?.street || '');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [testOutcome, setTestOutcome] = useState<TestPaymentOutcome>('success');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationSelection, setLocationSelection] = useState<DeliveryLocationSelection | null>(
    null,
  );
  const [autoRoute, setAutoRoute] = useState<{
    distanceKm: number;
    durationMin: number;
  } | null>(null);

  // Sync profile fields once Firebase Auth finishes resolving customer data
  useEffect(() => {
    setCustomerName((prev) =>
      prev === INITIAL_CUSTOMER_PROFILE.name || !prev.trim() ? customer.name : prev,
    );
    if (customer.phone) {
      setCustomerPhone((prev) =>
        prev === INITIAL_CUSTOMER_PROFILE.phone || !prev.trim() ? customer.phone : prev,
      );
    }
    const firstAddr = customer.savedAddresses[0];
    if (firstAddr) {
      setDeliveryAddress((prev) => (!prev.trim() ? firstAddr.street : prev));
      setNeighbourhood((prev) => (prev === 'State Housing' ? firstAddr.neighbourhood : prev));
    } else if (customer.neighbourhood) {
      setNeighbourhood((prev) => (prev === 'State Housing' ? customer.neighbourhood : prev));
    }
  }, [customer]);

  const pickupLocation = useMemo<GeoPoint>(() => {
    if (restaurant?.location) return restaurant.location;
    return (
      pointForNeighbourhood(restaurant?.neighbourhood || customer.neighbourhood) ||
      pointForNeighbourhood('State Housing')!
    );
  }, [restaurant?.id, restaurant?.location, restaurant?.neighbourhood, customer.neighbourhood]);

  const deliveryLocation = useMemo<GeoPoint>(() => {
    if (locationSelection) return locationSelection.location;
    const matchingSaved = customer.savedAddresses.find(
      (address) =>
        address.street === deliveryAddress.trim() && address.neighbourhood === neighbourhood,
    );
    if (
      matchingSaved &&
      typeof matchingSaved.lat === 'number' &&
      typeof matchingSaved.lng === 'number'
    ) {
      return { lat: matchingSaved.lat, lng: matchingSaved.lng };
    }
    return pointForNeighbourhood(neighbourhood) || pickupLocation;
  }, [locationSelection, customer.savedAddresses, deliveryAddress, neighbourhood, pickupLocation]);

  useEffect(() => {
    let cancelled = false;
    setAutoRoute(null);
    void fetchOsrmRoute(pickupLocation, deliveryLocation).then((route) => {
      if (cancelled || !route) return;
      setAutoRoute({ distanceKm: route.distanceKm, durationMin: route.durationMin });
    });
    return () => {
      cancelled = true;
    };
  }, [pickupLocation, deliveryLocation]);

  const deliveryQuote = useMemo<DeliveryQuote>(
    () =>
      locationSelection
        ? {
            distanceKm: locationSelection.distanceKm,
            durationMin: locationSelection.durationMin,
            deliveryFee: locationSelection.deliveryFee,
            straightKm: 0,
            source: locationSelection.source,
          }
        : quoteDelivery({
            pickup: pickupLocation,
            delivery: deliveryLocation,
            baseFee: restaurant?.deliveryFee ?? 0,
            roadDistanceKm: autoRoute?.distanceKm,
            durationMin: autoRoute?.durationMin,
            source: autoRoute ? 'osm' : 'estimated',
          }),
    [
      locationSelection,
      pickupLocation,
      deliveryLocation,
      restaurant?.deliveryFee,
      autoRoute,
    ],
  );

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryFee = restaurant ? deliveryQuote.deliveryFee : 0;
  const total = subtotal + deliveryFee + serviceCharge;

  const validate = () => {
    const next: Record<string, string> = {};
    if (!customerName.trim()) next.customerName = 'Please enter your full name.';
    const cleanPhone = customerPhone.replace(/\s+/g, '');
    if (cleanPhone.length < 10) {
      next.customerPhone = 'Enter a valid Nigerian phone number (e.g. 0803 412 8890).';
    }
    if (!deliveryAddress.trim() || deliveryAddress.trim().length < 6) {
      next.deliveryAddress = 'Please enter your street address and house or gate number.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    if (!validate() || items.length === 0) return;

    if (!isSignedIn) {
      onOpenAuth();
      return;
    }

    const details: CheckoutDetails = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryAddress: deliveryAddress.trim(),
      neighbourhood,
      deliveryInstructions: deliveryInstructions.trim(),
      pickupLocation,
      deliveryLocation,
      deliveryDistanceKm: deliveryQuote.distanceKm,
      deliveryDurationMin: deliveryQuote.durationMin,
      deliveryFee,
      locationSource: deliveryQuote.source,
    };

    setIsSubmitting(true);
    try {
      if (paystackMode === 'Live') {
        const result = await onPayWithPaystack(details);
        if (!result.ok) {
          setPaymentError(
            result.error || 'Paystack could not complete this payment. Your cart has been preserved.',
          );
        }
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 450));

      if (testOutcome === 'declined') {
        setPaymentError(
          'Paystack Test Decline (PSK-ERR-51): Transaction declined by test issuing bank (insufficient funds). Your cart has been preserved — switch to a valid test card or retry.',
        );
        return;
      }

      const paymentReference = `PSK-CAL-${Date.now().toString().slice(-6)}`;
      const ok = await onPlaceOrder({ ...details, paymentReference });
      if (!ok) {
        setPaymentError('Unable to finalize order confirmation. Please review and try again.');
      }
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : 'Unable to complete payment. Your cart has been preserved.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0 || !restaurant) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-12">
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-8 text-center max-w-lg mx-auto">
          <h1 className="text-[24px] font-bold text-[#1C1917]">No items in your checkout</h1>
          <p className="text-[15px] text-[#78716C] mt-2 mb-6">
            Add meals from a Calabar restaurant before proceeding to checkout.
          </p>
          <PrimaryButton onClick={onBackToMenu}>Explore restaurants</PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-8 md:py-10">
      <button
        type="button"
        onClick={onBackToMenu}
        className="inline-flex items-center gap-2 text-[14px] font-medium text-[#78716C] hover:text-[#1C1917] mb-5 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to {restaurant.name}</span>
      </button>

      <h1 className="text-[28px] md:text-[32px] font-bold text-[#1C1917] mb-7">Checkout</h1>

      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Delivery Details */}
        <div className="lg:col-span-7 space-y-6 min-w-0">
          <section className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 sm:p-6 space-y-4">
            <h2 className="text-[18px] font-semibold text-[#1C1917]">1. Delivery address</h2>

            {customer.savedAddresses.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customer.savedAddresses.map((saved) => (
                  <button
                    key={saved.id}
                    type="button"
                    onClick={() => {
                      setDeliveryAddress(saved.street);
                      setNeighbourhood(saved.neighbourhood);
                      setLocationSelection(null);
                    }}
                    className={`px-3 py-1.5 rounded-[8px] border text-[13px] font-medium transition-colors cursor-pointer ${
                      deliveryAddress === saved.street
                        ? 'border-[#EA580C] bg-[#FFF7ED] text-[#EA580C]'
                        : 'border-[#E7E5E4] text-[#78716C] hover:text-[#1C1917]'
                    }`}
                  >
                    Use {saved.label}: {saved.neighbourhood}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label
                htmlFor="checkout-neighbourhood"
                className="block text-[13px] font-medium text-[#1C1917] mb-1.5"
              >
                Calabar neighbourhood
              </label>
              <select
                id="checkout-neighbourhood"
                value={neighbourhood}
                onChange={(e) => {
                  setNeighbourhood(e.target.value);
                  setLocationSelection(null);
                }}
                className="w-full h-12 px-3.5 rounded-[8px] bg-white border border-[#E7E5E4] focus:border-[#EA580C] focus:outline-none text-[15px] text-[#1C1917]"
              >
                {CALABAR_NEIGHBOURHOODS.filter((n) => n !== 'All Calabar').map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <InputField
              label="Street address & landmark"
              value={deliveryAddress}
              onChange={(e) => {
                setDeliveryAddress(e.target.value);
                setLocationSelection(null);
              }}
              placeholder="E.g. 18 Leopard Town Road, beside State Housing Gate"
              error={errors.deliveryAddress}
            />

            <div className="pt-2">
              <DeliveryMapPicker
                restaurantName={restaurant.name}
                restaurantAddress={restaurant.address}
                pickup={pickupLocation}
                deliveryAddress={deliveryAddress}
                neighbourhood={neighbourhood}
                deliveryLocation={deliveryLocation}
                baseFee={restaurant.deliveryFee}
                quote={deliveryQuote}
                onAddressChange={(address) => {
                  setDeliveryAddress(address);
                  setLocationSelection(null);
                }}
                onSelect={(selection) => {
                  setLocationSelection(selection);
                  setDeliveryAddress(selection.formattedAddress || deliveryAddress);
                  setNeighbourhood(selection.neighbourhood || neighbourhood);
                  setErrors((prev) => ({ ...prev, deliveryAddress: '' }));
                }}
              />
            </div>
          </section>

          <section className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 sm:p-6 space-y-4">
            <h2 className="text-[18px] font-semibold text-[#1C1917]">2. Contact &amp; instructions</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Recipient name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full name"
                error={errors.customerName}
              />
              <InputField
                label="Customer phone number"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0803 412 8890"
                error={errors.customerPhone}
              />
            </div>

            <div>
              <label
                htmlFor="delivery-instructions"
                className="block text-[13px] font-medium text-[#1C1917] mb-1.5"
              >
                Delivery instructions (optional)
              </label>
              <textarea
                id="delivery-instructions"
                rows={3}
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                placeholder="E.g. Call me at the security post, or drop with reception."
                className="w-full p-3.5 rounded-[8px] border border-[#E7E5E4] focus:border-[#EA580C] focus:outline-none text-[15px] text-[#1C1917] placeholder:text-[#78716C]/80"
              />
            </div>
          </section>
        </div>

        {/* Right: Order Summary & Paystack CTA */}
        <div className="lg:col-span-5 min-w-0">
          <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 sm:p-6 space-y-5 lg:sticky lg:top-24">
            <div>
              <h2 className="text-[18px] font-semibold text-[#1C1917]">Order summary</h2>
              <p className="text-[13px] text-[#78716C] mt-0.5">
                {restaurant.name} · Est. {restaurant.deliveryTimeMin}–{restaurant.deliveryTimeMax}{' '}
                mins
              </p>
            </div>

            <div className="divide-y divide-[#E7E5E4] border-y border-[#E7E5E4]">
              {items.map((item) => (
                <div key={item.cartItemId} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#1C1917]">
                      <span className="tabular-nums font-semibold">{item.quantity}×</span>{' '}
                      {item.menuItem.name}
                    </p>
                    {(item.selectedSize ||
                      item.selectedSpice ||
                      (item.selectedToppings && item.selectedToppings.length > 0) ||
                      item.selectedExtras.length > 0 ||
                      item.note) && (
                      <p className="text-[12px] text-[#78716C] mt-0.5">
                        {[
                          item.selectedSize?.label,
                          item.selectedSpice ? `Spice: ${item.selectedSpice}` : undefined,
                          ...(item.selectedToppings || []).map((t) => t.label),
                          ...item.selectedExtras.map((e) => e.label),
                          item.note ? `Note: ${item.note}` : undefined,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                  <PriceDisplay
                    amount={item.unitPrice * item.quantity}
                    className="text-[14px] font-semibold text-[#1C1917] shrink-0"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between text-[#78716C]">
                <span>Subtotal</span>
                <PriceDisplay amount={subtotal} className="text-[#1C1917] font-medium" />
              </div>
              <div className="flex justify-between text-[#78716C]">
                <span>Delivery distance</span>
                <span className="text-right">
                  <span className="font-medium text-[#1C1917]">
                    {deliveryQuote.distanceKm} km · {deliveryQuote.durationMin} mins
                  </span>
                  <span className="block text-[12px] text-[#78716C]">
                    {deliverySourceLabel(deliveryQuote.source)}
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-[#78716C]">
                <span>Delivery fee</span>
                <PriceDisplay amount={deliveryFee} className="text-[#1C1917] font-medium" />
              </div>
              <div className="flex justify-between text-[#78716C]">
                <span>Service charge</span>
                <PriceDisplay amount={serviceCharge} className="text-[#1C1917] font-medium" />
              </div>
              <div className="pt-3 border-t border-[#E7E5E4] flex justify-between text-[18px] font-bold text-[#1C1917]">
                <span>Total</span>
                <PriceDisplay amount={total} />
              </div>
            </div>

            {/* Paystack Gateway Security & Test Environment Selector */}
            <div className="p-3.5 rounded-[8px] bg-[#FFF7ED] border border-[#E7E5E4] space-y-2.5 text-[13px] text-[#78716C]">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                    <p className="font-semibold text-[#1C1917]">
                      Payment gateway ({paystackMode})
                    </p>
                    <p className="mt-0.5 leading-relaxed">
                      {paystackMode === 'Test Preview'
                        ? 'Sandbox preview: no card is charged and no live Paystack transaction is created.'
                        : 'Card and bank transfer details are handled by Paystack. Payments are verified on the server before your order is confirmed.'}
                    </p>

                </div>
              </div>

              {paystackMode === 'Test Preview' && (
                <div className="pt-2 border-t border-[#E7E5E4] space-y-1.5">
                  <label
                    htmlFor="paystack-test-outcome"
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1C1917]"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-[#EA580C]" aria-hidden="true" />
                    <span>Paystack sandbox test card scenario</span>
                  </label>
                  <select
                    id="paystack-test-outcome"
                    value={testOutcome}
                    onChange={(e) => {
                      setTestOutcome(e.target.value as TestPaymentOutcome);
                      setPaymentError(null);
                    }}
                    className="w-full h-9 px-2.5 rounded-[6px] border border-[#E7E5E4] bg-white text-[13px] text-[#1C1917] focus:border-[#EA580C] focus:outline-none cursor-pointer"
                  >
                    <option value="success">Test Visa / Transfer — Succeeds &amp; confirms order</option>
                    <option value="declined">Test Declined Card — Simulates failed transaction</option>
                  </select>
                </div>
              )}
            </div>

            {!isSignedIn && (
              <div className="p-3.5 rounded-[8px] bg-[#FAFAF9] border border-[#E7E5E4] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[13px]">
                <p className="text-[#1C1917]">
                  Sign in with Google to save your order receipt and track delivery.
                </p>
                <PrimaryButton size="sm" variant="outline" onClick={onOpenAuth}>
                  Sign in
                </PrimaryButton>
              </div>
            )}

            {paymentError && (
              <div
                role="alert"
                className="p-3.5 rounded-[8px] bg-[#DC2626]/8 border border-[#DC2626]/30 text-[13px] text-[#DC2626] space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="leading-relaxed">{paymentError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTestOutcome('success');
                    setPaymentError(null);
                  }}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#1C1917] hover:text-[#EA580C] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {paystackMode === 'Live'
                      ? 'Try Paystack again'
                      : 'Switch back to valid test card & retry'}
                  </span>
                </button>
              </div>
            )}

            <PrimaryButton type="submit" fullWidth size="lg" loading={isSubmitting}>
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>
                {isSignedIn
                  ? paystackMode === 'Test Preview'
                    ? 'Confirm sandbox order · '
                    : 'Pay online with Paystack · '
                  : 'Sign in & continue · '}
              </span>
              <PriceDisplay amount={total} />
            </PrimaryButton>
          </div>
        </div>
      </form>
    </div>
  );
};
