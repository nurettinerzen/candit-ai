## Launch Operations Runbook

Bu dokuman, pilot ve launch oncesi operasyon hazirligini tek yerde toplar.
Amac:

- secret rotation sirasi ve sahipligini netlestirmek
- incident response ve rollback adimlarini standardize etmek
- launch gunu go/no-go kararini kimin verecegini tek sayfada toplamak

## 1. Secret Rotation Plan

Launch oncesi minimum rotation kapsami:

- `JWT_SECRET`
- `RESEND_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_AUTH_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_WEBHOOK_SECRET`

Prensipler:

- Sohbet, ekran goruntusu veya log icinde paylasilan her secret launch oncesi rotate edilmelidir.
- Eski ve yeni secret'lar ayni anda uzun sure acik kalmamalidir.
- Rotation sonrasi `corepack pnpm launch:verify` ve `corepack pnpm launch:verify:runtime:strict` tekrar kosulmadan launch penceresi acilmamalidir.

Onerilen sira:

1. Yeni secret'i provider panelinde olustur.
2. Staging/pilot env'e yaz.
3. Ilgili smoke ve runtime verify komutlarini kos.
4. Eski secret'i revoke et.
5. Rotation tarihi ve owner bilgisini not dus.

Rotation kayit sablonu:

| Secret | Owner | Last Rotated | Next Rotation | Notes |
| --- | --- | --- | --- | --- |
| `RESEND_API_KEY` | _assign_ | _yyyy-mm-dd_ | _yyyy-mm-dd_ | Sohbet/log paylasimi olduysa acil rotate |
| `OPENAI_API_KEY` | _assign_ | _yyyy-mm-dd_ | _yyyy-mm-dd_ | Worker smoke sonrasi teyit |
| `JWT_SECRET` | _assign_ | _yyyy-mm-dd_ | _yyyy-mm-dd_ | Session invalidation etkisi kontrol edilmeli |
| `STRIPE_SECRET_KEY` | _assign_ | _yyyy-mm-dd_ | _yyyy-mm-dd_ | Self-serve kapaliysa bile owner belli olmali |

## 2. Incident Response

Bir incident oldugunda ilk bakilacak sinyal kaynaklari:

- Internal admin `red-alert`
- `PlatformIncident` ve `SecurityEvent` kayitlari
- Worker task run durumlari
- `corepack pnpm launch:verify:contracts`
- `corepack pnpm launch:verify:runtime:strict`

Severity sinirlari:

- `P1`: login, invitation, interview runtime, tenant isolation veya candidate-facing email zinciri bozuk
- `P2`: tekil tenant veya tekil provider sorunu, manuel workaround var
- `P3`: copy, reporting, non-critical admin surface veya dusuk etkili kalite sorunu

Ilk 15 dakika icinde yapilacaklar:

1. Incident owner ata.
2. Etkilenen tenant, user, application, interview session ve trace bilgilerini not et.
3. Yeni pilot provisioning ve yeni dis davetleri gecici olarak durdur.
4. `launch:verify:contracts` veya `launch:verify:runtime:strict` ile sorunun kapsamını tekrar uret.
5. Evidence'i tek yerde topla: hata mesaji, tenant id, uygulama id, session id, ilgili commit SHA.

## 3. Rollback Kurallari

Rollback prensipleri:

- Uygulama rollback'i ile veri rollback'i ayni sey degildir.
- Prisma migration'larini canli veride geri almak, acik bir data plan olmadan yapilmamalidir.
- Ilk tercih son saglam uygulama commit'ine veya deployment'ina donmektir.

Onerilen rollback akisi:

1. Son saglam commit veya deployment SHA'sini sec.
2. Hedef SHA icin `launch:verify:contracts` kos.
3. Mumkunse staging'de `launch:verify:runtime:strict` ile kanit al.
4. Uygulamayi geri al.
5. Candidate-facing kritik akislar icin hizli smoke gec.
6. Incident notuna rollback zamani ve karar vereni yaz.

## 4. Launch Day Go / No-Go

Bu tablo launch gununden once doldurulmali:

| Rol | Kisi | Backup | Not |
| --- | --- | --- | --- |
| Go/No-Go owner | _assign_ | _assign_ | Son karar |
| API / backend owner | _assign_ | _assign_ | Auth, jobs, candidate flow |
| Web / recruiter UX owner | _assign_ | _assign_ | Public + panel surfaces |
| Worker / AI quality owner | _assign_ | _assign_ | Screening, report, recommendation |
| Ops / provider owner | _assign_ | _assign_ | Resend, Google, Stripe env |

Go kosullari:

- `corepack pnpm launch:verify:contracts` yesil
- `corepack pnpm launch:verify:runtime:strict` yesil
- 1 tam mock interview kaydi alinmis
- 1 pilot tenant handoff artifact'i uretilmis
- Launch checklistte kritik acik bulunmuyor

No-Go kosullari:

- Tenant isolation, auth, invitation veya interview runtime zincirinde acik bug
- Candidate-facing email veya login akisi bozuk
- Son smoke kaniti eski veya tekrarlanamiyor
- Launch owner tablosu ve incident owner'lari atanmis degil
