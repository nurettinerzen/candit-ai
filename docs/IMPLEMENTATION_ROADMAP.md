# AI Interviewer - V1 Local Delivery Durumu

## Tamamlanan Teknik Kapsam

- [x] Monorepo ve workspace altyapisi (`apps/web`, `apps/api`, `apps/worker`, `packages/*`)
- [x] Local stack tanimi (`docker-compose.yml`: Postgres/Redis/Minio/Mailhog)
- [x] Prisma domain modeli + migration SQL + seed
- [x] JWT tabanli auth + tenant guard + RBAC guard
- [x] Job CRUD API
- [x] Candidate intake/import API + dedup
- [x] Application create/list + stage transition + human-approved decision
- [x] Audit log API
- [x] Feature flag API (`auto_stage_change_enabled` default false)
- [x] Analytics API (funnel, time-to-hire, interview-quality)
- [x] Async job API + BullMQ worker + retry/DLQ persistence
- [x] Web recruiter workspace baseline

## V1 Kabul Kurallari Karsiligi

- [x] AI otomatik red yok, humanApprovedBy zorunlu
- [x] Tenant izolasyonu app katmaninda zorunlu (`x-tenant-id` + token claim)
- [x] Kritik aksiyonlar audit loga yaziliyor
- [x] Turkish-first temel akis ve seed verisi hazir

## Bilincli Olarak V1 Sonrasina Birakilanlar

- [ ] Gercek OIDC/SSO provider entegrasyonu (simdilik local JWT)
- [ ] Candidate consent gate runtime enforcement (interview session start adiminda)
- [ ] AI raporda otomatik evidence-count validator (min 2)
- [ ] E2E/contract test otomasyonu (su an placeholder test script)
- [ ] Canli media interview (LiveKit) entegrasyonu
- [ ] Dis entegrasyonlar (Calendar/ATS) gercek provider baglantilari

## Lokal Dogrulama Checklist

1. `corepack pnpm install`
2. `docker compose up -d postgres redis minio mailhog`
3. `corepack pnpm db:generate`
4. `corepack pnpm db:migrate`
5. `corepack pnpm db:seed`
6. `corepack pnpm build`
7. `corepack pnpm dev`
