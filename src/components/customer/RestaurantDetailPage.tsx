import React, { useMemo, useState } from 'react';
import { ArrowLeft, Clock, MapPin, ShoppingBag, Star, Truck } from 'lucide-react';
import { CartItem, MenuItem, Restaurant } from '../../types/marketplace';
import { formatNaira } from '../../utils/format';
import { CartItemRow, FoodCard, SearchBar } from '../ui/MarketplaceCards';
import { EmptyState, PriceDisplay, PrimaryButton, ResilientImage } from '../ui/Primitives';

interface RestaurantDetailPageProps {
  restaurant: Restaurant;
  menuItems: MenuItem[];
  cartItems: CartItem[];
  cartRestaurant: Restaurant | null;
  serviceCharge: number;
  onBack: () => void;
  onSelectMeal: (meal: MenuItem) => void;
  onUpdateCartQty: (cartItemId: string, delta: number) => void;
  onRemoveCartItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onOpenCart: () => void;
  onProceedToCheckout: () => void;
}

export const RestaurantDetailPage: React.FC<RestaurantDetailPageProps> = ({
  restaurant,
  menuItems,
  cartItems,
  cartRestaurant,
  serviceCharge,
  onBack,
  onSelectMeal,
  onUpdateCartQty,
  onRemoveCartItem,
  onClearCart,
  onOpenCart,
  onProceedToCheckout,
}) => {
  const categories = useMemo(() => {
    const unique = Array.from(new Set(menuItems.map((m) => m.category)));
    return ['All', ...unique];
  }, [menuItems]);

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [menuSearch, setMenuSearch] = useState('');

  const visibleItems = useMemo(() => {
    const query = menuSearch.trim().toLowerCase();
    return menuItems
      .filter((item) =>
        activeCategory === 'All' ? true : item.category === activeCategory,
      )
      .filter((item) => {
        if (!query) return true;
        return (
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
        );
      });
  }, [menuItems, activeCategory, menuSearch]);

  const itemCountByMealId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      map.set(
        item.menuItem.id,
        (map.get(item.menuItem.id) || 0) + item.quantity,
      );
    }
    return map;
  }, [cartItems]);

  const isSameRestaurantCart =
    cartItems.length > 0 && cartRestaurant?.id === restaurant.id;
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const meetsMinimum =
    restaurant.minimumOrder === 0 || subtotal >= restaurant.minimumOrder;

  return (
    <div
      className={`max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-6 md:py-8 ${
        cartItems.length > 0 ? 'pb-24 lg:pb-8' : ''
      }`}
    >
      {/* Back navigation */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[14px] font-medium text-[#78716C] hover:text-[#1C1917] mb-5 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to restaurants</span>
      </button>

      {/* Top Restaurant Header */}
      <div className="bg-white border border-[#E7E5E4] rounded-[12px] overflow-hidden mb-8">
        <div className="relative h-48 sm:h-64 w-full bg-[#F5F5F4]">
          <ResilientImage
            src={restaurant.coverImage}
            alt={restaurant.name}
            fallbackTitle={restaurant.name}
            priority
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute bottom-4 left-4 sm:left-6 flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[12px] bg-[#1C1917] text-white border-2 border-white flex items-center justify-center text-[20px] font-bold font-display shadow-md shrink-0">
              {restaurant.logoText}
            </div>
            <div className="text-white">
              <h1 className="text-[24px] sm:text-[32px] font-bold leading-tight">
                {restaurant.name}
              </h1>
              <p className="text-[14px] text-white/90">
                {restaurant.cuisine}
                <span aria-hidden="true"> · </span>
                {restaurant.priceTier}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-[15px] text-[#78716C] max-w-2xl leading-relaxed">
                {restaurant.description}
              </p>
              <p className="text-[13px] text-[#1C1917] font-medium mt-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#EA580C] shrink-0" aria-hidden="true" />
                <span>{restaurant.address}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-[14px] font-semibold px-3 py-1.5 rounded-[8px] ${
                  restaurant.isOpen
                    ? 'bg-[#15803D]/10 text-[#15803D]'
                    : 'bg-[#DC2626]/10 text-[#DC2626]'
                }`}
              >
                {restaurant.isOpen ? 'Open for delivery' : 'Currently closed'}
              </span>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[#E7E5E4] grid grid-cols-2 sm:grid-cols-4 gap-4 text-[14px]">
            <div className="flex items-start gap-2.5">
              <Truck className="w-4 h-4 text-[#EA580C] mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[12px] text-[#78716C]">Delivery fee &amp; minimum</p>
                <p className="font-semibold text-[#1C1917] tabular-nums">
                  {formatNaira(restaurant.deliveryFee)}
                  {restaurant.minimumOrder > 0 && (
                    <span className="font-normal text-[#78716C]">
                      {' '}
                      · Min {formatNaira(restaurant.minimumOrder)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[#EA580C] mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[12px] text-[#78716C]">Delivery estimate</p>
                <p className="font-semibold text-[#1C1917] tabular-nums">
                  {restaurant.deliveryTimeMin}–{restaurant.deliveryTimeMax} mins
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[#EA580C] mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[12px] text-[#78716C]">Opening hours</p>
                <p className="font-semibold text-[#1C1917]">{restaurant.openingHours}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Star className="w-4 h-4 text-[#EA580C] mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[12px] text-[#78716C]">Customer rating</p>
                <p className="font-semibold text-[#1C1917] tabular-nums">
                  {restaurant.reviewCount > 0 && restaurant.rating !== null
                    ? `${restaurant.rating.toFixed(1)} (${restaurant.reviewCount} reviews)`
                    : 'No reviews yet'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!restaurant.isOpen && (
        <div className="mb-6 p-4 rounded-[10px] bg-[#FFF7ED] border border-[#EA580C]/30 text-[14px] text-[#1C1917]">
          This kitchen is currently closed ({restaurant.openingHours}). You can browse the menu
          now, or explore open Calabar vendors.
        </div>
      )}

      {/* 2-Column Workspace: Menu (Left) + Inline Cart Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Categories, Menu Search & Food Grid */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-[22px] font-semibold text-[#1C1917]">Menu</h2>
            <div className="w-full sm:w-72">
              <SearchBar
                value={menuSearch}
                onChange={setMenuSearch}
                placeholder="Search dishes on this menu..."
              />
            </div>
          </div>

          {/* Food Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={`h-10 px-4 rounded-[8px] text-[14px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-[#EA580C] text-white'
                    : 'bg-white border border-[#E7E5E4] text-[#1C1917] hover:border-[#1C1917]/40'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          {visibleItems.length === 0 ? (
            <EmptyState
              title="No matching dishes"
              description="Try clearing the search or selecting another food category on this menu."
              actionLabel="Show all dishes"
              onAction={() => {
                setActiveCategory('All');
                setMenuSearch('');
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {visibleItems.map((meal) => (
                <FoodCard
                  key={meal.id}
                  meal={meal}
                  restaurantName={restaurant.name}
                  restaurantIsOpen={restaurant.isOpen}
                  inCartQuantity={itemCountByMealId.get(meal.id) || 0}
                  onSelectMeal={onSelectMeal}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Desktop Sticky Cart Preview */}
        <aside className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24">
          <div className="bg-white border border-[#E7E5E4] rounded-[12px] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E7E5E4] bg-[#FFF7ED]/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#EA580C]" aria-hidden="true" />
                <h3 className="text-[16px] font-semibold text-[#1C1917]">Cart preview</h3>
              </div>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-[12px] font-medium text-[#DC2626] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[14px] font-medium text-[#1C1917]">Your cart is empty</p>
                <p className="text-[13px] text-[#78716C] mt-1 leading-relaxed">
                  Select any available dish to customise sizes, extras, and add it to your order.
                </p>
              </div>
            ) : !isSameRestaurantCart && cartRestaurant ? (
              <div className="p-5 space-y-3">
                <p className="text-[14px] text-[#1C1917]">
                  You currently have{' '}
                  <strong className="tabular-nums">{totalCartItems}</strong>{' '}
                  {totalCartItems === 1 ? 'item' : 'items'} in your cart from{' '}
                  <strong>{cartRestaurant.name}</strong>.
                </p>
                <p className="text-[13px] text-[#78716C]">
                  Adding a dish from {restaurant.name} will prompt you to start a fresh cart.
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  <PrimaryButton size="sm" fullWidth onClick={onOpenCart}>
                    View {cartRestaurant.name} cart
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="max-h-72 overflow-y-auto pr-1 divide-y divide-[#E7E5E4]">
                  {cartItems.map((item) => (
                    <CartItemRow
                      key={item.cartItemId}
                      item={item}
                      onUpdateQty={onUpdateCartQty}
                      onRemove={onRemoveCartItem}
                    />
                  ))}
                </div>

                <div className="pt-3 border-t border-[#E7E5E4] space-y-1.5 text-[14px]">
                  <div className="flex justify-between text-[#78716C]">
                    <span>Running subtotal</span>
                    <PriceDisplay amount={subtotal} className="font-semibold text-[#1C1917]" />
                  </div>
                  <div className="flex justify-between text-[#78716C]">
                    <span>Delivery fee</span>
                    <PriceDisplay amount={restaurant.deliveryFee} className="text-[#1C1917]" />
                  </div>
                  <div className="flex justify-between text-[#78716C]">
                    <span>Service charge</span>
                    <PriceDisplay amount={serviceCharge} className="text-[#1C1917]" />
                  </div>
                </div>

                {!meetsMinimum && (
                  <p className="text-[12px] text-[#D97706] font-medium">
                    Add <PriceDisplay amount={restaurant.minimumOrder - subtotal} /> more to reach{' '}
                    {formatNaira(restaurant.minimumOrder)} minimum order.
                  </p>
                )}

                <PrimaryButton
                  fullWidth
                  disabled={!meetsMinimum}
                  onClick={onProceedToCheckout}
                >
                  Checkout · <PriceDisplay amount={subtotal + restaurant.deliveryFee + serviceCharge} />
                </PrimaryButton>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile Compact Sticky Cart Preview Bar (under 64px height) */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E7E5E4] px-4 py-2.5 shadow-lg">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] text-[#78716C] truncate">
                <span className="font-semibold text-[#1C1917] tabular-nums">
                  {totalCartItems} {totalCartItems === 1 ? 'item' : 'items'}
                </span>
                {' · '}
                {cartRestaurant?.name}
              </p>
              <PriceDisplay
                amount={subtotal}
                className="text-[15px] font-bold text-[#1C1917]"
              />
            </div>
            <PrimaryButton size="sm" onClick={onOpenCart}>
              View cart
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
};
