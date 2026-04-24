# Telyx -> Candid Launch Gap Analysis

## Scope

- `Telyx` referans repo: `/Users/nurettinerzen/Desktop/ai-assistant-saas`
- `Candid` incelenen repo: `/Users/nurettinerzen/Desktop/ai-interviewer`
- Not: Masaüstündeki `/Users/nurettinerzen/Desktop/Telyx` klasörü kod repo'su değil; gerçek uygulama kodu `ai-assistant-saas` içinde.

## Executive Summary

Kısa cevap: `Candid`, ilk bakışta düşündüğümüzden daha olgun bir ürün çekirdeğine sahip. Recruiter workflow, auth foundation, billing foundation, member invites, scheduling, AI orchestration, sourcing, public interview runtime ve internal admin yüzeyi kodda mevcut. Domain derinliği açısından bazı alanlarda `Telyx`'ten daha ileri.

Ama `Telyx` ile asıl fark ürün çekirdeğinde değil, launch işletim sisteminde. `Telyx` launch/pilot seviyesine şu katmanlarla çıkmış:

- gerçek public lead capture akışları
- güvenlik olay omurgası
- red alert / safe-test / response trace / ops incident katmanı
- smoke / regression / security / validation test matrisi
- pilot runbook'ları ve doğrulama paketleri
- prod davranışı netleştirilmiş auth + rate limit + webhook validation disiplini

`Candid` tarafında bugün gördüğüm resim şu:

- **ürün çekirdeği güçlü**
- **launch ops / security / verification katmanı eksik**
- **bazı yüzeyler gerçek değil, mock veya demo modunda**
- **bazı modüller kodda var ama production-verified değil**

Bu yüzden launch planı "yeni feature yazmak" değil, daha çok:

1. mock/demoyu ürünleştirmek
2. ops ve security omurgasını eklemek
3. doğrulama/test katmanını Telyx seviyesine çıkarmak
4. production config ve çalışma modlarını sıkılaştırmak

## What Telyx Has As A Launch System

`Telyx` repo sadece feature zengin değil; launch disiplinini ayrı bir katman olarak kurmuş.

Öne çıkan yapılar:

- gerçek public `contact` ve `waitlist` endpoint'leri
- rate limiting ve abuse düşünülmüş public form akışları
- `SecurityEvent`, `ResponseTrace`, `OperationalIncident` veri modelleri
- `red-alert` API yüzeyi
- `safe-test` prod doğrulama endpoint'leri
- cron/ops runbook'ları
- smoke, regression, pilot, replay, security, validation test klasörleri
- prod kanıt paketleri ve deployment/verification dökümanları

Bu katmanlar `Telyx`'i sadece "çalışan uygulama" değil, "izlenebilir ve pilota sokulabilir sistem" haline getirmiş.

## What Candid Already Has

### 1. Recruiter product core

`Candid` çekirdeğinde aşağıdakiler gerçek ve bağlı duruyor:

- jobs
- candidates
- applications
- stage transitions
- AI task triggers
- audit
- human approval
- reports/recommendations

Ana kanıt yüzeyleri:

- `apps/api/src/modules/jobs`
- `apps/api/src/modules/candidates`
- `apps/api/src/modules/applications`
- `apps/api/src/modules/screening`
- `apps/api/src/modules/reports`
- `apps/api/src/modules/recommendations`
- `apps/web/app/(recruiter)`

### 2. AI control plane ve worker

`Candid`'de eski dökümanların aksine gerçek provider akışı var:

- worker orchestration
- task-specific services
- OpenAI structured generation
- deterministic fallback
- output persistence

Ana kanıt yüzeyleri:

- `apps/worker/src/ai/ai-task-execution-orchestrator.ts`
- `apps/worker/src/ai/providers/structured-ai-provider.ts`
- `apps/worker/src/ai/tasks/*`

### 3. Auth ve account foundation

Auth artık sadece demo header seviyesinde değil:

- signup/login
- password reset
- email verification
- invitation accept flow
- Google OAuth foundation
- refresh/logout/session endpoints

Ana kanıt yüzeyleri:

- `apps/api/src/modules/auth/*`
- `apps/web/app/auth/*`
- `apps/web/lib/auth/*`

### 4. Billing foundation

`Candid`'de billing artık placeholder değil:

- trial snapshot
- plan catalog
- addon catalog
- Stripe checkout session creation
- customer portal
- internal admin plan override
- quota grants / usage events

