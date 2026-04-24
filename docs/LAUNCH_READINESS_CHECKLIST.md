# Candit Launch Readiness Checklist

Bu dokuman, launch oncesi tek "source of truth" kontrol listesi olarak kullanilir.
Amac yeni feature yazmaktan once mevcut sistemin:

- calisir durumda oldugunu
- baglantilarinin dogru oldugunu
- urun mesajinin dogru oldugunu
- panel akislarinin dogru ve guvenli oldugunu
- AI / screening / interview kalitesinin launch seviyesinde oldugunu
- admin ve operasyon yuzeylerinin gercek kullanim icin hazir oldugunu

dogrulamaktir.

Ilgili arka plan notlari icin:

- `docs/TELYX_CANDID_LAUNCH_GAP_ANALYSIS.md`
- `docs/LAUNCH_ENVIRONMENT_MATRIX.md`
- `docs/PILOT_ACCOUNT_HANDOFF_RUNBOOK.md`

## Kullanim Sekli

- Her madde `Not Started`, `In Progress`, `Blocked`, `Done` durumlarindan biriyle takip edilir.
- Her madde icin kanit istenir: ekran kaydi, screenshot, test notu, log, ya da dokuman linki.
- Bir alan launch'a dahil edilmeyecekse, "Done" yerine "Deferred from launch" olarak not dusulur.
- Domain baglamadan, Stripe/real mail/real traffic acilmadan once bu checklist en az bir tur tam gecilmelidir.

## Verification Snapshot - 2026-04-17

### Guncel local pilot verification

- [x] Tek komutla tekrar kosulabilir smoke hattı eklendi.
  - Komut:
    - `corepack pnpm smoke:pilot`
  - Kapsam:
    - API health
    - web root
    - auth signup + session
    - auth logout + relogin
    - recruiter dashboard / jobs / candidates / applications / team / interviews / settings / subscription / ai-support sayfa yukleme
    - recruiter overview
    - AI support center
    - provider/infrastructure readiness
    - scheduling provider catalog + fallback
    - job secimi / yoksa olusturma
    - jobs list + draft create/edit/archive
    - candidate create
    - candidates list + detail
    - CV upload + parse
    - application create
    - applications list + detail
    - application stage transition + stage filter
    - recruiter entity detail page yukleme (`/jobs/:id`, `/candidates/:id`, `/applications/:id`)
    - fit score tetikleme + worker sonucu
    - interview invite
    - public interview start + cevap
    - recruiter karari kaydetme
    - karar bildirimi / dossier governance gorunurlugu
    - application dossier governance + transcript visibility
- [x] Launch-kritik contract verification lane eklendi.
  - Komut:
    - `corepack pnpm launch:verify:contracts`
  - Kapsam:
    - production runtime hardening
    - human-approved decision / reject / reminder / re-invite contractleri
    - duplicate candidate provenance enrichment
    - public interview consent gate
    - decision event -> candidate email baglantisi
    - CSV intake / source parsing
    - report minimum evidence validator
- [x] Recruiter settings ekraninda launch boundary gorunurlugu eklendi.
  - Yeni durum:
    - e-posta, billing, voice, auth ve scheduling provider'lari `hazir / pilot / kurulum gerekli / V1 disi` olarak gorunuyor
    - `ZOOM` ve `MICROSOFT_CALENDAR` recruiter tarafinda da launch disi olarak acik isaretleniyor
    - dahili meeting link fallback'i guvenli varsayilan yol olarak gorunuyor
- [x] Recruiter settings icinde tenant-bazli baglanti kurulumu gorunurlugu eklendi.
  - Yeni durum:
    - `Google Calendar` ve `Google Meet` icin gercek connection kaydi, scheduling katalog durumu ve OAuth callback sonucu ayni panelde gorunuyor
    - cookie tabanli JWT runtime disinda OAuth connect butonlari bilincli sekilde pasif/uyari modunda kaliyor
    - `Google Meet` ayrica ayri OAuth varmis gibi sunulmuyor; Google Calendar credential tabaniyla acikca iliskilendiriliyor
- [x] Public auth yuzeyi V1 launch sinirlarini daha acik gosteriyor.
  - Yeni durum:
    - `GET /v1/auth/providers` artik `enterpriseSso` durumunu da donuyor
    - `login` ve `signup` ekranlari Enterprise SSO / OIDC'nin V1 kapsaminda olmadigini acikca belirtiyor
