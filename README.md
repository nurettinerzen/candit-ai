# AI Recruiter V1 Foundation (Demo-Ready)

Turkey-first, Turkish-only AI-assisted recruiting SaaS foundation for blue-collar and entry-level hiring.

## What Works Now
- Recruiter workflow: jobs, candidates, applications, stage transitions, decision submission.
- AI support workflow: CV parsing, screening support, report generation, recommendation generation.
- Application detail as core operating screen with:
  - AI insights
  - human approval visibility
  - audit visibility
- AI Support Center with feature flags and AI run monitoring.
- Async orchestration with queue + worker.
- Demo seed scenarios for no-AI / screening-only / report+recommendation flows.

## Core Product URLs
- `/` overview and demo framing
- `/applications` recruiter pipeline
- `/applications/[id]` core operating screen
- `/jobs`
- `/candidates`
- `/ai-destek`
- `/audit-logs`

## Local Setup
```bash
corepack pnpm install
cp .env.example .env
docker compose up -d postgres redis minio mailhog
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

## Demo Credentials
- `admin@demo.local`
- `recruiter@demo.local`
- `hm@demo.local`
- Password: `DEV_LOGIN_PASSWORD` in `.env` (default: `demo12345`)

## Required Delivery Docs
- `CURRENT_PRODUCT_CAPABILITIES.md`
- `DEMO_FLOW.md`
- `IMPLEMENTED_VS_DEFERRED.md`
- `LOCAL_SMOKE_TEST.md`

## Important Guardrails
- AI is assistant-only in V1.
- No autonomous rejection.
- Critical decisions require human approval.
- AI outputs must stay evidence-linked and uncertainty-aware.
- Interview runtime (voice/video) is intentionally deferred and not presented as implemented.
