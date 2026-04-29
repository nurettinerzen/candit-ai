# Migration Guide

Bu projede local veya canlı veriyi korumak istiyorsak migration komutlarını dikkatli ayırıyoruz.

## Günlük Güvenli Akış

Mevcut veritabanına bekleyen migration'ları uygulamak için:

```bash
corepack pnpm --filter @ai-interviewer/api exec prisma migrate deploy --schema prisma/schema.prisma
```

Durumu kontrol etmek için:

```bash
corepack pnpm --filter @ai-interviewer/api exec prisma migrate status --schema prisma/schema.prisma
```

Prisma client üretmek için:

```bash
corepack pnpm db:generate
```

## Ne Zaman `migrate dev` Kullanılır?

`corepack pnpm db:migrate` bu projede `prisma migrate dev` çalıştırır.

Bu komut geliştirme sırasında yeni migration üretmek için uygundur, ama local DB drift görürse reset isteyebilir. İçinde korunması gereken veri olan DB'lerde önce `migrate status` ve `migrate deploy` tercih edilmeli.

## Veri Koruma Kuralı

Canlıya yakın veya korunması gereken DB için sırayla:

1. Yedek al.
2. `migrate status` ile bekleyen migration'ları gör.
3. Migration SQL dosyalarını kontrol et.
4. `migrate deploy` çalıştır.
5. `migrate status` ile `Database schema is up to date!` sonucunu doğrula.
6. `db:generate`, api lint ve web lint çalıştır.

## Drift Durumunda

Prisma drift bildirirse DB reset ilk seçenek olmamalı. Daha güvenli seçenekler:

```bash
corepack pnpm --filter @ai-interviewer/api exec prisma migrate resolve --schema prisma/schema.prisma --applied <migration_name>
```

veya DB'yi manuel SQL ile migration geçmişine hizalayıp ardından `migrate resolve` kullanmak.

Eğer eski bir migration dosyası değiştirilmişse, önce dosyanın neden değiştiği anlaşılmalı. Veri olan DB'de `migrate dev` ile reset onaylanmamalı.

## Bu Turda Yapılan Uygulama

Veri resetlenmeden şu migration'lar uygulandı:

```text
20260424123000_remove_calendly_provider
20260429104500_job_profile_foundation
20260429132000_operational_recruiting_foundations
```

Son doğrulama:

```text
Database schema is up to date!
```