- [x] Launch warning yuzeyi test/prod credential driftini daha erken yakaliyor.
  - Yeni durum:
    - recruiter `Settings` icinde runtime kaynakli `Launch uyarilari` paneli var
    - production ortaminda `EMAIL_PROVIDER=console`, `sk_test_...` Stripe key ve localhost OAuth redirect URI gibi riskler gorunur hale geliyor
    - bu warning'ler contract verification icinde de kapsaniyor
- [x] Subscription sayfasi self-serve billing readiness durumunu acikca gosteriyor.
  - Yeni durum:
    - `Subscription` yuzeyi `Stripe self-serve hazir / sales-led pilot / test modu` ayrimini acikca gosteriyor
    - production runtime'da self-serve billing hazir degilse plan degistirme, add-on satin alma ve portal/iptal aksiyonlari proaktif olarak bloklaniyor
    - billing launch warning'leri ayni ekranda gorunur hale geliyor
- [x] Launch disi meeting provider secimleri sessiz fallback yerine acik neden ile bloklaniyor.
  - Yeni durum:
    - `ZOOM` ve `MICROSOFT_CALENDAR` explicit secilirse API acikca reddediyor
    - `GOOGLE_*` provider secimi aktif tenant baglantisi olmadan devam etmiyor
    - explicit secim basarisizsa sistem baska provider'a sessizce kaymiyor; neden recruiter tarafina geri donuyor
- [x] Recruiter cekirdek akis local ortamda uctan uca dogrulandi.
  - Olusan akis:
    - aday olustur
    - basvuru olustur
    - screening/fitscore kuyruğa ver
    - AI mulakat daveti olustur
    - public candidate session baslat
    - readiness + ilk cevap gonder
    - public interview tamamla
    - report + recommendation olusumunu dogrula
  - Son tekrar:
    - `corepack pnpm smoke:pilot`
    - sonuc: `PASS`
    - kalan warning'ler: `console` email provider ve `stripeReady=false`
  - Sertlestirme:
    - smoke signup/candidate e-postalari `+alias` yerine benzersiz local-part ile uretiliyor; trial email normalizasyonuna carpmiyor
- [x] Smoke auth zinciri tenant header gereksinimi ile hizalandi.
  - Yeni durum:
    - signup sonrasi gelen `tenantId`, tum authli smoke isteklerinde `x-tenant-id` olarak kullaniliyor
  - Etki:
    - `/auth/session` ve read-model/billing istekleri local runtime config ile uyumlu tekrar kosulabiliyor
- [x] CV upload akisi `CVFileBlob` schema drift durumuna karsi sertlestirildi.
  - Onceki sorun:
    - `CVFileBlob` tablosu eksik local/staging veritabaninda upload `500` ile dusuyordu
  - Yeni durum:
    - dosya filesystem'e yaziliyor
    - blob tablosu yoksa nested create fallback devreye giriyor
    - worker parse akisi blob relation'ini opsiyonel okuyup storage fallback ile devam ediyor
- [x] Planli `VOICE` interview olusturma da AI interview quota enforcement ile hizalandi.
  - Onceki sorun:
    - invite akisi quota kontrolluydu, `schedule()` degildi
  - Yeni durum:
    - `VOICE` modundaki planli AI mulakat da assert + usage kaydi yapiyor
- [x] Recruiter drawer icindeki sessiz UX kirigi kapatildi.
  - Onceki sorun:
    - mulakat daveti backend'de olusuyor ama drawer sonucu gostermiyordu
  - Yeni durum:
    - link ve son gecerlilik recruiter'a aninda gosteriliyor
- [x] Brand asset eksigi icin temel logo mark eklendi ve public + recruiter shell icine baglandi.
  - Kaynak:
    - `/Users/nurettinerzen/Desktop/ai-interviewer/apps/web/public/brand/candit-mark.svg`
- [x] Runtime smoke tenant izolasyon proof'u ile sertlestirildi.
  - Yeni durum:
    - ikinci tenant otomatik aciliyor
    - farkli tenant header ile session yukleme `403` veriyor
    - farkli tenant token ile recruiter candidate verisi `404` ile izole kaliyor
  - Komut:
    - `corepack pnpm smoke:pilot`
- [x] Password reset / owner reset gibi kritik akislara audit izi eklendi.
  - Yeni durum:
    - password reset request / completion audit log'a yaziliyor
    - owner reset invite internal admin audit ve security event izi uretiyor
    - bu davranis contract test lane icinde dogrulaniyor
