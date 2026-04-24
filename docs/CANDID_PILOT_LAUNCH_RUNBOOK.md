# Candit Pilot Launch Runbook

## Current launch state

- Public contact intake is live and persists to the database.
- Recruiter core flow has a repeatable runtime smoke proof.
- Internal admin and red-alert visibility are database-backed.
- Real transactional email is configured; Stripe self-serve billing is still a launch warning until the provider is configured.
- Environment variable ownership and launch/runtime separation are documented in [LAUNCH_ENVIRONMENT_MATRIX.md](/Users/nurettinerzen/Desktop/ai-interviewer/docs/LAUNCH_ENVIRONMENT_MATRIX.md).
- Pilot tenant provisioning and account handoff flow are documented in [PILOT_ACCOUNT_HANDOFF_RUNBOOK.md](/Users/nurettinerzen/Desktop/ai-interviewer/docs/PILOT_ACCOUNT_HANDOFF_RUNBOOK.md).

## Environment gates

- Review [LAUNCH_ENVIRONMENT_MATRIX.md](/Users/nurettinerzen/Desktop/ai-interviewer/docs/LAUNCH_ENVIRONMENT_MATRIX.md) before changing any runtime variables
- Set `APP_RUNTIME_MODE=production`
- Set `JWT_SECRET` to a real 32+ char secret
- Set `CORS_ORIGIN=https://app.candit.ai`
- Set `PUBLIC_WEB_BASE_URL=https://app.candit.ai`
- Set `NEXT_PUBLIC_API_BASE_URL=https://api.candit.ai/v1`
- Set internal admin allowlists before launch

## Launch proof commands

### 1. Static verification

Use this to prove the repo builds and tests cleanly:

```bash
corepack pnpm launch:verify
```

This covers:

- Prisma client generation
- lint
- tests
- full workspace build

### 2. Contract verification

Use this to prove launch-critical guardrails before the full runtime smoke:

```bash
corepack pnpm launch:verify:contracts
```

This proves:

- production runtime hardening rules
- human-approved decision / quick-action contracts
- auth provider boundary contract and Google OAuth callback guardrails
- launch warning detection for console email, Stripe test/live drift, and local OAuth redirect mistakes
- explicit meeting provider selection is blocked when the provider is V1 disi, setup-required, or missing a tenant connection
- duplicate candidate provenance enrichment
- invite reminder and re-invite workflow contracts
- public interview consent gate
- decision event to candidate email wiring
- web auth/runtime and CSV intake parsing
- worker-side minimum evidence enforcement

### 3. Runtime verification

Use this after web, api and worker are running:

```bash
corepack pnpm launch:verify:runtime
```

This proves:

- tenant-aware signup and session load
- tenant header mismatch rejection
- cross-tenant resource isolation on recruiter data
- AI support center and infrastructure readiness reads
- scheduling provider catalog and fallback visibility
- recruiter overview
- billing overview read
- published job creation
- candidate creation
- CV upload and parsing
- application creation
- fit score and screening
- interview invite
- public interview start, answer and completion
- review pack generation
- recruiter decision recording
- decision-driven candidate communication and dossier governance visibility

### 4. Strict runtime verification

Use this only when launch warnings are expected to be fully gone:

```bash
corepack pnpm launch:verify:runtime:strict
```

This must fail if launch warnings remain.

## Expected warnings today

- Email delivery may still warn if the provider is `console`.
- Stripe may still warn if `stripeReady=false`.
- `Settings` can now also warn if production still uses `sk_test_...` Stripe keys or localhost OAuth redirect URIs.

These warnings are acceptable only for a sales-led pilot.
They are not acceptable for a fully self-serve launch.

## Pilot day checklist

- Check signup flow
- Check login flow
- Check one password reset flow
- Check one email verification flow
- Check tenant isolation proof in runtime smoke output
- Check one public contact submission
- Check `/admin/leads`
- Check `/admin/red-alert`
- Check one recruiter end-to-end flow from candidate create to recruiter decision and dossier communication log
- Check billing configuration presence, even if self-serve billing is still closed

## Supported pilot boundaries

- Google Calendar / Google Meet can remain active for pilot
- `ZOOM` and `MICROSOFT_CALENDAR` must remain visibly unsupported until real adapters are ready
- Self-serve billing can remain disabled while pilot runs through guided sales
- Recruiter `Subscription` screen should show whether Stripe self-serve is really ready or still in sales-led pilot mode
- Recruiter `Settings` screen should be used as the operator-facing truth source for `pilot / setup required / V1 disi` provider states
- Recruiter `Settings > Baglanti kurulumu` cards should be used as the tenant-facing truth source for Google Calendar / Google Meet connection status and OAuth callback outcomes
- Public `login` and `signup` screens should continue to state that Enterprise SSO / OIDC is outside the V1 launch scope
