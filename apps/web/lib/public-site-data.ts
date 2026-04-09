export type PublicNavLink = {
  label: string;
  href: string;
};

export type PublicAction = {
  label: string;
  href: string;
  tone?: "primary" | "secondary";
};

export type PublicStat = {
  value: string;
  label: string;
  detail?: string;
};

export type PublicStep = {
  step: string;
  title: string;
  body: string;
};

export type PublicCard = {
  eyebrow?: string;
  title: string;
  body: string;
  bullets?: string[];
  href?: string;
  actionLabel?: string;
  badge?: string;
  meta?: string;
  icon?: string;
};

export type PublicFaq = {
  question: string;
  answer: string;
};

export type PublicTimelineEntry = {
  date: string;
  version?: string;
  title: string;
  body: string;
  items: string[];
};

export type PublicLegalSection = {
  title: string;
  body: string;
};

export type PublicBlogArticle = {
  slug: string;
  category: string;
  title: string;
  date: string;
  readTime: string;
  excerpt: string;
  sections: Array<{ title: string; body: string }>;
  relatedSlugs: string[];
};

export type PublicSolution = {
  slug: string;
  label: string;
  title: string;
  shortDescription: string;
  intro: string;
  useCases: string[];
  highlights: string[];
  channels: string[];
  ctaTitle: string;
  ctaBody: string;
};

export const PUBLIC_TOP_NAV: PublicNavLink[] = [
  { label: "Özellikler", href: "/features" },
  { label: "Çözümler", href: "/solutions" },
  { label: "Fiyatlar", href: "/pricing" },
  { label: "Kaynaklar", href: "/blog" },
  { label: "İletişim", href: "/contact" }
];

export const PUBLIC_FOOTER_COLUMNS: Array<{ title: string; links: PublicNavLink[] }> = [
  {
    title: "Ürün",
    links: [
      { label: "Özellikler", href: "/features" },
      { label: "Fiyatlar", href: "/pricing" },
      { label: "Entegrasyonlar", href: "/integrations" },
      { label: "Güncellemeler", href: "/changelog" }
    ]
  },
  {
    title: "Çözümler",
    links: [
      { label: "Teknoloji", href: "/solutions/teknoloji" },
      { label: "Perakende", href: "/solutions/perakende" },
      { label: "Sağlık", href: "/solutions/saglik" },
      { label: "Finans", href: "/solutions/finans" },
      { label: "Üretim ve Lojistik", href: "/solutions/uretim-lojistik" }
    ]
  },
  {
    title: "Kaynaklar",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Yardım", href: "/help" },
      { label: "API Dokümantasyonu", href: "/docs/api" },
      { label: "Güvenlik", href: "/security" }
    ]
  },
  {
    title: "Şirket",
    links: [
      { label: "Hakkımızda", href: "/about" },
      { label: "İletişim", href: "/contact" },
      { label: "Gizlilik Politikası", href: "/privacy" },
      { label: "Kullanım Koşulları", href: "/terms" }
    ]
  }
];

export const PUBLIC_HOME_CHANNELS: PublicCard[] = [
  {
    title: "AI Mülakat",
    body: "Adaylara otomatik sesli veya yazılı mülakat uygulayın. AI yanıtları anlık analiz eder ve puanlar."
  },
  {
    title: "Ön Eleme",
    body: "CV ve başvuru bilgilerini AI ile tarayın, pozisyona uygun adayları otomatik filtreleyin."
  },
  {
    title: "Aday Yönetimi",
    body: "Tüm başvuruları tek panelden takip edin. Durum güncellemeleri ve iletişim otomatik yönetilir."
  },
  {
    title: "Analitik",
    body: "İşe alım süreci metriklerini gerçek zamanlı izleyin. Darboğazları tespit edip optimize edin."
  }
];

export const PUBLIC_HOME_PROOF: PublicStat[] = [
  {
    value: "%87",
    label: "Daha Hızlı İşe Alım",
    detail: "İşe alım sürecini otomatikleştirerek ortalama kapanma süresini %87 kısaltın."
  },
  {
    value: "7/24",
    label: "Kesintisiz Mülakat",
    detail: "AI mülakat 7 gün 24 saat aktif. Adaylar istedikleri zaman mülakata girebilir."
  },
  {
    value: "12x",
    label: "Verimlilik Artışı",
    detail: "İnsan kaynakları ekibinizin verimliliği ortalama 12 kat artar."
  }
];

export const PUBLIC_HOME_STEPS: PublicStep[] = [
  {
    step: "01",
    title: "Pozisyonu tanımlayın",
    body: "İş ilanını oluşturun, mülakat sorularını ve değerlendirme kriterlerini belirleyin."
  },
  {
    step: "02",
    title: "Adayları yönlendirin",
    body: "Mülakat linkini paylaşın veya başvuru formunuza entegre edin. Adaylar kolayca katılsın."
  },
  {
    step: "03",
    title: "AI mülakat yaptırın",
    body: "Adaylar sizin belirlediğiniz sorularla mülakata girer. AI yanıtları analiz eder ve raporlar."
  },
  {
    step: "04",
    title: "En iyi adayı seçin",
    body: "Karşılaştırmalı raporlarla en uygun adayı belirleyin ve teklifinizi iletin."
  }
];

export const PUBLIC_FEATURE_HERO_ACTIONS: PublicAction[] = [
  { label: "Hesap Oluştur", href: "/auth/signup" },
  { label: "Özellikleri Keşfedin", href: "#feature-groups", tone: "secondary" }
];

