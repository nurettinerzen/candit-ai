# Workflow Definitions

## 1) Recruiter creates job
- Current status: Implemented (`POST /v1/jobs` + web `/jobs/new`)
- Target behavior: create requisition with structured requirements and publish state
- Missing services/components: job requirement interpretation task trigger (optional)
- Feature flags: `ai.job_requirement_interpretation.enabled`

## 2) Candidate enters system
- Current status: Implemented (`POST /v1/candidates`, `/import`)
- Target behavior: intake + dedup + optional CV parse task
- Missing services/components: CV upload + parse trigger in recruiter flow
- Feature flags: `ai.cv_parsing.enabled`

## 3) Recruiter links candidate to job
- Current status: Implemented (`POST /v1/applications`, web `/applications`)
- Target behavior: create unique application and start pipeline
- Missing services/components: optional auto-trigger for fit assistance task
- Feature flags: `ai.candidate_fit_assistance.enabled`

## 4) System builds structured application profile
- Current status: Partially implemented (entities exist, no full orchestrated build service)
- Target behavior: merge candidate, job, parsed CV, screening context into normalized profile
- Missing services/components: profile composer service + background worker processor
- Feature flags: `ai.cv_parsing.enabled`, `ai.candidate_fit_assistance.enabled`

## 5) Recruiter reviews candidate
- Current status: Implemented (candidate/app detail pages)
- Target behavior: unified dossier with evidence and uncertainty panels
- Missing services/components: recommendation list API integration in UI
- Feature flags: N/A (UI composition)

## 6) AI-assisted screening support produces notes/flags
- Current status: Implemented as backend scaffolding (`AiTaskRun` + queue contracts)
- Target behavior: structured screening support output attached to application
- Missing services/components: worker processor writing outputs to recommendation/report tables
- Feature flags: `ai.screening_support.enabled`

## 7) Recruiter advances candidate
- Current status: Implemented (`stage-transition`, `decision`)
- Target behavior: stage changes with mandatory human accountability and evidence references
- Missing services/components: stricter stage policy matrix service
- Feature flags: `auto_stage_change_enabled` (must remain false in V1)

## 8) Future: AI first interview is scheduled
- Current status: Deferred (session entities exist, no scheduler workflow)
- Target behavior: session scheduling with consent + calendar integration
- Missing services/components: interview scheduling service, integration adapters
- Feature flags: `ai.interview_preparation.enabled`, `ai.interview_orchestration.enabled`

## 9) Future: AI interview runs
- Current status: Deferred (task type exists, media runtime absent)
- Target behavior: controlled AI-led interview with guardrails and transcript capture
- Missing services/components: real-time media engine, orchestrator runtime, safety monitors
- Feature flags: `ai.interview_orchestration.enabled`

## 10) Future: transcript + report + recommendation generated
- Current status: Partially implemented in data model; generation deferred by flags
- Target behavior: async chain `TRANSCRIPT_SUMMARIZATION -> REPORT_GENERATION -> RECOMMENDATION_GENERATION`
- Missing services/components: worker processors + reconciliation jobs + UI views
- Feature flags: `ai.transcript_summarization.enabled`, `ai.report_generation.enabled`, `ai.recommendation_generation.enabled`

## 11) Recruiter final next-step decision
- Current status: Implemented (`POST /v1/applications/:id/decision`)
- Target behavior: approval-backed decision with report/evidence linkage
- Missing services/components: recommendation consumption policy service
- Feature flags: `ai.auto_reject.enabled` (must remain false)

## 12) Audit log preserved end-to-end
- Current status: Implemented and expanded (decision/stage/task run events)
- Target behavior: immutable trace from intake to decision and future interview outcomes
- Missing services/components: event publication worker and archived evidence snapshots
- Feature flags: N/A
