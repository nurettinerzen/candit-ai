# Candit Validation Matrix

## Purpose

Bu dokuman "hangi komut neyi kanitlar" sorusunun kisa cevabidir.
Launch oncesi yesil build ile yesil runtime akis birbirine karistirilmamalidir.

## Validation layers

### 1. Static repository proof

- Command:
  - `corepack pnpm launch:verify`
- Proves:
  - Prisma client generation
  - lint
  - tests
  - full workspace build
- Does not prove:
  - running api/web/worker coordination
  - queue execution
  - storage access
  - provider readiness

### 2. Runtime pilot smoke

- Command:
  - `corepack pnpm launch:verify:runtime`
- Requires:
  - web running
  - api running
  - worker running
  - database and redis reachable
- Proves:
  - signup + session
  - tenant-aware auth requests
  - recruiter overview
  - billing overview read
  - job create / publish path
  - candidate create
  - CV upload
  - CV parsing
  - application create
  - fit score
  - screening
  - interview invite
  - public interview completion
  - report + recommendation generation
- Current expected result:
  - pass with warnings if email provider is `console`
  - pass with warnings if `stripeReady=false`

### 3. Strict runtime smoke

- Command:
  - `corepack pnpm launch:verify:runtime:strict`
- Proves:
  - the same runtime flow as pilot smoke
  - plus zero remaining launch warnings
- Required for:
  - self-serve launch
  - claims that billing and transactional email are production-ready

## Guardrails we have already proven

- Published active job limit is enforced on publish, not on draft creation.
- `VOICE` AI interview scheduling is quota-enforced server-side.
- CV upload remains operational even if `CVFileBlob` is missing and filesystem storage is still available.

## Still open before a fully self-serve launch

- Real transactional email provider
- Stripe self-serve billing readiness
- Provider support boundaries finalized in product copy
