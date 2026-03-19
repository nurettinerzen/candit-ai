# Frontend Structure Plan (Recruiter App)

## 1) Route map

Current recruiter routes:
- `/jobs`
- `/jobs/new`
- `/candidates`
- `/candidates/new`
- `/candidates/[id]`
- `/applications`
- `/applications/[id]`
- `/audit-logs`

Recommended next routes (no fake AI UI):
- `/applications/[id]/ai` (task runs and report/recommendation history)
- `/settings/feature-flags` (admin/recruiter scoped)

## 2) Layout boundaries

- Root layout: global HTML, locale, stylesheet
- Recruiter layout: `RecruiterShell` with navigation + session context
- Page-specific panels for forms/tables

## 3) API client boundaries

Implemented refactor:
- Transport: `apps/web/lib/api/http.ts`
- Domain client: `apps/web/lib/api/recruiter-client.ts`
- Compatibility export: `apps/web/lib/api-client.ts`

Rule:
- Keep transport concerns (headers, error parsing) isolated from domain methods.

## 4) Query/state management strategy

V1 approach:
- Local component state + explicit `load*` functions (already in place)

V1.5 recommendation:
- Introduce TanStack Query for caching/retry/invalidation when AI/report pages expand.

## 5) Form architecture

- Keep reusable primitives in `components/form-controls.tsx`.
- Form-level validation stays lightweight in V1.
- Move to schema-based validation (zod) when interview/report forms are added.

## 6) Loading/error/empty state system

Implemented:
- Shared `LoadingState`, `ErrorState`, `EmptyState` components.

Next:
- Add list/detail skeleton variants and consistent retry UI action slots.

## 7) Reusable recruiter components

Current reusable components:
- `RecruiterShell`
- `StageChip` / `JobStatusChip`
- UI state primitives
- Form controls

Recommended additions:
- `EvidenceCard`
- `UncertaintyBadge`
- `ApprovalBanner`
- `TaskRunStatusBadge`

## 8) Dev-auth temporary strategy and path to real auth

Current:
- Header-based dev session (`x-tenant-id`, `x-user-id`, `x-roles`)

Path:
1. Keep local dev mode for productivity.
2. Add JWT session persistence in web client.
3. Remove header auth for non-dev environments.

## 9) What stays simple in V1 vs abstracted now

Keep simple now:
- Page-level state and fetch orchestration
- Basic table-driven recruiter UI

Abstract now (already started):
- API transport/domain boundaries
- AI task run type contracts
- Feature-flag and policy-aware backend surfaces for future UI expansion
