# Target V1 Architecture (Turkey-first, Turkish-only)

Design constraints:
- Locale: Turkey-first, Turkish-only in V1 (`tr-TR` / `tr`)
- Segment: blue-collar + entry-level white-collar
- AI role: assistant/copilot, not autonomous final decision-maker
- Hard rule: no autonomous rejection in V1
- Human approval mandatory for critical decisions

## System Boundary Map

### 1. Auth and session model
- Boundary: identity verification + request user context
- Runtime: JWT (`/v1/auth/login`, `/v1/auth/refresh`) and temporary dev-header mode for local web
- V1 policy: production path must be JWT; dev header mode remains local-only

### 2. Multi-tenant tenant/workspace model
- Boundary: tenant-level isolation and workspace scoping
- Runtime: tenant propagated through request context and all queries (`tenantId`)
- Future: DB RLS enablement with `SET app.tenant_id`

### 3. RBAC and permission model
- Boundary: role -> permission mapping in domain package + guard enforcement
- Runtime: centralized at `RbacGuard`
- New permissions added for screening/interview/report/AI task/workflow boundaries

### 4. Jobs and requisitions domain
- Boundary: requisition CRUD, requirement fields, publication state
- Runtime: `JobsModule`, `Job`, `JobRequirement`
- AI touchpoint: job requirement interpretation task (assistive)

### 5. Candidates domain
- Boundary: intake, dedup, source tracking
- Runtime: `CandidatesModule`, `Candidate`, `CVFile`, `CVParsedProfile`
- AI touchpoint: CV parsing task run lifecycle

### 6. Applications / pipeline domain
- Boundary: candidate-job linkage, stage progression, stage history
- Runtime: `ApplicationsModule`, `CandidateApplication`, `CandidateStageHistory`
- Safety: decision and critical stage transitions audited + approval tracked

### 7. Screening domain
- Boundary: structured screening templates and screening-support task execution
- Runtime data: `ScreeningTemplate`, `AiTaskRun(taskType=SCREENING_SUPPORT)`
- V1 mode: recruiter-driven, async AI support only

### 8. Interview domain
- Boundary: interview templates/sessions, consent context, transcript foundation
- Runtime data: `InterviewTemplate`, `InterviewSession`, `ConsentRecord`, `Transcript*`
- V1 mode: architecture-ready, full media engine deferred

### 9. AI orchestration domain
- Boundary: AI request intake, task lifecycle, feature-flag gating, provider selection, queue dispatch
- Runtime: new `AiOrchestrationModule` and `AiTaskRun`
- Provider strategy: registry + `NoopAiProvider` in V1 scaffolding

### 10. Reports / scoring / recommendations domain
- Boundary: structured report artifacts and recommendation records
- Runtime data: `AiReport`, `AiScore`, `AiEvidenceLink`, new `ApplicationRecommendation`
- V1 mode: ingestion and listing contracts; generation remains async/deferred by flag

### 11. Audit / compliance domain
- Boundary: immutable action trail + approval trail
- Runtime: `AuditLog`, new `HumanApproval`, centralized `AuditWriterService`
- Rule: decisions and AI-orchestration requests emit audit entries

### 12. Analytics domain
- Boundary: funnel/time-to-hire/interview quality aggregates
- Runtime: `AnalyticsModule`
- Note: decision-calibration analytics deferred

### 13. Integrations domain
- Boundary: external providers (calendar, ATS, meeting)
- Runtime data scaffolding: `IntegrationSyncState`, `WebhookEvent`
- V1 mode: contracts only, provider execution deferred

### 14. Async jobs / workflow domain
- Boundary: long-running work execution, retry, dead-letter
- Runtime: `WorkflowJob`, `WorkflowRetry`, `DeadLetterJob`, BullMQ worker
- Expanded job taxonomy now supports AI stage-specific tasks

### 15. Notifications domain
- Boundary: recruiter/candidate notifications for task/session/report milestones
- V1 mode: deferred (no notification delivery service yet)
- Required future contract: event-triggered notification processor from domain outbox

### 16. Frontend app structure
- Boundary: recruiter workflow UI + typed API clients
- Runtime: Next.js recruiter routes with separated API transport (`lib/api/http.ts`) and domain client (`lib/api/recruiter-client.ts`)
- V1 auth: dev-header strategy retained, migration path documented to JWT cookie/session

## Cross-cutting Rules

- AI never writes terminal candidate decision autonomously.
- `ai.auto_reject.enabled` must remain `false`; server rejects attempts to enable it.
- Critical actions require explicit human approval record (`HumanApproval`).
- AI assistance must be traceable by task run, audit log, and domain event.
