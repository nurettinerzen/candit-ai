# Implementation Decisions and Known Gaps

## Decisions and rationale

- Centralized human approval:
  - Implemented `HumanApprovalService` + `HumanApproval` table.
  - Rationale: avoid policy drift across controllers/services.

- Domain event outbox first:
  - Implemented `DomainEvent` + `DomainEventsService`.
  - Rationale: async orchestration and integrations need durable event history.

- AI orchestration as control plane:
  - Implemented `AiTaskRun` and `AiOrchestrationModule`.
  - Rationale: clear lifecycle tracking before model runtime rollout.

- Feature-flag-per-AI-stage:
  - Expanded defaults and added server enforcement for auto-reject prohibition.
  - Rationale: rollout control and hard safety constraints.

- Frontend API boundary split:
  - Introduced `lib/api/http.ts` and `lib/api/recruiter-client.ts`.
  - Rationale: prepare for growth without changing page-level behavior.

## Known gaps / intentional placeholders

- Worker still returns deterministic placeholders for AI jobs.
- No real model provider execution path yet (registry + noop only).
- No real-time interview media orchestration runtime.
- No outbox publisher process yet (events persisted only).
- No production auth/session integration in web app.
- No notification delivery service.

## Unsafe assumptions intentionally avoided

- No claim that AI interview/report features are fully shipped.
- No hidden autonomous reject path.
- No fake AI UI outputs added.
