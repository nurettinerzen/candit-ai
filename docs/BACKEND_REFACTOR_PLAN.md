# Backend Refactor Plan

## Current Module Map

- `auth`: login/refresh token flow
- `candidates`: intake/list/detail/import
- `jobs`: CRUD for requisitions
- `applications`: create/list/detail/stage/decision
- `audit`: list audit logs
- `feature-flags`: list/update flags
- `analytics`: funnel/time-to-hire/interview-quality
- `async-jobs`: queue contract + status
- `health`: liveness endpoint

## Target Module Map (V1 architecture foundation)

- `policy`: centralized human approval policy and records
- `domain-events`: outbox event persistence
- `ai-orchestration`: AI task intake, provider selection, feature-flag gates, queue handoff
- `applications`: pipeline transitions and decision handling (using policy+audit+events)
- `reports/recommendations` (next incremental extraction): report and recommendation query/write services
- `interviews` (next incremental extraction): session/template orchestration boundaries

## Anti-patterns to remove

- Controller-local safety rules for critical decisions.
- Direct ad-hoc audit writes distributed across modules.
- Implicit workflow transitions without domain event emission.
- AI feature toggles detached from concrete task types.

## Service extraction opportunities

- `DecisionPolicyService` for stage/decision matrix validation.
- `ApplicationProfileComposer` for merged candidate+job+cv structure.
- `RecommendationService` for storing/retrieving structured recommendation records.
- `InterviewOrchestrationService` for scheduler/runtime separation.

## Domain events introduced

- `application.created`
- `application.stage_transitioned`
- `application.decision_recorded`
- `ai.task_run.requested`

Transport note:
- Events are persisted in `DomainEvent` outbox first; publication workers are deferred.

## Async job boundaries introduced

- `cv_parse`
- `job_requirement_interpretation`
- `candidate_fit_assistance`
- `screening_support`
- `interview_preparation`
- `interview_orchestration`
- `transcript_summarization`
- `report_generation`
- `recommendation_generation`
- `webhook_retry`

## AI provider abstraction points

- `AiProviderClient` interface
- `AiProviderRegistryService` provider resolution boundary
- `NoopAiProviderService` explicit placeholder for unimplemented inference runtime

## Interview/report orchestration boundaries

- Orchestration entrypoint: `AiOrchestrationService.createTaskRun`
- Persistence unit: `AiTaskRun`
- Downstream job execution: `WorkflowJob` + worker
- Report/recommendation persistence schema exists (`AiReport`, `ApplicationRecommendation`)

## Central human approval enforcement

- `HumanApprovalService.assertRequesterMatchesApprover` enforces requester==approver for critical actions.
- `HumanApprovalService.record` persists mandatory approval evidence.
- Decision endpoint now flows through central policy service instead of controller-only checks.
