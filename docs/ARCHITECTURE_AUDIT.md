# Architecture Audit (2026-03-10)

Scope audited:
- Backend: `apps/api/src/modules/*`, `apps/api/prisma/schema.prisma`, `apps/worker/src/index.ts`
- Frontend: `apps/web/app/(recruiter)/*`, `apps/web/lib/*`
- Shared packages: `packages/domain`, `packages/contracts`

## 1) What is already implemented correctly

- Multi-tenant request context exists and is enforced in app layer (`AuthGuard` + `TenantGuard`).
- RBAC exists with permission decorator and guard.
- Core recruiting entities are present: jobs, candidates, applications, stage history.
- Human decision requirement is present in current product flow and surfaced in UI.
- Audit logs are persisted and queryable.
- Async jobs and worker retry/DLQ scaffolding exist.
- Prisma schema already includes major future entities (interviews, transcripts, reports, evidence).

## 2) What is missing

- Central policy enforcement service for critical decisions was missing (approval logic existed only in one controller path).
- Domain event outbox was missing, so workflow orchestration had no canonical event stream.
- AI operating model boundaries were not represented in executable service contracts.
- Feature flag matrix for AI stages was incomplete (only 2 flags existed).
- AI task tracking lifecycle entity was missing (`queued/running/failed` visibility by task stage).
- Frontend API layer had no boundary split (single file client for all domains).

## 3) What is wrongly coupled

- Decision safety check was coupled to controller input shape, not to shared policy service.
- Stage transition, decision, audit, and orchestration concerns were mixed in one application service without event contracts.
- Worker job taxonomy was too narrow (`cv_parse`, `report_generation`, `webhook_retry`) for the intended AI pipeline.
- Feature flags and AI behavior were loosely connected (flag keys did not map to stage responsibilities).

## 4) What should be refactored before scaling

- Move human approval to a central service and persist approval records.
- Introduce a domain event outbox table and service.
- Introduce AI task run lifecycle entity and orchestration service.
- Split frontend API transport from domain clients.
- Expand async job contract to explicit AI task types.

## 5) Placeholder areas that must be explicitly marked

- Worker execution remains deterministic simulation for AI tasks (no provider inference execution yet).
- Interview media runtime (voice/video, LiveKit orchestration) is deferred.
- Transcript generation and report synthesis pipelines are deferred.
- Notification and external integration execution are deferred.

## 6) Unsafe areas to build on without redesign

- Building autonomous recommendation/action pipelines directly on application stage endpoints without centralized approval policy.
- Expanding AI features without event outbox and task lifecycle observability.
- Treating current analytics as decision quality analytics (current analytics are mostly aggregate operational metrics).
- Assuming current frontend local header auth can be used as-is in production.
