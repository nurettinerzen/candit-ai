# Jira Backlog Seed (Epic -> Story -> Task)

## Epic: E-1000 Platform Foundation

### Story: S-1010 Monorepo ve local stack kurulumu
- Task: T-1011 `apps/web`, `apps/api`, `apps/worker`, `packages/*` klasorleri olustur
- Task: T-1012 `docker-compose.yml` ile Postgres/Redis/Minio/Mailhog hazirla
- Task: T-1013 Koku scriptlerini (`dev`, `build`, `db:migrate`) tanimla

### Story: S-1020 Tenant + RBAC cekirdegi
- Task: T-1021 Global auth guard olustur
- Task: T-1022 Tenant guard ile `x-tenant-id` claim eslesmesini zorunlu kil
- Task: T-1023 Permission decorator + RBAC guard implement et
- Task: T-1024 Yetki disi endpoint erisim testlerini yaz

### Story: S-1030 Core veri modeli
- Task: T-1031 Prisma schema ile tenant/user/job/candidate/application modellerini olustur
- Task: T-1032 Interview/transcript/ai_report tablolarini ekle
- Task: T-1033 Consent/audit/feature_flag/workflow tablolarini ekle
- Task: T-1034 Tenant ve stage odakli indeksleri dogrula

## Epic: E-2000 Recruiter Flow MVP

### Story: S-2010 Job lifecycle
- Task: T-2011 Job create/list/update endpointleri
- Task: T-2012 Job requirement CRUD
- Task: T-2013 Job creation wizard UI

### Story: S-2020 Candidate intake + pipeline
- Task: T-2021 Candidate create/import endpointleri
- Task: T-2022 Application stage transition endpointi + audit
- Task: T-2023 Pipeline board UI (bulk action dahil)

### Story: S-2030 Decision safety
- Task: T-2031 `POST /v1/applications/{id}/decision` insan onayi zorunlu kurali
- Task: T-2032 AI'nin otomatik stage degisimi flag'ini default kapali yap
- Task: T-2033 Decision ekraninda kanit+guven+oneri birlesik gosterim
