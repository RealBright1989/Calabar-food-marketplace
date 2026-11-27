import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Crown,
  FileCheck2,
  Lock,
  LogOut,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { getAuthErrorMessage } from '../../lib/firebase';
import {
  ActivityLog,
  Announcement,
  CustomerProfile,
  Dispute,
  MarketplaceSettings,
  MenuItem,
  Order,
  Restaurant,
  TransactionRecord,
  UserRole,
  VendorApplication,
} from '../../types/marketplace';
import { formatShortDate } from '../../utils/format';
import {
  EmptyState,
  LoadingState,
  PriceDisplay,
  PrimaryButton,
  StatusBadge,
} from '../ui/Primitives';

interface SuperAdminDashboardProps {
  authReady: boolean;
  isSignedIn: boolean;
  userEmail?: string;
  userName?: string;
  userRole: UserRole;
  authLoading: boolean;
  authError?: string;
  onGoogleSignIn: () => Promise<void>;
  onOpenAuth: () => void;
  onSignOut: () => Promise<void>;
  restaurants: Restaurant[];
  menuItems: MenuItem[];
  customers: CustomerProfile[];
  orders: Order[];
  transactions: TransactionRecord[];
  applications: VendorApplication[];
  disputes: Dispute[];
  announcements: Announcement[];
  activityLogs: ActivityLog[];
  settings: MarketplaceSettings;
  onOpenAdminPortal: () => void;
}

