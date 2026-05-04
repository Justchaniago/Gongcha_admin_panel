# Map Plan Audit & Penyesuaian RBAC Admin Panel

## Summary
Kita akan merapikan RBAC Admin Panel sesuai `RBAC_POLICY.md` secara bertahap dan aman: mulai dari audit permukaan akses, membangun helper authorization terpusat, normalisasi session/profile RBAC, lalu migrasi endpoint/action/UI gating per domain. Target akhirnya: tidak ada lagi authorization berbasis role tersebar, semua mutation backend-only memakai permission + scope, dan `assignedStoreId` tetap didukung sementara untuk backward compatibility.

## Key Changes
- Tambahkan RBAC core di backend:
  - tipe `Role`, `AccessProfile`, `Permission`, `Scope`
  - permission catalog dan default profile matrix dari `RBAC_POLICY.md`
  - `authorize(session, { permission, resource })`
  - `hasPermission`, `isWithinScope`, dan legacy mapper `assignedStoreId -> scope.storeIds`
- Update session layer:
  - `getAdminSession` mengembalikan `role`, `accessProfile`, `permissions`, `scope`, `assignedStoreId`
  - legacy user tetap jalan:
    - `SUPER_ADMIN` lama -> `ROOT`, `GLOBAL`, all permissions
    - `STAFF` lama -> `STORE_MANAGER`, `STORE`, `[assignedStoreId]`
  - `/api/auth/session` ikut expose RBAC fields untuk UI gating
- Audit dan refactor backend authorization:
  - ganti `allowedRoles`/manual role check dengan permission check
  - enforce scope untuk resource ber-`storeId`
  - mutation penting tetap tulis activity log
- Update UI gating:
  - sidebar, buttons, modals, tabs pakai `permissions` dari session
  - UI gating tetap hanya UX; backend tetap final authority
- Pertahankan backward compatibility:
  - jangan hapus `assignedStoreId`
  - jangan memutus role lama
  - jangan langsung migrasi semua direct read kecuali yang business-critical/RBAC-sensitive

## Implementation Phases
1. **RBAC Audit Inventory**
   - Buat daftar semua API route, server action, UI role check, dan direct Firebase read yang menyentuh access control.
   - Klasifikasikan setiap item dengan permission target, scope target, dan risk level.
   - Output audit berupa dokumen/checklist `RBAC_AUDIT.md`.

2. **RBAC Core Foundation**
   - Tambahkan helper backend authorization terpusat.
   - Update `AdminUser` type agar mendukung `accessProfile`, `permissions`, dan `scope`.
   - Update `getAdminSession` dan `/api/auth/session` dengan legacy fallback.
   - Tidak mengubah behavior bisnis dulu selain memperkaya session.

3. **Backend Enforcement Pass**
   - Prioritas 1: transactions, transaction verify, transaction delete, points override, vouchers.
   - Prioritas 2: users/staff/admin-users, settings, rewards, notifications, assets.
   - Prioritas 3: stores, menus, dashboard, audit logs.
   - Untuk setiap endpoint/action: tentukan permission, load resource bila butuh `storeId`, call `authorize`, lalu lanjut existing logic.

4. **UI Gating Pass**
   - Update AuthContext/session type agar UI bisa baca `permissions` dan `scope`.
   - Ganti checks seperti `role === "SUPER_ADMIN"` atau `role !== "STAFF"` menjadi `can("permission")`.
   - Sidebar/menu visibility mengikuti permission, bukan role hardcoded.
   - Keep role label display only for presentation.

5. **Migration & Compatibility**
   - Tambahkan script audit/migration untuk `admin_users`:
     - dry-run menampilkan user yang belum punya `accessProfile`, `permissions`, `scope`
     - apply mengisi field baru berdasarkan legacy role/assignedStoreId
   - Jangan hapus field lama.
   - Setelah stabil, baru rencanakan cleanup role checks dan direct sensitive reads.

## Domain Permission Mapping
- Transactions:
  - read: `transaction.read`
  - verify/reject: `transaction.verify`, `transaction.reject`
  - delete: `transaction.delete`
  - refund/override: `transaction.refund`, `transaction.override`
  - staff/store manager wajib scope `STORE` sesuai `transaction.storeId`
- Points:
  - read: `points.read`
  - manual adjustment hanya `points.adjust.override`
  - semua adjustment harus audited dan dianggap emergency/compat path
- Members:
  - read/update/disable: `member.read`, `member.update`, `member.disable`
  - member data sensitif harus backend-read, bukan direct UI Firestore
- Rewards/Vouchers:
  - rewards CRUD: `reward.*`
  - voucher issue/cancel/read: `voucher.*`
  - voucher issue harus backend usecase + audit
- Staff/Admin Users:
  - read/create/update/disable/RBAC: `staff.*`
  - RBAC management hanya `staff.manage_rbac`
- Settings/Audit/Notifications/Assets:
  - settings: `settings.read`, `settings.update`
  - audit: `audit.read`, `audit.manage`
  - notifications: `notification.send`
  - assets: `asset.manage`

## Test Plan
- Run `npm run build` after each implementation phase.
- Add unit-level checks for RBAC helper behavior:
  - `SUPER_ADMIN/ROOT` allowed globally
  - missing permission denied
  - `STORE` scope denied when resource store is missing
  - `STORE` scope denied for another store
  - legacy `assignedStoreId` maps correctly
- Manual API scenarios:
  - legacy `SUPER_ADMIN` can access current admin flows
  - legacy `STAFF` can read/verify assigned-store transactions only
  - staff cannot delete transactions, update settings, manage rewards, or manage staff
  - inactive admin is denied
- UI scenarios:
  - buttons/sidebar items hide based on permission
  - direct URL/API call still blocked by backend without permission

## Assumptions
- Scope is Admin Panel first; Member App and Cashier App RBAC are not implemented in this pass.
- `assignedStoreId` remains supported until all admin users and screens support `scope.storeIds`.
- Direct reads for low-risk stores/menu/reward display can remain temporarily, but member, transaction, staff, dashboard, settings, and audit reads should move toward backend-controlled access.
- Current branch `rbac-backend-architecture` is the checkpoint branch for this work; `main` remains untouched.