Ana kanıt yüzeyleri:

- `apps/api/src/modules/billing/*`
- `apps/api/prisma/schema.prisma`
- `apps/web/app/(recruiter)/subscription/page.tsx`

### 5. Interview + scheduling foundation

Bu alan düşündüğümden çok daha ileri:

- recruiter side interview list
- public candidate interview page
- AI-first interview invitation flow
- scheduling workflows
- candidate availability / slot selection
- transcript ingestion endpoints
- interview review-pack tetikleme

Ana kanıt yüzeyleri:

- `apps/api/src/modules/interviews/*`
- `apps/api/src/modules/scheduling/*`
- `apps/web/app/(recruiter)/interviews/page.tsx`
- `apps/web/app/interview/[sessionId]/page.tsx`
- `apps/web/app/schedule/[workflowId]/page.tsx`

### 6. Member/team management

Bu da mevcut ve settings içine bağlanmış:

- member list
- invite
- resend invite
- role change
- status change
- ownership transfer

Ana kanıt yüzeyleri:

- `apps/api/src/modules/members/*`
- `apps/web/app/(recruiter)/settings/page.tsx`

### 7. Internal admin and platform view

`Candid`'de internal admin yüzeyi var:

- dashboard
- account list/detail
- red alert benzeri özet
- enterprise customer creation
- plan/quota admin actions

Ana kanıt yüzeyleri:

- `apps/api/src/modules/internal-admin/*`
- `apps/web/app/(recruiter)/admin/*`

## The Real Gap: Telyx Launch System vs Candid Launch System

## Gap Matrix

| Area | Telyx | Candid | Verdict |
|---|---|---|---|
| Public site pages | Full public surface | Full public surface exists | Similar |
| Public waitlist/contact submission | Real backend endpoints + persistence | Mock form shell only | Critical gap |
| Auth foundation | Production-shaped | Good foundation, but still demo/hybrid defaults | Critical gap |
| Billing foundation | Launch-grade | Strong foundation | Near ready |
| AI control plane | Mature | Strong foundation | Good |
| Interview domain | Moderate | Stronger, domain-specific | Strong |
| Scheduling/integrations | Connected | Good foundation, some providers stubbed | Medium gap |
| Security event pipeline | Dedicated | Not found as dedicated layer | Critical gap |
| Red alert security dashboard | Real security + ops events | Internal admin alert aggregation only | Critical gap |
| Safe prod validation endpoints | Present | Not found | Critical gap |
| Runbooks / pilot ops | Strong | Limited smoke doc only | Critical gap |
| Automated tests | Strong matrix | `no tests yet` scripts | Critical gap |
| Lint / quality gate | Present in practice | `no lint yet` scripts | Critical gap |
| Trace / incident forensics | Dedicated | Not found as dedicated layer | Medium-high gap |

## Critical Gaps To Fix Before Launch

## P0

### 1. Replace mock public funnel with real lead capture

Şu an public site conversion yüzeyi launch-ready değil.

Bulgu:

- public contact ve waitlist sayfaları `MockContactForm` kullanıyor
- waitlist kopyasında açıkça "sonraki adımda gerçek submission akışını bağlayabiliriz" notu var
- backend modüllerinde `contact` / `waitlist` API karşılığı yok

Telyx karşılığı:

- `/api/contact/info`
- `/api/contact`
- `/api/waitlist`
- `/api/waitlist/check/:email`
- rate limit + DB persistence + admin notification

Candit için yapılması gereken:

- `PublicContactPage` ve `PublicWaitlistPage` için gerçek submission API aç
- waitlist/contact tablolarını Prisma'ya ekle
- duplicate/email validation/rate limit ekle
- ops ekibine notification gönder
- admin tarafında bu lead'leri görecek basit bir inbox/list yüzeyi ekle

### 2. Production auth mode'u demo modundan ayır

Şu an auth altyapısı iyi ama launch varsayılanları hala demo/development ağırlıklı.

Bulgu:

- `.env.example` içinde `AUTH_SESSION_MODE="hybrid"`
- `AUTH_TOKEN_TRANSPORT="header"`
- `ALLOW_DEV_AUTH_HEADERS="true"`
- `ALLOW_DEMO_SHORTCUTS="true"`
- `ALLOW_DEMO_CREDENTIAL_LOGIN="true"`
- web login ekranında demo session fallback var
- Google auth UI'da "ayarlar tamamlandığında aktif olacak" söylemi duruyor

