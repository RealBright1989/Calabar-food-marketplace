import React, { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  CALABAR_NEIGHBOURHOODS,
  RESTAURANT_CATEGORIES,
} from '../../data/calabarData';
import {
  FoodCategory,
  MenuItem,
  PriceTier,
  Restaurant,
  RestaurantCategory,
} from '../../types/marketplace';
import { RestaurantCard, SearchBar } from '../ui/MarketplaceCards';
import { EmptyState } from '../ui/Primitives';

interface RestaurantListingPageProps {
  restaurants: Restaurant[];
  menuItems: MenuItem[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: FoodCategory | 'All';
  onCategoryChange: (cat: FoodCategory | 'All') => void;
  selectedRestaurantCategory: RestaurantCategory | 'All';
  onRestaurantCategoryChange: (cat: RestaurantCategory | 'All') => void;
  selectedNeighbourhood: string;
  onNeighbourhoodChange: (area: string) => void;
  onSelectRestaurant: (restaurantId: string) => void;
}

type SortOption =
  | 'popularity'
  | 'rating'
  | 'fastest'
  | 'price-asc'
  | 'price-desc';
type DeliveryFilter = 'all' | 'under25' | 'under35' | 'under45';
type RatingFilter = 'all' | '4.0' | '4.5' | '4.8';
type AvailabilityFilter = 'all' | 'open' | 'closed';

export const RestaurantListingPage: React.FC<RestaurantListingPageProps> = ({
  restaurants,
  menuItems,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedRestaurantCategory,
  onRestaurantCategoryChange,
  selectedNeighbourhood,
  onNeighbourhoodChange,
  onSelectRestaurant,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [priceFilter, setPriceFilter] = useState<PriceTier | 'All'>('All');
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>('all');

  const activeRestaurants = useMemo(
    () => restaurants.filter((r) => r.status === 'Active'),
    [restaurants],
  );

  // Map restaurantId -> searchable menu dish names
  const menuTextByRestaurant = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of menuItems) {
      const existing = map.get(item.restaurantId) || '';
      map.set(
        item.restaurantId,
        `${existing} ${item.name} ${item.category} ${item.description}`.toLowerCase(),
      );
    }
    return map;
  }, [menuItems]);

  // Count restaurants per discovery category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: activeRestaurants.length };
    for (const cat of RESTAURANT_CATEGORIES) {
      counts[cat] = activeRestaurants.filter((r) =>
        r.restaurantCategories.includes(cat),
      ).length;
    }
    return counts;
  }, [activeRestaurants]);

  const filteredRestaurants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return activeRestaurants
      .filter((r) => {
        if (!query) return true;
        const menuText = menuTextByRestaurant.get(r.id) || '';
        return (
          r.name.toLowerCase().includes(query) ||
          r.cuisine.toLowerCase().includes(query) ||
          r.neighbourhood.toLowerCase().includes(query) ||
          r.address.toLowerCase().includes(query) ||
          r.categories.some((c) => c.toLowerCase().includes(query)) ||
          r.restaurantCategories.some((c) => c.toLowerCase().includes(query)) ||
          menuText.includes(query)
        );
      })
      .filter((r) => {
        if (selectedRestaurantCategory === 'All') return true;
        return r.restaurantCategories.includes(selectedRestaurantCategory);
      })
      .filter((r) => {
        if (selectedCategory === 'All') return true;
        return r.categories.includes(selectedCategory);
      })
      .filter((r) => {
        if (selectedNeighbourhood === 'All Calabar') return true;
        return r.neighbourhood === selectedNeighbourhood;
      })
      .filter((r) => {
        if (ratingFilter === 'all') return true;
        const minRating = Number(ratingFilter);
        return r.rating !== null && r.rating >= minRating;
      })
      .filter((r) => {
        if (deliveryFilter === 'under25') return r.deliveryTimeMax <= 25;
        if (deliveryFilter === 'under35') return r.deliveryTimeMax <= 35;
        if (deliveryFilter === 'under45') return r.deliveryTimeMax <= 45;
        return true;
      })
      .filter((r) => {
        if (priceFilter === 'All') return true;
        return r.priceTier === priceFilter;
      })
      .filter((r) => {
        if (availabilityFilter === 'open') return r.isOpen;
        if (availabilityFilter === 'closed') return !r.isOpen;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'fastest') return a.deliveryTimeMin - b.deliveryTimeMin;
        if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
        if (sortBy === 'price-asc') return a.averageMealPrice - b.averageMealPrice;
        if (sortBy === 'price-desc') return b.averageMealPrice - a.averageMealPrice;
        return b.popularityScore - a.popularityScore;
      });
  }, [
    activeRestaurants,
    menuTextByRestaurant,
    searchQuery,
    selectedRestaurantCategory,
    selectedCategory,
    selectedNeighbourhood,
    ratingFilter,
    deliveryFilter,
    priceFilter,
    availabilityFilter,
    sortBy,
  ]);

  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedCategory !== 'All' ||
    selectedRestaurantCategory !== 'All' ||
    selectedNeighbourhood !== 'All Calabar' ||
    ratingFilter !== 'all' ||
    deliveryFilter !== 'all' ||
    priceFilter !== 'All' ||
    availabilityFilter !== 'all' ||
    sortBy !== 'popularity';

  const handleResetFilters = () => {
    onSearchChange('');
    onCategoryChange('All');
    onRestaurantCategoryChange('All');
    onNeighbourhoodChange('All Calabar');
    setRatingFilter('all');
    setDeliveryFilter('all');
    setPriceFilter('All');
    setAvailabilityFilter('all');
    setSortBy('popularity');
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-8 md:py-10">
      {/* Page Heading */}
      <div className="mb-7">
        <h1 className="text-[28px] md:text-[32px] font-bold text-[#1C1917] leading-tight">
          Find your next favourite restaurant.
        </h1>
        <p className="text-[15px] text-[#78716C] mt-1.5">
          Discover Calabar kitchens by cuisine, ratings, delivery speed, price range, and area.
        </p>
      </div>

      {/* Restaurant Categories Filter Bar */}
      <div className="mb-6">
        <div
          className="flex items-center gap-2 overflow-x-auto pb-2"
          role="tablist"
          aria-label="Restaurant categories"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedRestaurantCategory === 'All'}
            onClick={() => onRestaurantCategoryChange('All')}
            className={`h-10 px-4 rounded-[8px] text-[14px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2 ${
              selectedRestaurantCategory === 'All'
                ? 'bg-[#EA580C] text-white'
                : 'bg-white border border-[#E7E5E4] text-[#1C1917] hover:border-[#1C1917]/40'
            }`}
          >
            <span>All restaurants</span>
            <span
              className={`text-[12px] tabular-nums ${
                selectedRestaurantCategory === 'All' ? 'text-white/85' : 'text-[#78716C]'
              }`}
            >
              {categoryCounts.All}
            </span>
          </button>

          {RESTAURANT_CATEGORIES.map((cat) => {
            const active = selectedRestaurantCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onRestaurantCategoryChange(cat)}
                className={`h-10 px-4 rounded-[8px] text-[14px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2 ${
                  active
                    ? 'bg-[#EA580C] text-white'
                    : 'bg-white border border-[#E7E5E4] text-[#1C1917] hover:border-[#1C1917]/40'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[12px] tabular-nums ${
                    active ? 'text-white/85' : 'text-[#78716C]'
                  }`}
                >
                  {categoryCounts[cat] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search, Filters & Sorting Toolbar */}
      <div className="bg-[#FFF7ED]/70 border border-[#E7E5E4] rounded-[12px] p-4 md:p-5 mb-8 space-y-4">
        {/* Top Row: Search + Location + Sort */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <SearchBar
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search by restaurant name, food (e.g. pizza, suya), or location..."
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="listing-neighbourhood" className="sr-only">
              Filter by Calabar location
            </label>
            <select
              id="listing-neighbourhood"
              value={selectedNeighbourhood}
              onChange={(e) => onNeighbourhoodChange(e.target.value)}
              className="w-full h-12 px-3.5 rounded-[8px] bg-white border border-[#E7E5E4] text-[14px] text-[#1C1917] focus:border-[#EA580C] focus:outline-none cursor-pointer"
            >
              {CALABAR_NEIGHBOURHOODS.map((area) => (
                <option key={area} value={area}>
                  {area === 'All Calabar' ? 'Location: All Calabar' : area}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="listing-sort" className="sr-only">
              Sort restaurants
            </label>
            <select
              id="listing-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full h-12 px-3.5 rounded-[8px] bg-white border border-[#E7E5E4] text-[14px] font-medium text-[#1C1917] focus:border-[#EA580C] focus:outline-none cursor-pointer"
            >
              <option value="popularity">Sort: Popularity</option>
              <option value="rating">Sort: Highest rating</option>
              <option value="fastest">Sort: Fastest delivery</option>
              <option value="price-asc">Sort: Price (Low to high)</option>
              <option value="price-desc">Sort: Price (High to low)</option>
            </select>
          </div>
        </div>

        {/* Bottom Row: Ratings, Delivery time, Price range, Availability */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div>
            <label htmlFor="filter-rating" className="block text-[12px] font-medium text-[#78716C] mb-1">
              Rating
            </label>
            <select
              id="filter-rating"
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value as RatingFilter)}
              className="w-full h-10 px-3 rounded-[8px] bg-white border border-[#E7E5E4] text-[13px] text-[#1C1917] focus:border-[#EA580C] focus:outline-none cursor-pointer"
            >
              <option value="all">Any rating</option>
              <option value="4.0">4.0 stars &amp; up</option>
              <option value="4.5">4.5 stars &amp; up</option>
              <option value="4.8">4.8 stars &amp; up</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-delivery" className="block text-[12px] font-medium text-[#78716C] mb-1">
              Delivery time
            </label>
            <select
              id="filter-delivery"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as DeliveryFilter)}
              className="w-full h-10 px-3 rounded-[8px] bg-white border border-[#E7E5E4] text-[13px] text-[#1C1917] focus:border-[#EA580C] focus:outline-none cursor-pointer"
            >
              <option value="all">Any delivery time</option>
              <option value="under25">25 mins or less</option>
              <option value="under35">35 mins or less</option>
              <option value="under45">45 mins or less</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-price" className="block text-[12px] font-medium text-[#78716C] mb-1">
              Price range
            </label>
            <select
              id="filter-price"
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as PriceTier | 'All')}
              className="w-full h-10 px-3 rounded-[8px] bg-white border border-[#E7E5E4] text-[13px] text-[#1C1917] focus:border-[#EA580C] focus:outline-none cursor-pointer"
            >
              <option value="All">All price ranges</option>
              <option value="₦">Budget (₦ · Under ₦4,000)</option>
              <option value="₦₦">Mid-range (₦₦ · ₦4,000–₦6,500)</option>
              <option value="₦₦₦">Premium (₦₦₦ · ₦6,500+)</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-availability" className="block text-[12px] font-medium text-[#78716C] mb-1">
              Availability
            </label>
            <select
              id="filter-availability"
              value={availabilityFilter}
              onChange={(e) =>
                setAvailabilityFilter(e.target.value as AvailabilityFilter)
              }
              className="w-full h-10 px-3 rounded-[8px] bg-white border border-[#E7E5E4] text-[13px] text-[#1C1917] focus:border-[#EA580C] focus:outline-none cursor-pointer"
            >
              <option value="all">All kitchens</option>
              <option value="open">Open now only</option>
              <option value="closed">Currently closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-[#78716C]">
          <span className="tabular-nums">
            Showing{' '}
            <span className="font-semibold text-[#1C1917]">{filteredRestaurants.length}</span>{' '}
            {filteredRestaurants.length === 1 ? 'restaurant' : 'restaurants'}
          </span>
          {selectedCategory !== 'All' && (
            <span>
              · Dish category:{' '}
              <strong className="text-[#1C1917]">{selectedCategory}</strong>{' '}
              <button
                type="button"
                onClick={() => onCategoryChange('All')}
                className="text-[#EA580C] hover:underline ml-1 cursor-pointer"
              >
                (clear)
              </button>
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[13px] font-semibold text-[#EA580C] hover:text-[#C2410C] cursor-pointer"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* Responsive Restaurant Grid: Desktop 3, Tablet 2, Mobile 1 */}
      {filteredRestaurants.length === 0 ? (
        <EmptyState
          icon={<SlidersHorizontal className="w-6 h-6" />}
          title="No matching restaurants found"
          description="Try adjusting your rating, price range, delivery time, or search term to see more Calabar kitchens."
          actionLabel="Reset filters"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRestaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onSelect={onSelectRestaurant}
            />
          ))}
        </div>
      )}
    </div>
  );
};
