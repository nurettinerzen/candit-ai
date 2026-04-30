# Candit Launch Environment Matrix

Bu dokuman `.env.example` icindeki tum variable'lari launch baglaminda aciklar.
Amac pilot, staging ve launch runtime'larinda hangi ayarin neden var oldugunu tek yerde toplamaktir.

## Kaynak ve kurallar

- Kanonik variable listesi: `/Users/nurettinerzen/Desktop/ai-interviewer/.env.example`
- Launch runtime hedefi:
  - `APP_RUNTIME_MODE=production`
  - `AUTH_SESSION_MODE=jwt`
  - `AUTH_TOKEN_TRANSPORT=cookie`
  - demo/dev shortcut'lar kapali
  - localhost callback veya placeholder sender kalmamis
- Pilot runtime notu:
  - self-serve billing kapali olabilir
  - email delivery `resend` ile acik olmali
  - unsupported provider'lar UI ve API'de kapali kalmali

## Veri ve storage

- `DATABASE_URL`: API ve worker icin ana Postgres baglantisi. Launch: zorunlu.
- `REDIS_URL`: BullMQ queue ve worker koordinasyonu. Launch: zorunlu.
- `FILE_STORAGE_ROOT`: local/file-based artifact root. Launch: storage stratejisine gore gerekli.
- `CV_UPLOAD_MAX_SIZE_BYTES`: CV upload boyut limiti. Launch: onerilir.
- `S3_ENDPOINT`: object storage endpoint. Local MinIO veya gercek S3. Launch: storage stratejisine gore gerekli.
- `S3_ACCESS_KEY`: object storage access key. Launch: storage stratejisine gore gerekli.
- `S3_SECRET_KEY`: object storage secret. Launch: storage stratejisine gore gerekli.
- `S3_BUCKET`: CV ve diger artifact'larin bucket adi. Launch: storage stratejisine gore gerekli.

## Runtime ve auth cekirdegi

- `JWT_SECRET`: access/refresh token imzalama secret'i. Launch: zorunlu, 32+ karakter gercek secret.
- `DEV_LOGIN_PASSWORD`: seed/demo hesaplar icin kolay sifre. Launch: kapali veya `disabled-for-production`.
- `APP_RUNTIME_MODE`: `development`, `demo`, `production`. Launch: `production`.
- `AUTH_SESSION_MODE`: `dev_header`, `hybrid`, `jwt`. Launch: `jwt`.
- `AUTH_TOKEN_TRANSPORT`: `header` veya `cookie`. Launch: `cookie`.
- `AUTH_ACCESS_COOKIE_NAME`: access cookie adi. Launch: zorunlu.
- `AUTH_REFRESH_COOKIE_NAME`: refresh cookie adi. Launch: zorunlu.
- `AUTH_COOKIE_SECURE`: secure cookie zorunlulugu. Launch: `true`.
- `AUTH_COOKIE_DOMAIN`: cookie domain override. Launch: domain stratejisine gore ayarlanir.
- `AUTH_ACCESS_TTL_MINUTES`: access token omru. Launch: zorunlu.
- `AUTH_REFRESH_TTL_DAYS`: refresh token omru. Launch: zorunlu.
- `AUTH_SESSION_TTL_DAYS`: session omru. Launch: zorunlu.
- `AUTH_INVITATION_TTL_HOURS`: invitation token omru. Launch: zorunlu.
- `AUTH_EMAIL_VERIFICATION_TTL_HOURS`: email verification token omru. Launch: zorunlu.
- `AUTH_PASSWORD_RESET_TTL_HOURS`: password reset token omru. Launch: zorunlu.
- `AUTH_OAUTH_RELAY_TTL_HOURS`: OAuth relay token omru. Launch: zorunlu.
- `ALLOW_DEV_AUTH_HEADERS`: header tabanli dev auth. Launch: `false`.
- `REQUIRE_TENANT_HEADER`: tenant header zorunlulugu. Pilot/staging: onerilir, launch: karara bagli ama sabit olmali.
- `ALLOW_DEMO_SHORTCUTS`: demo shortcut davranislari. Launch: `false`.
- `ALLOW_DEMO_CREDENTIAL_LOGIN`: seeded demo credential login. Launch: `false`.

## AI ve speech

