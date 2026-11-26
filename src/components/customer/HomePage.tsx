import React from 'react';
import { ArrowRight, Crown, MapPin, ShieldCheck, Store } from 'lucide-react';
import {
  CALABAR_NEIGHBOURHOODS,
  FOOD_CATEGORIES,
  IMAGES,
} from '../../data/calabarData';
import { FoodCategory, MenuItem, Restaurant } from '../../types/marketplace';
import { CategoryCard, FoodCard, RestaurantCard, SearchBar } from '../ui/MarketplaceCards';
import { PrimaryButton, ResilientImage } from '../ui/Primitives';

interface HomePageProps {
  selectedNeighbourhood: string;
  onSelectNeighbourhood: (neighbourhood: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  onSelectCategory: (cat: FoodCategory) => void;
  restaurants: Restaurant[];
  menuItems: MenuItem[];
  onSelectRestaurant: (restaurantId: string) => void;
  onSelectMeal: (meal: MenuItem) => void;
  onExploreRestaurants: () => void;
  onOpenVendorApply: () => void;
  onOpenVendorPortal: () => void;
  onOpenAdminPortal: () => void;
  onOpenSuperAdminPortal: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  selectedNeighbourhood,
  onSelectNeighbourhood,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onSelectCategory,
  restaurants,
  menuItems,
  onSelectRestaurant,
  onSelectMeal,
  onExploreRestaurants,
  onOpenVendorApply,
  onOpenVendorPortal,
  onOpenAdminPortal,
  onOpenSuperAdminPortal,
}) => {
  const activeRestaurants = restaurants.filter((r) => r.status === 'Active');
  const featuredRestaurants = [...activeRestaurants]
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 3);

  const restaurantMap = new Map(activeRestaurants.map((r) => [r.id, r]));
  const popularMeals = menuItems
    .filter((m) => m.popular && restaurantMap.has(m.restaurantId))
    .slice(0, 6);

  return (
    <div>
      {/* 1. Hero Section — Warm Cream #FFF7ED */}
      <section className="bg-[#FFF7ED] border-b border-[#E7E5E4]">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Left Copy & Search */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 mb-4 self-start">
                <MapPin className="w-4 h-4 text-[#EA580C]" aria-hidden="true" />
                <label htmlFor="hero-location-select" className="sr-only">
                  Delivery area in Calabar
                </label>
                <select
                  id="hero-location-select"
                  value={selectedNeighbourhood}
                  onChange={(e) => onSelectNeighbourhood(e.target.value)}
                  className="bg-white border border-[#E7E5E4] rounded-[8px] h-9 px-3 text-[13px] font-medium text-[#1C1917] focus:border-[#EA580C] focus:outline-none cursor-pointer"
                >
                  {CALABAR_NEIGHBOURHOODS.map((area) => (
                    <option key={area} value={area}>
                      Delivering in {area === 'All Calabar' ? 'Calabar' : `${area}, Calabar`}
                    </option>
                  ))}
                </select>
              </div>

              <h1 className="text-[32px] lg:text-[48px] font-bold text-[#1C1917] leading-[1.12] tracking-tight text-balance">
                Good food, delivered to your door.
              </h1>
              <p className="text-[16px] text-[#78716C] mt-4 max-w-lg leading-relaxed">
                Discover great meals from trusted restaurants and local kitchens around Calabar.
              </p>

              <div className="mt-7 space-y-3 max-w-xl">
                <SearchBar
                  value={searchQuery}
                  onChange={onSearchChange}
                  onSubmit={onSearchSubmit}
                  placeholder="Search for rice, chicken, restaurants..."
                  buttonLabel="Search"
                />
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <PrimaryButton size="lg" onClick={onExploreRestaurants}>
                    <span>Explore restaurants</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={onOpenVendorApply}
                    className="h-12 px-4 rounded-[8px] text-[14px] font-semibold text-[#1C1917] hover:text-[#EA580C] transition-colors cursor-pointer"
                  >
                    List your restaurant
                  </button>
                </div>
              </div>
            </div>

            {/* Right Food Photography */}
            <div className="lg:col-span-6 flex">
              <div className="w-full rounded-[12px] overflow-hidden border border-[#E7E5E4] bg-white min-h-[260px] lg:min-h-[380px]">
                <ResilientImage
                  src={IMAGES.heroFeast}
                  alt="Authentic Calabar feast featuring smoky party Jollof rice, Edikang Ikong soup, fried plantains, and chilled zobo"
                  fallbackTitle="Calabar Signature Feast"
                  priority
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Separate portal sign-ins */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 pt-6">
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5 md:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#EA580C]">
              Partner &amp; operations access
            </p>
            <h2 className="text-[16px] font-semibold text-[#1C1917] mt-1">
              Separate portal sign-ins
            </h2>
            <p className="text-[13px] text-[#78716C] mt-1 leading-relaxed max-w-2xl">
              Vendor, admin, and super admin portals use different verified Google accounts. Each
              sign-in only opens its own dashboard, so sensitive marketplace tools never appear in a
              vendor account.
            </p>
            {import.meta.env.DEV && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#78716C]">
                <span>Local previews:</span>
                <a
                  href="?preview=vendor#vendor-dashboard"
                  className="font-semibold text-[#EA580C] underline underline-offset-2 hover:text-[#C2410C]"
                >
                  Vendor
                </a>
                <a
                  href="?preview=admin#admin-dashboard"
                  className="font-semibold text-[#EA580C] underline underline-offset-2 hover:text-[#C2410C]"
                >
                  Admin
                </a>
                <a
                  href="?preview=super-admin#super-admin-dashboard"
                  className="font-semibold text-[#EA580C] underline underline-offset-2 hover:text-[#C2410C]"
                >
                  Super admin
                </a>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <PrimaryButton variant="outline" onClick={onOpenVendorPortal}>
              <Store className="w-4 h-4" aria-hidden="true" />
              Vendor sign in
            </PrimaryButton>
            <PrimaryButton variant="outline" onClick={onOpenAdminPortal}>
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Admin sign in
            </PrimaryButton>
            <PrimaryButton variant="outline" onClick={onOpenSuperAdminPortal}>
              <Crown className="w-4 h-4" aria-hidden="true" />
              Super admin sign in
            </PrimaryButton>
          </div>
        </div>
      </section>

      {/* 2. Food Categories */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-12">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-[24px] font-semibold text-[#1C1917]">Browse by category</h2>
            <p className="text-[15px] text-[#78716C] mt-1">
              From traditional Efik soups to smoky evening suya.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {FOOD_CATEGORIES.map((category) => (
            <CategoryCard
              key={category.id}
              label={category.label}
              subtitle={category.subtitle}
              image={category.image}
              onClick={() => onSelectCategory(category.id)}
            />
          ))}
        </div>
      </section>

      {/* 3. Featured Restaurants */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-6">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-[24px] font-semibold text-[#1C1917]">Featured restaurants</h2>
            <p className="text-[15px] text-[#78716C] mt-1">
              Popular Calabar kitchens ready for doorstep delivery.
            </p>
          </div>
          <button
            type="button"
            onClick={onExploreRestaurants}
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#EA580C] hover:text-[#C2410C] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>View all</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {featuredRestaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onSelect={onSelectRestaurant}
            />
          ))}
        </div>
      </section>

      {/* 4. Popular Meals */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-12">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-[24px] font-semibold text-[#1C1917]">Popular meals in Calabar</h2>
            <p className="text-[15px] text-[#78716C] mt-1">
              Most ordered dishes this week. Select any meal to customise portions and extras.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {popularMeals.map((meal) => {
            const vendor = restaurantMap.get(meal.restaurantId);
            return (
              <FoodCard
                key={meal.id}
                meal={meal}
                restaurantName={vendor?.name || 'Calabar Kitchen'}
                restaurantIsOpen={vendor?.isOpen ?? true}
                onSelectMeal={onSelectMeal}
              />
            );
          })}
        </div>
      </section>

      {/* 5. Promotional Banner */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 pt-4">
        <div className="bg-[#FFF7ED] border border-[#E7E5E4] rounded-[12px] p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7">
            <h2 className="text-[24px] md:text-[32px] font-bold text-[#1C1917] leading-tight text-balance">
              Discover something delicious today.
            </h2>
            <p className="text-[15px] text-[#78716C] mt-3 max-w-xl leading-relaxed">
              Whether you are craving hot Edikang Ikong at work or evening suya with friends,
              browse verified Calabar kitchens with transparent Naira pricing and live order updates.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <PrimaryButton onClick={onExploreRestaurants}>Browse all menus</PrimaryButton>
              <PrimaryButton variant="outline" onClick={onOpenVendorApply}>
                Become a vendor
              </PrimaryButton>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="aspect-[16/9] rounded-[10px] overflow-hidden border border-[#E7E5E4] bg-white">
              <ResilientImage
                src={IMAGES.restaurantInterior}
                alt="Inside a warm Calabar restaurant kitchen preparing fresh meals"
                fallbackTitle="Calabar Partner Kitchens"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
