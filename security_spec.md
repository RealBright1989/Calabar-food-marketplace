# Security Specification — Calabar Food Marketplace

## 1. Data Invariants
1. **Identity & Privilege Separation**: Users cannot self-assign `role: "admin"` or `role: "vendor"` during profile creation or profile updates. Role promotion occurs only via an authenticated administrator (`isAdmin()`).
2. **Admin Email Spoofing Guard**: Bootstrapped administrator access requires BOTH `request.auth.token.email == 'brightokon444@gmail.com'` AND `request.auth.token.email_verified == true`, or membership in `/admins/{uid}` with `email_verified == true`.
3. **PII Isolation**: User emails, phone numbers, and saved delivery addresses reside in `/users/{userId}/private/{docId}` and are readable only by the owning user (`request.auth.uid == userId`) or an administrator (`isAdmin()`).
4. **Vendor Data Isolation**: Vendors can read/update only their own restaurant (`existing().ownerUid == request.auth.uid`), their own menu items, and orders/transactions/disputes explicitly tagged with `restaurantOwnerUid == request.auth.uid`. Vendors cannot list or read another vendor's private orders or payouts.
5. **Transaction Integrity**: Financial amounts (`grossAmount`, `subtotalAmount`, `commissionAmount`, `vendorPayout`, `serviceCharge`) and `reference` in `/transactions/{id}` are immutable once created. Administrators can only update `verificationStatus`, `verifiedByUid`, and `verifiedAt`, or append a new `'Refund'` ledger entry.
6. **Terminal Order Locking**: Once an order reaches `'Delivered'` or `'Cancelled'`, vendors cannot mutate its status or payment status. Only administrators retain dispute/refund override capability.
7. **Immutable Audit Trail**: `/activityLogs/{logId}` entries are append-only (`create` by `isAdmin()` with server timestamp `request.time`). Updates and deletes are unconditionally denied.
8. **Temporal & Volumetric Integrity**: All `createdAt`/`updatedAt` timestamps must match `request.time`, all document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and every string and array field enforces strict size bounds.

## 2. The "Dirty Dozen" Attack Payloads (All Expected: `PERMISSION_DENIED`)
1. **Privilege Escalation on Signup**: Customer creates `/users/{uid}` with `role: "admin"`.
2. **Unverified Admin Email Spoof**: User with `email: "brightokon444@gmail.com"` and `email_verified: false` reads `/activityLogs`.
3. **Shadow Ghost Field Injection**: Customer updates `/users/{uid}` adding `{ accountStatus: "Active", isVerified: true }`.
4. **Cross-Customer PII Scrape**: Signed-in customer A attempts `get` on `/users/cust-2/private/info`.
5. **Cross-Vendor Order Snooping**: Vendor A attempts `list` or `get` on `/orders` belonging to Vendor B (`restaurantOwnerUid != vendorA.uid`).
6. **Vendor Self-Activation After Suspension**: Suspended Vendor A attempts `update` on `/restaurants/rest-a` changing `status: "Active"`.
7. **Order Total Tampering**: Customer or Vendor attempts `update` on `/orders/ord-101` lowering `total` from `10150` to `100`.
8. **Transaction Ledger Amount Manipulation**: Admin or Vendor attempts `update` on `/transactions/txn-101` altering `commissionAmount` or `vendorPayout`.
9. **Audit Log Deletion/Tampering**: Admin attempts `delete` or `update` on `/activityLogs/log-1`.
10. **Terminal Order State Reversal**: Vendor attempts `update` on a `'Delivered'` order back to `'Preparing your food'`.
11. **Path ID Poisoning**: Attacker creates `/orders/invalid$id..2000bytes` exceeding 128 chars or containing illegal characters.
12. **Client Timestamp Forgery**: Authenticated user creates `/orders/ord-999` with a backdated `createdAt` not equal to `request.time`.
