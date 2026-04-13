# Implementation Decisions and Current Gaps

## Decisions and rationale

- AI orchestration is the control plane.
  - `AiTaskRun`, workflow jobs, retries, audit and domain events are the default backbone for CV parsing, fit score, screening and interview review flows.
  - Rationale: launch proof depends on traceable async execution, not hidden background magic.

- Billing enforcement lives on the server, not only in UI.
  - Active published job limits, member seat limits, candidate processing and AI interview quotas are enforced in backend services.
  - Rationale: launch safety depends on API truth, not page-level assumptions.

- Public funnel stays sales-led until providers are fully ready.
  - Public contact intake persists to DB and internal admin review surfaces exist.
  - Stripe self-serve can stay closed without blocking pilot launch.
  - Rationale: pilot conversion can run through contact + guided sales before full self-serve billing opens.

- Admin and ops visibility are database-backed.
  - Security incidents, public leads, internal admin account views and audit records persist.
  - Rationale: launch operations need inspectable evidence after a failure, not console-only traces.

## Current proven state

- Local pilot smoke now passes end-to-end with a real tenant-aware auth flow.
- Recruiter core flow is proven end-to-end:
  - signup
  - session load
  - published job creation
  - candidate creation
  - CV upload
  - CV parsing
  - application creation
  - fit score
  - screening
  - interview invite
  - public interview completion
  - report + recommendation generation
- Interview scheduling for `VOICE` sessions now uses the same AI interview quota enforcement as invite flows.
- CV upload is now resilient to local/staging schema drift when `CVFileBlob` is missing; filesystem-backed storage remains usable and worker extraction can continue.

## Known gaps / launch boundaries

- Real email delivery is still not launch-ready in the default environment.
  - Current smoke warning: notification provider is still `console`.
  - Launch requirement: real provider credentials and sender identity.

- Stripe self-serve billing is still not launch-ready in the default environment.
  - Current smoke warning: `stripeReady=false`.
  - Pilot can still run as sales-led.

- Not every marketed integration is equally launch-ready.
  - Google Calendar / Meet / Calendly can be piloted.
  - Unsupported providers must keep failing visibly instead of being marketed as ready.

- Admin and recruiter surfaces still need ongoing UX simplification.
  - Core flows are functioning, but polish and information hierarchy are still being tightened.

## Avoided overclaims

- Do not describe self-serve billing as live until strict runtime smoke passes without Stripe warnings.
- Do not describe transactional email as launch-ready until strict runtime smoke passes without email warnings.
- Do not market unsupported integrations as production-ready.