- `OPENAI_API_KEY`: parsing, screening, report, recommendation ve speech icin OpenAI key. Pilot: zorunlu.
- `OPENAI_API_BASE_URL`: OpenAI base URL override. Launch: default veya resmi gateway.
- `OPENAI_MODEL`: varsayilan model. Launch: zorunlu.
- `OPENAI_MODEL_CV_PARSING`: CV parse icin override model. Opsiyonel.
- `OPENAI_MODEL_SCREENING_SUPPORT`: screening icin override model. Opsiyonel.
- `OPENAI_MODEL_REPORT_GENERATION`: report icin override model. Opsiyonel.
- `OPENAI_MODEL_RECOMMENDATION_GENERATION`: recommendation icin override model. Opsiyonel.
- `OPENAI_MODEL_TRANSCRIPT_SUMMARIZATION`: transcript summary icin override model. Opsiyonel.
- `OPENAI_MODEL_INTERVIEW_ORCHESTRATION`: interview orchestration icin override model. Opsiyonel.
- `OPENAI_STT_MODEL`: speech-to-text modeli. Opsiyonel.
- `OPENAI_TTS_MODEL`: text-to-speech modeli. Opsiyonel.
- `OPENAI_TTS_VOICE`: TTS voice secimi. Opsiyonel.
- `SPEECH_STT_PROVIDER`: `browser` veya provider-backed STT. Pilot: `browser` fallback kabul edilebilir.
- `SPEECH_TTS_PROVIDER`: `browser` veya provider-backed TTS. Pilot: `browser` fallback kabul edilebilir.

## Google auth ve scheduling

- `GOOGLE_SCHEDULING_ENABLED`: Google Calendar/Meet pilotta acik mi. Production/pilot varsayilani: `false`.
- `GOOGLE_OAUTH_CLIENT_ID`: Google Calendar/Meet OAuth client id. Pilot: Google scheduling kullaniliyorsa zorunlu.
- `GOOGLE_OAUTH_CLIENT_SECRET`: Google Calendar/Meet OAuth client secret. Pilot: zorunlu.
- `GOOGLE_OAUTH_REDIRECT_URI`: Google scheduling callback URL. Launch: localhost olamaz.
- `GOOGLE_OAUTH_SCOPES`: scheduling scope listesi. Pilot: zorunlu.
- `GOOGLE_CALENDAR_DEFAULT_ID`: varsayilan calendar id. Opsiyonel.
- `GOOGLE_AUTH_ENABLED`: Google login pilotta acik mi. Production/pilot varsayilani: `false`.
- `GOOGLE_AUTH_CLIENT_ID`: Google login client id. Google auth aciksa zorunlu.
- `GOOGLE_AUTH_CLIENT_SECRET`: Google login client secret. Google auth aciksa zorunlu.
- `GOOGLE_AUTH_REDIRECT_URI`: Google login callback URL. Launch: localhost olamaz.
- `GOOGLE_AUTH_SCOPES`: login scope listesi. Opsiyonel.

## Email ve notification

- `EMAIL_PROVIDER`: `console` veya `resend`. Pilot/launch: `resend`.
- `RESEND_API_KEY`: Resend API key. Pilot/launch: email delivery icin zorunlu.
- `RESEND_API_BASE_URL`: Resend API base URL. Genelde default.
- `EMAIL_FROM`: giden email sender adresi. Pilot/launch: dogrulanmis domain.
- `NOTIFICATION_DEFAULT_EMAIL_TO`: ops fallback inbox. Opsiyonel; yoksa public contact bildirimleri ilk internal admin inbox'una duser. Launch icin yine de acik tanimlanmasi onerilir.

## Billing