export const PUBLIC_FEATURE_GROUPS: PublicCard[] = [
  {
    title: "AI Mülakat",
    body: "Adaylarla sesli veya görüntülü AI mülakatları otomatik gerçekleştirin.",
    bullets: ["Pozisyona özel soru setleri", "Sesli ve görüntülü mülakat desteği", "Gerçek zamanlı değerlendirme", "Otomatik transkript ve özet"]
  },
  {
    title: "Ön Eleme (Screening)",
    body: "Başvuruları AI ile hızlıca tarayın, uygun adayları öne çıkarın.",
    bullets: ["CV ve başvuru formu analizi", "Pozisyon-aday uyum skoru", "Otomatik kısa liste oluşturma", "Özelleştirilebilir eleme kriterleri"]
  },
  {
    title: "Aday Değerlendirme",
    body: "Her adayı yapılandırılmış puanlama ile objektif değerlendirin.",
    bullets: ["Yetkinlik bazlı skorlama", "Teknik ve davranışsal analiz", "Karşılaştırmalı aday raporu", "Önyargı azaltma metrikleri"]
  },
  {
    title: "İş İlanı Yönetimi",
    body: "İlanlarınızı oluşturun, yayınlayın ve başvuruları tek yerden takip edin.",
    bullets: ["Hızlı ilan oluşturma şablonları", "Çoklu pozisyon yönetimi", "Başvuru havuzu takibi", "Kariyer sayfası entegrasyonu"]
  },
  {
    title: "Analitik ve Raporlama",
    body: "İşe alım sürecinizin her adımını ölçün ve optimize edin.",
    bullets: ["Mülakat performans metrikleri", "Aday dönüşüm hunisi", "Pozisyon bazlı süre analizi", "Ekip verimliliği raporları"]
  },
  {
    title: "Entegrasyonlar",
    body: "Mevcut İK araçlarınız ve takvimlerinizle sorunsuz çalışın.",
    bullets: ["Google Calendar senkronizasyonu", "ATS entegrasyonları", "Webhook ve API desteği", "Kaynak Bulma (beta)"]
  }
];

export const PUBLIC_FEATURE_OPERATIONS: PublicCard[] = [
  {
    title: "İşe Alım Dashboard'u",
    body: "Tüm işe alım sürecinizi tek ekrandan takip edin ve yönetin.",
    bullets: [
      "Pozisyon bazlı ilerleme ve doluluk oranları",
      "Mülakat tamamlanma ve değerlendirme metrikleri",
      "Aday havuzu ve pipeline görünürlüğü",
      "Ekip performansı ve SLA takibi"
    ]
  },
  {
    title: "Güvenlik ve KVKK",
    body: "Aday verilerini güvenle saklayın, KVKK ve GDPR uyumlu çalışın.",
    bullets: [
      "Rol bazlı erişim ve yetkilendirme",
      "Aday verisi maskeleme ve anonimleştirme",
      "Veri saklama süresi politikaları ve otomatik silme"
    ]
  },
  {
    title: "Aday Yönetimi",
    body: "Tüm adaylarınızı tek havuzda yönetin, geçmiş verilere kolayca erişin.",
    bullets: [
      "Merkezi aday veritabanı ve arama",
      "Aday etiketleme ve segmentasyon",
      "Geçmiş mülakat ve değerlendirme kayıtları"
    ]
  }
];

export const PUBLIC_SOLUTIONS: PublicSolution[] = [
  {
    slug: "teknoloji",
    label: "Teknoloji",
    title: "Teknoloji Sektörü İçin AI İşe Alım",
    shortDescription: "Yazılımcı, mühendis ve teknik pozisyonlarda hızlı ve doğru işe alım.",
    intro:
      "Teknik yetkinlik değerlendirmesi, kodlama becerisi analizi ve kültür uyumu skorlaması ile teknoloji sektöründe doğru adayı bulun.",
    useCases: [
      "Yazılım geliştirici teknik mülakat ve değerlendirme",
      "Mühendislik pozisyonları için yetkinlik bazlı ön eleme",
      "Toplu stajyer ve yeni mezun alımı"
    ],
    highlights: [
      "Teknik soru setleri ile derinlemesine değerlendirme",
      "Kod analizi ve problem çözme becerisi ölçümü",
      "Hızlı işe alım döngüsü ile yetenek kaybını önleme",
      "Çoklu pozisyon ve ekip bazlı pipeline yönetimi"
    ],
    channels: ["AI Mülakat", "Ön Eleme", "Analitik"],
    ctaTitle: "Teknik ekibinizi AI ile güçlendirin",
    ctaBody: "Doğru yazılımcıyı bulmak artık günler değil, saatler sürüyor."
  },
  {
    slug: "perakende",
    label: "Perakende",
    title: "Perakende Sektörü İçin AI İşe Alım",
    shortDescription: "Yüksek hacimli mağaza ve depo personeli alımını hızlandırın.",
    intro:
      "Sezonluk kampanya dönemlerinde yüzlerce başvuruyu AI ile tarayın, uygun adayları dakikalar içinde belirleyin.",
    useCases: [
      "Mağaza personeli toplu alımı ve hızlı ön eleme",
      "Sezonluk kampanya dönemi işe alım otomasyonu",
      "Bölge bazlı aday havuzu yönetimi"
    ],
    highlights: [
      "Yüksek hacimli başvurularda otomatik filtreleme",
      "Vardiya ve lokasyon uyumu kontrolü",
      "Hızlı onboarding için standart mülakat akışları",
      "Bölge müdürleri için özel raporlama"
    ],
    channels: ["AI Mülakat", "Ön Eleme", "Aday Yönetimi"],
    ctaTitle: "Perakende alımlarınızı hızlandırın",
    ctaBody: "Sezonluk işe alımları AI ile yönetin, mağazalarınız zamanında açılsın."
  },
  {
    slug: "saglik",
    label: "Sağlık",
    title: "Sağlık Sektörü İçin AI İşe Alım",
    shortDescription: "Hemşire, teknisyen ve sağlık personeli alımında hız ve uyum.",
    intro:
      "Sertifika doğrulama, vardiya uyumu ve yetkinlik değerlendirmesi ile sağlık sektörüne özel işe alım çözümleri.",
    useCases: [
      "Hemşire ve sağlık teknisyeni alımı",
      "Sertifika ve lisans uygunluk kontrolü",
      "Vardiya bazlı uygunluk değerlendirmesi"
    ],
    highlights: [
      "Sektöre özel yetkinlik soru setleri",
      "Sertifika ve belge doğrulama desteği",
      "KVKK uyumlu hassas veri yönetimi",
      "Acil pozisyonlar için hızlandırılmış süreç"
    ],
    channels: ["AI Mülakat", "Ön Eleme", "Analitik"],
    ctaTitle: "Sağlık ekibinizi doğru adaylarla tamamlayın",
    ctaBody: "Kritik sağlık pozisyonlarını AI destekli süreçle hızla doldurun."
  },
  {
    slug: "finans",
    label: "Finans",
    title: "Finans Sektörü İçin AI İşe Alım",
    shortDescription: "Bankacılık, sigorta ve fintek pozisyonlarında nitelikli aday seçimi.",
    intro:
      "Analitik düşünme, risk değerlendirme ve mevzuat bilgisi gibi kritik yetkinlikleri AI mülakat ile ölçün.",
    useCases: [
      "Bankacılık ve sigorta pozisyonları için ön eleme",
      "Fintek startup'ları için hızlı teknik değerlendirme",
      "Uyum ve mevzuat bilgisi kontrolü"
    ],
    highlights: [
      "Finansal yetkinlik ve analitik düşünme ölçümü",
      "Mevzuat ve uyum bilgisi değerlendirmesi",
      "Gizlilik odaklı aday veri yönetimi",
      "Kurumsal onay akışları ve rol bazlı erişim"
    ],
    channels: ["AI Mülakat", "Ön Eleme", "Analitik"],
    ctaTitle: "Finansal yetenekleri AI ile keşfedin",
    ctaBody: "Doğru finans profesyonelini bulmak için yapılandırılmış AI mülakatları kullanın."
  },
  {
    slug: "uretim-lojistik",
    label: "Üretim ve Lojistik",
    title: "Üretim ve Lojistik İçin AI İşe Alım",
    shortDescription: "Fabrika, depo ve saha personeli alımında ölçeklenebilir çözüm.",
    intro:
      "Yüksek hacimli mavi yaka alımlarını AI ön eleme ve standart mülakat akışlarıyla hızlandırın.",
    useCases: [
      "Üretim hattı operatörü ve teknisyen alımı",
      "Depo ve lojistik personeli toplu işe alımı",
      "Saha ekibi için bölge bazlı aday yönetimi"
    ],
    highlights: [
      "Mavi yaka pozisyonlarına özel soru setleri",
      "Fiziksel uygunluk ve vardiya tercihi kontrolü",
      "Toplu alımlarda ölçeklenebilir AI mülakat",
      "Fabrika ve depo bazlı raporlama"
    ],
    channels: ["AI Mülakat", "Ön Eleme", "Aday Yönetimi"],
    ctaTitle: "Üretim ve lojistik alımlarınızı ölçeklendirin",
    ctaBody: "Yüzlerce başvuruyu AI ile tarayın, doğru adayları saatler içinde belirleyin."
  }
];

