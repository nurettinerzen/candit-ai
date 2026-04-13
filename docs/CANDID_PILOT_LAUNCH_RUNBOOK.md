# Candit Pilot Launch Runbook

## Current launch state

- Public contact intake is live and persists to the database.
- Recruiter core flow has a repeatable runtime smoke proof.
- Internal admin and red-alert visibility are database-backed.
- Self-serve billing and real transactional email are still launch warnings unless their providers are configured.

## Environment gates

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

### 2. Runtime verification

Use this after web, api and worker are running:

```bash
corepack pnpm launch:verify:runtime
```

This proves:

- tenant-aware signup and session load
- recruiter overview
- provider and infrastructure readiness reads
- billing overview read
- published job creation
- candidate creation
- CV upload and parsing
- application creation
- fit score and screening
- interview invite
- public interview start, answer and completion
- review pack generation

### 3. Strict runtime verification

Use this only when launch warnings are expected to be fully gone:

```bash
corepack pnpm launch:verify:runtime:strict
```

This must fail if launch warnings remain.

## Expected warnings today

- Email delivery may still warn if the provider is `console`.
- Stripe may still warn if `stripeReady=false`.

These warnings are acceptable only for a sales-led pilot.
They are not acceptable for a fully self-serve launch.

## Pilot day checklist

- Check signup flow
- Check login flow
- Check one password reset flow
- Check one email verification flow
- Check one public contact submission
- Check `/admin/leads`
- Check `/admin/red-alert`
- Check one recruiter end-to-end flow from candidate create to interview review pack
- Check billing configuration presence, even if self-serve billing is still closed

## Supported pilot boundaries

- Google Calendar / Google Meet / Calendly can remain active for pilot
- `ZOOM` and `MICROSOFT_CALENDAR` must remain visibly unsupported until real adapters are ready
- Self-serve billing can remain disabled while pilot runs through guided sales