- [x] Launch env ayrimi operator tarafinda gorunur hale getirildi.
  - Yeni durum:
    - `infrastructure-readiness` artik `environment` ve `environmentWarnings` alanlarini donuyor
    - frontend/backend runtime drift'i, demo session flag'i ve kullanilabilir dev login sifresi ayni payload'da gorunuyor
    - tum env variable'lar icin launch matrisi dokumani eklendi:
      - `/Users/nurettinerzen/Desktop/ai-interviewer/docs/LAUNCH_ENVIRONMENT_MATRIX.md`
- [x] Gercek email delivery launch seviyesinde konfigure edildi.
  - Mevcut durum:
    - notification provider `resend`
    - strict runtime smoke candidate-facing email provider'i `ready` olarak goruyor
  - Gerekli kanit:
    - `corepack pnpm launch:verify:runtime:strict`
- [x] Pilot tenant provisioning ve handoff script'i eklendi.
  - Komut:
    - `corepack pnpm pilot:provision --help`
  - Yeni durum:
    - tenant, owner, billing snapshot ve AI defaults tek komutta hazirlaniyor
    - yeni owner icin aktivasyon linki uretiliyor
    - `artifacts/pilot/` altina JSON + Markdown handoff ozeti yaziliyor
- [ ] Stripe self-serve billing hala hazir degil.
  - Mevcut durum:
    - `stripeReady=false`
  - Etki:
    - self-serve subscription / addon akislari pilotta kapali kalir

### Tamamlanan ilk dogrulamalar

- [x] Render API deploy ayakta ve `https://candit.onrender.com/v1/health` `200` donuyor.
- [x] Vercel frontend deploy ayakta ve ana sayfa `200` donuyor.
- [x] Public auth sayfalari `200` donuyor:
  - `/auth/login`
  - `/auth/signup`
- [x] Public marketing sayfalari `200` donuyor:
  - `/pricing`
  - `/features`
  - `/contact`
  - `/blog`
- [x] CORS, Vercel origin icin dogru cevap veriyor:
  - `Origin: https://candit-seven.vercel.app`
  - `Access-Control-Allow-Origin: https://candit-seven.vercel.app`
- [x] Public auth provider endpoint calisiyor:
  - `GET /v1/auth/providers`
  - response: `{"google":{"enabled":true},"enterpriseSso":{"enabled":false,"launchStatus":"unsupported"}}`
- [x] Supabase/Postgres baglantisi ve migration zinciri calisiyor; API Prisma ile ayaga kalkiyor.
- [x] Frontend local production build temiz geciyor.
  - Komut:
    - `corepack pnpm --filter @ai-interviewer/web build`
- [x] Public blog / integrations / changelog copy tarafinda Telyx destek/e-ticaret referanslarini temizleyen local degisiklikler repo workspace'inde mevcut.
  - Ana kaynak:
    - `/Users/nurettinerzen/Desktop/ai-interviewer/apps/web/lib/public-site-data.ts`
- [x] Canli public sayfalarda eski marka / baglam sizintisi bulunmadi.
  - Tarama yapilan canli sayfalar:
    - `/`
    - `/blog`
    - `/features`
    - `/pricing`
    - `/contact`
    - `/integrations`
    - `/changelog`
  - Aranan ifadeler:
    - `Telyx`
    - `Telix`
    - `WhatsApp`
    - `Sellerboard`
- [x] Public claim cleanup icin launch-riskli metinler local olarak yumusatildi.
  - Temizlenen riskler:
    - kanitsiz performans yuzdeleri
    - dogrulanmamis buyuk hacim sayilari
    - `Turkiye'de` veri lokasyonu iddiasi
    - `tam uyumlu` gibi kesin compliance dili
- [x] P2 public surface audit'i icin local patch set hazirlandi ve production build temiz gecti.
  - Temizlenen alanlar:
    - landing/stage yuzeyindeki kanitsiz performans dili
    - integrations sayfasindaki asiri hazirlik iddialari
    - security sayfasindaki kesin compliance / altyapi claim'leri
    - blog sayfasindaki calismayan newsletter formu
    - API docs sayfasindaki urunle alakasiz eski endpoint metinleri
  - Teknik kanit:
    - `corepack pnpm --filter @ai-interviewer/web lint`
    - `corepack pnpm --filter @ai-interviewer/web build`
  - Ana dosyalar:
    - `/Users/nurettinerzen/Desktop/ai-interviewer/apps/web/lib/public-site-data.ts`
    - `/Users/nurettinerzen/Desktop/ai-interviewer/apps/web/components/public-site.tsx`
    - `/Users/nurettinerzen/Desktop/ai-interviewer/apps/web/lib/i18n.ts`
