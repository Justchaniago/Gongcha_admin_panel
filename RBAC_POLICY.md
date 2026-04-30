# Admin Panel RBAC Policy

This document is the source of truth for Admin Panel RBAC design and migration.

The Admin Panel RBAC model uses:
- role for access level
- accessProfile for job/function template
- permissions for allowed actions
- scope for data boundaries

UI gating is only for user experience. Backend/usecase authorization is the final authority.

## Goals

- Keep RBAC explicit, auditable, and scalable.
- Avoid broad role checks spread across UI and API routes.
- Support different admin functions without creating too many roles.
- Enforce store-level access consistently.
- Keep backward compatibility during migration.

## Admin User Model

Target `admin_users/{uid}` shape:

```ts
{
  uid: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "STAFF" | "AUDITOR";
  accessProfile:
    | "ROOT"
    | "OPERATIONS"
    | "MARKETING"
    | "FINANCE"
    | "SUPPORT"
    | "STORE_MANAGER"
    | "READ_ONLY";
  permissions: string[];
  scope: {
    type: "GLOBAL" | "STORE";
    storeIds: string[];
  };
  isActive: boolean;

  // Legacy compatibility during migration.
  assignedStoreId?: string | null;
}
```

## Roles

Roles describe access level, not every business department.

### `SUPER_ADMIN`

System owner/root administrator.

- full system access
- can manage RBAC
- can manage settings
- can manage staff/admin users
- can access all stores and global data

### `ADMIN`

Back-office administrator.

- access depends on `accessProfile`
- usually global scope
- must still pass permission checks

### `STAFF`

Store-scoped operator.

- usually scoped to one or more stores
- cannot manage system-wide settings
- cannot manage RBAC
- access depends on permissions and scope

### `AUDITOR`

Read-only audit/report user.

- cannot mutate business data
- can read audit/report data according to scope

## Access Profiles

Access profiles are reusable permission templates.

### `ROOT`

Only for `SUPER_ADMIN`.

- all permissions
- global scope

### `OPERATIONS`

For operational managers/admins.

Typical access:
- dashboard
- transactions
- stores
- menus/products
- member read access

### `MARKETING`

For marketing and campaign operations.

Typical access:
- rewards
- vouchers
- campaigns/promotions
- notifications
- visual assets

### `FINANCE`

For finance and reporting.

Typical access:
- transaction reports
- revenue dashboard
- refunds/financial review
- read financial data

### `SUPPORT`

For customer/member support.

Typical access:
- member lookup
- transaction lookup
- voucher support
- support notes
- limited issue resolution

### `STORE_MANAGER`

For store-level operators/managers.

Typical access:
- assigned store dashboard
- assigned store transactions
- assigned store transaction verification/rejection
- limited member read access

### `READ_ONLY`

For read-only admin users.

Typical access:
- dashboard read
- transaction read
- reports read
- audit read

## Scope

Scope controls which data an admin user can access.

### `GLOBAL`

Can access all resources allowed by permission.

```ts
scope: {
  type: "GLOBAL",
  storeIds: []
}
```

### `STORE`

Can access only resources belonging to listed stores.

```ts
scope: {
  type: "STORE",
  storeIds: ["store_a", "store_b"]
}
```

Long term, prefer `scope.storeIds` over `assignedStoreId`.
Keep `assignedStoreId` only for backward compatibility during migration.

## Permission Catalog

Use permission strings in backend/usecase authorization.

### Dashboard

- `dashboard.read`

### Transactions

- `transaction.read`
- `transaction.verify`
- `transaction.reject`
- `transaction.refund`
- `transaction.override`
- `transaction.delete`

### Members

- `member.read`
- `member.update`
- `member.disable`

### Points

- `points.read`
- `points.adjust.override`
- `points.recalculate`

Points must be derived from transactions. Manual point adjustment must be treated as an audited override or migration-only compatibility path.

### Rewards

- `reward.read`
- `reward.create`
- `reward.update`
- `reward.delete`

### Vouchers

- `voucher.read`
- `voucher.issue`
- `voucher.cancel`