export const PUBLIC_SOLUTIONS_STATS: PublicStat[] = [
  { value: "%70", label: "Daha Hızlı İşe Alım" },
  { value: "5K+", label: "Aylık AI Mülakat" },
  { value: "%85", label: "Ön Eleme Doğruluğu" },
  { value: "3x", label: "Daha Fazla Aday Kapasitesi" }
];

export const PUBLIC_SOLUTIONS_ADVANTAGES: PublicCard[] = [
  {
    title: "Hızlı İşe Alım Döngüsü",
    body: "AI ön eleme ve mülakat ile işe alım sürenizi %70'e kadar kısaltın."
  },
  {
    title: "Objektif Aday Değerlendirme",
    body: "Yapılandırılmış skorlama ile önyargıyı azaltın, tutarlı kararlar verin."
  },
  {
    title: "Ölçeklenebilir Alım",
    body: "Tek pozisyondan toplu alıma kadar her ölçekte AI mülakat gerçekleştirin."
  },
  {
    title: "KVKK Uyumlu",
    body: "Aday verileri Türkiye'de, KVKK ve GDPR standartlarına tam uyumlu."
  }
];

export const PUBLIC_FAQ: PublicFaq[] = [
  {
    question: "AI mülakat nasıl çalışır?",
    answer:
      "Aday, paylaşılan mülakat linkine tıklayarak görüşmeyi başlatır. AI asistan pozisyona özel soruları sırayla sorar, yanıtları gerçek zamanlı analiz eder ve detaylı bir değerlendirme raporu oluşturur."
  },
  {
    question: "Ön eleme (screening) süreci nedir?",
    answer:
      "Adayların CV ve başvuru bilgileri AI tarafından analiz edilir, pozisyon gereksinimleriyle eşleştirilir ve uygunluk skoru hesaplanır. Belirlediğiniz kriterlere göre otomatik kısa liste oluşturulur."
  },
  {
    question: "Deneme sürümünde neler var?",
    answer:
      "7 gün boyunca 1 kullanıcı, 1 aktif ilan, 25 aday ön eleme ve 3 AI mülakat hakkı ile platformu ücretsiz deneyebilirsiniz. Kredi kartı gerekmez."
  },
  {
    question: "KVKK ve veri güvenliği nasıl sağlanıyor?",
    answer:
      "Aday verileri Türkiye'de, KVKK ve GDPR standartlarına tam uyumlu şekilde saklanır. Rol bazlı erişim, veri maskeleme ve otomatik silme politikaları uygulanır."
  },
  {
    question: "Mevcut ATS sistemimle entegre olabilir mi?",
    answer:
      "Evet, REST API ve webhook desteği ile mevcut İK sistemlerinize entegre olabilirsiniz. Google Calendar, Outlook ve yaygın ATS platformları ile hazır entegrasyonlar mevcuttur."
  }
];

export const PUBLIC_PRICING_PLANS: PublicCard[] = [
  {
    badge: "7 gün ücretsiz — Kredi kartı gerekmez",
    title: "Deneme",
    body: "Platformu keşfedin. 7 gün boyunca temel özellikleri deneyin.",
    meta: "Ücretsiz",
    bullets: [
      "1 kullanıcı",
      "1 aktif ilan",
      "25 aday ön eleme",
      "3 AI mülakat",
      "Temel raporlama",
      "E-posta desteği"
    ],
    href: "/auth/signup",
    actionLabel: "Ücretsiz Deneyin"
  },
  {
    title: "Starter",
    body: "Tek recruiter ile düzenli işe alım yapan ekipler için.",
    meta: "4.499₺/ay",
    bullets: [
      "1 kullanıcı",
      "2 aktif ilan",
      "100 aday işleme",
      "15 AI mülakat",
      "Temel raporlama",
      "E-posta desteği"
    ],
    href: "/auth/signup",
    actionLabel: "Hemen Başlayın"
  },
  {
    badge: "En Popüler",
    title: "Growth",
    body: "Düzenli işe alım yapan küçük ekipler için.",
    meta: "12.999₺/ay",
    bullets: [
      "2 kullanıcı",
      "10 aktif ilan",
      "500 aday işleme",
      "50 AI mülakat",
      "Takvim entegrasyonları",
      "Gelişmiş raporlama",
      "Öncelikli destek"
    ],
    href: "/auth/signup",
    actionLabel: "Hemen Başlayın"
  },
  {
    title: "Kurumsal",
    body: "Büyük ekipler için özel kota, branded deneyim, SLA ve entegrasyonlar.",
    meta: "Özel Teklif",
    bullets: [
      "Özel kullanıcı limiti",
      "Özel aktif ilan",
      "Özel aday işleme",
      "Özel AI mülakat",
      "Takvim entegrasyonları",
      "Gelişmiş raporlama",
      "Özel onboarding + SLA"
    ],
    href: "/contact",
    actionLabel: "Bize Ulaşın"
  }
];

