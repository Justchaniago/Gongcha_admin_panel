# RBAC Audit Inventory

This inventory tracks the Admin Panel migration from broad role checks to the RBAC model in `RBAC_POLICY.md`.

Risk levels:
- High: financial, points, user/admin, settings, audit, or cross-store data
- Medium: business management data
- Low: read-only display data

## Backend API Routes

| Surface | Current state | Target permission | Scope | Risk | Migration note |
| --- | --- | --- | --- | --- | --- |
| `/api/transactions` `GET` | session role check | `transaction.read` | `STORE` by `storeId` | High | Filter response by scope |
| `/api/transactions` `PATCH` verify/reject | session role check | `transaction.verify` / `transaction.reject` | `STORE` by transaction | High | Authorize after loading transaction |
| `/api/transactions` `POST` bulk verify/reject | session role check | `transaction.verify` / `transaction.reject` | `STORE` per transaction | High | Authorize each transaction |
| `/api/transactions` `DELETE` | manual `SUPER_ADMIN` check | `transaction.delete` | global | High | Replace role check |
| `/api/transactions/verify` `POST` | session role check | `transaction.verify` | `STORE` by transaction | High | Authorize after POS match lookup |
| `/api/members/[uid]/points` `PATCH` | `SUPER_ADMIN` only | `points.adjust.override` | global | High | Keep as audited override only |
| `/api/members/[uid]/vouchers` `POST` | broad role check | `voucher.issue` | global/store future | High | Voucher issue must stay backend-only |
| `/api/settings` `GET/PATCH` | `SUPER_ADMIN` only | `settings.read` / `settings.update` | global | High | Settings affect business rules |
| `/api/rewards` and `/api/rewards/[id]` | read broad, write admin | `reward.read/create/update/delete` | global | Medium | Keep read broader via permission |
| `/api/notifications` | read/write broad | `audit.read` / `notification.send` | global | Medium | POST should not allow generic staff |
| `/api/assets` | `SUPER_ADMIN` only | `asset.manage` | global | Medium | Use centralized authorization |
| `/api/stores` and `/api/stores/[id]` | read broad, write admin | `store.read/create/update` | `STORE` for scoped reads | Medium | Store display may remain direct-read temporarily |
| `/api/activity-logs` | custom whitelist helper | `audit.read` / `audit.manage` | global | High | Preserve whitelist if still required |
| `/api/auth/session` | profile read | none | own session | High | Must expose normalized RBAC fields |
| `/api/setup-user` | session based | `staff.create` future | own bootstrap | High | Keep carefully constrained |

## Server Actions

| Surface | Current state | Target permission | Scope | Risk | Migration note |
| --- | --- | --- | --- | --- | --- |
| `userStaffActions.createAccountAction` | allows `SUPER_ADMIN` and `STAFF` | `member.create` or `staff.create` | global | High | Staff creation requires `staff.create`; member creation requires member permission |
| `userStaffActions.updateAccountAction` | allows broad roles | `member.update` or `staff.update` | global/store future | High | Split by collection |
| `userStaffActions.deleteAccountAction` | allows broad roles | `member.disable` or `staff.disable` | global | High | Prefer disable over delete long-term |
| `userStaffActions.updatePointsAction` | allows broad roles | `points.adjust.override` | global | High | Audited override only |
| `storeActions` | `SUPER_ADMIN` only | `store.create/update/delete` | global | Medium | Centralize checks |
| `menuActions` | `SUPER_ADMIN` only | `menu.create/update/delete` | global | Medium | Centralize checks |
| `rewardActions` | `SUPER_ADMIN` only | `reward.create/update/delete` | global | Medium | Centralize checks |
| `memberActions` | `SUPER_ADMIN` only | `member.update`, `notification.send` | global | High | Centralize checks |

## UI Gating

| Surface | Current state | Target | Risk | Migration note |
| --- | --- | --- | --- | --- |
| Sidebar/AdminShell | `role === SUPER_ADMIN` | permission based menu visibility | Medium | UI only, backend remains final |
| Rewards pages | `role === SUPER_ADMIN` | `reward.create/update/delete` | Medium | Read may remain visible with `reward.read` |
| Stores/Menu pages | `role !== STAFF` | `store.*` / `menu.*` | Medium | Replace broad inverse checks |
| Admin users pages | `role === SUPER_ADMIN` | `staff.*` and `member.*` | High | Avoid optimistic-user redirect bugs |
| Notifications pages | `role === SUPER_ADMIN` | `notification.send` | Medium | Align with API |
| Settings pages | `role === SUPER_ADMIN` | `settings.read/update` | High | Align with API |
| Transactions pages | admin/staff split | `transaction.*` | High | Include scope-aware backend filtering |
| Dashboard pages | role/scoped UI logic | `dashboard.read` and scope | High | Backend read model preferred |

## Direct Firebase Reads With RBAC Impact

| Surface | Collections | Risk | Recommendation |
| --- | --- | --- | --- |
| Dashboard | `transactions`, `users`, `stores`, `daily_stats` | High | Move to backend read model |
| Admin users | `users`, `admin_users`, `stores` | High | Move members/staff reads to backend |
| Auth fallback | `admin_users` | High | Prefer session API; keep temporary fallback |
| Stores display | `stores` | Low/Medium | Allowed temporarily for display-only data |
| Menus display | `products` | Low | Allowed temporarily for display-only data |
| Rewards display | `rewards_catalog` | Low/Medium | Allowed temporarily for display-only data |

## Acceptance Criteria

- Backend mutations use centralized authorization.
- Scope is enforced for store-bound transaction actions.
- Session exposes normalized `accessProfile`, `permissions`, and `scope`.
- Legacy `SUPER_ADMIN` and `STAFF` users continue to work.
- UI gating can consume permissions without trusting UI as security boundary.
