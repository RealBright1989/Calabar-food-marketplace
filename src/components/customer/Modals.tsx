import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CALABAR_NEIGHBOURHOODS } from '../../data/calabarData';
import { UserRole } from '../../types/marketplace';
import { InputField, PrimaryButton } from '../ui/Primitives';

/* Auth Modal (Firebase Google Sign-In & Role Status) */
interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  isSignedIn: boolean;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  authLoading?: boolean;
  /** When set, only this role is allowed through this sign-in flow. */
  requiredRole?: UserRole;
  authError?: string;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  isSignedIn,
  userEmail,
  userName,
  userRole,
  authLoading = false,
  requiredRole,
  authError = '',
  onGoogleSignIn,
  onSignOut,
}) => {
  const [error, setError] = useState('');

  if (!open) return null;

  const portalCopy =
    requiredRole === 'vendor'
      ? {
          title: 'Vendor portal sign-in',
          description:
            'Use the Google account linked to your approved Calabar kitchen. Vendor accounts can only manage their own restaurant.',
          button: 'Sign in with Vendor Account',
        }
      : requiredRole === 'admin'
        ? {
            title: 'Administrator portal sign-in',
            description:
              'Use a verified administrator Google account. Admin access includes marketplace-wide controls that are not available in the vendor portal.',
            button: 'Sign in with Admin Account',
          }
        : {
            title: isSignedIn ? 'Your account & role' : 'Sign in to Calabar Food Marketplace',
            description:
              'Sign in with Google to place orders, track deliveries, and apply as a Calabar vendor.',
            button: 'Continue with Google',
          };

  const displayedError = authError || error;
  const roleMismatch = Boolean(
    isSignedIn && requiredRole && userRole && userRole !== requiredRole,
  );

  const handleGoogleClick = async () => {
    setError('');
    try {
      await onGoogleSignIn();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not complete Google Sign-In. Please allow popups and try again.',
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md bg-white rounded-[12px] border border-[#E7E5E4] shadow-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 id="auth-modal-title" className="text-[20px] font-bold text-[#1C1917]">
            {portalCopy.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {roleMismatch && (
          <div className="mb-4 p-3 rounded-[8px] bg-red-50 border border-red-200 text-[13px] text-[#991B1B] leading-relaxed">
            This account is registered as <strong className="capitalize">{userRole}</strong>. Sign
            out and use your <strong className="capitalize">{requiredRole}</strong> Google account
            to open this portal.
          </div>
        )}

        {displayedError && (
          <p className="mb-4 text-[13px] text-[#DC2626] leading-relaxed">{displayedError}</p>
        )}

        {isSignedIn ? (
          <div className="space-y-4">
            <div className="p-4 rounded-[10px] bg-[#FFF7ED] border border-[#E7E5E4] space-y-1">
              <p className="text-[15px] font-semibold text-[#1C1917]">{userName}</p>
              <p className="text-[13px] text-[#78716C]">{userEmail}</p>
              <p className="text-[13px] font-medium text-[#EA580C] pt-1 capitalize">
                Active role: {userRole || 'customer'}
              </p>
            </div>
            <p className="text-[13px] text-[#78716C] leading-relaxed">
              Your orders, vendor applications, and dashboard permissions are synced securely with
              Firestore based on your verified role.
            </p>
            {roleMismatch && (
              <PrimaryButton fullWidth loading={authLoading} onClick={() => void handleGoogleClick()}>
                {portalCopy.button}
              </PrimaryButton>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <PrimaryButton variant="outline" onClick={onClose}>
                Close
              </PrimaryButton>
              <PrimaryButton
                variant="danger"
                loading={authLoading}
                onClick={async () => {
                  await onSignOut();
                  if (!requiredRole) onClose();
                }}
              >
                Sign out
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[14px] text-[#78716C] leading-relaxed">{portalCopy.description}</p>

            <PrimaryButton
              fullWidth
              size="lg"
              loading={authLoading}
              onClick={handleGoogleClick}
            >
              {portalCopy.button}
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
};

/* Become a Vendor Application Modal */
interface VendorApplyModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitApplication: (payload: {
    businessName: string;
    ownerName: string;
    email: string;
    phone: string;
    neighbourhood: string;
    cuisine: string;
  }) => void;
}

export const VendorApplyModal: React.FC<VendorApplyModalProps> = ({
  open,
  onClose,
  onSubmitApplication,
}) => {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [neighbourhood, setNeighbourhood] = useState('Marian Road');
  const [cuisine, setCuisine] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !ownerName.trim() || !phone.trim() || !cuisine.trim()) {
      setError('Please fill in your restaurant name, owner name, phone, and cuisine.');
      return;
    }
    setError('');
    onSubmitApplication({
      businessName: businessName.trim(),
      ownerName: ownerName.trim(),
      email: email.trim() || 'vendor@calabarfood.ng',
      phone: phone.trim(),
      neighbourhood,
      cuisine: cuisine.trim(),
    });
    setBusinessName('');
    setOwnerName('');
    setEmail('');
    setPhone('');
    setCuisine('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-apply-title"
    >
      <div className="w-full max-w-lg bg-white rounded-[12px] border border-[#E7E5E4] shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 id="vendor-apply-title" className="text-[20px] font-bold text-[#1C1917]">
            Become a Calabar vendor
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close vendor application form"
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[14px] text-[#78716C] mb-5">
          Submit your restaurant details for review by the marketplace admin team.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label="Restaurant / Kitchen name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="E.g. Calabar Heritage Pot"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Owner / Manager name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Full name"
            />
            <InputField
              label="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0803 000 0000"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kitchen@example.ng"
            />
            <div>
              <label
                htmlFor="apply-neighbourhood"
                className="block text-[13px] font-medium text-[#1C1917] mb-1.5"
              >
                Calabar area
              </label>
              <select
                id="apply-neighbourhood"
                value={neighbourhood}
                onChange={(e) => setNeighbourhood(e.target.value)}
                className="w-full h-12 px-3.5 rounded-[8px] border border-[#E7E5E4] bg-white text-[15px] text-[#1C1917]"
              >
                {CALABAR_NEIGHBOURHOODS.filter((a) => a !== 'All Calabar').map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <InputField
            label="Primary cuisine &amp; dishes"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder="E.g. Efik Soups, Jollof Rice & Grills"
          />

          {error && <p className="text-[13px] text-[#DC2626]">{error}</p>}

          <div className="pt-2 flex items-center justify-end gap-3">
            <PrimaryButton variant="outline" onClick={onClose}>
              Cancel
            </PrimaryButton>
            <PrimaryButton type="submit">Submit application</PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};