export const PUBLIC_PAY_AS_YOU_GO: PublicCard = {
  eyebrow: "Ek Paketler",
  title: "Planınızı Bozmadan Kapasite Artırın",
  body: "Planınızı değiştirmeden yoğun dönemlerde ek aday işleme ve AI mülakat kotası satın alın.",
  meta: "1.099₺ - 2.499₺",
  bullets: [
    "Ek aday işleme: 1.099₺ / 50 aday",
    "Ek aday işleme: 1.999₺ / 100 aday",
    "Ek AI mülakat: 1.199₺ / 10 mülakat",
    "Ek AI mülakat: 2.499₺ / 25 mülakat",
    "Mevcut plana eklenir, dönem içinde aktif olur"
  ],
  href: "/subscription",
  actionLabel: "Plana Ekle"
};

export const PUBLIC_INTEGRATION_GROUPS: Array<{ title: string; items: PublicCard[] }> = [
  {
    title: "İletişim",
    items: [
      { title: "WhatsApp Business", body: "WhatsApp Business API ile otomatik mesajlaşma", badge: "Mevcut", href: "/settings", actionLabel: "Panelde aç" },
      { title: "Gmail", body: "Google Workspace ile e-posta entegrasyonu", badge: "Mevcut", href: "/settings", actionLabel: "Panelde aç" },
      { title: "Outlook", body: "Microsoft 365 ile e-posta yönetimi", badge: "Mevcut", href: "/settings", actionLabel: "Panelde aç" }
    ]
  },
  {
    title: "E-Ticaret",
    items: [
      { title: "Shopify", body: "Global e-ticaret platformu ile tam entegrasyon", badge: "Mevcut", href: "/settings", actionLabel: "Panelde aç" },
      { title: "ikas", body: "Türkiye'nin önde gelen e-ticaret altyapısı ile sipariş ve müşteri yönetimi", badge: "Mevcut", href: "/settings", actionLabel: "Panelde aç" },
      { title: "Ticimax", body: "E-ticaret siparişlerinizi otomatik takip edin", badge: "Yakında", href: "/contact", actionLabel: "İletişime geç" },
      { title: "IdeaSoft", body: "Türkiye'nin köklü e-ticaret platformu entegrasyonu", badge: "Yakında", href: "/contact", actionLabel: "İletişime geç" }
    ]
  },
  {
    title: "CRM",
    items: [
      { title: "Custom CRM", body: "Kendi CRM sisteminizle entegrasyon", badge: "Mevcut", href: "/settings", actionLabel: "Panelde aç" },
      { title: "HubSpot", body: "Müşteri ve talep bilgilerini iki yönlü senkronize edin", badge: "Yakında", href: "/contact", actionLabel: "İletişime geç" }
    ]
  },
  {
    title: "Planlama",
    items: [
      { title: "Google Calendar", body: "Randevuları otomatik oluşturun ve yönetin", badge: "Mevcut", href: "/settings", actionLabel: "Panelde aç" }
    ]
  },
  {
    title: "Veri Entegrasyonları",
    items: [
      { title: "Webhook API", body: "Webhook API ile herhangi bir sisteme bağlanın", badge: "Mevcut", href: "/settings", actionLabel: "Panelde aç" },
      { title: "Paraşüt", body: "Fatura ve cari hesap takibi", badge: "Yakında", href: "/contact", actionLabel: "İletişime geç" }
    ]
  }
];

