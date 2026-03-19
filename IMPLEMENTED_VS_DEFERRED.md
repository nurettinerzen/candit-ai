# IMPLEMENTED VS DEFERRED

## 1) IMPLEMENTED AND DEMOABLE NOW
- Recruiter end-to-end flow: jobs, candidates, applications, stage transition, decision submit.
- Application detail as primary operating screen with:
  - candidate/job summary
  - stage actions
  - AI task triggers
  - latest AI report/recommendation insight cards
  - AI task run history
  - stage history
  - human approval records
  - audit entries
- AI support async workflow for:
  - `CV_PARSING`
  - `SCREENING_SUPPORT`
  - `REPORT_GENERATION`
  - `RECOMMENDATION_GENERATION`
- AI Support Center for feature flag control and AI run visibility.
- Audit and domain event persistence across core flows.

## 2) IMPLEMENTED BUT INTERNAL/FOUNDATIONAL
- BullMQ async orchestration and worker execution framework.
- Prompt template and scoring rubric persistence model.
- Guardrail policy normalization and uncertainty shaping.
- Feature-flag based system trigger gates.
- Domain event outbox persistence model.

## 3) SCAFFOLDING / ARCHITECTURE ONLY
- Interview runtime control-plane boundaries for future voice/video flow.
- Extended AI task enums beyond currently demoed tasks.
- Integration object models (calendar/webhook sync) without full productized UX.

## 4) INTENTIONALLY DEFERRED
- Real-time AI interview runtime (voice/video session engine).
- Production-grade auth/session UX in frontend (web currently uses dev header session for local demo).
- Full production observability and test matrix (unit/e2e coverage still limited).
- Advanced multi-tenant operator tooling and granular flag override UI.
