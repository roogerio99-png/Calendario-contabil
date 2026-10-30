# Security Specification — Agriconnection Gestão & Time Tracking Contábil

## 1. Data Invariants
1. **Authentication & Verification**: All Firestore reads and writes require an authenticated user with `request.auth != null` and `request.auth.token.email_verified == true`.
2. **Identity Integrity (`ownerUid`)**: Every `Task` and `AuditLog` document created or updated must have `ownerUid == request.auth.uid`.
3. **Path ID Hardening**: Document IDs (`taskId`, `logId`) must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
4. **Strict Schema & Size Boundaries**:
   - `Task` documents must contain required keys `['id', 'code', 'title', 'status', 'assignee', 'ownerUid']` and only allowed schema keys, with bounded string lengths (`title <= 500`, `code <= 32`, `status` in `['PENDENTE', 'EM_ANDAMENTO', 'PAUSADA', 'AGUARDANDO_DEPENDENCIA', 'CONCLUIDA']`).
   - `AuditLog` documents are append-only (`update` and `delete` denied for non-admins) and must contain `['id', 'timestamp', 'user', 'taskCode', 'type', 'details', 'ownerUid']` with `details.size() <= 2000`.
5. **Query Enforcer**: `list` operations check `resource.data.ownerUid == request.auth.uid || isAdmin()`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating a task in `/tasks_10_2026/CTB-01` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', token: { email: 'roogerio99@gmail.com', email_verified: false } }` -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Task Create**: `auth.uid = 'u1'`, payload `ownerUid: 'u2'` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Task Create**: Payload includes extra key `isSuperAdmin: true` -> Rejected by `hasOnly()`.
5. **Shadow Field Injection on Task Update**: Update modifies unauthorized key `secretField` -> Rejected by `affectedKeys().hasOnly()`.
6. **Value Poisoning on Task Title**: Update sets `title` to a 10,000-character string -> Rejected by `isValidTask(incoming())`.
7. **Invalid Status Enum**: Payload sets `status: 'HACKED'` -> Rejected by `isValidTask(incoming())`.
8. **ID Poisoning**: Document ID contains spaces or special characters or > 128 chars -> Rejected by `isValidId()`.
9. **Immutable ID/Code Tampering on Update**: Update changes `id` or `code` of an existing task -> Rejected by immutability check.
10. **AuditLog Tampering**: Authenticated user attempts `update` on `/logs_10_2026/log-1` -> `PERMISSION_DENIED`.
11. **AuditLog Deletion**: Non-admin user attempts `delete` on `/logs_10_2026/log-1` -> `PERMISSION_DENIED`.
12. **Unfiltered List Scraping**: Non-owner, non-admin attempts blanket `list` without matching `resource.data.ownerUid == request.auth.uid` -> `PERMISSION_DENIED`.
