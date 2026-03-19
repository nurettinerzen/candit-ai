# CURRENT PRODUCT CAPABILITIES

## Product Scope (V1)
- Turkey-first and Turkish-only recruiter experience.
- Blue-collar and entry-level hiring workflows.
- AI is assistant-only; no autonomous rejection.
- Human approval is mandatory for critical decisions.

## Recruiter Product Flow (Working)
- Job list and job creation (`/jobs`, `/jobs/new`).
- Candidate list, create, detail, and candidate-to-application linking (`/candidates`, `/candidates/new`, `/candidates/[id]`).
- Application pipeline list, creation, filtering, and detail operations (`/applications`, `/applications/[id]`).
- Stage transition with mandatory reason code.
- Human-approved decision submit with explicit approver identity.
- Entity-scoped audit visibility (`/audit-logs`).

## AI Support Flow (Working)
- Manual trigger from application detail for:
  - `CV_PARSING`
  - `SCREENING_SUPPORT`
  - `REPORT_GENERATION`
  - `RECOMMENDATION_GENERATION`
- Async queue orchestration (`WorkflowJob` + worker execution path).
- AI task status lifecycle visible in product (`QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`).
- Provider transparency:
  - deterministic fallback mode visible
  - configured real provider path supported
- AI outputs persisted and visible:
  - `AiReport`
  - `ApplicationRecommendation`
  - `AiTaskRun.outputJson/uncertaintyJson/guardrailFlags`

## Trust and Control (Working)
- Human approval records persisted (`HumanApproval`) and shown in application detail.
- Audit trail written for recruiter and system actions (`AuditLog`).
- Domain events written for core operations (`DomainEvent`).
- `ai.auto_reject.enabled` blocked by policy guard.

## Demo/Control Surface (Working)
- AI Support Center (`/ai-destek`):
  - Feature flag visibility and toggle management
  - Provider visibility
  - Recent AI task runs with failures
- Overview homepage (`/`) with product framing and demo scenario visibility.

## Interview Capability Boundary (Explicit)
- Real-time AI voice/video interview runtime is not implemented in this V1 delivery.
- Interview domain entities and future pipeline boundary remain in place for next phase.