- `STRIPE_SECRET_KEY`: Stripe secret key. Self-serve billing acilacaksa zorunlu.
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook imza secret'i. Self-serve billing acilacaksa zorunlu.
- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID`: billing portal config id. Self-serve billing icin onerilir.
- `STRIPE_PRICE_FLEX_MONTHLY`: Flex aylik price id. Self-serve billing icin gerekli.
- `STRIPE_PRICE_STARTER_MONTHLY`: Starter aylik price id. Self-serve billing icin gerekli.
- `STRIPE_PRICE_GROWTH_MONTHLY`: Growth aylik price id. Self-serve billing icin gerekli.
- `STRIPE_PRICE_ENTERPRISE_MONTHLY`: Enterprise aylik price id. Opsiyonel.
- `STRIPE_PRICE_JOB_CREDIT_PACK_1`: 1 job kredi paketi price id. Opsiyonel.
- `STRIPE_PRICE_JOB_CREDIT_PACK_3`: 3 job kredi paketi price id. Opsiyonel.
- `STRIPE_PRICE_CANDIDATE_PROCESSING_PACK_50`: 50 candidate processing pack price id. Opsiyonel.
- `STRIPE_PRICE_INTERVIEW_PACK_10`: 10 interview pack price id. Opsiyonel.
- `STRIPE_PRICE_INTERVIEW_PACK_25`: 25 interview pack price id. Opsiyonel.
- `STRIPE_PRICE_CANDIDATE_PROCESSING_PACK_100`: 100 candidate processing pack price id. Opsiyonel.

## Internal admin allowlist

- `INTERNAL_ADMIN_EMAIL_ALLOWLIST`: ic admin email allowlist. Launch: en az bir gercek ops adresi.
- `INTERNAL_ADMIN_DOMAIN_ALLOWLIST`: ic admin domain allowlist. Launch: ops domain'leri.
- `INTERNAL_BILLING_ADMIN_EMAIL_ALLOWLIST`: billing admin email allowlist. Launch: ops/billing sorumlulari.
- `INTERNAL_BILLING_ADMIN_DOMAIN_ALLOWLIST`: billing admin domain allowlist. Launch: ops/billing domain'leri.

## Public web ve frontend runtime

- `CORS_ORIGIN`: API'nin izin verdigi frontend origin listesi. Launch: gercek frontend domain'leri.
- `PUBLIC_WEB_BASE_URL`: invite, email verification, password reset linkleri icin public app base URL. Launch: `https://...`.
- `NEXT_PUBLIC_API_BASE_URL`: frontend'in vurdugu API root'u. Launch: gercek API URL.
- `NEXT_PUBLIC_APP_RUNTIME_MODE`: frontend runtime etiketi. Backend `APP_RUNTIME_MODE` ile hizali olmali.
- `NEXT_PUBLIC_AUTH_SESSION_MODE`: frontend auth modu etiketi. Backend `AUTH_SESSION_MODE` ile hizali olmali.
- `NEXT_PUBLIC_AUTH_TOKEN_TRANSPORT`: frontend auth transport etiketi. Backend `AUTH_TOKEN_TRANSPORT` ile hizali olmali.
- `NEXT_PUBLIC_ENABLE_DEMO_SESSION`: demo session UX gate'i. Launch: `false`.
- `NEXT_PUBLIC_DEV_TENANT_ID`: dev/demo tenant fallback id. Launch: aktif kullanilmamali.
- `NEXT_PUBLIC_DEV_USER_ID`: dev/demo user fallback id. Launch: aktif kullanilmamali.
- `NEXT_PUBLIC_DEV_ROLES`: dev/demo role fallback'i. Launch: aktif kullanilmamali.
- `NEXT_PUBLIC_DEV_USER_LABEL`: dev/demo user label'i. Launch: aktif kullanilmamali.
- `NEXT_PUBLIC_DEV_USER_EMAIL`: dev/demo user email'i. Launch: aktif kullanilmamali.
- `NEXT_PUBLIC_INTERNAL_ADMIN_EMAIL_ALLOWLIST`: frontend internal admin visibility allowlist. Backend ile hizali olmali.
- `NEXT_PUBLIC_INTERNAL_ADMIN_DOMAIN_ALLOWLIST`: frontend internal admin domain allowlist. Backend ile hizali olmali.
- `NEXT_PUBLIC_INTERNAL_BILLING_ADMIN_EMAIL_ALLOWLIST`: frontend billing admin allowlist. Backend ile hizali olmali.
- `NEXT_PUBLIC_INTERNAL_BILLING_ADMIN_DOMAIN_ALLOWLIST`: frontend billing admin domain allowlist. Backend ile hizali olmali.

## Worker

- `WORKER_CONCURRENCY`: ayni anda kosacak worker isi sayisi. Pilot: kuyruk hacmine gore ayarlanir.

## Ayrim kurallari

- Production/pilot runtime'da demo shortcut, demo credential ve usable `DEV_LOGIN_PASSWORD` acik kalmamalidir.
- Frontend `NEXT_PUBLIC_*` auth/runtime ayarlari backend ile birebir hizali olmalidir.
- Production/pilot runtime'da localhost callback, localhost public URL veya placeholder sender adresi kalmamalidir.
- Stripe self-serve kapaliysa Stripe variable'lari bos kalabilir; ama test/live drift launch warning olarak izlenmelidir.
- Email `resend` ile aciksa sender domain dogrulanmis olmali ve operasyon inbox'u net tanimli olmalidir.