- [x] Header tabanli staging auth smoke basarili.
  - Test edilen akıs:
    - `POST /v1/auth/signup`
    - `GET /v1/auth/session`
    - `POST /v1/auth/refresh`
    - `POST /v1/auth/logout`
  - Sonuc:
    - Signup session mode: `jwt`
    - Session: `200`
    - Refresh: `201`
    - Logout: `201`
- [x] Worker staging'de ayağa kalkiyor.
  - Gozlenen log:
    - `worker.started`
  - Runtime snapshot:
    - `databaseConfigured: true`
    - `queueName: ai-interviewer-jobs`
    - `concurrency: 4`
- [x] Yeni yuklenen CV icin parsing staging'de tekrar calisiyor.
  - Canli tekrar:
    - CV upload -> `201`
    - CV parsing -> `SUCCEEDED`
    - parsed profile kaydi olusuyor
- [x] Screening ve fit score cekirdek akisi staging'de dogrulandi.
  - Canli tekrar:
    - Screening run -> `SUCCEEDED`
    - `GET /applications/:id/fit-score/latest` gercek skor donuyor
  - Ornek sonuc:
    - `overallScore: 75`
    - `confidence: 0.596`
- [x] Tekrarli smoke tenant acilislarinda trial billing guardrail gorulebilir.
  - Davranis:
    - `PUBLISHED` job olusturma bazen `Bu e-posta adresi ücretsiz denemeyi daha önce kullandı...` ile reddediliyor
  - Uygulanan cozum:
    - smoke script bu durumda `DRAFT` job fallback ile akisa devam ediyor
- [x] P3 recruiter/admin ilk API audit'i yapildi.
  - Dogrulananlar:
    - `session`, `recruiter-overview`, `jobs`, `candidates`, `applications`, `billing/overview`, `tenant-config/runtime`, `feature-flags`, `ai-support-center` -> `200`
    - `internal-admin/dashboard` normal owner tenant icin beklenen sekilde `403`
  - Bulgu:
    - `read-models/infrastructure-readiness` canli ortamda `500` donuyordu
  - Uygulanan yerel duzeltme:
    - endpoint partial query failure durumunda `500` yerine degrade response dondurecek sekilde sertlestirildi
    - AI Support sayfasina `queryWarnings` gorunurlugu eklendi
- [x] P4/P5 review-pack zinciri staging'de canli olarak dogrulandi.
  - Canli tekrar:
    - public session `COMPLETED`
    - `reports/applications/:id` -> en az 1 rapor
    - `recommendations/applications/:id/latest` -> recommendation uretiyor
- [x] P7 rapor ekrani icin premium analytics kilidi gorunur hale getirildi.
  - Onceki sorun:
    - `time-to-hire` ve `interview-quality` Growth kilidi altinda `400` donerken UI bunu bos veri gibi gosteriyordu
  - Yeni durum:
    - rapor ekrani plan kilidini acik bir notice olarak gosteriyor
- [x] P8 ekip daveti yuzeyi seat limit guardrail'i ile hizalandi.
  - Onceki sorun:
    - free trial seat limiti doluyken davet formu aktif gorunuyor, submit sonrasi `400` donuyordu
  - Yeni durum:
    - settings > ekip sekmesinde davet butonu proaktif olarak disable ve limit mesaji gosteriliyor
- [x] P8 sourcing modu icin beta-gated gorunum iyilestirildi.
  - Onceki sorun:
    - non-admin user icin ham `403` hata gorunuyordu
  - Yeni durum:
    - kontrollu beta erisim mesaji ile acik sekilde explain ediliyor
- [x] P6 recruiter liste/detail yuzeyleri kismi veri hatalarina karsi sertlestirildi.
  - Onceki sorun:
    - `candidates`, `applications` ve `candidate detail` ekranlari yardimci endpoint'lerden biri dusunce komple hata ekranina gidiyordu
    - `jobs/[id]` icinde sourcing acma / yayinlama / arsivleme aksiyonlari hata yakalamadan sessiz patlayabiliyordu
  - Yeni durum:
    - liste/detail ekranlari ana veri varsa warning notice ile kisitli modda ayakta kaliyor
    - yeni basvuru acma alanlari gerekli veri yoksa proaktif disable oluyor
    - job detail aksiyonlari kontrollu hata mesaji uretiyor
  - Teknik kanit:
    - `corepack pnpm --filter @ai-interviewer/web lint`
    - `corepack pnpm --filter @ai-interviewer/web build`
