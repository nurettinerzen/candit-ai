# Candit Validation Matrix

## Purpose

Bu dokuman "hangi komut neyi kanitlar" sorusunun kisa cevabidir.
Launch oncesi yesil build ile yesil runtime akis birbirine karistirilmamalidir.

## Validation layers

### 1. Static repository proof

- Command:
  - `corepack pnpm launch:verify`
- Includes:
  - `corepack pnpm launch:verify:secrets`
- Proves:
  - checked-in repository files do not contain known secret key signatures
  - Prisma client generation
  - lint
  - tests
  - full workspace build
- Does not prove:
  - running api/web/worker coordination
  - queue execution
  - storage access
  - provider readiness

### 2. Contract verification

- Command:
  - `corepack pnpm launch:verify:contracts`
- Proves:
  - launch-critical guardrails and service contracts
  - production runtime hardening rules
  - decision / reject / reminder / re-invite control flow
  - auth provider boundary response and Google OAuth callback guardrails
  - launch warning detection for common test-vs-production credential drift
  - explicit scheduling provider guardrails for unsupported, unconfigured, or disconnected providers
  - duplicate candidate provenance enrichment
  - public interview consent gate
  - event-driven decision email wiring
  - CSV intake/source parsing contracts
  - report minimum evidence enforcement
- Does not prove:
  - live api/web/worker coordination
  - queue worker availability in a running environment
  - real provider delivery

### 3. Runtime pilot smoke

- Command:
  - `corepack pnpm launch:verify:runtime`
- Requires:
  - web running
  - api running
  - worker running
  - database and redis reachable
- Proves:
  - signup + session
  - logout + relogin
  - recruiter web surfaces load for dashboard / jobs / candidates / applications / team / interviews / settings / subscription / ai-support
  - tenant-aware auth requests
  - internal-admin API access is rejected for a normal recruiter tenant
  - recruiter overview
  - AI support center and infrastructure readiness surfaces
  - scheduling provider catalog + fallback visibility
  - billing overview read
  - job create / publish path
  - jobs list + isolated draft create / edit / archive proof
  - candidate create
  - candidates list + detail
  - CV upload
  - CV parsing
  - application create
  - applications list + detail
  - recruiter entity detail pages load for created jobs / candidates / applications
  - dedicated application stage transition + stage-filter proof
  - fit score
  - screening
  - interview invite
  - public interview completion
  - report + recommendation generation
  - recruiter decision recording
  - decision-driven candidate communication log visibility
  - application dossier governance visibility
  - transcript evidence visible in application detail
- Current expected result:
  - pass with warnings if `stripeReady=false`

### 4. Strict runtime smoke

- Command:
  - `corepack pnpm launch:verify:runtime:strict`
- Proves:
  - the same runtime flow as pilot smoke
  - plus zero remaining launch warnings
- Required for:
  - self-serve launch
  - claims that billing and transactional email are production-ready

### 5. AI quality smoke

- Command:
  - `corepack pnpm smoke:analysis`
- Email-safe existing-account mode:
  - `CANDIT_ANALYSIS_USE_EXISTING_ACCOUNT=1 CANDIT_SMOKE_EMAIL=<existing-user> CANDIT_SMOKE_PASSWORD=<password> corepack pnpm smoke:analysis`
- Optional quality gate:
  - `CANDIT_ANALYSIS_STRICT=1`
  - or `CANDIT_ANALYSIS_MAX_WARNINGS=<n>`
  - or `CANDIT_ANALYSIS_MIN_PASS_RATE=0.90`
- Proves:
  - repeated role/location scenario pack can trigger CV parse, fit score, and screening end-to-end
  - heuristic pass/warn distribution is written as a reusable artifact under `artifacts/smoke/`
  - AI quality review can run without consuming signup email quota when an existing account is supplied
  - generated artifacts do not persist smoke-user passwords
- Does not prove:
  - interview runtime quality
  - report/recommendation quality after a real interview transcript
  - live staging domain callbacks

### 6. Browser surface verification

- Commands:
  - `npx -y agent-browser install`
  - `npx -y agent-browser --session pilot-desktop open http://localhost:3200/pricing`
  - `npx -y agent-browser --session pilot-mobile set viewport 390 844`
  - `npx -y agent-browser --session pilot-mobile open http://localhost:3200/auth/login`
- Proves:
  - public page content is not blank in a real browser
  - Next.js error overlay is absent on sampled routes
  - desktop and mobile viewport rendering passes a basic gut-check
  - login/pricing key UI elements are present in the accessibility snapshot
- Does not prove:
  - every recruiter flow in-browser
  - authenticated interaction depth beyond the sampled routes
  - full visual QA across all breakpoints

## Guardrails we have already proven

- Published active job limit is enforced on publish, not on draft creation.
- `VOICE` AI interview scheduling is quota-enforced server-side.
- CV upload remains operational even if `CVFileBlob` is missing and filesystem storage is still available.

## Still open before a fully self-serve launch

- Stripe self-serve billing readiness
- Full invitation / password-reset journey proof on the real launch domain
- Mock interview quality review across multiple role types
