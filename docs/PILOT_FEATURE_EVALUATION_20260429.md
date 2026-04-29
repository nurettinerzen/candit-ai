# Pilot Feature Evaluation - 2026-04-29

## Net katma değerli ve uygulanmalı

- Şirkete/pozisyona özel ilan profili
  - Neden: Aynı unvan farklı şirketlerde farklı beklenti taşır; AI ilan, screening ve mülakat kalitesinin temel girdisi budur.
  - Karar: Hemen uygulanmalı.

- İlan revizyonu ve yapılandırılmış madde girişi
  - Neden: Recruiter ekipleri ilanı tek seferde doğru yazamaz; düzenleme kabiliyeti ve madde bazlı giriş operasyonel olarak şarttır.
  - Karar: Hemen uygulanmalı.

- Rol seviyesi, görev tanımı ve yetkinlik setleri
  - Neden: Sistemi generic AI işe alım araçlarından ayıran en önemli çekirdek budur.
  - Karar: Hemen veri modeline alınmalı, UI kademeli açılmalı.

- Aday geri dönüş SLA takibi
  - Neden: Operasyonel disiplin, aday deneyimi ve ekip içi görünürlük sağlar.
  - Karar: Hemen uygulanmalı.

- Şirket profili ve logo kullanımı
  - Neden: Çoklu müşteri / çoklu marka gerçekliğinde ilan ve aday iletişimi için temel ihtiyaçtır.
  - Karar: Hemen uygulanmalı.

## Mantıklı ama ikinci fazda ele alınmalı

- Otomatik bildirim varyantları
  - Havuzda bekliyor
  - Değerlendirmeye alındı
  - Kısa listeye alındı
  - 15 gün sonunda olumsuz dönüş
  - Neden: Değer yüksek ama şablon, teslimat sağlayıcısı ve hukuk metni birlikte ele alınmalı.

- Takvim / mülakat planlama akışının recruiter takvimleriyle tam entegrasyonu
  - Neden: Değer yüksek fakat provider bağlantısı, availability ve hata yönetimi gerekir.

- Referans araştırma soru setleri
  - Neden: Güçlü operasyon değeri var; ancak başvuru ve mülakat sonrası karar akışı ile birlikte tasarlanmalı.

- Departman sözlüğünün yetkili rol tarafından yönetilmesi
  - Neden: Mantıklı, ama serbest giriş + öneri yaklaşımı ilk faz için daha düşük maliyetli.

## Dikkatle tasarlanmalı

- Tek kullanıcı ile çoklu şirket yönetimi
  - Neden: Yüksek değerli olabilir, fakat tenant / marka / veri izolasyonu seviyesinde mimari karardır.
  - Karar: Workspace genişletmesi ile tasarlanmalı; acele “etiket bazlı” çözüm önerilmez.

- KVKK açık rıza akışı
  - Neden: Hukuki risk taşır; metin, saklama, geri çekme ve ispat izi birlikte ele alınmalı.
  - Karar: Hızlı UX çözümü yerine kontrollü hukuki tasarım gerekir.

- İşe alım onay akışı
  - Neden: Şirketler arası çok değişken. Onaylayıcı rolleri, eşikler ve istisnalar netleşmeden genelleme riskli.
  - Karar: Pilot sürecinden gerçek örnek akış toplanmalı.

## Bu turda başlatılan implementasyon

- İlanlar için yapılandırılmış `jobProfile` temeli eklendi.
- Yeni ilan ve ilan düzenleme ekranı ortak form üzerinden açıldı.
- Rol seviyesi, görev maddeleri, yetkinlik setleri, değerlendirme kriterleri ve başvuru soruları ilan formuna eklendi.
- Maaşı ilanda gizleme ve aday geri dönüş SLA alanı ilan bazında eklendi.
- Şirket profilinde logo alanı açıldı.
- Başvuru listesi ve detayında SLA görünürlüğü eklendi.
