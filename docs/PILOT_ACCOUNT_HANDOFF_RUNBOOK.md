# Pilot Account Handoff Runbook

Bu runbook, 1-2 dis sirketi pilot icin hizli sekilde sisteme alip ilk login paketini hazirlamak icin kullanilir.

## Hedef

- Tenant'i kullanima hazir acmak
- Owner hesabi icin aktivasyon linki uretmek
- Pilot boyunca yetecek kota ve plan snapshot'ini vermek
- AI prompt/rubric default'larini bos bir tenant'ta da hazir tutmak
- Handoff ozeti ve aktivasyon linkini artifact olarak saklamak

## Komut

Dry-run:

```bash
corepack pnpm pilot:provision \
  --company-name "Acme Lojistik" \
  --owner-name "Ayse Yilmaz" \
  --owner-email "ayse@acme.com" \
  --billing-email "finance@acme.com" \
  --seats 3 \
  --active-jobs 10 \
  --candidate-processing 500 \
  --ai-interviews 100 \
  --dry-run
```

Gercek provisioning:

```bash
corepack pnpm pilot:provision \
  --company-name "Acme Lojistik" \
  --owner-name "Ayse Yilmaz" \
  --owner-email "ayse@acme.com" \
  --billing-email "finance@acme.com" \
  --seats 3 \
  --active-jobs 10 \
  --candidate-processing 500 \
  --ai-interviews 100 \
  --grant-active-jobs 5 \
  --grant-ai-interviews 50
```

Mevcut owner hesabini sifirlayarak yeni aktivasyon linki uretmek icin:

```bash
corepack pnpm pilot:provision \
  --company-name "Acme Lojistik" \
  --owner-name "Ayse Yilmaz" \
  --owner-email "ayse@acme.com" \
  --tenant-id "ten_acme-lojistik" \
  --reset-owner
```

## Script ne yapiyor

- Tenant'i olusturur veya gunceller
- `Ana Calisma Alani` workspace'ini garanti eder
- Owner hesabini olusturur veya gunceller
- Owner yeni ise aktivasyon linki uretir
- `--reset-owner` verilirse mevcut owner sifresini sifirlar ve yeni aktivasyon linki uretir
- Billing account, aktif subscription ve pilot kota snapshot'ini yazar
- Ek grant verilirse manuel quota grant olarak ekler
- Prompt template ve scoring rubric default'larini tenant'a upsert eder
- `artifacts/pilot/` altina JSON + Markdown handoff ozeti yazar

## Handoff paketi

Dis sirketle paylasilacak minimum paket:

- `activationUrl`
- Web giris adresi
- Ilk login sonrasi yapacaklari 3 adim:
  1. Sirket profilini kontrol et
  2. Ilk job'i ac
  3. Bir test adayi ekleyip screening -> interview -> report akisini dene

## Provision sonrasi operator checklist

- Owner aktivasyon linki aciliyor mu kontrol et
- Recruiter login ve tenant header dogru mu kontrol et
- En az bir job create ve candidate create dene
- CV upload + screening sonucu geliyor mu bak
- Interview invite maili ve public interview linki calisiyor mu dogrula
- Report ve recommendation recruiter ekraninda gorunuyor mu kontrol et

## Notlar

- Script varsayilan olarak mevcut owner'i durduk yere resetlemez.
- Yeni aktivasyon linki icin varsayilan inviter kullanicisi `info@candit.ai` e-postali ic ekip hesabidir.
- Artifact dosyalari onboarding mesajini hazirlamak icin dogrudan kullanilabilir.