Launch öncesi yapılması gereken:

- production env için `jwt + cookie` zorunlu akışı netleştir
- dev header auth ve demo shortcuts'ı production'da hard-off yap
- login ekranındaki demo hesabı yolunu production build'de tamamen kaldır
- Google auth gerçekten kullanılacaksa redirect URI/client setup tamamlanmalı
- kullanılmayacaksa launch'ta UI'dan kaldırılmalı

### 3. Telyx-style security event backbone kur

`Candid`'de operational/internal alert özetleri var, ama `Telyx` seviyesinde güvenlik olay sistemi yok.

Telyx'te bulunan ama `Candid`'de göremediğim omurga:

- `SecurityEvent`
- request-level event logging
- webhook signature violation logging
- SSRF/firewall/pii leak/rate-limit event store
- `safe-test` doğrulama endpoint'leri

Candit için önerilen minimum güvenlik omurgası:

- `SecurityEvent` modeli
- severity + type + endpoint + actor + tenant + ip + metadata alanları
- merkezi logger helper
- auth failure loglama
- public form abuse loglama
- webhook invalid signature loglama
- rate limit hit loglama
- billing webhook failure loglama
- interview/public token abuse loglama

### 4. Red alert / incident panelini gerçek security+ops paneline çevir

Şu anki internal admin red-alert benzeri görünüm daha çok şu tablolardan türemiş aggregation:

- notification failures
- AI failures
- revoked auth sessions
- billing alerts
- integration alerts

Bu faydalı ama `Telyx`'teki gibi gerçek bir incident/security monitoring katmanı değil.

Yapılması gereken:

- security events için ayrı dashboard/read model
- category: `SECURITY`, `OPERATIONS`, `BILLING`, `AI`, `PUBLIC_FUNNEL`
- severity ve repeat-count
- resolve/acknowledge mekanizması
- health score
- safe-test ile dashboard doğrulaması

### 5. Test matrisini launch seviyesine çıkar

Bu en net launch gap.

Bulgu:

- `apps/api/package.json` -> `test: "echo 'no tests yet'"`
- `apps/web/package.json` -> `test: "echo 'no tests yet'"`
- `apps/worker/package.json` -> `test: "echo 'no tests yet'"`
- lint script'leri de aynı durumda

Telyx'te bulunan kalite katmanları:

- smoke
- regression
- pilot
- security
- validation
- replay
- golden

Candit için minimum launch test paketi:

1. auth smoke
2. public waitlist/contact smoke
3. recruiter core flow smoke
4. interview invite + public interview smoke
5. scheduling smoke
6. billing checkout session smoke
7. notification dispatch smoke
8. worker AI task smoke
9. permission / tenant isolation smoke
10. webhook signature validation tests

### 6. Runbook ve proof pack oluştur

`Telyx` launch-ready hissini sadece kod değil, operasyon dokümanı veriyor.

`Candid`'de şu an sadece local smoke var; bu yetmez.

Eklenmesi gereken dökümanlar:

- launch checklist
- incident playbook
- billing failure playbook
- interview runtime failure playbook
- notification/email failure playbook
- prod smoke/proof pack
- rollback steps
- manual daily checks

## P1

### 7. Integrations layer'ı productized hale getir

`Candid` entegrasyon tarafında fena değil ama tamamı launch-ready değil.

Bulgu:

- Google odakli scheduling adapterlari var
- `Google Calendar` / `Google Meet` adapter var
- `ATS_GENERIC` var
- `Microsoft Calendar` ve `Zoom` halen stub adapter

Yani burada "şema ve endpoint var" ile "gerçek provider launch'a hazır" ayrımı var.

Ne yapılmalı:

- launch'ta hangi provider'lar gerçekten desteklenecek netleştir
- sadece hazır olanları UI'da aktif göster
- stub provider'ları "yakında" durumuna çek
- OAuth/test akışları için smoke senaryosu ekle

### 8. Notifications katmanını açık ürün politikasıyla bitir

`Candid` notifications service mevcut. Email için `Resend` path'i var, fallback console var.

Eksik taraf:

- SMS gerçek provider yok
- in-app gerçek provider yok
- template coverage launch açısından henüz net değil
- delivery failure monitoring yeni security/ops omurgasına bağlanmalı

Yapılması gereken:

