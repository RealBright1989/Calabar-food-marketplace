import React from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { CartItem, Restaurant } from '../../types/marketplace';
import { CartItemRow } from '../ui/MarketplaceCards';
import { EmptyState, PriceDisplay, PrimaryButton } from '../ui/Primitives';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  restaurant: Restaurant | null;
  serviceCharge: number;
  onUpdateQty: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
  onBrowseRestaurants: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  onClose,
  items,
  restaurant,
  serviceCharge,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
  onBrowseRestaurants,
}) => {
  if (!open) return null;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryFee = items.length > 0 && restaurant ? restaurant.deliveryFee : 0;
  const activeServiceCharge = items.length > 0 ? serviceCharge : 0;
  const total = subtotal + deliveryFee + activeServiceCharge;

  const meetsMinimum = !restaurant || restaurant.minimumOrder === 0 || subtotal >= restaurant.minimumOrder;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#1C1917]/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl border-l border-[#E7E5E4]">
        {/* Header */}
        <div className="h-[72px] px-5 border-b border-[#E7E5E4] flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-[#1C1917]">Your cart</h2>
            {restaurant && items.length > 0 && (
              <p className="text-[13px] text-[#78716C] truncate">
                Ordering from {restaurant.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F5F4] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="py-8">
              <EmptyState
                icon={<ShoppingBag className="w-6 h-6" />}
                title="Your cart is empty"
                description="Add delicious meals from any Calabar restaurant to start your order."
                actionLabel="Explore restaurants"
                onAction={() => {
                  onClose();
                  onBrowseRestaurants();
                }}
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between pb-2 mb-1 border-b border-[#E7E5E4]">
                <span className="text-[13px] font-medium text-[#78716C]">
                  {items.reduce((acc, i) => acc + i.quantity, 0)} items selected
                </span>
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-[13px] font-medium text-[#DC2626] hover:underline cursor-pointer"
                >
                  Clear cart
                </button>
              </div>

              {items.map((item) => (
                <CartItemRow
                  key={item.cartItemId}
                  item={item}
                  onUpdateQty={onUpdateQty}
                  onRemove={onRemoveItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* Totals & Checkout CTA */}
        {items.length > 0 && (
          <div className="p-5 border-t border-[#E7E5E4] bg-[#FFF7ED]/50 space-y-4 shrink-0">
            <div className="space-y-2 text-[14px]">
              <div className="flex items-center justify-between text-[#78716C]">
                <span>Subtotal</span>
                <PriceDisplay amount={subtotal} className="text-[#1C1917] font-medium" />
              </div>
              <div className="flex items-center justify-between text-[#78716C]">
                <span>Delivery fee</span>
                <PriceDisplay amount={deliveryFee} className="text-[#1C1917] font-medium" />
              </div>
              <div className="flex items-center justify-between text-[#78716C]">
                <span>Service charge</span>
                <PriceDisplay amount={activeServiceCharge} className="text-[#1C1917] font-medium" />
              </div>
              <div className="pt-2.5 border-t border-[#E7E5E4] flex items-center justify-between text-[16px] font-bold text-[#1C1917]">
                <span>Total</span>
                <PriceDisplay amount={total} />
              </div>
            </div>

            {!meetsMinimum && restaurant && (
              <p className="text-[13px] text-[#D97706] font-medium">
                Minimum order for {restaurant.name} is{' '}
                <PriceDisplay amount={restaurant.minimumOrder} />. Add{' '}
                <PriceDisplay amount={restaurant.minimumOrder - subtotal} /> more to checkout.
              </p>
            )}

            <PrimaryButton
              fullWidth
              size="lg"
              disabled={!meetsMinimum}
              onClick={onProceedToCheckout}
            >
              Proceed to checkout
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
};
