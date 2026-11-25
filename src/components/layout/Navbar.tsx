import React, { useState } from 'react';
import { Menu, ShoppingBag, User, X } from 'lucide-react';
import { AppView } from '../../types/marketplace';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  cartCount: number;
  onOpenCart: () => void;
  isLoggedIn: boolean;
  customerName: string;
  userRole?: string;
  onOpenAuth: () => void;
  onOpenVendorPortal: () => void;
  onOpenAdminPortal: () => void;
}

interface NavLink {
  label: string;
  view: AppView;
  onSelect?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  cartCount,
  onOpenCart,
  isLoggedIn,
  customerName,
  userRole,
  onOpenAuth,
  onOpenVendorPortal,
  onOpenAdminPortal,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks: NavLink[] = [
    { label: 'Home', view: 'home' },
    { label: 'Restaurants', view: 'restaurants' },
    { label: 'Track Order', view: 'order-tracking' },
    ...(userRole === 'vendor'
      ? [{ label: 'Vendor Portal', view: 'vendor-dashboard' as AppView, onSelect: onOpenVendorPortal }]
      : []),
    ...(userRole === 'admin'
      ? [{ label: 'Admin', view: 'admin-dashboard' as AppView, onSelect: onOpenAdminPortal }]
      : []),
  ];

  const handleNav = (link: NavLink) => {
    if (link.onSelect) link.onSelect();
    else onNavigate(link.view);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 h-[72px] bg-white/95 backdrop-blur-sm border-b border-[#E7E5E4]">
      <div className="max-w-[1200px] mx-auto h-full px-4 md:px-6 lg:px-10 flex items-center justify-between gap-3 sm:gap-6 lg:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav({ label: 'Home', view: 'home' })}
          className="text-[16px] sm:text-[18px] font-bold tracking-tight text-[#1C1917] hover:text-[#EA580C] transition-colors whitespace-nowrap shrink-0 cursor-pointer font-display truncate max-w-[205px] sm:max-w-none"
        >
          Calabar Food Marketplace
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-6 text-[14px] font-medium"
        >
          {navLinks.map((item) => {
            const isActive =
              currentView === item.view ||
              (item.view === 'restaurants' && currentView === 'restaurant-detail');
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => handleNav(item)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-[#EA580C] border-[#EA580C] font-semibold'
                    : 'text-[#78716C] border-transparent hover:text-[#1C1917]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Action cluster (Account / Login + Cart) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              isLoggedIn ? handleNav({ label: 'Account', view: 'account' }) : onOpenAuth()
            }
            className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3 rounded-[8px] text-[14px] font-medium text-[#1C1917] hover:bg-[#F5F5F4] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <User className="w-4 h-4 text-[#78716C]" aria-hidden="true" />
            <span>
              {isLoggedIn
                ? `${customerName.split(' ')[0]}${
                    userRole && userRole !== 'customer' ? ` (${userRole})` : ''
                  }`
                : 'Log in'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Open shopping cart with ${cartCount} items`}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[8px] bg-[#EA580C] hover:bg-[#C2410C] text-white text-[14px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span>Cart</span>
            <span className="tabular-nums bg-white/20 px-1.5 py-0.5 rounded text-[12px] leading-none">
              {cartCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="lg:hidden w-10 h-10 rounded-[8px] border border-[#E7E5E4] flex items-center justify-center text-[#1C1917] hover:bg-[#F5F5F4] cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-b border-[#E7E5E4] px-4 py-4 shadow-lg">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navLinks.map((item) => {
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => handleNav(item)}
                  className={`text-left px-3 py-2.5 rounded-[8px] text-[15px] font-medium cursor-pointer ${
                    isActive
                      ? 'bg-[#FFF7ED] text-[#EA580C] font-semibold'
                      : 'text-[#1C1917] hover:bg-[#F5F5F4]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                if (isLoggedIn) {
                  handleNav({ label: 'Account', view: 'account' });
                } else {
                  onOpenAuth();
                }
              }}
              className="text-left px-3 py-2.5 rounded-[8px] text-[15px] font-medium text-[#1C1917] hover:bg-[#F5F5F4] cursor-pointer sm:hidden"
            >
              {isLoggedIn ? `Account (${customerName})` : 'Log in / Sign up'}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
};