- [x] P6 applicant drawer hizli aksiyonlari icin sessiz hata yolu kapatildi.
  - Onceki sorun:
    - job inbox drawer icinde reject/quick-action hata aldiginda recruiter'a gorunur bir hata donmuyordu
  - Yeni durum:
    - drawer icinde kontrollu hata kutusu gorunuyor; aksiyon basarisizligi sessiz kaybolmuyor
  - Teknik kanit:
    - `corepack pnpm --filter @ai-interviewer/web lint`
    - `corepack pnpm --filter @ai-interviewer/web build`
- [x] P8 owner/admin-adjacent UX icin dusuk riskli sertlestirmeler yapildi.
  - Iyilestirmeler:
    - recruiter `applications` ve `interviews` listelerinde satir tiklamalari full reload yerine client-side navigation kullaniyor
    - subscription ekraninda enterprise ilgisi icin olu buton yerine gercek contact CTA veriliyor
    - internal admin account detail icinde `SUSPENDED`, `DELETED` ve owner reset aksiyonlari artik acik onay istiyor
  - Teknik kanit:
    - `corepack pnpm --filter @ai-interviewer/web lint`
    - `corepack pnpm --filter @ai-interviewer/web build`
- [x] Sertlestirme sonrasi canli pilot smoke tekrar basarili.
  - Son tekrar:
    - signup
    - CV parse
    - fit score
    - screening
    - invite interview
    - public interview complete
    - report + recommendation
  - Kalan beklenen uyarilar:
    - `provider=console`
    - `stripeReady=false`

### Tespit edilen blocker / misconfiguration

- [x] Gecici staging auth runtime modu stabilize edildi.
  - Uygulanan gecici ayar:
    - Render: `APP_RUNTIME_MODE=development`, `AUTH_SESSION_MODE=jwt`, `AUTH_TOKEN_TRANSPORT=header`
    - Vercel: `NEXT_PUBLIC_APP_RUNTIME_MODE=development`, `NEXT_PUBLIC_AUTH_SESSION_MODE=jwt`, `NEXT_PUBLIC_AUTH_TOKEN_TRANSPORT=header`
  - Kanit:
    - `/Users/nurettinerzen/Desktop/ai-interviewer/apps/api/src/config/runtime-config.service.ts`
    - `/Users/nurettinerzen/Desktop/ai-interviewer/apps/web/lib/auth/runtime.ts`
  - Launch notu:
    - Gercek domain/proxy hazir oldugunda tekrar `production + cookie` moduna gecilecek.
- [x] Google auth public login redirect'i staging callback'e donuyor.
  - Mevcut dogrulama:
    - `/v1/auth/google/authorize` -> `redirect_uri=https://candit.onrender.com/v1/auth/google/callback`
- [x] Google OAuth redirect mismatch pilot boundary ile neutralize edildi.
  - Yeni durum:
    - production/pilot runtime'da `GOOGLE_AUTH_ENABLED=false` ve `GOOGLE_SCHEDULING_ENABLED=false` varsayilani ile Google login ve Google scheduling yuzeyleri bilincli sekilde kapali
    - bu sayede yetkili redirect URI tanimlanmadan recruiter veya aday kirik Google authorize akisina girmiyor
  - Tekrar acmak icin:
    - `GOOGLE_AUTH_ENABLED=true`
    - `GOOGLE_SCHEDULING_ENABLED=true`
    - Google Cloud Console icinde su URI'ler yetkili olmali:
      - `https://candit.onrender.com/v1/auth/google/callback`
      - `https://candit.onrender.com/v1/integrations/google/callback`
- [x] Integrations tarafindaki Google callback env'i staging/prod formatina getirildi.
  - Beklenen format:
    - `GOOGLE_OAUTH_REDIRECT_URI=https://candit.onrender.com/v1/integrations/google/callback`
- [x] Public contact intake endpoint'i staging'de tekrar calisir hale geldi.
  - Son dogrulama:
    - `POST /v1/public/contact` -> `201`
    - response icinde `persistence: "stored"`
  - Not:
    - Migration uygulandiktan sonra kalici inbox/persistence aktif hale geldi
