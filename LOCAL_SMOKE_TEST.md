# LOCAL SMOKE TEST

## Prerequisites
- Node.js 20+
- Corepack enabled
- Docker running

## 1) Install
```bash
corepack pnpm install
```

## 2) Environment
```bash
cp .env.example .env
```

## 3) Infra
```bash
docker compose up -d postgres redis minio mailhog
```

## 4) Database
```bash
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
```

## 5) Run Apps
```bash
corepack pnpm dev
```

## 6) Open
- Web: `http://localhost:3000`
- API: `http://localhost:4000/v1`

## 7) Smoke Checklist
- `/` overview opens with KPI and scenario cards.
- `/jobs` list loads; `/jobs/new` can create a job.
- `/candidates` list loads; `/candidates/new` can create a candidate.
- Candidate detail can create a new application.
- `/applications` list shows AI support status line.
- `/applications/[id]`:
  - stage transition works with reason code
  - AI task trigger buttons queue tasks
  - decision requires approval checkbox
  - human approval and audit areas are visible
- `/ai-destek`:
  - feature flags visible
  - selected flags toggle successfully (except auto reject)
  - recent task run statuses visible
- `/audit-logs` filters and lists entity logs.

## Demo Credentials
- `admin@demo.local`
- `recruiter@demo.local`
- `hm@demo.local`
- Password: `.env` `DEV_LOGIN_PASSWORD` (default: `demo12345`)