### Stores

- `store.read`
- `store.create`
- `store.update`
- `store.delete`

### Menus / Products

- `menu.read`
- `menu.create`
- `menu.update`
- `menu.delete`

### Staff / Admin Users

- `staff.read`
- `staff.create`
- `staff.update`
- `staff.disable`
- `staff.manage_rbac`

### Settings

- `settings.read`
- `settings.update`

### Audit

- `audit.read`
- `audit.manage`

### Notifications

- `notification.send`

### Assets

- `asset.manage`

## Default Profile Matrix

| Profile | Default Scope | Main Permissions |
| --- | --- | --- |
| `ROOT` | `GLOBAL` | all permissions |
| `OPERATIONS` | `GLOBAL` | `dashboard.read`, `transaction.read`, `transaction.verify`, `transaction.reject`, `store.read`, `store.update`, `menu.read`, `menu.update`, `member.read` |
| `MARKETING` | `GLOBAL` | `reward.read`, `reward.create`, `reward.update`, `reward.delete`, `voucher.read`, `voucher.issue`, `voucher.cancel`, `notification.send`, `asset.manage` |
| `FINANCE` | `GLOBAL` | `dashboard.read`, `transaction.read`, `transaction.refund`, `audit.read` |
| `SUPPORT` | `GLOBAL` or `STORE` | `member.read`, `transaction.read`, `voucher.read`, `voucher.issue`, `audit.read` |
| `STORE_MANAGER` | `STORE` | `dashboard.read`, `transaction.read`, `transaction.verify`, `transaction.reject`, `member.read`, `store.read`, `menu.read` |
| `READ_ONLY` | `GLOBAL` or `STORE` | `dashboard.read`, `transaction.read`, `reward.read`, `voucher.read`, `store.read`, `menu.read`, `audit.read` |

## Backend Authorization Pattern

Avoid scattered checks such as:

```ts
if (user.role === "SUPER_ADMIN") {
  // ...
}
```

Prefer centralized authorization:

```ts
await authorize(session, {
  permission: "transaction.verify",
  resource: {
    storeId: transaction.storeId,
  },
});
```

Authorization rules:

- inactive users are always denied
- `SUPER_ADMIN` with `ROOT` profile can access all permissions
- non-root users must have the requested permission
- `STORE` scope requires `resource.storeId` to be included in `scope.storeIds`
- missing resource scope for scoped permissions must deny by default
- UI visibility does not replace backend authorization

## Backend-Centric Relationship

RBAC is part of the backend/usecase layer.

Every backend mutation must enforce:
- authenticated actor
- required permission
- resource scope
- activity/audit logging for important business actions

This applies especially to:
- transactions
- points
- vouchers
- rewards
- users
- staff/admin users
- settings
- audit logs

## Migration Plan

Migrate incrementally.

1. Add `accessProfile`, `permissions`, and `scope` to `admin_users`.
2. Keep existing `role` and `assignedStoreId` fields for backward compatibility.
3. Map legacy users:
   - old `SUPER_ADMIN` -> `role: "SUPER_ADMIN"`, `accessProfile: "ROOT"`, `scope.type: "GLOBAL"`, all permissions
   - old `STAFF` with `assignedStoreId` -> `role: "STAFF"`, `accessProfile: "STORE_MANAGER"`, `scope.type: "STORE"`, `scope.storeIds: [assignedStoreId]`
4. Create a centralized backend authorization helper.
5. Update `getAdminSession` to return normalized RBAC fields.
6. Refactor API routes/server actions one domain at a time.
7. Start with transaction and points domains.
8. Update UI gating to use permissions from session after backend enforcement exists.
9. Remove direct role checks gradually.
10. Remove `assignedStoreId` only after all apps support `scope.storeIds`.

## Implementation Rule

When adding or refactoring Admin Panel functionality:

- define the required permission
- define the required resource scope
- enforce permission and scope in backend/usecase code
- keep UI gating secondary
- preserve backward compatibility where possible
- do not introduce direct Firebase writes from UI
