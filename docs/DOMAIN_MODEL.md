# Domain Model

## Core entities

- Tenant
- Workspace
- User, UserRoleBinding
- Job, JobRequirement
- Candidate, CVFile, CVParsedProfile
- CandidateApplication, CandidateStageHistory

## Interview/report entities

- ScreeningTemplate
- InterviewTemplate
- InterviewSession
- Transcript, TranscriptSegment
- AiReport, AiScore, AiEvidenceLink, AiRun

## New architecture-foundation entities

- `AiTaskRun`: lifecycle of AI assistance tasks by stage and status
- `AiPromptTemplate`: versioned prompt contracts per task stage
- `ScoringRubric`: versioned rubric contracts
- `ApplicationRecommendation`: structured recommendation artifact
- `HumanApproval`: explicit approval record for critical actions
- `DomainEvent`: outbox event persistence for orchestration/integration

## Governance and platform entities

- ConsentRecord
- AuditLog
- FeatureFlag, FeatureFlagOverride
- IntegrationSyncState, WebhookEvent
- WorkflowJob, WorkflowRetry, DeadLetterJob

## Key relationship notes

- `CandidateApplication` is the central aggregate for pipeline progression.
- `AiTaskRun` can attach to candidate/job/application/session/report context.
- `ApplicationRecommendation` attaches to `CandidateApplication` and optionally to `AiTaskRun`.
- `HumanApproval` can reference AI task runs and/or recommendations.
- `DomainEvent` stores aggregate events for reliable async processing.
