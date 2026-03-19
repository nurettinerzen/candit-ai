# Future Interview Engine Design

## Objective

Enable structured AI-assisted first interviews (voice/video) while preserving recruiter trust, auditability, and human control.

## Control Plane vs Runtime

- Control plane (already scaffolded):
  - `AiTaskRun` lifecycle
  - feature flags
  - policy checks and human approvals
  - domain events and audits

- Runtime (deferred):
  - real-time media session management
  - low-latency conversational inference
  - streaming transcript capture
  - interruption/timeout/fallback handling

## Planned runtime components

- `InterviewSessionScheduler`
- `InterviewRuntimeOrchestrator`
- `TranscriptIngestionPipeline`
- `ReportSynthesisPipeline`
- `RecommendationPolicyGate`

## Required guardrails

- Explicit consent check before media start
- Turkish-only prompts in V1/V1.5
- Follow-up depth limits per template
- Prohibited inference blocklist enforcement
- Manual fallback path for runtime failures

## Decision boundary

- AI outputs recommendation and evidence context.
- Recruiter remains final decision-maker.
- Any stage-impacting action requires human approval and audit trail.