- [x] Public integrations copy'sindeki takvim entegrasyonlari ve hazirlik seviyesi yeniden hizalandi.
  - Uygulanan duzeltme:
    - entegrasyon rozetleri `pilot kurulum / kontrollu erisim / degerlendirme` diline cekildi
    - takvim ve ATS yuzeyi kademeli rollout mantigina gore yeniden yazildi
- [x] API/worker ayri servis topolojisindeki CV parsing kirigi kapatildi.
  - Uygulanan cozum:
    - `CVFileBlob` relation + DB blob fallback
    - migration:
      - `20260409224500_cv_file_blob_fallback`
  - Dogrulama:
    - yeni yuklenen TXT CV parsing run'i `SUCCEEDED`
    - parsed profile olusuyor
    - screening ve fit-score akisi devam ediyor
- [x] Recruiter fit-score quick action yeni tenant icin tekrar kuyruga alinabiliyor.
  - Son dogrulama:
    - `POST /applications/:id/quick-action { action: "trigger_fit_score" }` -> `201 queued`
  - Not:
    - Worker artik tuketiyor; CV parsed profile yoksa domain hatasina dusuyor
- [x] Interview invite akisi yeni tenant icin template bagimliligindan kurtarildi.
  - Son dogrulama:
    - `POST /applications/:id/quick-action { action: "invite_interview" }` -> `201`
    - `interviewLink` ve `sessionId` donuyor
    - Public session fallback template ile aciliyor:
      - `Operasyon Varsayilan Ilk Gorusme`
- [x] Public interview runtime manual text fallback ile ilerliyor.
  - Son dogrulama:
    - `POST /interviews/public/sessions/:id/start` -> `201`
    - readiness cevabi `answerSource: "manual_text"` ile kabul ediliyor
    - ilk soru ve follow-up akisi ilerliyor
  - Not:
    - `answerSource: "text"` gecersiz; frontend/manual smoke icin `manual_text` kullanilmali
- [x] Browser tabanli interaktif smoke testi local `agent-browser` ile dogrulandi.
  - Kurulum:
    - `npx -y agent-browser install`
  - Son dogrulama:
    - desktop `http://localhost:3200/pricing`
    - mobile viewport `390x844` ile `http://localhost:3200/auth/login`
    - error overlay: `OK`
    - page errors: bos

### Bir sonraki faz

- [x] P0/P1 icinde kalan blocker'lar kapatildi.
  - Google OAuth redirect mismatch explicit launch flags ile pilot boundary'ye alindi
  - public `/integrations` sayfasi 404 yerine kontrollu pilot mesaji ile acildi
- [ ] Ardindan P2'ye gec:
  - landing page claim/copy/dogruluk kontrolu

## Durum Ozeti

### P0 - Altyapi ve deploy dogrulamasi

- [ ] Frontend Vercel deploy stabil ve tekrar deploylarda sorunsuz.
- [ ] API Render deploy stabil ve `v1/health` donuyor.
- [ ] Worker Render deploy stabil ve queue isleyebiliyor.
- [ ] Redis baglantisi dogru ve queue islemleri basarili.
- [ ] Supabase Postgres baglantisi dogru.
- [ ] Prisma migrations eksiksiz uygulanmis.
- [ ] Seed gerekiyorsa dogru yuklenmis.
- [ ] Tum environment variable'lar dokumante edildi.
- [ ] Demo/dev env'ler ile launch env'leri net ayrildi.
- [ ] Placeholder domain / localhost redirect / test value kalmadi.

### P1 - Sistem ve baglanti smoke testi

- [ ] Frontend -> API temel istekleri basarili.
- [ ] API -> DB okuma/yazma basarili.
- [ ] API -> Redis queue basarili.
- [ ] Worker -> DB basarili.
- [ ] Worker -> Redis basarili.
- [ ] Public site'dan recruiter paneline gecislerde baglanti sorunu yok.
- [ ] Auth callback URL'leri dogru.
- [ ] Public URL, API URL, callback URL, invite URL ve interview URL'leri dogru uretiliyor.
- [ ] Health/readiness endpoint'leri gercek durumu yansitiyor.

### P2 - Public site ve landing page dogrulugu

- [x] Landing page headline gercek urunle uyumlu.
- [x] Hero mesajlari abarti, yanlis vaat veya launch disi capability icermiyor.
- [x] Ozellik kartlari gercekten mevcut capability'lerle uyumlu.
- [x] CTA'ler dogru sayfaya gidiyor.
- [x] Fiyat/plan mesajlari gercek backlog ve launch planina uygun.
  - Kanit:
    - `pricing` sayfasi self-serve satin alma yerine `Pilot erisimi iste` ve `Iletisime gecin` CTA'leri gosteriyor
