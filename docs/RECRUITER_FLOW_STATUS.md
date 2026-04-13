# Recruiter Flow Current Status

## Working behavior

- Job list/create/detail/update flow works end-to-end.
- Published job limit enforcement works on publish, not draft creation.
- Candidate list/create/detail and CV upload flows work end-to-end.
- CV parsing runs through the async worker pipeline and produces parsed profile output.
- Application create/list/detail flow works end-to-end.
- Fit score and screening flows run through worker execution and surface artifacts back to recruiter views.
- Interview invite flow works end-to-end, including public candidate session start, answer, completion and review pack generation.
- Audit log and internal admin account visibility are backed by persisted data.

## Architecture now proven in runtime

- Tenant-aware auth and session loading work in the pilot smoke path.
- AI task orchestration, workflow retries and worker execution are active in real flows.
- Domain events and audit writes are active for recruiter-side mutations.
- Billing guardrails are enforced in backend services for:
  - active published jobs
  - member seats
  - candidate processing
  - AI interviews
- `VOICE` interview scheduling now uses the same AI interview quota enforcement as invite flows.

## Current boundaries

- Real email delivery is not yet a proven launch capability in default environments.
- Stripe self-serve billing is not yet a proven launch capability in default environments.
- Unsupported integrations must remain clearly labeled and non-marketed.
- Admin and recruiter UX still need polish, but core runtime behavior is functioning.