export const PUBLIC_BLOG_ARTICLES: PublicBlogArticle[] = [
  {
    slug: "ai-musteri-hizmetleri-gelecegi",
    category: "AI & Teknoloji",
    title: "AI ile Müşteri Hizmetlerinin Geleceği: 2026 Trendleri",
    date: "15 Mart 2026",
    readTime: "5 dk",
    excerpt:
      "Yapay zeka destekli müşteri hizmetleri hızla dönüşüyor. İşletmelerin bu değişime nasıl uyum sağlayabileceğini keşfedin.",
    sections: [
      {
        title: "Konuşabilir Yapay Zeka Yeni Standart",
        body:
          "Eskiden chatbotlar belirli anahtar kelimelere göre önceden programlanmış yanıtlar verirdi. Bugün ise büyük dil modelleri sayesinde yapay zeka asistanları doğal dilde anlama, bağlamsal yanıt üretme ve karmaşık sorunları çözme yeteneğine sahip. 2026'da konuşanabilir AI, müşteri hizmetlerinde altın standart haline geldi."
      },
      {
        title: "Omnichannel Deneyim: Tek Noktadan Yönetim",
        body:
          "Müşteriler artık tek bir kanalda kalmak istemiyor. WhatsApp'tan başlayan bir konuşmayı e-posta ile sürdürmeyi, web sitenizden başlatılan bir talebi telefonla takip etmeyi bekliyorlar. Tüm kanalların tek bir yapay zeka asistanı tarafından yönetilmesi, tutarlı deneyimin temelini oluşturuyor."
      },
      {
        title: "Proaktif Müşteri Hizmeti",
        body:
          "Reaktif yaklaşımın yerini proaktif akışlar aldı. Yapay zeka destekli sistemler müşteri davranışlarını analiz ederek potansiyel sorunları önceden tespit edebiliyor ve memnuniyeti kayda değer biçimde artırıyor."
      },
      {
        title: "İşletmeler Nasıl Uyum Sağlayabilir?",
        body:
          "Tekrarlayan görevleri belirlemek, tüm kanalları tek platformda birleştirmek, çözümü kendi verilerinizle eğitmek ve insan operatör ile yapay zeka arasında pürüzsüz bir geçiş kurmak dönüşümün temel adımlarıdır."
      }
    ],
    relatedSlugs: ["whatsapp-canli-destek-ai-handoff", "tahsilat-hatirlatma-otomasyonu", "cok-kanalli-destek-operasyonlari"]
  },
  {
    slug: "cok-kanalli-destek-operasyonlari",
    category: "Destek Operasyonları",
    title: "WhatsApp, Webchat ve E-postayı Tek Ekrandan Yönetmek Neden Fark Yaratır?",
    date: "27 Mart 2026",
    readTime: "5 dk",
    excerpt:
      "Kanallar ayrı ayrı yönetildiğinde ekipler zaman kaybediyor. Tek bir operasyon ekranının neden daha hızlı ve daha kontrollü çalıştığını anlatıyoruz.",
    sections: [
      {
        title: "Asıl Sorun Kanal Sayısı Değil, Dağınık Operasyon",
        body:
          "Kanal sayısının artması tek başına problem değildir. Problem, her kanalın ayrı inbox, ayrı takip ve ayrı sahiplenme mantığıyla ilerlemesidir. Bu da geciken yanıtlar ve tekrarlayan iş yükü yaratır."
      },
      {
        title: "Tek Ekran Ne Sağlar?",
        body:
          "Tek operasyon ekranı ekibe önce en önemli işi gösterir. Bekleyen, canlı destek isteyen, AI tarafından yönetilen ve kapanmış konuşmaları aynı listede görmek karar yorgunluğunu azaltır ve hızı artırır."
      },
      {
        title: "Handoff ve Sahiplenme Daha Temiz Çalışır",
        body:
          "Bir temsilcinin konuşmayı devralması, diğer ekip arkadaşlarının bunu anında görmesi ve çakışmanın önlenmesi için tek ekran modeli kritik avantaj sağlar."
      },
      {
        title: "Yönetim Açısından Da Daha Güçlü",
        body:
          "Hangi kanalın daha çok yük ürettiğini, nerede handoff arttığını ve ekibin hangi konularda zorlandığını tek bakışta okumak yönetim kalitesini güçlendirir."
      }
    ],
    relatedSlugs: ["whatsapp-canli-destek-ai-handoff", "tahsilat-hatirlatma-otomasyonu", "ai-musteri-hizmetleri-gelecegi"]
  },
  {
    slug: "e-ticaret-chatbot-karsilastirma",
    category: "E-ticaret",
    title: "E-ticaret İçin En İyi Chatbot Çözümleri: 2026 Karşılaştırması",
    date: "15 Şubat 2026",
    readTime: "6 dk",
    excerpt:
      "E-ticaret işletmeleri için doğru chatbot seçimini kolaylaştıran karşılaştırma çerçevesi.",
    sections: [
      {
        title: "E-ticaret Chatbotlarında Dikkat Edilmesi Gerekenler",
        body:
          "Doğal dil anlama kapasitesi, entegrasyon kolaylığı, çoklu kanal desteği, sipariş takibi yetkinliği, ölçeklenebilirlik ve maliyet yapısı seçim yaparken öne çıkan kriterlerdir."
      },
      {
        title: "Piyasadaki Genel Eğilimler",
        body:
          "Rule-based botlardan LLM destekli, bağlamsal ve entegre çözümlere geçiş hızlandı. Özellikle sipariş ve iade süreçlerini gerçek iş verisiyle bağlayabilen ürünler öne çıkıyor."
      },
      {
        title: "Candit Farkı: Yapay Zeka Öncelikli Mimari",
        body:
          "Tek ekran operasyon görünürlüğü, omnichannel deneyim ve kontrollü handoff sayesinde müşteri deneyimi ile ekip verimliliği birlikte iyileşir."
      },
      {
        title: "Doğru Çözümü Seçmek İçin Kontrol Listesi",
        body:
          "İşletmenizin kanal yoğunluğunu, entegrasyon ihtiyaçlarını, güvenlik beklentilerini ve handoff gereksinimlerini netleştirerek karar vermek seçim sürecini kolaylaştırır."
      }
    ],
    relatedSlugs: ["ai-musteri-hizmetleri-gelecegi", "whatsapp-business-api-rehberi", "whatsapp-canli-destek-ai-handoff"]
  },
  {
    slug: "tahsilat-hatirlatma-otomasyonu",
    category: "Operasyon",
    title: "Tahsilat Hatırlatmalarında Yapay Zeka ile Daha Nazik ve Sistemli Süreçler",
    date: "4 Nisan 2026",
    readTime: "6 dk",
    excerpt:
      "Tahsilat hatırlatmalarını manuel takipten çıkarıp daha düzenli, ölçülebilir ve müşteri dostu hale getirmenin yolları.",
    sections: [
      {
        title: "Manuel Takibin En Büyük Sorunu",
        body:
          "Manuel takip geciken hatırlatmalar, ton tutarsızlığı ve görünürlük kaybı üretir. Süreç kişilere bağımlı hale geldikçe tahsilat operasyonu kırılganlaşır."
      },
      {
        title: "Yapay Zeka Burada Ne Değiştirir?",
        body:
          "Yapay zeka doğru zamanı, doğru tonu ve uygun içeriği seçerek tekrarlayan tahsilat hatırlatma adımlarını standartlaştırır. Ekip ise istisna durumlara odaklanır."
      },
      {
        title: "Doğru Kanalı Seçmek",
        body:
          "Müşterinin geçmiş etkileşim alışkanlığına göre WhatsApp, e-posta veya telefon kanallarını kullanmak dönüş oranını yükseltir ve sürtünmeyi azaltır."
      },
      {
        title: "Daha Sistemli, Daha Ölçülebilir",
        body:
          "Açılma oranı, yanıt oranı, tahsilat süresi ve handoff noktaları görünür oldukça süreç daha öngörülebilir ve daha yönetilebilir hale gelir."
      }
    ],
    relatedSlugs: ["cok-kanalli-destek-operasyonlari", "whatsapp-canli-destek-ai-handoff", "ai-musteri-hizmetleri-gelecegi"]
  },
  {
    slug: "whatsapp-business-api-rehberi",
    category: "WhatsApp",
    title: "WhatsApp Business API: Eksiksiz Başlangıç Rehberi",
    date: "22 Şubat 2026",
    readTime: "6 dk",
    excerpt:
      "WhatsApp Business API’ye başlamak isteyen ekipler için temel kavramlar, adımlar ve dikkat noktaları.",
    sections: [
      {
        title: "WhatsApp Business API Nedir?",
        body:
          "WhatsApp Business API, yüksek hacimli mesajlaşma ve otomasyon ihtiyaçları için tasarlanmış kurumsal bir altyapıdır. Standart uygulamadan farklı olarak iş süreçleri ve entegrasyonlar için daha geniş imkân sağlar."
      },
      {
        title: "WhatsApp Business API'nin İşletmenize Kattığı Değer",
        body:
          "Sipariş sorguları, rezervasyon, tahsilat ve destek süreçlerinde müşterinin zaten bulunduğu kanalda hızlı yanıt vermeyi mümkün kılar."
      },
      {
        title: "Entegrasyon Adımları",
        body:
          "Hesap kurulumu, doğrulama, şablon mesajlar, webhook bağlantıları ve operasyon ekranı entegrasyonu temel kurulum basamaklarını oluşturur."
      },
      {
        title: "Başarılı Bir WhatsApp Stratejisi İçin İpuçları",
        body:
          "Ton tutarlılığı, insan desteğe geçiş kuralları, cevap süreleri ve performans ölçümü gibi konuları baştan tasarlamak başarıyı belirler."
      }
    ],
    relatedSlugs: ["whatsapp-canli-destek-ai-handoff", "ai-musteri-hizmetleri-gelecegi", "e-ticaret-chatbot-karsilastirma"]
  },
  {
    slug: "whatsapp-canli-destek-ai-handoff",
    category: "WhatsApp",
    title: "WhatsApp Desteğinde AI’dan Canlı Temsilciye Geçiş Nasıl Kurgulanır?",
    date: "8 Nisan 2026",
    readTime: "7 dk",
    excerpt:
      "Aynı konuşma içinde AI ile başlayıp gerektiğinde canlı ekibe devreden destek akışının en doğru kurgusu.",
    sections: [
      {
        title: "Handoff Yeni Sohbet Açmak Değildir",
        body:
          "Canlı destek isteyen müşteriyi yeni bir numaraya, forma veya ekrana yönlendirmek sürtünme yaratır. Doğru handoff yaklaşımı mevcut konuşmanın bağlamını korumak ve temsilcinin kaldığı yerden devam etmesini sağlamaktır."
      },
      {
        title: "AI Ne Zaman Devreden Çıkmalı?",
        body:
          "Kullanıcı açıkça insan isterse, sistem aynı konuda iki kez takılırsa veya işlem yüksek güven gerektiriyorsa canlı desteğe geçiş kritik hale gelir. Sipariş uyuşmazlıkları ve ödeme konuları buna iyi örnektir."
      },
      {
        title: "Operasyon Ekibi İçin Doğru Arayüz",
        body:
          "Bekleyen konuşmaların ayrı görünmesi, temsilcinin konuşmayı sahiplenebilmesi, ekip içi çakışmaların önlenmesi ve gerekirse konuşmanın tekrar AI'a devredilebilmesi gerekir."
      },
      {
        title: "En Sağlıklı Akış",
        body:
          "AI çözebiliyorsa devam eder, takıldığı yerde canlı desteği teklif eder, kullanıcı isterse aynı konuşma canlı ekibe geçer ve ekip işi tamamladıktan sonra gerekirse konuşma tekrar AI'a bırakılır."
      }
    ],
    relatedSlugs: ["tahsilat-hatirlatma-otomasyonu", "cok-kanalli-destek-operasyonlari", "ai-musteri-hizmetleri-gelecegi"]
  }
];