- [x] Mobile ve desktop gorunumu gozden gecirildi.
  - Kanit:
    - desktop browser smoke: `/pricing`
    - mobile browser smoke: `/auth/login`
- [x] Blog/solution/public sayfalarda yanlis claim yok.
- [x] Interview/AI claims gercekte calisan modlarla uyumlu.
- [x] Public forms, waitlist, contact, docs linkleri calisiyor.
- [x] Public sayfalarda copy, typo, TR/EN karismasi temizlendi.

### P3 - Recruiter panel temel akislar

- [x] Login/logout calisiyor.
- [ ] Signup / invitation / password reset akislarinda kopukluk yok.
- [x] Dashboard verileri dogru yukleniyor.
- [x] Jobs list/create/edit/archive akislari test edildi.
- [x] Candidates list/create/detail akislarinda sorun yok.
- [x] Applications list/detail/stage transition akislari calisiyor.
- [x] Read models recruiter gorunumleri beklenen veriyi donuyor.
- [x] Settings sayfasi kirmiyor.
- [x] Subscription sayfasi gercekten hazir olmayan alanlari yanlis gostermiyor.
- [ ] Tum kritik butonlar, modallar, tablolar ve filtreler gozden gecirildi.

### P4 - CV, screening, AI destek ve worker akislar

- [ ] CV upload calisiyor.
- [ ] CV parse akisi kuyruga gidiyor ve tamamlanabiliyor.
- [ ] Screening support task'i olusuyor ve sonuc uretiyor.
- [ ] Report generation task'i olusuyor ve sonuc uretiyor.
- [ ] Recommendation generation task'i olusuyor ve sonuc uretiyor.
- [ ] Retry / dead-letter davranisi kontrol edildi.
- [ ] Failed task durumlari UI'da anlasilir sekilde gorunuyor.
- [ ] Upload/storage mimarisi Render ayrik servis yapisinda dogru calisiyor.
- [ ] AI task output'lari hallucinasyon, bos cevap, format bozulmasi acisindan incelendi.
- [ ] Human approval guardrail'leri beklendigi gibi calisiyor.

### P5 - Interview runtime kalite kontrolu

- [ ] Interview invite olusturma akisi calisiyor.
- [ ] Public interview linki dogru uretiliyor.
- [ ] Session baslatma calisiyor.
- [ ] Sorular beklenen sirada ve dogru tonda soruluyor.
- [ ] Asistanin dili, aksani, konusma akisi kabul edilebilir seviyede.
- [ ] Readiness / consent / start akisi dogru.
- [ ] Transcript toplaniyor ve dogru bolumleniyor.
- [ ] Interview tamamlaninca beklenen downstream task'lar calisiyor.
- [ ] Browser speech fallback / ElevenLabs davranisi anlasilir.
- [ ] Gercek aday deneyimi icin en az bir tam mock interview kaydi alindi.

### P6 - AI kalite ve analiz dogrulugu

- [ ] Screening skorlarinin mantigi kontrol edildi.
- [ ] Recommendation gerekceleri kanit bagli ve tutarli.
- [ ] Report output formatlari recruiter icin kullanisli.
- [ ] Uyum/fit analizleri rastgele veya tehlikeli degil.
- [ ] Prompt ve output'lar Turkish-first beklentiyle uyumlu.
- [ ] Bos veri, eksik CV, eksik transcript, uyumsuz veri durumlari test edildi.
- [ ] AI cevaplarinda hukuki/riskli claim veya kesin yargi problemi yok.
- [ ] Ayni input tekrarlandiginda kalite kabul edilebilir stabilitede.
- [ ] Farkli rol tipleri ve aday profillerinde sonuc kalitesi gozden gecirildi.

### P7 - Analytics, reporting ve tasarim dogrulugu

- [ ] Dashboard metric'leri gercek DB verisiyle tutarli.
- [ ] Raporlama yuzeylerinde hesaplama hatasi yok.
- [ ] Trend/summary alanlari mantikli gorunuyor.
- [ ] Empty/loading/error state'ler tasarim olarak kabul edilebilir.
- [ ] Table, chart, KPI ve details gorunumleri tutarli.
- [ ] Data formatting, tarih, para ve adet formatlari dogru.
- [ ] UI genelinde spacing, overflow, alignment ve responsive sorunlar temizlendi.

