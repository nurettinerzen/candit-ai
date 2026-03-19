# DEMO FLOW

## Demo Story in 7 Minutes

## 1) Open Product and Frame Value
1. Open `/`.
2. Show overview KPIs and "Demo Senaryolari" cards.
3. State guardrail: AI only advises, human approval is mandatory.

## 2) Recruiter Core Workflow
1. Go to `/jobs` and show active roles.
2. Open `/jobs/new` and create a role quickly (optional).
3. Go to `/candidates` and open a candidate.
4. From candidate detail (`/candidates/[id]`), create a new application.
5. Land on `/applications/[id]` as the core operating screen.

## 3) AI Support Workflow on Application Detail
1. In `/applications/[id]`, trigger `SCREENING_SUPPORT` or `REPORT_GENERATION`.
2. Show task status updates in "AI Gorev Gecmisi".
3. Show latest AI report and recommendation cards:
   - summary
   - strengths
   - risks
   - missing information
   - uncertainty
   - evidence links

## 4) Human Approval and Decision
1. Use stage transition with required reason code.
2. Use "Insan Onayli Karar" form.
3. Check approval checkbox and submit decision.
4. Show resulting:
   - stage history update
   - human approval record
   - audit entry

## 5) AI Governance and Demo Controls
1. Open `/ai-destek`.
2. Show feature flags for AI task gates and system triggers.
3. Show provider mode (real vs deterministic fallback).
4. Show failed run example (controlled failure visibility).

## 6) Audit/Trust Narrative
1. Open `/audit-logs`.
2. Filter by `CandidateApplication` + application ID.
3. Show traceability of human and system actions.

## 7) Forward Boundary (Honest)
1. Return to `/`.
2. Show "Planlanan Sonraki Yetenek" panel.
3. Clarify: interview runtime is intentionally deferred, not faked.

## Seeded Demo Scenarios
- `app_demo_mehmet_support`: no AI run yet.
- `app_demo_zeynep_cashier`: screening support completed (+ failed report attempt example).
- `app_demo_ahmet_warehouse`: report + recommendation + approval records available.
