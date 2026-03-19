# Roadmap: V1 vs V1.5 vs Later

## V1 (now)

- Recruiter core flow: jobs, candidates, applications, stage management
- Human-approved decision endpoint
- Audit logging + approval records
- AI task orchestration contracts with queue integration
- AI feature flag matrix and guardrails (`ai.auto_reject.enabled` blocked)
- Domain event outbox persistence

## V1.5

- Interview preparation assistant
- Transcript summarization pipeline
- Report generation pipeline
- Recommendation generation (ADVANCE/HOLD/REVIEW) with uncertainty and evidence metadata
- Recruiter-facing AI task/report/recommendation views

## Later

- Real-time voice/video AI first interview engine
- Calendar/meeting provider integrations
- Notification delivery module
- Event publication worker/outbox relay
- Calibration and fairness analytics for recommendation quality
- Production auth hardening (OIDC/SSO, token/session lifecycle controls)
