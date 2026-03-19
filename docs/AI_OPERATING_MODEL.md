# AI Operating Model (V1, V1.5, Later)

Hard policy baseline:
- AI is an assistant in V1.
- No autonomous rejection in V1.
- Human approval required for critical decisions.
- Turkish-only prompts/outputs in V1 (`tr`).

## Stage Definitions

### 1. CV parsing and structured extraction
- Release: V1
- Automation mode: Assisted (async)
- Inputs: CV file metadata, OCR/text payload, tenant locale
- Outputs: normalized candidate profile fields, parse confidence, missing-field list
- DB entities: `CVFile`, `CVParsedProfile`, `AiTaskRun`
- APIs: `POST /v1/ai/task-runs` (`taskType=CV_PARSING`)
- Sync/Async: Async (`WorkflowJob`)
- Audit trail: `AuditLog(action=ai.task_run.requested)`, `DomainEvent(ai.task_run.requested)`
- Human approval: not required for parsing task execution
- Future model category: document extraction + LLM normalization
- Rule-based vs LLM: file validation/routing rule-based; extraction+normalization LLM-assisted

### 2. Job requirement interpretation
- Release: V1
- Automation mode: Assisted
- Inputs: `Job.jdText`, requirement list, role family
- Outputs: structured requirement hints, ambiguity flags
- DB entities: `Job`, `JobRequirement`, `AiTaskRun`
- APIs: `POST /v1/ai/task-runs` (`JOB_REQUIREMENT_INTERPRETATION`)
- Sync/Async: Async
- Audit trail: task request audit + event
- Human approval: not required
- Future model category: reasoning LLM with schema-constrained output
- Rule-based vs LLM: validation/rules rule-based; interpretation LLM-based

### 3. Candidate-job fit assistance
- Release: V1
- Automation mode: Manual-with-AI-support
- Inputs: candidate profile + parsed CV + job requirements
- Outputs: fit summary, evidence pointers, open questions
- DB entities: `Candidate`, `CandidateApplication`, `AiTaskRun`
- APIs: `POST /v1/ai/task-runs` (`CANDIDATE_FIT_ASSISTANCE`)
- Sync/Async: Async
- Audit trail: task audit + event
- Human approval: required only when used for decision action
- Future model category: ranking/reasoning hybrid
- Rule-based vs LLM: hard constraint checks rule-based; explanatory fit LLM-based

### 4. Structured screening support
- Release: V1
- Automation mode: Manual-with-AI-support
- Inputs: screening template, candidate/application context, recruiter notes
- Outputs: suggested screening notes, risk flags, missing evidence list
- DB entities: `ScreeningTemplate`, `AiTaskRun`, `ApplicationRecommendation` (later)
- APIs: `POST /v1/ai/task-runs` (`SCREENING_SUPPORT`)
- Sync/Async: Async
- Audit trail: task audit + event
- Human approval: required before any stage-impacting action
- Future model category: instruction-following LLM with rubric awareness
- Rule-based vs LLM: rubric gating rule-based; narrative synthesis LLM-based

### 5. Interview preparation support
- Release: V1.5
- Automation mode: Manual-with-AI-support
- Inputs: job, candidate, prior screening artifacts, interview template
- Outputs: interviewer brief, focused questions, probe suggestions
- DB entities: `InterviewTemplate`, `AiPromptTemplate`, `ScoringRubric`, `AiTaskRun`
- APIs: `POST /v1/ai/task-runs` (`INTERVIEW_PREPARATION`)
- Sync/Async: Async
- Audit trail: task audit + event
- Human approval: recruiter approval to publish final brief
- Future model category: planning/retrieval-augmented LLM
- Rule-based vs LLM: policy filters rule-based; question generation LLM-based

### 6. Structured first interview orchestration
- Release: Later (architecture in place)
- Automation mode: Manual-with-AI-support (explicitly approved)
- Inputs: scheduled interview session, consent, template, guardrails
- Outputs: orchestrated turn plan, follow-up prompts, captured metadata
- DB entities: `InterviewSession`, `ConsentRecord`, `AiTaskRun`
- APIs: `POST /v1/ai/task-runs` (`INTERVIEW_ORCHESTRATION`)
- Sync/Async: Async control-plane (real-time media engine later)
- Audit trail: task audit + human approval + event
- Human approval: mandatory (`HumanApproval`) before orchestration start
- Future model category: low-latency conversational model
- Rule-based vs LLM: timing/compliance/limits rule-based; dialogue adaptation LLM-based

