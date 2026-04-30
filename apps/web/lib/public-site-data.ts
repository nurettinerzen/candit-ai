import { BILLING_ADDON_CATALOG, FREE_TRIAL_DEFINITION } from "@ai-interviewer/domain";
import { buildBillingTrialSummary } from "./billing-presentation";

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

function formatTryPrice(amountCents: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(amountCents / 100);
}

const publicAddonAmounts = Object.values(BILLING_ADDON_CATALOG)
  .map((addOn) => addOn.amountCents)
  .sort((a, b) => a - b);

export const PUBLIC_SITE_BRAND_SUBTITLE = "Ön eleme, kaynak bulma ve mülakat";

export const PUBLIC_TOP_NAV: PublicNavLink[] = [
  { label: "Özellikler", href: "/features" },
  { label: "Çözümler", href: "/solutions" },
  { label: "Paketler", href: "/pricing" },
  { label: "Kaynaklar", href: "/blog" },
  { label: "İletişim", href: "/contact" }
];

export const PUBLIC_FOOTER_COLUMNS: Array<{ title: string; links: PublicNavLink[] }> = [
  {
    title: "Ürün",
    links: [
      { label: "Özellikler", href: "/features" },
      { label: "Paketler", href: "/pricing" },
      { label: "Güncellemeler", href: "/changelog" }
    ]
  },
  {
    title: "Çözümler",
    links: [
      { label: "İşe alım akışı", href: "/solutions#capabilities" },
      { label: "AI Mülakat", href: "/solutions#capabilities" },
      { label: "Ön Eleme", href: "/solutions#capabilities" },
      { label: "Aday Yönetimi", href: "/solutions#operations" },
      { label: "Analitik", href: "/solutions#operations" }
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
    body: "Tüm başvuruları tek panelden takip edin. Durum güncellemelerini ve işe alım notlarını aynı akışta yönetin."
  },
  {
    title: "Analitik",
    body: "İşe alım süreci metriklerini tek panelde izleyin. Darboğazları görünür hale getirip akışı iyileştirin."
  }
];

export const PUBLIC_HOME_PROOF: PublicStat[] = [
  {
    value: "Tutarlı",
    label: "Değerlendirme Çıktıları",
    detail: "Yapılandırılmış screening, mülakat ve rapor çıktıları ile ekip içinde ortak karar zemini oluşturun."
  },
  {
    value: "7/24",
    label: "Kesintisiz Mülakat",
    detail:
      "Uygun senaryolarda adaylar davet edilen bağlantı üzerinden süreci kendi zamanlarında tamamlayabilir."
  },
  {
    value: "Daha az",
    label: "Manuel Tekrar",
    detail: "Tekrarlayan ön eleme, özet ve raporlama adımlarını otomatikleştirerek işe alım ekibinin odağını koruyun."
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
    title: "En güçlü adayları öne çıkarın",
    body: "Karşılaştırmalı raporlarla sonraki görüşme veya teklif adımı için en uygun adayları belirleyin."
  }
];

export const PUBLIC_FEATURE_HERO_ACTIONS: PublicAction[] = [
  { label: "Ücretsiz deneme", href: "/auth/signup" },
  { label: "Özellikleri Keşfedin", href: "#feature-groups", tone: "secondary" }
];

export const PUBLIC_FEATURE_GROUPS: PublicCard[] = [
  {
    title: "AI Mülakat",
    body: "Adaylarla sesli veya yazılı AI mülakat akışlarını otomatik yürütün.",
    bullets: ["Pozisyona özel soru setleri", "Sesli ve yazılı mülakat desteği", "Gerçek zamanlı değerlendirme", "Otomatik transkript ve özet"]
  },
  {
    title: "Ön Eleme",
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
    bullets: ["Hızlı ilan oluşturma şablonları", "Çoklu pozisyon yönetimi", "Başvuru havuzu takibi", "Paylaşılabilir başvuru akışları"]
  },
  {
    title: "Analitik ve Raporlama",
    body: "İşe alım sürecinizin her adımını ölçün ve optimize edin.",
    bullets: ["Mülakat performans metrikleri", "Aday dönüşüm hunisi", "Pozisyon bazlı süre analizi", "Ekip verimliliği raporları"]
  },
  {
    title: "Aday Havuzu",
    body: "Tüm adayları merkezi havuzda yönetin, geçmiş değerlendirmelere anında erişin.",
    bullets: ["Merkezi aday veritabanı", "Geçmiş mülakat ve skorlar", "Etiketleme ve filtreleme", "Pozisyonlar arası aday paylaşımı"]
  }
];

export const PUBLIC_FEATURE_OPERATIONS: PublicCard[] = [
  {
    title: "İşe Alım Kontrol Paneli",
    body: "Tüm işe alım sürecinizi tek ekrandan takip edin ve yönetin.",
    bullets: [
      "Pozisyon bazlı ilerleme ve doluluk oranları",
      "Mülakat tamamlanma ve değerlendirme metrikleri",
      "Aday havuzu ve süreç hattı görünürlüğü",
      "Ekip performansı ve SLA takibi"
    ]
  },
  {
    title: "Güvenlik ve veri yönetişimi",
    body: "Aday verilerini erişim kontrolü, denetim izi ve veri yaşam döngüsü süreçleriyle yönetin.",
    bullets: [
      "Rol bazlı erişim ve yetkilendirme",
      "Audit log ve yönetim görünürlüğü",
      "Veri saklama ve silme süreçleri için operasyonel temel"
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
      "Çoklu pozisyon ve ekip bazlı süreç hattı yönetimi"
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
      "Sezonluk kampanya dönemlerinde yüksek hacimli başvuruları AI ile tarayın ve öncelikli adayları daha hızlı görünür hale getirin.",
    useCases: [
      "Mağaza personeli toplu alımı ve hızlı ön eleme",
      "Sezonluk kampanya dönemi işe alım otomasyonu",
      "Bölge bazlı aday havuzu yönetimi"
    ],
    highlights: [
      "Yüksek hacimli başvurularda otomatik filtreleme",
      "Vardiya ve lokasyon uyumu kontrolü",
      "Hızlı işe alıştırma için standart mülakat akışları",
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
      "Hassas veri yönetimi için operasyonel kontrol yaklaşımı",
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
  { value: "Daha hızlı", label: "İşe alım akışı" },
  { value: "Çoklu rol", label: "Desteklenen senaryolar" },
  { value: "Tutarlı", label: "Ön eleme çıktıları" },
  { value: "Ölçeklenebilir", label: "Aday kapasitesi" }
];

export const PUBLIC_SOLUTIONS_ADVANTAGES: PublicCard[] = [
  {
    title: "Hızlı İşe Alım Döngüsü",
    body: "AI ön eleme ve mülakat ile işe alım döngüsündeki tekrarları azaltın ve ekip hızını artırın."
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
    title: "Uyum Odaklı",
    body: "Aday verilerini rol bazlı erişim, denetim izi ve yaşam döngüsü kontrolleriyle yönetin."
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
      "14 gün boyunca 1 kullanıcı, 1 aktif ilan, 25 aday ön eleme ve 3 AI mülakat hakkı ile platformu ücretsiz deneyebilirsiniz. Kredi kartı gerekmez."
  },
  {
    question: "KVKK ve veri güvenliği nasıl sağlanıyor?",
    answer:
      "Platform; rol bazlı erişim, veri maskeleme, audit log ve yaşam döngüsü kontrolleriyle güvenli kullanım için tasarlanmıştır. KVKK ve GDPR süreçleri için gerekli operasyonel kontroller ekip bazında yapılandırılmalıdır."
  },
  {
    question: "Mevcut ATS sistemimle entegre olabilir mi?",
    answer:
      "İhtiyacınıza göre API ve webhook seçeneklerini birlikte değerlendirebiliriz. Uygun entegrasyon senaryoları için ekibimizle iletişime geçebilirsiniz."
  }
];

export const PUBLIC_PRICING_TRIAL_CARD: PublicCard = {
  eyebrow: "Ücretsiz deneme",
  title: "14 günlük deneme",
  body: buildBillingTrialSummary(FREE_TRIAL_DEFINITION),
  href: "/auth/signup",
  actionLabel: "Ücretsiz deneme"
};

export const PUBLIC_PAY_AS_YOU_GO: PublicCard = {
  eyebrow: "Ek Paketler",
  title: "Planınızı Bozmadan Kapasite Artırın",
  body: "Flex planda doğrudan, Starter ve Growth planda ise ek kapasite olarak kredi paketleri satın alın.",
  meta: `${formatTryPrice(publicAddonAmounts[0] ?? 0)} - ${formatTryPrice(publicAddonAmounts[publicAddonAmounts.length - 1] ?? 0)}`,
  bullets: Object.values(BILLING_ADDON_CATALOG).map(
    (addOn) => `${addOn.label}: ${formatTryPrice(addOn.amountCents)}`
  ),
  href: "/subscription",
  actionLabel: "Plana Ekle"
};

export const PUBLIC_BLOG_ARTICLES: PublicBlogArticle[] = [
  {
    slug: "ai-mulakatlarin-gelecegi",
    category: "AI İşe Alım",
    title: "AI Mülakatların Geleceği: 2026'da Neler Değişiyor?",
    date: "15 Mart 2026",
    readTime: "5 dk",
    excerpt:
      "Yapay zeka destekli mülakatlar sadece hız değil, daha tutarlı değerlendirme kalitesi de sunuyor. 2026'da öne çıkan pratikleri özetledik.",
    sections: [
      {
        title: "Yapılandırılmış Değerlendirme Yeni Standart",
        body:
          "Ekipler artık serbest biçimli notlar yerine yetkinlik bazlı, denetlenebilir ve kıyaslanabilir çıktılar istiyor. AI mülakat katmanı bu yapısal değerlendirmeyi standardize ettiği için hız kadar karar kalitesine de etki ediyor."
      },
      {
        title: "İnsan + AI Birlikte Çalışıyor",
        body:
          "Kazanan ekipler insan karar vericiyi süreçten çıkarmıyor; tekrar eden ön eleme, soru standardizasyonu ve raporlama işini AI'a bırakıp nihai kararı recruiter ve hiring manager'a bağlıyor."
      },
      {
        title: "Aday Deneyimi de Ölçülüyor",
        body:
          "Mülakat akışının netliği, erişilebilirliği, davet süresi ve dönüş hızı artık sadece operasyon metriği değil, işveren markasının bir parçası. AI destekli akışlar bu deneyimi daha tutarlı hale getiriyor."
      },
      {
        title: "Kazanan Model: Şeffaf ve Denetlenebilir Akış",
        body:
          "Sistemin hangi sinyali neden ürettiği görülebildiğinde ekiplerin güveni artıyor. Bu yüzden özet, risk, eksik bilgi ve öneri katmanlarının açıklanabilir olması kritik hale geliyor."
      }
    ],
    relatedSlugs: ["yapilandirilmis-mulakat-skorlama", "aday-deneyimi-icin-en-iyi-pratikler", "ats-entegrasyonu-ne-zaman-gerekli"]
  },
  {
    slug: "yapilandirilmis-mulakat-skorlama",
    category: "İşe Alım Operasyonları",
    title: "Yapılandırılmış Mülakat Skorlaması Neden Daha Güvenilir?",
    date: "27 Mart 2026",
    readTime: "6 dk",
    excerpt:
      "Serbest notlar yerine yapılandırılmış skor kartları kullanan ekipler neden daha hızlı ve daha savunulabilir karar alıyor?",
    sections: [
      {
        title: "Aynı Sorular, Daha Kıyaslanabilir Sonuçlar",
        body:
          "Adaylar benzer sorularla değerlendirildiğinde ekipler pozisyon bazlı sinyal kalitesini çok daha rahat okuyabiliyor. Böylece görüşme performansı kişiden kişiye değişen bir yapıya sıkışmıyor."
      },
      {
        title: "Not Kalitesi Kişiye Bağımlı Olmaktan Çıkar",
        body:
          "AI destekli skorlamada recruiter yalnızca serbest metin yazmak zorunda kalmaz. Yetkinlik, risk, eksik bilgi ve öneri katmanları hazır geldiği için değerlendirme kalitesi daha az değişken olur."
      },
      {
        title: "Denetlenebilir Karar Çerçevesi",
        body:
          "İşe alım kararının neden verildiğini açıklayabilmek kritik. Yapılandırılmış skorlar; görüşme özeti, güçlü yön, risk ve eksik bilgi başlıklarıyla bu açıklanabilirliği güçlendirir."
      },
      {
        title: "Sonuç: Daha Hızlı Kalibrasyon",
        body:
          "Hiring manager ve recruiter aynı sinyalleri aynı formatta gördüğünde kalibrasyon toplantıları kısalır, karar döngüsü hızlanır ve gereksiz tekrar mülakatlar azalır."
      }
    ],
    relatedSlugs: ["ai-mulakatlarin-gelecegi", "cv-on-eleme-skoru-nasil-okunur", "hiring-manager-ile-kalibrasyon"]
  },
  {
    slug: "cv-on-eleme-skoru-nasil-okunur",
    category: "AI İşe Alım",
    title: "CV Ön Eleme Skorunu Doğru Okumak: Recruiter İçin Pratik Çerçeve",
    date: "15 Şubat 2026",
    readTime: "6 dk",
    excerpt:
      "Skor tek başına karar değildir. CV ön eleme çıktısını hızlandırıcı olarak kullanırken hangi sinyallere bakmanız gerektiğini özetledik.",
    sections: [
      {
        title: "Skor, Bağlamla Birlikte Anlamlıdır",
        body:
          "Aynı skor iki farklı pozisyonda farklı anlam taşıyabilir. Bu yüzden ham puanın yanında deneyim kanıtı, eksik bilgi alanları ve risk notları birlikte okunmalıdır."
      },
      {
        title: "Eksik Bilgi Alanları Kritik Sinyaldir",
        body:
          "Yüksek skor ama yüksek belirsizlik, genellikle eksik veriyle oluşur. Recruiter için en verimli yaklaşım, eksik bilgi listesini takip sorularına çevirmektir."
      },
      {
        title: "Otomatik Red İçin Değil, Önceliklendirme İçin",
        body:
          "CV skoru sisteminize hız kazandırabilir; ancak nihai kararı otomatik vermek yerine hangi adayın önce inceleneceğini belirlemek için daha güvenli kullanılır."
      },
      {
        title: "Skor + Mülakat + Hiring Manager Notu",
        body:
          "En sağlıklı karar modeli, CV ön eleme çıktısını mülakat sinyali ve hiring manager değerlendirmesiyle birleştirir. Tek kaynağa dayalı kararlar yerine katmanlı doğrulama daha güçlüdür."
      }
    ],
    relatedSlugs: ["yapilandirilmis-mulakat-skorlama", "ai-mulakatlarin-gelecegi", "ats-entegrasyonu-ne-zaman-gerekli"]
  },
  {
    slug: "aday-deneyimi-icin-en-iyi-pratikler",
    category: "Operasyon",
    title: "Aday Deneyimini Bozmadan Hızlanmak İçin 5 Pratik",
    date: "4 Nisan 2026",
    readTime: "6 dk",
    excerpt:
      "Daha hızlı işe alım ile daha iyi aday deneyimi arasında seçim yapmak zorunda değilsiniz. Küçük ama etkili 5 uygulamayı derledik.",
    sections: [
      {
        title: "İlk Teması Netleştirin",
        body:
          "Başvurudan hemen sonra adayın önünde ne olacağını anlatan net bir akış güven yaratır. AI mülakat, değerlendirme süresi ve sonraki adımlar açık biçimde belirtilmelidir."
      },
      {
        title: "Bekleme Süresini Sessizlikle Geçirmeyin",
        body:
          "Adayın günlerce haber beklemesi en büyük kopuş noktalarından biridir. Küçük durum güncellemeleri bile güven duygusunu ciddi biçimde artırır."
      },
      {
        title: "Mülakat Sorularını Rol ile Uyumlu Tutun",
        body:
          "Genel geçer sorular adayın deneyimini zayıflatır. Pozisyonun gerçekten ölçmek istediği davranış ve teknik sinyallere göre soru seti özelleştirilmelidir."
      },
      {
        title: "Raporu İnsan Diline Çevirin",
        body:
          "Hiring manager tarafında okunabilir, kısa ve denetlenebilir özetler karar süresini düşürür. AI çıktısının operasyonel değeri raporun okunabilirliğiyle doğrudan ilişkilidir."
      }
    ],
    relatedSlugs: ["ai-mulakatlarin-gelecegi", "yapilandirilmis-mulakat-skorlama", "hiring-manager-ile-kalibrasyon"]
  },
  {
    slug: "ats-entegrasyonu-ne-zaman-gerekli",
    category: "Entegrasyon",
    title: "ATS Entegrasyonu Ne Zaman Gerekli, Ne Zaman Erken?",
    date: "22 Şubat 2026",
    readTime: "6 dk",
    excerpt:
      "Her ekip ilk günden karmaşık entegrasyona ihtiyaç duymaz. ATS entegrasyonunun gerçekten ne zaman değer ürettiğini anlatıyoruz.",
    sections: [
      {
        title: "İlk Kırılma Noktası: Çift Veri Girişi",
        body:
          "Recruiter ekibi aynı aday bilgisini iki farklı sisteme giriyorsa entegrasyon ihtiyacı doğmuştur. Bu noktada webhook veya temel API senaryosu ciddi zaman kazandırır."
      },
      {
        title: "Tam Kapsam Yerine Kontrollü Senaryo",
        body:
          "İlk entegrasyonun tüm süreçleri kapsaması gerekmez. Aday oluşturma, mülakat sonucu geri yazma veya durum güncelleme gibi tek bir akışla başlamak daha güvenlidir."
      },
      {
        title: "Takvim Entegrasyonu Ayrı Bir Katmandır",
        body:
          "ATS ile veri senkronizasyonu ayrı, takvim ve görüşme provisioning akışı ayrıdır. Bu iki ihtiyacın birlikte mi yoksa aşamalı mı çözüleceği baştan netleşmelidir."
      },
      {
        title: "Entegrasyonun Başarısı Teknikten Çok Operasyoneldir",
        body:
          "Alan eşlemeleri, sahiplik, hata görünürlüğü ve retry kuralları net değilse teknik entegrasyon olsa bile süreç kırılgan kalır. Operasyon tasarımı burada belirleyicidir."
      }
    ],
    relatedSlugs: ["cv-on-eleme-skoru-nasil-okunur", "ai-mulakatlarin-gelecegi", "aday-deneyimi-icin-en-iyi-pratikler"]
  },
  {
    slug: "hiring-manager-ile-kalibrasyon",
    category: "İşe Alım Operasyonları",
    title: "Hiring Manager ile Kalibrasyon Toplantıları Nasıl Kısalır?",
    date: "8 Nisan 2026",
    readTime: "7 dk",
    excerpt:
      "Hiring manager toplantıları uzuyorsa sorun çoğu zaman aday değil, sinyal formatıdır. Kalibrasyonu hızlandıran çerçeveyi paylaşıyoruz.",
    sections: [
      {
        title: "Aynı Dili Konuşmak Gerekir",
        body:
          "Recruiter ile hiring manager aynı çıktıya bakıp farklı şeyler anlıyorsa toplantı uzar. Güçlü yön, risk, eksik bilgi ve öneri başlıklarının sabit olması ortak dil yaratır."
      },
      {
        title: "Ham Notlar Yerine Karar Destek Paketi",
        body:
          "Hiring manager çoğu zaman tüm görüşme notunu okumak istemez. Kısa özet, alıntı niteliğinde kanıtlar ve net bir karar önerisi toplantı verimini ciddi biçimde artırır."
      },
      {
        title: "İtiraz Noktalarını Önceden Görünür Kılın",
        body:
          "Eksik bilgi, belirsiz sinyal veya rol uyumu riski baştan görünür olduğunda tartışma daha somut ilerler. Bu da toplantıyı uzatan soyut yorumları azaltır."
      },
      {
        title: "Sonuç: Daha Az Toplantı, Daha Net Karar",
        body:
          "Kalibrasyonun amacı daha çok konuşmak değil, daha iyi hizalanmaktır. İyi yapılandırılmış AI çıktıları sayesinde ekip daha kısa sürede daha net karar verebilir."
      }
    ],
    relatedSlugs: ["yapilandirilmis-mulakat-skorlama", "aday-deneyimi-icin-en-iyi-pratikler", "ai-mulakatlarin-gelecegi"]
  }
];

export const PUBLIC_HELP_QUICKSTART: PublicStep[] = [
  { step: "1", title: "Hesap açılışı", body: "Ücretsiz hesabınızı birkaç dakika içinde açın." },
  { step: "2", title: "Pozisyon tanımı", body: "İş ilanınızı ve mülakat sorularınızı tanımlayın." },
  { step: "3", title: "Mülakat linki", body: "Adaylara mülakat linkini gönderin, başvurular otomatik başlasın." },
  { step: "4", title: "Sonuç değerlendirme", body: "AI raporlarıyla en uygun adayları hızlıca belirleyin." }
];

export const PUBLIC_HELP_TOPICS: PublicCard[] = [
  {
    title: "Kurulum Desteği",
    body: "Başlangıç kurulumu, onboarding ve ilk akış kurulumu",
    href: "/contact",
    actionLabel: "İletişime geçin"
  },
  {
    title: "Güvenlik & Uyumluluk",
    body: "Veri güvenliği, erişim kontrolleri ve süreç yönetişimi",
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
    title: "Erişim ve Yetkilendirme",
    body: "Şirket hesabı, oturum ve rol bazlı erişim sınırlarıyla ekip içi görünürlüğü kontrol altında tutun.",
    bullets: [
      "Rol bazlı erişim sınırları",
      "JWT tabanlı oturum akışı",
      "Kritik yönetim aksiyonları için denetim izi"
    ]
  },
  {
    title: "Veri Yönetişimi",
    body: "Aday verilerinin saklanması, görünürlüğü ve yaşam döngüsü için operasyonel kontroller oluşturun.",
    bullets: [
      "Saklama ve silme politikalarını ekip bazında tanımlama",
      "Hassas veri alanları için görünürlük kararları",
      "KVKK ve GDPR süreçleri için iç operasyon sahipliği"
    ]
  },
  {
    title: "AI Güvenlik Yaklaşımı",
    body: "AI çıktıları karar desteği olarak konumlanır; nihai karar ve hassas süreçler insan onayıyla ilerler.",
    bullets: [
      "AI çıktıları recruiter kararının yerine geçmez",
      "Eksik bilgi ve risk sinyalleri görünür hale getirilir",
      "Politika, fallback ve gözden geçirme katmanlarıyla akış sertleştirilir"
    ]
  },
  {
    title: "Operasyonel İzleme",
    body: "Sistem durumu, kritik olaylar ve temel audit görünürlüğüyle operasyonel takip desteklenir.",
    bullets: [
      "Sağlık kontrolleri ve altyapı görünürlüğü",
      "Kritik olay kaydı ve yönetim takibi",
      "Operasyon checklistleriyle düzenli takip"
    ]
  }
];

export const PUBLIC_ABOUT_STATS: PublicStat[] = [
  { value: "2024", label: "Kuruluş Yılı" },
  { value: "B2B SaaS", label: "Ürün Modeli" },
  { value: "TR / EN", label: "Ürün Dili" },
  { value: "AI + Human", label: "Karar Yaklaşımı" }
];

export const PUBLIC_ABOUT_STORY: PublicCard[] = [
  {
    title: "Nereden Geldik",
    body:
      "Yıllarca işe alım süreçlerindeki verimsizlikleri ve önyargıları gözlemledik. 2024'te yapay zeka teknolojisini işe alım süreçleriyle birleştirerek Candit'i kurduk."
  },
  {
    title: "Nasıl Çalışıyoruz",
    body:
      "Candit ekibi ürün, mühendislik ve işe alım deneyimini bir araya getiren dağıtık bir çalışma modeliyle ilerler. Gerçek kullanım senaryolarından hızlı öğrenir, ürünü müşteri ihtiyaçlarına göre sürekli geliştiririz."
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
  { title: "Miraç Öztürk", body: "CTO. AI mülakat motoru, sunucu mimarisi, NLP altyapısı ve sistem güvenliğini yönetir." },
  { title: "Davut Pehlivanlı", body: "Türkiye Operasyonları Danışmanı. Büyüme stratejisi ve kurumsal satış süreçlerinde yön verir." },
  { title: "Eyüp Yorulmaz", body: "Yazılım Geliştirici. Mülakat arayüzü ve aday deneyimi geliştirme süreçlerinde aktif rol alır." },
  { title: "Ramazan Badeli", body: "Yazılım Geliştirici. ATS entegrasyonları ve analitik modülleri geliştirme süreçlerinde görev alır." },
  { title: "Merve Çınar", body: "Pazarlama & İçerik. İK sektörüne yönelik dijital pazarlama stratejileri ve marka iletişimini yönetir." }
];

export const PUBLIC_CHANGELOG: PublicTimelineEntry[] = [
  {
    date: "Haziran 2026",
    version: "v0.6.0",
    title: "Kimlik Doğrulama ve Operasyon Güncellemesi",
    body:
      "Kimlik doğrulama güvenliği, iletişim formu alımı, yönetim görünürlüğü ve olay yönetimi altyapısı güçlendirildi.",
    items: [
      "Herkese açık iletişim formu gerçek sunucuya bağlandı",
      "Yönetim potansiyel müşteri gelen kutusu açıldı",
      "Güvenlik olayı ve kritik alarm kalıcılığı eklendi",
      "Üretim ortamı kimlik doğrulama varsayılanları sertleştirildi"
    ]
  },
  {
    date: "Mart 2026",
    version: "v0.5.0",
    title: "Planlama ve Akış Sertleştirmesi",
    body:
      "Mülakat planlama tarafında temel akışlar ve yedek senaryolar güçlendirildi.",
    items: [
      "Planlama akışı güncellendi",
      "Toplantı akışı bağlamı netleştirildi",
      "Planlama ihtiyaçları için operasyon akışı güçlendirildi",
      "Yedek toplantı akışı görünür hale getirildi"
    ]
  },
  {
    date: "Şubat 2026",
    version: "v0.4.0",
    title: "Kaynak Bulma ve Aday Havuzu",
    body:
      "Aday keşfi, potansiyel aday takibi ve mevcut havuzdan yeniden değerlendirme akışları ürünün çekirdeğine eklendi.",
    items: [
      "Kaynak bulma projesi ve potansiyel aday modeli açıldı",
      "Yetenek profili kaynak katmanı eklendi",
      "Uyum skorlama ve iletişim temelleri güçlendirildi",
      "İşe alım uzmanı görünürlüğü geliştirildi"
    ]
  },
  {
    date: "Ocak 2026",
    version: "v0.3.0",
    title: "AI Mülakat Motoru",
    body:
      "AI destekli sesli ve yazılı mülakat altyapısı, transkript ve rapor katmanları ile birlikte devreye alındı.",
    items: [
      "AI sesli görüşme desteği",
      "Transkript özetleme ve rapor oluşturma",
      "Öneri ve işe alım uzmanı değerlendirme akışları",
      "Mülakat yedek akış davranışları"
    ]
  },
  {
    date: "Aralık 2025",
    version: "v0.2.0",
    title: "İşe Alım Uzmanı Paneli",
    body:
      "Kontrol paneli, ilanlar, adaylar, başvurular ve raporlar yüzeyleri tek işe alım paneli altında birleştirildi.",
    items: [
      "Genel bakış kontrol paneli",
      "İlan ve başvuru akışı",
      "Aday havuzu ve profil ekranları",
      "İlk raporlama yüzeyi"
    ]
  },
  {
    date: "Kasım 2025",
    version: "v0.1.0",
    title: "İlk Ürün Omurgası",
    body:
      "Kiracı, üye, kimlik doğrulama ve işe alım alan modelleriyle Candit'in ilk ürün omurgası kuruldu.",
    items: [
      "Şirket hesabı ve erişim modeli",
      "Kayıt / giriş / davet temelleri",
      "İlan, aday ve başvuru alan modeli",
      "İlk yönetim omurgası"
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
