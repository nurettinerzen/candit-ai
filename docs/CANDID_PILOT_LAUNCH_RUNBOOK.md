# Candid Pilot Launch Runbook

## Current Launch State

- Public contact intake is live and writes to the database.
- Public CTA flow is direct signup; waitlist is intentionally disabled.
- Production auth is locked to JWT + cookie transport.
- Security incidents and red-alert incidents now persist in the database.
- Launch verification commands are available through `pnpm launch:verify`.

## Pilot Launch Gates

### P0. Environment

- Set `APP_RUNTIME_MODE=production`
- Set `JWT_SECRET` to a real 32+ char secret
- Set `CORS_ORIGIN=https://app.candit.ai`
- Set `PUBLIC_WEB_BASE_URL=https://app.candit.ai`
- Set `NEXT_PUBLIC_API_BASE_URL=https://api.candit.ai/v1`
- Set internal admin allowlists before launch

### P0. Auth

- Confirm cookie auth works on production domain
- Confirm signup creates tenant + owner user + workspace
- Confirm password reset and email verification links resolve correctly
- Confirm demo session is disabled in production

### P0. Intake And Ops

- Submit a real public contact form and verify `PublicLeadSubmission` is created
- Verify internal admin can review `/admin/leads`
- Verify ops notification provider credentials are configured

### P0. Monitoring

- Review `/admin/red-alert` after a smoke run
- Confirm security incidents appear for rejected tokens and refresh token reuse
- Confirm integration incidents appear for unsupported or degraded providers

### P1. Integrations

- Google Calendar / Google Meet / Calendly can remain active for pilot
- `ZOOM` and `MICROSOFT_CALENDAR` are intentionally surfaced as unsupported for pilot
- Do not market unsupported providers as production-ready until real adapters are implemented

## Verification Commands

```bash
corepack pnpm db:generate
corepack pnpm --filter @ai-interviewer/api exec prisma migrate deploy
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

Or run:

```bash
corepack pnpm launch:verify
```

## Pilot Day Checklist

- Check signup flow
- Check login flow
- Check one password reset flow
- Check one email verification flow
- Check admin lead inbox
- Check red-alert dashboard
- Check one calendar-connected interview scheduling flow
- Check billing configuration presence even if payments are not opened to all users yet

## Known Pilot Boundaries

- Zoom native adapter is not implemented yet
- Microsoft Calendar native adapter is not implemented yet
- Unsupported integrations now fail visibly instead of silently no-oping