- launch'ta kullanılacak kanal setini netleştir
- sadece gerçekten çalışan delivery channel'larını ürün akışına bağla
- interview invite, member invite, password reset, public lead, billing checkout link template'lerini finalize et

### 9. Health ve readiness yüzeyini büyüt

Şu an health endpoint çok hafif:

- `/health`
- `/health/providers`

Telyx seviyesinde launch için eklenmesi gerekenler:

- queue health
- db latency / redis health
- mail provider health
- billing provider readiness
- public funnel readiness
- interview runtime readiness
- degraded mode sinyalleri

### 10. Documentation drift temizliği

Bu proje içinde önemli bir risk var: bazı dökümanlar kodun gerisinde.

Örnekler:

- bazı dokümanlar "no real provider path yet" diyor
- bazıları "no production auth/session integration" diyor
- ama kodda auth, billing, worker provider, interviews, settings, memberships mevcut

Bu launch açısından tehlikeli çünkü ekip yanlış backlog çıkarabilir.

Yapılması gereken:

- "source of truth" launch doc oluştur
- implemented / connected / verified / deferred ayrımı net olmalı
- eski audit/roadmap dokümanları ya güncellenmeli ya da deprecated işaretlenmeli

## P2

### 11. Trace / forensic layer

`Telyx`'te `ResponseTrace` ve `OperationalIncident` katmanı var.

`Candid` için özellikle şu alanlarda değerli olur:

- public interview oturumu
- AI answer generation
- candidate answer ingestion
- scheduling booking
- notification delivery
- sourcing outreach send

Bu katman launch için zorunlu değil ama ilk ciddi prod problemi çok hızlandırır.

### 12. Post-launch monitoring cadence

`Telyx` pilot mantığında:

- alarm thresholds
- daily checks
- weekly summaries
- optional cron

`Candid` için de benzer minimum ops ritmi tanımlanmalı:

- günde 2 kez panel kontrolü
- failed notification sayısı
- failed interview session sayısı
- abandoned session oranı
- billing checkout started vs completed oranı
- public lead volume ve spam oranı

## Recommended Launch Sequence For Candid

## Sprint 1 - Hard launch blockers

1. Public waitlist/contact backend + persistence + notification
2. Production auth mode hardening
3. Minimal security event model + logger
4. Minimal red alert dashboard for security/ops
5. Real smoke tests for auth/core interview/billing/public funnel
6. Launch checklist + proof pack + incident runbook

## Sprint 2 - Productization

1. Integration support matrix cleanup
2. Notification templates + failure handling
3. Provider readiness dashboard expansion
4. Billing/quota edge case verification
5. Docs cleanup and source-of-truth launch doc

## Sprint 3 - Post-launch quality

1. Response trace / incident forensics
2. Replay/regression suites
3. Threshold-based monitoring
4. Safer admin validation endpoints

## Concrete Build List For Candid

## Must build

- `WaitlistEntry` table
- `ContactMessage` table
- public lead submission API
- lead rate limiter
- lead notification template
- `SecurityEvent` table
- `SecurityEventService`
- security-aware red alert read model
- smoke test runner
- production launch runbook
- proof pack doc

## Must wire

- contact form -> API
- waitlist form -> API
- auth production env -> cookie transport
- invite / reset / verify email templates -> real provider
- billing events -> alerting
- interview runtime failures -> alerting

## Must verify

- no demo login path in prod
- no dev headers in prod
- Stripe flow
- Resend flow
- public interview invite flow
- scheduling flow
- tenant isolation smoke
- member invitation flow

## Final Verdict

Eğer sadece ürün kabiliyeti sorulursa:

- `Candid` zayıf değil
- hatta recruiter/interview domaininde ciddi bir temel atılmış

Ama eğer soru "yarın launch'a çıkabilir miyiz?" ise:

- bugün olduğu haliyle **tam launch-ready değil**
- en büyük açıklar feature değil, **launch operating system** tarafında

En kritik cümle şu:

`Telyx`'te launch'a bizi taşıyan şey sadece feature completeness değildi; güvenlik, doğrulama, monitoring, public capture ve operasyon disipliniydi. `Candid`'de tam olarak bu katmanı tamamlamamız gerekiyor.

Bu katmanı tamamladığımız anda `Candid`'in launch yolu çok hızlanır; çünkü domain çekirdeği zaten büyük ölçüde kurulmuş durumda.