export const PUBLIC_HELP_QUICKSTART: PublicStep[] = [
  { step: "1", title: "Hesap Oluşturun", body: "Dakikalar içinde ücretsiz hesabınızı açın." },
  { step: "2", title: "Pozisyon Ekleyin", body: "İş ilanınızı ve mülakat sorularınızı tanımlayın." },
  { step: "3", title: "Mülakat Linki Paylaşın", body: "Adaylara mülakat linkini gönderin, başvurular otomatik başlasın." },
  { step: "4", title: "Sonuçları Değerlendirin", body: "AI raporlarıyla en uygun adayları hızlıca belirleyin." }
];

export const PUBLIC_HELP_TOPICS: PublicCard[] = [
  {
    title: "Entegrasyonlar",
    body: "E-ticaret, CRM ve kanal entegrasyonları",
    href: "/integrations",
    actionLabel: "Keşfet"
  },
  {
    title: "Güvenlik & Uyumluluk",
    body: "Veri güvenliği, KVKK ve GDPR uyumluluğu",
    href: "/security",
    actionLabel: "Keşfet"
  },
  {
    title: "Fiyatlandırma",
    body: "Planlar, özellikler ve fiyat karşılaştırması",
    href: "/pricing",
    actionLabel: "Keşfet"
  },
  {
    title: "Özellikler",
    body: "Tüm platform özellikleri ve yetenekleri",
    href: "/features",
    actionLabel: "Keşfet"
  }
];

export const PUBLIC_SECURITY_GROUPS: PublicCard[] = [
  {
    title: "Veri Güvenliği",
    body: "Verileriniz endüstri lideri güvenlik protokolleriyle korunur.",
    bullets: [
      "AES-256 ve TLS 1.3 ile uçtan uca şifreleme",
      "RBAC, MFA ve gelişmiş oturum yönetimi",
      "DDoS koruması ve izole ağ mimarisi"
    ]
  },
  {
    title: "Yasal Uyumluluk",
    body: "Türkiye ve Avrupa veri koruma düzenlemelerine tam uyum.",
    bullets: [
      "KVKK için VİS, açık rıza, saklama ve silme politikaları",
      "GDPR için veri taşınabilirliği, silme talebi ve DPA desteği",
      "Veri ihlali bildirim süreci ve veri minimizasyonu ilkesi"
    ]
  },
  {
    title: "AI Güvenliği",
    body: "Yapay zeka asistanı çoklu güvenlik katmanıyla korunur.",
    bullets: [
      "Müşteri verileri model eğitiminde kullanılmaz",
      "Yanıtlar politika kontrolü ve içerik filtrelemeden geçer",
      "Hassas veri maskeleme ve halüsinasyon engelleme guardrail'leri"
    ]
  },
  {
    title: "Operasyonel Güvenlik",
    body: "Sistemler 7/24 izlenir ve korunur.",
    bullets: [
      "Anomali tespitli sürekli izleme",
      "Kim, ne zaman, ne yaptı görünürlüğü için audit log",
      "Günlük yedekleme ve olay müdahale planı"
    ]
  }
];

