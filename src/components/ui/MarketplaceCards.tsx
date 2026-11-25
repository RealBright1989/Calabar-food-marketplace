import React from 'react';
import { MapPin, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { CartItem, FoodCategory, MenuItem, Restaurant } from '../../types/marketplace';
import { formatNaira } from '../../utils/format';
import { PriceDisplay, QuantitySelector, ResilientImage } from './Primitives';

/* 1. SearchBar */
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  buttonLabel?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search for rice, chicken, restaurants...',
  buttonLabel,
  className = '',
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-center bg-white border border-[#E7E5E4] focus-within:border-[#EA580C] rounded-[8px] h-12 px-3 gap-2 transition-colors ${className}`}
    >
      <Search className="w-4 h-4 text-[#78716C] shrink-0" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 min-w-0 bg-transparent text-[15px] text-[#1C1917] placeholder:text-[#78716C] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="p-1 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {buttonLabel && (
        <button
          type="submit"
          className="h-9 px-4 rounded-[6px] bg-[#EA580C] hover:bg-[#C2410C] text-white text-[14px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          {buttonLabel}
        </button>
      )}
    </form>
  );
};

/* 2. CategoryCard */
interface CategoryCardProps {
  label: string;
  subtitle: string;
  image: string;
  active?: boolean;
  onClick: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  label,
  subtitle,
  image,
  active = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left rounded-[12px] border transition-all duration-150 overflow-hidden cursor-pointer ${
        active
          ? 'border-[#EA580C] bg-[#FFF7ED]'
          : 'border-[#E7E5E4] bg-white hover:border-[#1C1917]/30 hover:-translate-y-0.5'
      }`}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-[#F5F5F4]">
        <ResilientImage
          src={image}
          alt={label}
          fallbackTitle={label}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
        />
      </div>
      <div className="p-3.5">
        <p className="text-[15px] font-semibold text-[#1C1917] leading-snug">{label}</p>
        <p className="text-[13px] text-[#78716C] mt-0.5 line-clamp-1">{subtitle}</p>
      </div>
    </button>
  );
};

/* 3. RestaurantCard */
interface RestaurantCardProps {
  restaurant: Restaurant;
  onSelect: (restaurantId: string) => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({ restaurant, onSelect }) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(restaurant.id)}
      className="group w-full text-left bg-white border border-[#E7E5E4] rounded-[12px] overflow-hidden hover:border-[#1C1917]/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F5F5F4]">
        <ResilientImage
          src={restaurant.coverImage}
          alt={restaurant.name}
          fallbackTitle={restaurant.name}
          className={`w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200 ${
            !restaurant.isOpen ? 'grayscale-[40%] opacity-85' : ''
          }`}
        />
      </div>
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[18px] font-semibold text-[#1C1917] leading-snug group-hover:text-[#EA580C] transition-colors">
              {restaurant.name}
            </h3>
            {restaurant.reviewCount > 0 && restaurant.rating !== null ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#1C1917] shrink-0 tabular-nums pt-0.5">
                <Star className="w-3.5 h-3.5 fill-[#EA580C] text-[#EA580C]" aria-hidden="true" />
                {restaurant.rating.toFixed(1)}
                <span className="font-normal text-[#78716C]">({restaurant.reviewCount})</span>
              </span>
            ) : (
              <span className="text-[13px] font-medium text-[#78716C] shrink-0 pt-0.5">
                New vendor
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#78716C] mt-1 line-clamp-1">
            {restaurant.cuisine}
            <span aria-hidden="true"> · </span>
            <span className="font-medium text-[#1C1917]">{restaurant.priceTier}</span>
          </p>
          <p className="text-[13px] text-[#78716C] mt-1 flex items-center gap-1 truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#78716C]" aria-hidden="true" />
            <span className="truncate">{restaurant.neighbourhood}, Calabar</span>
          </p>
        </div>

        <div className="pt-2.5 border-t border-[#E7E5E4] flex items-center justify-between gap-2 text-[13px] text-[#78716C]">
          <div className="flex items-center gap-1.5 min-w-0 truncate tabular-nums">
            <span>
              {restaurant.deliveryTimeMin}–{restaurant.deliveryTimeMax} mins
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatNaira(restaurant.deliveryFee)} delivery</span>
            {restaurant.minimumOrder > 0 && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">
                  Min {formatNaira(restaurant.minimumOrder)}
                </span>
              </>
            )}
          </div>
          <span
            className={`font-semibold whitespace-nowrap shrink-0 ${
              restaurant.isOpen ? 'text-[#15803D]' : 'text-[#DC2626]'
            }`}
          >
            {restaurant.isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>
    </button>
  );
};

/* 4. FoodCard */
interface FoodCardProps {
  meal: MenuItem;
  restaurantName: string;
  restaurantIsOpen?: boolean;
  inCartQuantity?: number;
  onSelectMeal: (meal: MenuItem) => void;
  onQuickAdd?: (meal: MenuItem) => void;
}

export const FoodCard: React.FC<FoodCardProps> = ({
  meal,
  restaurantName,
  restaurantIsOpen = true,
  inCartQuantity = 0,
  onSelectMeal,
  onQuickAdd,
}) => {
  const isAvailable = meal.available && restaurantIsOpen;

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-[12px] overflow-hidden flex flex-col hover:border-[#1C1917]/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150">
      <button
        type="button"
        onClick={() => onSelectMeal(meal)}
        className="text-left cursor-pointer group focus:outline-none"
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-[#F5F5F4]">
          <ResilientImage
            src={meal.image}
            alt={meal.name}
            fallbackTitle={meal.name}
            className={`w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200 ${
              !isAvailable ? 'grayscale-[45%] opacity-80' : ''
            }`}
          />
        </div>
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <p className="text-[#78716C] truncate">
              {restaurantName}
              <span aria-hidden="true"> · </span>
              {meal.category}
            </p>
            <span
              className={`font-semibold whitespace-nowrap shrink-0 ${
                !meal.available
                  ? 'text-[#DC2626]'
                  : !restaurantIsOpen
                    ? 'text-[#78716C]'
                    : 'text-[#15803D]'
              }`}
            >
              {!meal.available ? 'Sold out' : !restaurantIsOpen ? 'Closed' : 'Available'}
            </span>
          </div>
          <h3 className="text-[16px] font-semibold text-[#1C1917] mt-1 leading-snug line-clamp-1 group-hover:text-[#EA580C] transition-colors">
            {meal.name}
          </h3>
          <p className="text-[13px] text-[#78716C] mt-1 line-clamp-2 leading-relaxed">
            {meal.description}
          </p>
        </div>
      </button>

      <div className="mt-auto px-4 pb-4 pt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <PriceDisplay amount={meal.price} className="text-[16px] font-bold text-[#1C1917]" />
          {inCartQuantity > 0 && (
            <span className="text-[12px] font-semibold text-[#EA580C] tabular-nums whitespace-nowrap">
              · {inCartQuantity} in cart
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={!isAvailable}
          onClick={() => (onQuickAdd ? onQuickAdd(meal) : onSelectMeal(meal))}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#EA580C] hover:bg-[#C2410C] disabled:bg-[#E7E5E4] disabled:text-[#78716C] text-white text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {isAvailable ? (
            <>
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{inCartQuantity > 0 ? 'Add more' : 'Add'}</span>
            </>
          ) : (
            <span>{!meal.available ? 'Sold out' : 'Closed'}</span>
          )}
        </button>
      </div>
    </div>
  );
};

/* 5. CartItemRow */
interface CartItemRowProps {
  item: CartItem;
  onUpdateQty: (cartItemId: string, delta: number) => void;
  onRemove: (cartItemId: string) => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  onUpdateQty,
  onRemove,
}) => {
  const optionsSummary = [
    item.selectedSize?.label,
    item.selectedSpice,
    ...(item.selectedToppings?.map((t) => `+ ${t.label}`) || []),
    ...item.selectedExtras.map((e) => `+ ${e.label}`),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-start gap-3.5 py-4 border-b border-[#E7E5E4] last:border-b-0">
      <div className="w-16 h-16 rounded-[8px] overflow-hidden shrink-0 bg-[#F5F5F4]">
        <ResilientImage
          src={item.menuItem.image}
          alt={item.menuItem.name}
          fallbackTitle={item.menuItem.name}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-[15px] font-semibold text-[#1C1917] leading-snug">
            {item.menuItem.name}
          </h4>
          <button
            type="button"
            onClick={() => onRemove(item.cartItemId)}
            aria-label={`Remove ${item.menuItem.name} from cart`}
            className="text-[#78716C] hover:text-[#DC2626] p-1 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {optionsSummary && (
          <p className="text-[13px] text-[#78716C] mt-0.5 leading-snug">{optionsSummary}</p>
        )}
        {item.note && (
          <p className="text-[12px] text-[#78716C] italic mt-0.5">Note: {item.note}</p>
        )}

        <div className="flex items-center justify-between gap-3 mt-3">
          <QuantitySelector
            size="sm"
            quantity={item.quantity}
            onDecrease={() => onUpdateQty(item.cartItemId, -1)}
            onIncrease={() => onUpdateQty(item.cartItemId, 1)}
          />
          <PriceDisplay
            amount={item.unitPrice * item.quantity}
            className="text-[15px] font-semibold text-[#1C1917]"
          />
        </div>
      </div>
    </div>
  );
};

export type { FoodCategory };
