import React from 'react';
import { Check, MapPin, Phone, Store } from 'lucide-react';
import { ORDER_TIMELINE_STEPS } from '../../data/calabarData';
import { Order, OrderStatus } from '../../types/marketplace';
import { formatOrderTime } from '../../utils/format';
import { DeliveryStaticMap } from '../ui/DeliveryStaticMap';
import { EmptyState, PriceDisplay, PrimaryButton, StatusBadge } from '../ui/Primitives';

interface OrderTrackingPageProps {
  orders: Order[];
  selectedOrderId: string | null;
  canAdvanceStatus?: boolean;
  onSelectOrder: (orderId: string) => void;
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
  onBrowseRestaurants: () => void;
}

export const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({
  orders,
  selectedOrderId,
  canAdvanceStatus = false,
  onSelectOrder,
  onAdvanceOrderStatus,
  onBrowseRestaurants,
}) => {
  const activeOrder =
    orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  if (!activeOrder) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-12">
        <EmptyState
          title="No orders to track yet"
          description="Place an order from any Calabar restaurant to track preparation and delivery in real time."
          actionLabel="Explore restaurants"
          onAction={onBrowseRestaurants}
        />
      </div>
    );
  }

  const currentStepIndex = ORDER_TIMELINE_STEPS.indexOf(activeOrder.status);
  const canAdvance =
    activeOrder.status !== 'Delivered' &&
    activeOrder.status !== 'Cancelled' &&
    currentStepIndex >= 0 &&
    currentStepIndex < ORDER_TIMELINE_STEPS.length - 1;

  const nextStatus = canAdvance ? ORDER_TIMELINE_STEPS[currentStepIndex + 1] : null;

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-8 md:py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-[#1C1917]">
            Order tracking
          </h1>
          <p className="text-[15px] text-[#78716C] mt-1">
            Live kitchen and rider progress for your Calabar delivery.
          </p>
        </div>

        {orders.length > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 w-full sm:w-auto">
            <label htmlFor="order-switcher" className="text-[13px] font-medium text-[#78716C] shrink-0">
              Select order:
            </label>
            <select
              id="order-switcher"
              value={activeOrder.id}
              onChange={(e) => onSelectOrder(e.target.value)}
              className="h-10 px-3 rounded-[8px] border border-[#E7E5E4] bg-white text-[14px] font-medium text-[#1C1917] focus:border-[#EA580C] focus:outline-none cursor-pointer w-full sm:w-auto max-w-full"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} — {o.restaurantName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Progress Timeline */}
        <div className="lg:col-span-7 bg-white border border-[#E7E5E4] rounded-[12px] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#E7E5E4]">
            <div>
              <p className="text-[13px] text-[#78716C]">Order number</p>
              <p className="text-[20px] font-bold text-[#1C1917] font-mono tabular-nums">
                {activeOrder.orderNumber}
              </p>
            </div>
            <StatusBadge status={activeOrder.status} />
          </div>

          {activeOrder.status === 'Cancelled' ? (
            <div className="py-8 text-center">
              <p className="text-[16px] font-semibold text-[#DC2626]">
                This order was cancelled.
              </p>
              <p className="text-[14px] text-[#78716C] mt-1">
                Any confirmed Paystack payment is automatically queued for refund.
              </p>
            </div>
          ) : (
            <ol className="mt-6 space-y-0">
              {ORDER_TIMELINE_STEPS.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                const isLast = idx === ORDER_TIMELINE_STEPS.length - 1;

                return (
                  <li key={step} className="relative flex items-start gap-4 pb-6 last:pb-0">
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={`absolute left-[13px] top-7 bottom-0 w-0.5 ${
                          idx < currentStepIndex ? 'bg-[#15803D]' : 'bg-[#E7E5E4]'
                        }`}
                      />
                    )}
                    <div
                      className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 text-[12px] font-bold tabular-nums ${
                        isCompleted
                          ? 'bg-[#15803D] border-[#15803D] text-white'
                          : 'bg-white border-[#E7E5E4] text-[#78716C]'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <div className="pt-0.5 flex-1">
                      <p
                        className={`text-[15px] font-semibold ${
                          isCurrent
                            ? 'text-[#EA580C]'
                            : isCompleted
                              ? 'text-[#1C1917]'
                              : 'text-[#78716C]'
                        }`}
                      >
                        {step}
                      </p>
                      {isCurrent && (
                        <p className="text-[13px] text-[#78716C] mt-0.5">
                          Current stage · Placed at {formatOrderTime(activeOrder.placedAt)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {nextStatus && (
            <div className="mt-6 pt-5 border-t border-[#E7E5E4] flex flex-wrap items-center justify-between gap-3">
              {canAdvanceStatus ? (
                <>
                  <p className="text-[13px] text-[#78716C]">
                    Staff control — advance live kitchen or rider milestone:
                  </p>
                  <PrimaryButton
                    size="sm"
                    variant="outline"
                    onClick={() => onAdvanceOrderStatus(activeOrder.id, nextStatus)}
                  >
                    Advance to: {nextStatus}
                  </PrimaryButton>
                </>
              ) : (
                <p className="text-[13px] text-[#78716C]">
                  Updates appear automatically here as the kitchen prepares and dispatches your
                  order.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: Delivery Map, Order Details & Vendor Info */}
        <div className="lg:col-span-5 space-y-5">
          <DeliveryStaticMap
            restaurantName={activeOrder.restaurantName}
            restaurantAddress={
              activeOrder.restaurantAddress || `${activeOrder.restaurantName}, Calabar`
            }
            deliveryAddress={activeOrder.deliveryAddress}
            neighbourhood={activeOrder.neighbourhood}
            heading="Delivery route map"
          />

          <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 sm:p-6 space-y-4">
            <h2 className="text-[18px] font-semibold text-[#1C1917]">Vendor &amp; delivery</h2>

            <div className="space-y-3 text-[14px]">
              <div className="flex items-start gap-3">
                <Store className="w-4 h-4 text-[#EA580C] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-[#1C1917]">{activeOrder.restaurantName}</p>
                  <p className="text-[#78716C]">
                    Est. delivery: {activeOrder.estimatedDelivery}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#EA580C] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-[#78716C]">Vendor phone</p>
                  <p className="font-medium text-[#1C1917] tabular-nums">
                    {activeOrder.restaurantPhone}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#EA580C] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-[#78716C]">Delivering to ({activeOrder.neighbourhood})</p>
                  <p className="font-medium text-[#1C1917]">{activeOrder.deliveryAddress}</p>
                  {activeOrder.deliveryInstructions && (
                    <p className="text-[13px] text-[#78716C] mt-0.5">
                      Note: {activeOrder.deliveryInstructions}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 sm:p-6 space-y-4">
            <h2 className="text-[18px] font-semibold text-[#1C1917]">Receipt summary</h2>
            <div className="divide-y divide-[#E7E5E4] border-y border-[#E7E5E4]">
              {activeOrder.items.map((item, index) => (
                <div key={index} className="py-2.5 flex justify-between gap-3 text-[14px]">
                  <div>
                    <p className="font-medium text-[#1C1917]">
                      <span className="tabular-nums font-semibold">{item.quantity}×</span>{' '}
                      {item.name}
                    </p>
                    {item.optionsText && (
                      <p className="text-[12px] text-[#78716C]">{item.optionsText}</p>
                    )}
                  </div>
                  <PriceDisplay
                    amount={item.unitPrice * item.quantity}
                    className="font-medium text-[#1C1917] shrink-0"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1.5 text-[14px]">
              <div className="flex justify-between text-[#78716C]">
                <span>Subtotal</span>
                <PriceDisplay amount={activeOrder.subtotal} className="text-[#1C1917]" />
              </div>
              <div className="flex justify-between text-[#78716C]">
                <span>Delivery fee</span>
                <PriceDisplay amount={activeOrder.deliveryFee} className="text-[#1C1917]" />
              </div>
              <div className="flex justify-between text-[#78716C]">
                <span>Service charge</span>
                <PriceDisplay amount={activeOrder.serviceCharge} className="text-[#1C1917]" />
              </div>
              <div className="pt-2 border-t border-[#E7E5E4] flex justify-between text-[16px] font-bold text-[#1C1917]">
                <span>Total paid ({activeOrder.paymentMethod})</span>
                <PriceDisplay amount={activeOrder.total} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
