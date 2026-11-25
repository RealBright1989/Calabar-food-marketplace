import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { MenuExtraOption, MenuItem, MenuSizeOption } from '../../types/marketplace';
import { formatNaira } from '../../utils/format';
import { PriceDisplay, PrimaryButton, QuantitySelector, ResilientImage } from '../ui/Primitives';

interface MealDetailModalProps {
  meal: MenuItem | null;
  restaurantName: string;
  restaurantIsOpen: boolean;
  onClose: () => void;
  onAddToCart: (payload: {
    meal: MenuItem;
    quantity: number;
    selectedSize?: MenuSizeOption;
    selectedExtras: MenuExtraOption[];
    selectedToppings: MenuExtraOption[];
    selectedSpice?: string;
    note?: string;
  }) => void;
}

export const MealDetailModal: React.FC<MealDetailModalProps> = ({
  meal,
  restaurantName,
  restaurantIsOpen,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedSizeId, setSelectedSizeId] = useState<string>('');
  const [selectedSpice, setSelectedSpice] = useState<string>('');
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([]);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (meal) {
      setQuantity(1);
      setSelectedSizeId(meal.sizes?.[0]?.id || '');
      setSelectedSpice(meal.spiceLevels?.[0] || '');
      setSelectedToppingIds([]);
      setSelectedExtraIds([]);
      setNote('');
    }
  }, [meal]);

  if (!meal) return null;

  const selectedSize = meal.sizes?.find((s) => s.id === selectedSizeId);
  const selectedToppings =
    meal.toppings?.filter((t) => selectedToppingIds.includes(t.id)) || [];
  const selectedExtras =
    meal.extras?.filter((e) => selectedExtraIds.includes(e.id)) || [];

  const unitPrice =
    meal.price +
    (selectedSize?.priceDelta || 0) +
    selectedToppings.reduce((sum, top) => sum + top.price, 0) +
    selectedExtras.reduce((sum, ext) => sum + ext.price, 0);

  const lineTotal = unitPrice * quantity;
  const canOrder = meal.available && restaurantIsOpen;

  const toggleTopping = (id: string) => {
    setSelectedToppingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleExtra = (id: string) => {
    setSelectedExtraIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canOrder) return;
    onAddToCart({
      meal,
      quantity,
      selectedSize,
      selectedToppings,
      selectedExtras,
      selectedSpice: selectedSpice || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meal-modal-title"
    >
      <div className="w-full max-w-xl bg-white rounded-[12px] border border-[#E7E5E4] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top Cover Image */}
        <div className="relative aspect-[16/9] bg-[#F5F5F4] shrink-0">
          <ResilientImage
            src={meal.image}
            alt={meal.name}
            fallbackTitle={meal.name}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close meal details"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 text-[#1C1917] flex items-center justify-center shadow hover:bg-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <p className="text-[#78716C]">
                {restaurantName}
                <span aria-hidden="true"> · </span>
                {meal.category}
              </p>
              <span
                className={`font-semibold ${
                  !meal.available
                    ? 'text-[#DC2626]'
                    : !restaurantIsOpen
                      ? 'text-[#78716C]'
                      : 'text-[#15803D]'
                }`}
              >
                {!meal.available
                  ? 'Sold out'
                  : !restaurantIsOpen
                    ? 'Kitchen closed'
                    : 'Available'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 mt-1">
              <h2 id="meal-modal-title" className="text-[22px] font-bold text-[#1C1917]">
                {meal.name}
              </h2>
              <PriceDisplay amount={meal.price} className="text-[18px] font-bold text-[#1C1917]" />
            </div>
            <p className="text-[15px] text-[#78716C] mt-2 leading-relaxed">{meal.description}</p>
          </div>

          {/* Size / Portion Options */}
          {meal.sizes && meal.sizes.length > 0 && (
            <div className="pt-4 border-t border-[#E7E5E4]">
              <h3 className="text-[14px] font-semibold text-[#1C1917] mb-2.5">
                Choose portion / size
              </h3>
              <div className="space-y-2">
                {meal.sizes.map((size) => (
                  <label
                    key={size.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-[8px] border cursor-pointer transition-colors ${
                      selectedSizeId === size.id
                        ? 'border-[#EA580C] bg-[#FFF7ED]'
                        : 'border-[#E7E5E4] hover:border-[#1C1917]/30'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 text-[14px] font-medium text-[#1C1917]">
                      <input
                        type="radio"
                        name="meal-size"
                        checked={selectedSizeId === size.id}
                        onChange={() => setSelectedSizeId(size.id)}
                        className="accent-[#EA580C] cursor-pointer"
                      />
                      {size.label}
                    </span>
                    <span className="text-[13px] font-medium text-[#78716C] tabular-nums">
                      {size.priceDelta === 0 ? 'Included' : `+${formatNaira(size.priceDelta)}`}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Spice Level */}
          {meal.spiceLevels && meal.spiceLevels.length > 0 && (
            <div className="pt-4 border-t border-[#E7E5E4]">
              <h3 className="text-[14px] font-semibold text-[#1C1917] mb-2.5">
                Spice &amp; pepper level
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {meal.spiceLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSelectedSpice(level)}
                    className={`h-10 px-2.5 rounded-[8px] border text-[13px] font-medium transition-colors cursor-pointer truncate ${
                      selectedSpice === level
                        ? 'border-[#EA580C] bg-[#FFF7ED] text-[#EA580C] font-semibold'
                        : 'border-[#E7E5E4] text-[#1C1917] hover:border-[#1C1917]/30'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toppings */}
          {meal.toppings && meal.toppings.length > 0 && (
            <div className="pt-4 border-t border-[#E7E5E4]">
              <h3 className="text-[14px] font-semibold text-[#1C1917] mb-2.5">
                Toppings
              </h3>
              <div className="space-y-2">
                {meal.toppings.map((topping) => {
                  const checked = selectedToppingIds.includes(topping.id);
                  return (
                    <label
                      key={topping.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-[8px] border cursor-pointer transition-colors ${
                        checked
                          ? 'border-[#EA580C] bg-[#FFF7ED]'
                          : 'border-[#E7E5E4] hover:border-[#1C1917]/30'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 text-[14px] font-medium text-[#1C1917]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTopping(topping.id)}
                          className="w-4 h-4 accent-[#EA580C] rounded cursor-pointer"
                        />
                        {topping.label}
                      </span>
                      <span className="text-[13px] font-medium text-[#78716C] tabular-nums">
                        +{formatNaira(topping.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extras */}
          {meal.extras && meal.extras.length > 0 && (
            <div className="pt-4 border-t border-[#E7E5E4]">
              <h3 className="text-[14px] font-semibold text-[#1C1917] mb-2.5">
                Optional extras
              </h3>
              <div className="space-y-2">
                {meal.extras.map((extra) => {
                  const checked = selectedExtraIds.includes(extra.id);
                  return (
                    <label
                      key={extra.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-[8px] border cursor-pointer transition-colors ${
                        checked
                          ? 'border-[#EA580C] bg-[#FFF7ED]'
                          : 'border-[#E7E5E4] hover:border-[#1C1917]/30'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 text-[14px] font-medium text-[#1C1917]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleExtra(extra.id)}
                          className="w-4 h-4 accent-[#EA580C] rounded cursor-pointer"
                        />
                        {extra.label}
                      </span>
                      <span className="text-[13px] font-medium text-[#78716C] tabular-nums">
                        +{formatNaira(extra.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kitchen Note */}
          <div className="pt-4 border-t border-[#E7E5E4]">
            <label htmlFor="meal-note" className="block text-[14px] font-semibold text-[#1C1917] mb-1.5">
              Special instructions (optional)
            </label>
            <textarea
              id="meal-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g. Pack plantain separately, call on arrival..."
              className="w-full p-3 rounded-[8px] border border-[#E7E5E4] focus:border-[#EA580C] focus:outline-none text-[14px] text-[#1C1917] placeholder:text-[#78716C]"
            />
          </div>

          {/* Sticky Footer Actions inside modal */}
          <div className="pt-4 border-t border-[#E7E5E4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <span className="text-[13px] font-medium text-[#78716C] sm:hidden">Quantity</span>
              <QuantitySelector
                quantity={quantity}
                onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
                onIncrease={() => setQuantity((q) => Math.min(20, q + 1))}
              />
            </div>

            <PrimaryButton type="submit" disabled={!canOrder} className="w-full sm:flex-1">
              {!restaurantIsOpen
                ? 'Restaurant currently closed'
                : !meal.available
                  ? 'Sold out'
                  : `Add to cart · ${formatNaira(lineTotal)}`}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};