function roleLabel(role?: UserRole): string {
  if (!role || role === 'customer') return 'Customer';
  if (role === 'super-admin') return 'Super Admin';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function StatCard({
  label,
  value,
  hint,
  Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  Icon: React.ElementType;
}) {
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-[#78716C]">{label}</p>
        <Icon className="w-4 h-4 text-[#EA580C]" aria-hidden="true" />
      </div>
      <div className="text-[24px] font-bold text-[#1C1917] mt-3 tabular-nums">{value}</div>
      <p className="text-[12px] text-[#78716C] mt-1">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-[#E7E5E4] rounded-[12px] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E7E5E4]">
        <h2 className="text-[16px] font-semibold text-[#1C1917]">{title}</h2>
        {description && <p className="text-[13px] text-[#78716C] mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  authReady,
  isSignedIn,
  userEmail,
  userName,
  userRole,
  authLoading,
  authError = '',
  onGoogleSignIn,
  onOpenAuth,
  onSignOut,
  restaurants,
  menuItems,
  customers,
  orders,
  transactions,
  applications,
  disputes,
  announcements,
  activityLogs,
  settings,
  onOpenAdminPortal,
}) => {
  const [localAuthError, setLocalAuthError] = useState('');

  const adminAccounts = useMemo(
    () => customers.filter((c) => c.role === 'admin' || c.role === 'super-admin'),
    [customers],
  );
  const vendorAccounts = useMemo(
    () => customers.filter((c) => c.role === 'vendor'),
    [customers],
  );
  const customerAccounts = useMemo(
    () => customers.filter((c) => !c.role || c.role === 'customer'),
    [customers],
  );

  const grossRevenue = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'Charge' && t.verificationStatus !== 'Refunded')
        .reduce((sum, t) => sum + t.grossAmount, 0),
    [transactions],
  );
  const commissionEarned = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'Charge' && t.verificationStatus !== 'Refunded')
        .reduce((sum, t) => sum + t.commissionAmount, 0),
    [transactions],
  );
  const pendingVerification = transactions.filter(
    (t) => t.verificationStatus === 'Pending Verification',
  ).length;
  const openDisputes = disputes.filter(
    (d) => d.status === 'Open' || d.status === 'Investigating',
  );
  const pendingApplications = applications.filter((a) => a.status === 'Pending');

  const handleSignIn = async () => {
    setLocalAuthError('');
    try {
      await onGoogleSignIn();
    } catch (err) {
      setLocalAuthError(getAuthErrorMessage(err));
    }
  };

  if (!authReady) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-12">
        <LoadingState variant="rows" count={5} />
      </div>
    );
  }

  if (!isSignedIn || userRole !== 'super-admin') {
    const wrongRole = isSignedIn;
    const shownError = localAuthError || authError;
    return (
      <div className="max-w-[680px] mx-auto px-4 md:px-6 py-16">
        <div className="bg-white border border-[#E7E5E4] rounded-[12px] p-8 space-y-5 text-center">
          <div className="w-12 h-12 rounded-[10px] bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-[24px] font-bold text-[#1C1917]">
              Super Administrator authentication required
            </h1>
            <p className="text-[15px] text-[#78716C] leading-relaxed">
              The Super Admin portal monitors the entire marketplace, including administrator
              accounts, payouts, audit logs, and platform rules. Only the verified root administrator
              account can open it.
            </p>
          </div>

          {wrongRole && (
            <div className="p-4 rounded-[10px] bg-[#FFF7ED] border border-[#E7E5E4] text-left space-y-1">
              <p className="text-[13px] text-[#78716C]">Currently signed in as</p>
              <p className="text-[15px] font-semibold text-[#1C1917]">
                {userName} ({userEmail})
              </p>
              <p className="text-[13px] font-semibold text-[#DC2626] capitalize">
                Role: {roleLabel(userRole)} — Super Admin permission denied
              </p>
            </div>
          )}

          {shownError && <p className="text-[13px] text-[#DC2626]">{shownError}</p>}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {!isSignedIn ? (
              <PrimaryButton size="lg" loading={authLoading} onClick={() => void handleSignIn()}>
                <Crown className="w-4 h-4" />
                Sign in with Super Admin Google Account
              </PrimaryButton>
            ) : (
              <>
                <PrimaryButton variant="outline" loading={authLoading} onClick={() => void onSignOut()}>
                  Sign out
                </PrimaryButton>
                <PrimaryButton loading={authLoading} onClick={() => void handleSignIn()}>
                  Switch to Super Admin Google Account
                </PrimaryButton>
              </>
            )}
            <PrimaryButton variant="outline" loading={authLoading} onClick={onOpenAuth}>
              Use email and password
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-8 space-y-6">
      <div className="bg-[#FFF7ED] border border-[#E7E5E4] rounded-[12px] p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Crown className="w-5 h-5 text-[#EA580C]" aria-hidden="true" />
            <h1 className="text-[24px] font-bold text-[#1C1917]">Platform control center</h1>
            <span className="px-2.5 py-1 rounded-[6px] bg-white border border-[#E7E5E4] text-[12px] font-semibold text-[#EA580C]">
              Super Admin
            </span>
          </div>
          <p className="text-[14px] text-[#78716C] mt-2 max-w-2xl leading-relaxed">
            Read-only oversight across administrators, vendors, customer accounts, payments,
            disputes, and platform activity. Daily operations remain in the Admin portal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <PrimaryButton variant="outline" onClick={onOpenAdminPortal}>
            Open admin portal
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </PrimaryButton>
          <PrimaryButton variant="secondary" onClick={() => void onSignOut()}>
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Sign out
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Gross platform revenue"
          value={<PriceDisplay amount={grossRevenue} />}
          hint={`${commissionEarned > 0 ? `${Math.round((commissionEarned / grossRevenue) * 100)}%` : '0%'} commission share`}
          Icon={Wallet}
        />
        <StatCard
          label="Administrator accounts"
          value={adminAccounts.length}
          hint={`${vendorAccounts.length} vendor accounts monitored`}
          Icon={ShieldCheck}
        />
        <StatCard
          label="Open disputes"
          value={openDisputes.length}
          hint={`${pendingVerification} payments awaiting verification`}
          Icon={AlertTriangle}
        />
        <StatCard
          label="Pending applications"
          value={pendingApplications.length}
          hint={`${restaurants.length} kitchens on the platform`}
          Icon={FileCheck2}
        />
      </div>

      <Panel
        title="Administrator accounts"
        description="Accounts with marketplace-wide access. Only a Super Admin can change these roles."
      >
        {adminAccounts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Users className="w-6 h-6" aria-hidden="true" />}
              title="No administrator accounts found"
              description="Administrator profiles will appear here once they are signed in."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#FAFAF9] text-[#78716C]">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {adminAccounts.map((account) => (
                  <tr key={account.id} className="border-t border-[#E7E5E4]">
                    <td className="px-5 py-3 font-medium text-[#1C1917]">{account.name}</td>
                    <td className="px-5 py-3 text-[#78716C]">{account.email || '—'}</td>
                    <td className="px-5 py-3 text-[#1C1917]">{roleLabel(account.role)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={account.accountStatus === 'Suspended' ? 'Suspended' : 'Active'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Platform snapshot" description="Counts across the live marketplace.">
          <div className="divide-y divide-[#E7E5E4]">
            {[
              { label: 'Customer accounts', value: customerAccounts.length, Icon: Users },
              { label: 'Vendor accounts', value: vendorAccounts.length, Icon: Store },
              { label: 'Active kitchens', value: restaurants.filter((r) => r.status === 'Active').length, Icon: Store },
              { label: 'Menu items', value: menuItems.length, Icon: ClipboardList },
              { label: 'Orders placed', value: orders.length, Icon: ClipboardList },
              { label: 'Active announcements', value: announcements.filter((a) => a.isActive).length, Icon: Activity },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="flex items-center gap-2 text-[13px] text-[#78716C]">
                  <Icon className="w-4 h-4 text-[#EA580C]" aria-hidden="true" />
                  {label}
                </span>
                <span className="text-[15px] font-semibold text-[#1C1917] tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Platform settings" description="Current marketplace rules and gateway mode.">
          <div className="divide-y divide-[#E7E5E4]">
            {[
              { label: 'Commission rate', value: `${settings.commissionRatePercent}%` },
              { label: 'Service charge', value: <PriceDisplay amount={settings.serviceChargeFlat} /> },
              { label: 'Default delivery fee', value: <PriceDisplay amount={settings.defaultDeliveryFee} /> },
              { label: 'Minimum platform order', value: <PriceDisplay amount={settings.minPlatformOrder} /> },
              { label: 'Paystack mode', value: settings.paystackMode },
              { label: 'Auto-accept orders', value: settings.autoAcceptOrders ? 'Enabled' : 'Disabled' },
              { label: 'Default city', value: settings.defaultCity },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="text-[13px] text-[#78716C]">{label}</span>
                <span className="text-[13px] font-semibold text-[#1C1917]">{value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Recent platform activity"
        description="Audit trail of marketplace-wide changes."
      >
        {activityLogs.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Activity className="w-6 h-6" aria-hidden="true" />}
              title="No activity recorded yet"
              description="Actions from admin and vendor portals will appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#FAFAF9] text-[#78716C]">
                <tr>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Summary</th>
                  <th className="px-5 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="border-t border-[#E7E5E4]">
                    <td className="px-5 py-3 font-medium text-[#1C1917]">{log.action}</td>
                    <td className="px-5 py-3 text-[#78716C]">{log.actorEmail || log.actorUid || '—'}</td>
                    <td className="px-5 py-3 text-[#78716C] max-w-[360px]">{log.summary}</td>
                    <td className="px-5 py-3 text-[#78716C] whitespace-nowrap">
                      {log.createdAt ? `${formatShortDate(log.createdAt)} · ${log.createdAt.slice(11, 16)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Open disputes" description="Cases needing platform attention.">
          {openDisputes.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CheckCircle2 className="w-6 h-6" aria-hidden="true" />}
                title="No open disputes"
                description="All reported cases have been resolved."
              />
            </div>
          ) : (
            <div className="divide-y divide-[#E7E5E4]">
              {openDisputes.slice(0, 5).map((dispute) => (
                <div key={dispute.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#1C1917] truncate">
                      {dispute.orderNumber} · {dispute.restaurantName}
                    </p>
                    <p className="text-[12px] text-[#78716C] truncate">{dispute.reason}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <PriceDisplay amount={dispute.amount} className="text-[13px] font-semibold" />
                    <StatusBadge status={dispute.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Pending vendor applications" description="Kitchens waiting for review.">
          {pendingApplications.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<FileCheck2 className="w-6 h-6" aria-hidden="true" />}
                title="No pending applications"
                description="New vendor applications will appear here."
              />
            </div>
          ) : (
            <div className="divide-y divide-[#E7E5E4]">
              {pendingApplications.slice(0, 5).map((application) => (
                <div key={application.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#1C1917] truncate">
                      {application.businessName}
                    </p>
                    <p className="text-[12px] text-[#78716C] truncate">
                      {application.ownerName} · {application.neighbourhood}
                    </p>
                  </div>
                  <StatusBadge status="Pending" />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Payment ledger"
        description="Latest verified, pending, and refunded platform transactions."
      >
        {transactions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Wallet className="w-6 h-6" aria-hidden="true" />}
              title="No transactions yet"
              description="Payments will appear here as orders are placed."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#FAFAF9] text-[#78716C]">
                <tr>
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-5 py-3 font-medium">Kitchen</th>
                  <th className="px-5 py-3 font-medium">Gross</th>
                  <th className="px-5 py-3 font-medium">Commission</th>
                  <th className="px-5 py-3 font-medium">Payout</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 10).map((txn) => (
                  <tr key={txn.id} className="border-t border-[#E7E5E4]">
                    <td className="px-5 py-3 font-medium text-[#1C1917]">{txn.reference}</td>
                    <td className="px-5 py-3 text-[#78716C]">{txn.restaurantName}</td>
                    <td className="px-5 py-3"><PriceDisplay amount={txn.grossAmount} /></td>
                    <td className="px-5 py-3 text-[#78716C]"><PriceDisplay amount={txn.commissionAmount} /></td>
                    <td className="px-5 py-3"><PriceDisplay amount={txn.vendorPayout} /></td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-[12px] font-semibold ${
                          txn.verificationStatus === 'Verified'
                            ? 'text-[#15803D]'
                            : txn.verificationStatus === 'Refunded'
                              ? 'text-[#DC2626]'
                              : 'text-[#D97706]'
                        }`}
                      >
                        {txn.verificationStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-[12px] text-[#78716C] text-center pb-4 flex items-center justify-center gap-1.5">
        <Settings className="w-3.5 h-3.5" aria-hidden="true" />
        Super Admin access is read-only in this portal. Use the Admin portal for operational changes.
      </p>
    </div>
  );
};