### P8 - Admin ve internal operasyon yuzeyleri

- [ ] Admin paneline yetkisiz erisim engelleniyor.
- [ ] User list / detail / edit akislari calisiyor.
- [ ] Yeni kullanici olusturma calisiyor.
- [ ] Tenant/account duzenleme akislari calisiyor.
- [ ] Enterprise/customer olusturma ve guncelleme test edildi.
- [ ] Red alert / internal admin ekranlari beklenen veriyi gosteriyor.
- [ ] Password reset / owner reset gibi kritik akislarda audit ve guardrail var.
- [ ] Tenant isolation manuel olarak test edildi.
- [x] Internal admin public lead status degisikligi sonrasinda liste ve KPI kartlari stale kalmiyor; sayfa aktif filtrelerle yeniden yukleniyor.
- [x] Internal admin enterprise modal'i gecersiz e-posta veya sayisal limitlerle broken teklif olusturmuyor.

### P9 - Launch oncesi acilmamasi gereken entegrasyonlar

- [x] Stripe launch oncesi acilmayacaksa UI'da yanlis yonlendirme yok.
    - public pricing ve recruiter subscription yuzeyi self-serve kapaliyken guided onboarding / contact akisina yonlendiriyor
- [x] Real email gonderimi acilmadan once provider ayarlari dokumante edildi.
    - `LAUNCH_ENVIRONMENT_MATRIX.md` ve `CANDID_PILOT_LAUNCH_RUNBOOK.md` email provider ownership ve sender beklentisini acikliyor
- [x] Google / Stripe / Resend / ElevenLabs icin hangi provider'lar launch'a dahil net.
- [x] Launch disi entegrasyonlar UI'dan gizlendi, etiketlendi ya da disabled hale getirildi.
- [ ] Test credential ile prod credential karismiyor.
- [x] Subscription yuzeyinde Stripe kapaliyken kullanici sadece disabled buton gormuyor; bir sonraki mantikli aksiyona yonlendiriliyor.

### P10 - Security, privacy ve operasyon hazirligi

- [x] Secret rotation planı hazir.
    - `LAUNCH_OPERATIONS_RUNBOOK.md` icinde launch oncesi rotate edilmesi gereken tum kritik secret'lar ve sira tanimli
- [ ] Public repo / screenshot / log uzerinden sizmis secret kalmadi.
    - `corepack pnpm launch:verify:secrets` checked-in repo yuzeyini tarar; sohbet, log ve screenshot kaynakli ifsalar ayrica rotate edilmelidir
- [x] Demo shortcut / dev auth / debug modlar launch'ta kapatilacak sekilde planlandi.
    - runtime warning'leri, env matrisi ve launch-safe seed davranisi demo credential sarkmasini erken yakaliyor
- [x] Error logging / incident response / rollback adimlari dokumante edildi.
    - `LAUNCH_OPERATIONS_RUNBOOK.md` incident source, severity, containment ve rollback kurallarini topluyor
- [ ] Launch gunu icin owner, sorumlu ve go/no-go karari net.
    - owner tablosu `LAUNCH_OPERATIONS_RUNBOOK.md` icinde hazir; final isimler launch gununden once doldurulmali

## Go / No-Go Kapilari

Launch oncesi minimum "go" kosullari:

- [ ] P0 tamamen tamamlandi.
- [ ] P1 tamamen tamamlandi.
- [ ] P2 launch copy acisindan tamamlandi.
- [ ] P3 recruiter core flow smoke tamamlandi.
- [ ] P4 en az bir gercek task zinciri ile dogrulandi.
- [ ] P5 en az bir tam mock interview ile dogrulandi.
- [ ] P6 AI kalite review yapildi.
- [ ] P8 admin/tenant security kritik akislar test edildi.
- [ ] Launch disi entegrasyonlar ya kapatildi ya da bilincli sekilde ertelendi.

## Kanit Kaydi

Her checklist alanina asagidaki formatta not dusulebilir:

```md
- [ ] Jobs create/edit/archive akislari test edildi.
  Owner:
  Status:
  Evidence:
  Notes:
```

## Birlikte Yurutulecek Fazlar

Pratik calisma sirasi:

1. P0 + P1: sistem/bağlanti/dagitim dogrulamasi
2. P2: landing/public copy ve claim kontrolu
3. P3 + P8: panel ve admin yuzeyleri
4. P4 + P5 + P6: CV, screening, interview, AI kalite
5. P7 + P9 + P10: analytics, integrations, launch guvenligi
