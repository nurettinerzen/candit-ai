# Module Boundaries

## Runtime modules (current)

- `auth`: identity/session token operations
- `candidates`: candidate intake/read/import
- `jobs`: requisition lifecycle
- `applications`: pipeline state transitions and decisions
- `audit`: read and write audit trail boundaries
- `feature-flags`: rollout/safety toggles
- `analytics`: aggregate reporting endpoints
- `async-jobs`: job dispatch and status reads
- `ai-orchestration`: AI task run intake + queue handoff
- `policy`: human approval rules and records
- `domain-events`: outbox persistence

## Boundary contracts

- `applications` may not bypass `policy` for critical decisions.
- `ai-orchestration` must check stage-level feature flags before enqueue.
- `ai-orchestration` and `applications` must emit domain events and audit entries.
- `async-jobs` is transport/execution contract, not business policy owner.

## Planned boundary extractions

- `interviews`: session scheduling/runtime orchestration
- `reports`: report generation/read models
- `recommendations`: recommendation lifecycle and approval policy
- `notifications`: outbound message delivery
- `integrations`: provider adapters and sync/webhook processors