export const PUBLIC_ABOUT_STATS: PublicStat[] = [
  { value: "2024", label: "Kuruluş Yılı" },
  { value: "50.000+", label: "Mülakat Tamamlandı" },
  { value: "200+", label: "Şirket Kullanıyor" },
  { value: "120.000+", label: "Aday Değerlendirildi" }
];

export const PUBLIC_ABOUT_STORY: PublicCard[] = [
  {
    title: "Nereden Geldik",
    body:
      "Yıllarca işe alım süreçlerindeki verimsizlikleri ve önyargıları gözlemledik. 2024'te yapay zeka teknolojisini işe alım süreçleriyle birleştirerek Candit'i kurduk."
  },
  {
    title: "Neden Los Angeles",
    body:
      "Candit, yapay zeka ve teknoloji ekosisteminin kalbinde, Los Angeles'ta kuruldu. Türk kuruculara sahip ekip önce Türkiye pazarında işe alım süreçlerini dönüştürmeyi hedefledi."
  },
  {
    title: "Misyonumuz",
    body:
      "Her şirketin büyüklüğünden bağımsız olarak adaylarını yapay zeka destekli mülakatlarla objektif, hızlı ve tutarlı şekilde değerlendirebilmesini sağlamak."
  },
  {
    title: "Vizyonumuz",
    body:
      "İşe alım süreçlerinin yapay zeka ile tamamen dönüştüğü, her şirketin en doğru adayı en kısa sürede bulabildiği bir dünya inşa etmek."
  },
  {
    title: "Kültürümüz",
    body:
      "Küçük ama tutkulu bir ekip. Her özellik, her iyileştirme ve her ürün kararı İK ekiplerinin ve adayların ihtiyaçlarından hareketle geliştiriliyor."
  }
];

export const PUBLIC_TEAM: PublicCard[] = [
  { title: "Nurettin Erzen", body: "Kurucu & CEO. Ürün vizyonu, iş stratejisi ve İK teknoloji ortaklıklarını yönetir." },
  { title: "Miraç Öztürk", body: "CTO. AI mülakat motoru, backend mimarisi, NLP pipeline ve sistem güvenliğini yönetir." },
  { title: "Davut Pehlivanlı", body: "Türkiye Operasyonları Danışmanı. Büyüme stratejisi ve kurumsal satış süreçlerinde yön verir." },
  { title: "Eyüp Yorulmaz", body: "Yazılım Geliştirici. Mülakat arayüzü ve aday deneyimi geliştirme süreçlerinde aktif rol alır." },
  { title: "Ramazan Badeli", body: "Yazılım Geliştirici. ATS entegrasyonları ve analitik modülleri geliştirme süreçlerinde görev alır." },
  { title: "Merve Çınar", body: "Pazarlama & İçerik. İK sektörüne yönelik dijital pazarlama stratejileri ve marka iletişimini yönetir." }
];

export const PUBLIC_CONTACT_TRUST: PublicCard[] = [
  { title: "Dakikalar İçinde Kurulum", body: "İlk AI mülakatınızı hemen oluşturun, teknik bilgi gerektirmez." },
  { title: "AI Destekli Mülakat", body: "Yapay zeka ile tutarlı ve objektif aday değerlendirmesi." },
  { title: "Kurumsal Güvenlik", body: "KVKK uyumlu, aday verileriniz güvende." },
  { title: "Özel Destek", body: "Kurulum, ATS entegrasyonu ve eğitimde yanınızdayız." }
];

export const PUBLIC_CONTACT_METRICS: PublicStat[] = [
  { value: "%70", label: "Daha hızlı ön eleme" },
  { value: "7/24", label: "Kesintisiz mülakat" },
  { value: "3 dk", label: "Ort. değerlendirme süresi" },
  { value: "5x", label: "Daha fazla aday kapasitesi" }
];

export const PUBLIC_CHANGELOG: PublicTimelineEntry[] = [
  {
    date: "Haziran 2026",
    version: "v0.6.0",
    title: "Arama Desteği & Yeni Diller",
    body:
      "Bilgi tabanı ve konuşma geçmişinde gelişmiş arama desteği eklendi. Portekizce, Almanca ve Fransızca dil destekleri ile global erişim genişletildi.",
    items: [
      "Yeni bilgi tabanında gelişmiş arama",
      "Yeni konuşma geçmişi arama",
      "Yeni Portekizce, Almanca ve Fransızca dil desteği",
      "Arama sonuçları sıralama algoritması iyileştirildi"
    ]
  },
  {
    date: "Mart 2026",
    version: "v0.5.0",
    title: "Çok Kanallı İletişim",
    body:
      "WhatsApp, email ve web chat tek platformda birleşti. Tüm kanallardan gelen müşteri mesajları tek panelden yönetilmeye başladı.",
    items: [
      "Yeni WhatsApp Business entegrasyonu",
      "Yeni Gmail ve Outlook email desteği",
      "Yeni web chat widget",
      "AI yanıt kalitesi iyileştirildi"
    ]
  },
  {
    date: "Şubat 2026",
    version: "v0.4.0",
    title: "E-ticaret Entegrasyonları",
    body:
      "Shopify ve ikas entegrasyonları ile sipariş takibi, iade yönetimi ve müşteri doğrulama süreçleri otomatikleştirildi.",
    items: [
      "Yeni Shopify entegrasyonu",
      "Yeni ikas entegrasyonu",
      "Yeni sipariş takibi ve iade yönetimi",
      "Müşteri doğrulama sistemi güçlendirildi"
    ]
  },
  {
    date: "Ocak 2026",
    version: "v0.3.0",
    title: "Sesli AI Asistan",
    body:
      "AI destekli sesli görüşme, takvim entegrasyonu ve toplu arama kampanyaları ile müşteri iletişimi yeni bir seviyeye taşındı.",
    items: [
      "Yeni AI sesli görüşme desteği",
      "Yeni Google Calendar entegrasyonu",
      "Yeni toplu arama kampanyaları",
      "Randevu çakışma sorunu giderildi"
    ]
  },
  {
    date: "Aralık 2025",
    version: "v0.2.0",
    title: "Dashboard & Analitik",
    body:
      "Gerçek zamanlı analitik, müşteri veri yönetimi ve takım rolleri ile işletmelerin görünürlüğü artırıldı.",
    items: [
      "Yeni gerçek zamanlı analitik dashboard",
      "Yeni müşteri veri yönetimi",
      "Yeni takım yönetimi ve roller",
      "Dark mode iyileştirmeleri"
    ]
  },
  {
    date: "Kasım 2025",
    version: "v0.1.0",
    title: "İlk Adım",
    body:
      "AI asistan oluşturma, bilgi tabanı, temel chat ve çoklu dil desteği ile yolculuğun ilk sürümü yayınlandı.",
    items: [
      "Yeni AI asistan oluşturma",
      "Yeni bilgi tabanı yönetimi",
      "Yeni temel chat desteği",
      "Yeni çoklu dil desteği"
    ]
  }
];

