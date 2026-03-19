# Recruiter Flow Current Status

## Working behavior

- Job list/create flow works end-to-end.
- Candidate list/create/detail flow works end-to-end.
- Application create/list/detail flow works end-to-end.
- Stage transition works and writes stage history + audit.
- Decision submit works with mandatory human approval match.
- Audit log list/filter works.

## Architecture scaffolding now present

- AI task run request/list/get APIs (`/v1/ai/task-runs`).
- AI provider registry abstraction (noop provider only).
- Domain events persisted for application and AI task actions.
- Human approval records persisted in dedicated table.
- Extended feature flags for AI stage gates.

## Deferred behavior

- AI-generated interview runtime
- Transcript generation/summarization pipeline execution
- Report/recommendation generation execution
- Integration-driven scheduling/notifications
