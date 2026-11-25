import React from 'react';
import { AppView } from '../../types/marketplace';

interface FooterProps {
  onNavigate: (view: AppView) => void;
  onOpenVendorApply: () => void;
  onShowInfoToast: (msg: string) => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onOpenVendorApply,
  onShowInfoToast,
}) => {
  return (
    <footer className="bg-[#1C1917] text-white mt-16">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-white/10">
          <div>
            <p className="text-[18px] font-bold font-display text-white">
              Calabar Food Marketplace
            </p>
            <p className="text-[14px] text-[#A8A29E] mt-2.5 leading-relaxed">
              Good food, delivered right to your door across Marian, State Housing, Parliamentary,
              and Calabar South.
            </p>
          </div>

          <div>
            <h4 className="text-[14px] font-semibold text-white mb-3">Discover</h4>
            <ul className="space-y-2 text-[14px] text-[#A8A29E]">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('restaurants')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Explore restaurants
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('order-tracking')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Track an order
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('account')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Customer account
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[14px] font-semibold text-white mb-3">Partner with us</h4>
            <ul className="space-y-2 text-[14px] text-[#A8A29E]">
              <li>
                <button
                  type="button"
                  onClick={onOpenVendorApply}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Become a vendor
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('vendor-dashboard')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Vendor dashboard
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('admin-dashboard')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Marketplace admin
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[14px] font-semibold text-white mb-3">Company &amp; Support</h4>
            <ul className="space-y-2 text-[14px] text-[#A8A29E]">
              <li>
                <button
                  type="button"
                  onClick={() =>
                    onShowInfoToast('Calabar Food Marketplace connects local Calabar kitchens with hungry customers.')
                  }
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  About us
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    onShowInfoToast('Support desk: hello@calabarfood.ng · +234 800 225 2227')
                  }
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Contact support
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    onShowInfoToast('Terms of Service & Privacy Policy apply to all Calabar marketplace orders.')
                  }
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Terms and privacy
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#A8A29E]">
          <p>© {new Date().getFullYear()} Calabar Food Marketplace. Calabar, Cross River State.</p>
          <div className="flex items-center gap-5">
            <a
              href="#instagram"
              onClick={(e) => {
                e.preventDefault();
                onShowInfoToast('Instagram: @calabarfoodmarket');
              }}
              className="hover:text-white transition-colors"
            >
              Instagram
            </a>
            <a
              href="#x"
              onClick={(e) => {
                e.preventDefault();
                onShowInfoToast('X (Twitter): @calabarfoodng');
              }}
              className="hover:text-white transition-colors"
            >
              X
            </a>
            <a
              href="#whatsapp"
              onClick={(e) => {
                e.preventDefault();
                onShowInfoToast('WhatsApp Concierge: +234 809 555 0100');
              }}
              className="hover:text-white transition-colors"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