export const PUBLIC_PRIVACY_SECTIONS: PublicLegalSection[] = [
  {
    title: "1. Toplanan Veriler",
    body:
      "Platformu kullandığınızda hesap bilgileri, işletme bilgileri, entegrasyon verileri, iletişim verileri, kullanım logları ve otomasyon senaryoları toplanabilir."
  },
  {
    title: "2. Verilerin Kullanım Amaçları",
    body:
      "Veriler hizmeti sağlamak, entegrasyonları çalıştırmak, güvenliği korumak, teknik destek vermek ve yasal yükümlülükleri yerine getirmek amacıyla kullanılır."
  },
  {
    title: "3. Veri Koruma Mekanizmaları",
    body:
      "Şifreleme, HTTPS, OAuth 2.0, erişim kontrolleri ve düzenli güvenlik güncellemeleri ile veri güvenliği sağlanır."
  },
  {
    title: "4. Saklama ve Silme Politikası",
    body:
      "İletişim kayıtları platform üzerinden silinebilir. Hesap bilgileri hesap kapatılana kadar saklanır; bazı kayıtlar yasal gereklilikler nedeniyle daha uzun tutulabilir."
  },
  {
    title: "5. Üçüncü Taraflarla Paylaşım",
    body:
      "Entegrasyon sağlayıcıları, sesli arama ve yapay zeka servisleri, ödeme işleyiciler ve yasal zorunluluklar kapsamında sınırlı veri paylaşımı yapılabilir."
  },
  {
    title: "6. Çerezler",
    body:
      "Oturum yönetimi ve kullanıcı deneyiminin iyileştirilmesi için çerez kullanılabilir. Çerez tercihleri tarayıcı ayarlarından yönetilebilir."
  },
  {
    title: "7. Kullanıcı Hakları",
    body:
      "Erişim, düzeltme, silme, itiraz ve veri taşınabilirliği hakları için info@candit.ai üzerinden başvuru yapılabilir."
  },
  {
    title: "8. Çocukların Gizliliği",
    body:
      "Platform 18 yaş altı kullanıcılara yönelik değildir ve ebeveyn izni olmadan bilerek veri toplanmaz."
  },
  {
    title: "9. Değişiklikler",
    body:
      "Politika zaman zaman güncellenebilir. Önemli değişiklikler e-posta veya platform bildirimi ile duyurulur."
  },
  {
    title: "10. İletişim",
    body: "Gizlilik ile ilgili sorular için info@candit.ai adresine ulaşabilirsiniz."
  }
];

export const PUBLIC_TERMS_SECTIONS: PublicLegalSection[] = [
  {
    title: "1. Hizmet Tanımı",
    body:
      "Platform, işletmelere yapay zeka destekli işe alım ve mülakat yönetimi sunan bir SaaS ürünüdür."
  },
  {
    title: "2. Hesap Oluşturma ve Yetkilendirme",
    body:
      "Hesap bilgilerinin doğruluğu ve güvenliği kullanıcı sorumluluğundadır. Yetkisiz erişim şüphesi gecikmeden bildirilmelidir."
  },
  {
    title: "3. Üçüncü Taraf Entegrasyonları",
    body:
      "Google ve diğer sağlayıcılarla entegrasyon bağlandığında ilgili sağlayıcıların şartları da geçerli olabilir. Hizmet kesintilerinden platform sorumlu değildir."
  },
  {
    title: "4. Kabul Edilebilir Kullanım",
    body:
      "Yasalara aykırı, spam, dolandırıcılık veya güvenlik önlemlerini aşmaya yönelik kullanım yasaktır."
  },
  {
    title: "5. Planlar, Ücretlendirme ve Faturalandırma",
    body:
      "Aylık, yıllık veya kullanım bazlı ücretlendirme uygulanabilir. Abonelik ve iade kuralları abonelik sayfasında belirtilir."
  },
  {
    title: "6. İçerik ve Veri Sorumluluğu",
    body:
      "Platforma yüklenen içerikler, entegrasyon verileri ve asistan talimatları kullanıcı sorumluluğundadır. Yasal yükümlülüklerin yerine getirilmesi müşteriye aittir."
  },
  {
    title: "7. Fikri Mülkiyet",
    body:
      "Platformun yazılımı, arayüzü ve marka unsurları Candit.ai'ye aittir. Tersine mühendislik ve yetkisiz erişim yasaktır."
  },
  {
    title: "8. Hizmet Seviyesi ve Sorumluluk Sınırları",
    body:
      "Platform olduğu gibi sunulur; dolaylı zararlardan sorumluluk kabul edilmez ve toplam sorumluluk ilgili dönemde ödenen ücretle sınırlıdır."
  },
  {
    title: "9. Fesih ve Hesap Kapatma",
    body:
      "Hesap istenen zamanda kapatılabilir. Şartların ihlali halinde hesap askıya alınabilir veya kapatılabilir."
  },
  {
    title: "10. Değişiklikler",
    body:
      "Koşullar önceden bildirimle güncellenebilir. Platformu kullanmaya devam etmek güncel koşulların kabulü anlamına gelir."
  },
  {
    title: "11. İletişim",
    body: "Sorularınız için info@candit.ai adresine ulaşabilirsiniz."
  }
];

export function getSolutionBySlug(slug: string) {
  return PUBLIC_SOLUTIONS.find((solution) => solution.slug === slug) ?? null;
}

export function getBlogArticleBySlug(slug: string) {
  return PUBLIC_BLOG_ARTICLES.find((article) => article.slug === slug) ?? null;
}