### 7. Transcript summarization
- Release: V1.5/Later
- Automation mode: Manual-with-AI-support
- Inputs: transcript segments, session metadata
- Outputs: concise Turkish summary, key signals, unresolved questions
- DB entities: `Transcript`, `TranscriptSegment`, `AiTaskRun`
- APIs: `POST /v1/ai/task-runs` (`TRANSCRIPT_SUMMARIZATION`)
- Sync/Async: Async
- Audit trail: task audit + event
- Human approval: recruiter approval before summary is treated as report input
- Future model category: long-context summarization model
- Rule-based vs LLM: redaction rules rule-based; summarization LLM-based

### 8. Recruiter-facing report generation
- Release: V1.5
- Automation mode: Manual-with-AI-support
- Inputs: transcript summary, screening artifacts, rubric
- Outputs: structured report JSON + score dimensions
- DB entities: `AiReport`, `AiScore`, `AiEvidenceLink`, `AiTaskRun`
- APIs: `POST /v1/ai/task-runs` (`REPORT_GENERATION`)
- Sync/Async: Async
- Audit trail: task audit + event + report metadata
- Human approval: required before report is used for stage decision
- Future model category: rubric-grounded reasoning model
- Rule-based vs LLM: score bounds and schema checks rule-based; analysis LLM-based

### 9. Recommendation generation
- Release: V1.5
- Automation mode: Manual-with-AI-support
- Inputs: report, evidence links, policy rules
- Outputs: `ADVANCE/HOLD/REVIEW` recommendation with confidence + uncertainty
- DB entities: `ApplicationRecommendation`, `AiTaskRun`, `HumanApproval`
- APIs: `POST /v1/ai/task-runs` (`RECOMMENDATION_GENERATION`)
- Sync/Async: Async
- Audit trail: task audit + recommendation event
- Human approval: mandatory for applying recommendation to pipeline decision
- Future model category: calibrated classifier + reasoning model
- Rule-based vs LLM: final policy gate rule-based; rationale generation LLM-based

### 10. Evidence-linked reasoning
- Release: V1 baseline policy, richer in V1.5
- Automation mode: Assisted
- Inputs: transcript segments/CV fields/notes references
- Outputs: claim-to-evidence map
- DB entities: `AiEvidenceLink`, `AiReport`, `ApplicationRecommendation`
- APIs: report/recommendation generation task endpoints
- Sync/Async: Async
- Audit trail: report metadata + domain event
- Human approval: required when evidence-backed recommendation is applied
- Future model category: retrieval + grounding model
- Rule-based vs LLM: evidence cardinality checks rule-based; mapping quality LLM-based

### 11. Uncertainty handling
- Release: V1 baseline
- Automation mode: Assisted
- Inputs: confidence, missing fields, conflicting evidence
- Outputs: uncertainty JSON, required follow-up list
- DB entities: `AiTaskRun.uncertaintyJson`, `ApplicationRecommendation.uncertaintyJson`
- APIs: all AI task run APIs
- Sync/Async: Async
- Audit trail: included in task run payload and logs
- Human approval: required if uncertainty affects decision path
- Future model category: calibrated confidence estimators
- Rule-based vs LLM: thresholds/gates rule-based; explanations LLM-based

### 12. Guardrails and prohibited inferences
- Release: V1 baseline
- Automation mode: Rule-enforced
- Inputs: raw AI outputs + policy constraints
- Outputs: blocked actions, redacted fields, compliance flags
- DB entities: `FeatureFlag`, `AiTaskRun.guardrailFlags`, `HumanApproval`, `AuditLog`
- APIs: feature flag APIs + AI task run APIs
- Sync/Async: Both (request-time checks + async processing)
- Audit trail: explicit guardrail/audit entries
- Human approval: still mandatory for critical decisions
- Future model category: policy engine + constrained decoding
- Rule-based vs LLM: prohibitions always rule-based; helper text generation LLM-based

## Prohibited Inferences in V1

- No autonomous rejection or auto-stage-change to rejected.
- No demographic/sensitive-attribute inference for decision support.
- No hidden scoring dimensions not visible to recruiters.
- No recommendation without uncertainty and evidence context.
