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
      { label: "Changelog", href: "/changelog" }
    ]
  },
  {
    title: "Çözümler",
    links: [
      { label: "E-ticaret", href: "/solutions/ecommerce" },
      { label: "Restoran", href: "/solutions/restaurant" },
      { label: "Güzellik Salonu", href: "/solutions/salon" },
      { label: "Müşteri Desteği", href: "/solutions/support" }
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
    icon: "📞",
    title: "Telefon",
    body: "Sesli AI asistan ile çağrıları karşılayın. Randevu oluşturma, bilgi verme ve yönlendirme otomatik."
  },
  {
    icon: "💬",
    title: "WhatsApp",
    body: "En çok kullanılan kanalda anında yanıt. Sipariş takibi, randevu, destek, hepsi WhatsApp üzerinden."
  },
  {
    icon: "🌐",
    title: "Web Chat",
    body: "Sitenize tek satırlık kodla entegre edin. Ziyaretçileri müşteriye çeviren akıllı sohbet."
  },
  {
    icon: "📧",
    title: "Email",
    body: "Gelen kutusunu AI ile yönetin. Otomatik taslak, akıllı sınıflandırma ve hızlı yanıt."
  }
];

export const PUBLIC_HOME_PROOF: PublicStat[] = [
  {
    value: "%85",
    label: "Daha Hızlı Yanıt Süresi",
    detail: "Müşteriler saniyeler içinde cevap alır. Bekleme süresi neredeyse sıfır."
  },
  {
    value: "7/24",
    label: "Kesintisiz Müşteri Hizmeti",
    detail: "Gece, hafta sonu, bayram, AI asistan hiç tatil yapmaz."
  },
  {
    value: "4x",
    label: "Daha Fazla Müşteri Kapasitesi",
    detail: "Aynı ekiple 4 kat daha fazla müşteriye hizmet verin."
  }
];

export const PUBLIC_HOME_STEPS: PublicStep[] = [
  {
    step: "01",
    title: "İşletmenizi tanımlayın",
    body: "SSS, bilgi tabanı ve işletme detaylarınızı yükleyin. AI asistan sizi öğrensin."
  },
  {
    step: "02",
    title: "Kanalları bağlayın",
    body: "Telefon, WhatsApp, email ve web chat, tek tıkla entegre edin. CRM bağlantısı da dahil."
  },
  {
    step: "03",
    title: "AI devreye girsin",
    body: "Müşterileriniz yazar, arar veya email atar. AI anında, doğru ve güvenli yanıt verir."
  },
  {
    step: "04",
    title: "İzleyin ve optimize edin",
    body: "Dashboard'dan tüm kanalları takip edin. Performans ve memnuniyet tek yerde."
  }
];

export const PUBLIC_FEATURE_HERO_ACTIONS: PublicAction[] = [
  { label: "Demo Talep Edin", href: "/waitlist" },
  { label: "Özellikleri Keşfedin", href: "#feature-groups", tone: "secondary" }
];

export const PUBLIC_FEATURE_GROUPS: PublicCard[] = [
  {
    title: "Çok Kanallı Destek",
    body: "Tüm iletişim kanallarınızı tek platformda yönetin.",
    bullets: ["WhatsApp Business entegrasyonu", "AI telefon görüşmeleri", "Web chat widget", "Email otomasyonu"]
  },
  {
    title: "AI Asistan",
    body: "GPT-4 tabanlı akıllı müşteri hizmeti.",
    bullets: ["Doğal dil işleme", "Bağlam anlayışı", "Çoklu dil desteği", "Sürekli öğrenme"]
  },
  {
    title: "E-ticaret Entegrasyonları",
    body: "Popüler e-ticaret platformları ile entegre çalışın.",
    bullets: ["ikas entegrasyonu", "Shopify entegrasyonu", "IdeaSoft entegrasyonu", "Ticimax entegrasyonu"]
  },
  {
    title: "Takvim Entegrasyonu",
    body: "Randevu ve rezervasyonları otomatik yönetin.",
    bullets: ["Google Calendar senkronizasyonu", "Otomatik randevu oluşturma", "Hatırlatma bildirimleri"]
  },
  {
    title: "Çoklu Dil Desteği",
    body: "16 farklı dilde müşteri hizmeti sunun.",
    bullets: ["Türkçe ve İngilizce", "Arapça, Almanca, Fransızca", "Ve daha fazlası..."]
  },
  {
    title: "Gerçek Zamanlı Dashboard",
    body: "Performansınızı anlık takip edin.",
    bullets: ["Arama istatistikleri", "Müşteri memnuniyeti", "Detaylı raporlar"]
  }
];

export const PUBLIC_FEATURE_OPERATIONS: PublicCard[] = [
  {
    title: "Dashboard ve KPI",
    body: "Günlük operasyon kararlarını destekleyen metrikleri takip edin.",
    bullets: [
      "Kanal ve niyet bazlı çözüm oranı",
      "Deflection ve handoff trendleri",
      "Geciken yanıtlar için SLA risk uyarıları",
      "Kanallar arası dağılım analizi"
    ]
  },
  {
    title: "Güvenlik ve KVKK",
    body: "Veri süreçlerinde ölçülebilir ve denetlenebilir yaklaşım.",
    bullets: [
      "Hassas işlemler için rol bazlı yetkilendirme",
      "Kritik işlemler için audit log takibi",
      "Veri minimizasyonu ve kontrollü saklama prensibi"
    ]
  },
  {
    title: "Entegrasyonlar",
    body: "İş verisini sisteme bağlayın, yanıtları güncel tutun.",
    bullets: [
      "ERP/CRM ve e-ticaret sistemlerinden veri akışı",
      "Webhook ile harici platform senkronizasyonu",
      "Hafif operasyonlar için Sheets/Takvim desteği"
    ]
  }
];

export const PUBLIC_SOLUTIONS: PublicSolution[] = [
  {
    slug: "ecommerce",
    label: "E-ticaret",
    title: "E-ticaret için AI Asistan",
    shortDescription: "Sipariş durumu, iade ve kargo süreçleri için 7/24 otomatik destek.",
    intro:
      "Sipariş durumu, iade, kargo soruları ve satış öncesi destek otomasyonu ile müşterilerinize tüm kanallardan kesintisiz hizmet verin.",
    useCases: [
      "Sipariş sorgu, ERP, Shopify veya ikas benzeri sistemlerle yanıt üretimi",
      "İade talebi toplama, form ve etiketleme akışı",
      "Kargo takip bağlantısı ve otomatik durum güncellemesi"
    ],
    highlights: [
      "Sipariş doğrulama ve güncel veri erişimi",
      "İnsan onaylı kritik işlem akışları",
      "Canlı temsilciye kontrollü handoff",
      "Çözüm oranı, handoff oranı ve SLA görünürlüğü"
    ],
    channels: ["Telefon", "WhatsApp", "Web Chat", "Email"],
    ctaTitle: "E-ticaret müşterilerinize 7/24 destek sunun",
    ctaBody: "İade, sipariş ve kargo süreçlerini tek bir AI asistanla yönetin."
  },
  {
    slug: "restaurant",
    label: "Restoran",
    title: "Restoranlar için AI Asistan",
    shortDescription: "Rezervasyon alma, menü bilgisi ve müşteri soruları için akıllı asistan.",
    intro:
      "Rezervasyon, menü ve çalışma saatleri gibi yoğun tekrar eden soruları tek merkezde çözen restoran odaklı AI deneyimi.",
    useCases: [
      "Masa rezervasyonu alma ve teyit etme",
      "Menü, fiyat ve alerjen bilgisi paylaşma",
      "Çalışma saatleri ve lokasyon yönlendirmesi"
    ],
    highlights: [
      "Yoğun servis saatlerinde yük dengeleme",
      "Telefon ve WhatsApp rezervasyon akışı",
      "Kanal bağımsız tutarlı yanıt tonu",
      "Operasyon ekipleri için görünür handoff noktaları"
    ],
    channels: ["Telefon", "WhatsApp", "Web Chat", "Email"],
    ctaTitle: "Restoran rezervasyonlarınızı otomatikleştirin",
    ctaBody: "Rezervasyon ve müşteri sorularını kesintisiz biçimde AI ile yönetin."
  },
  {
    slug: "salon",
    label: "Kuaför/Salon",
    title: "Kuaför ve Salonlar için AI Asistan",
    shortDescription: "Randevu planlama ve hizmet bilgileri için 7/24 asistan.",
    intro:
      "Online randevu, hizmet bilgisi ve hatırlatma mesajları ile salon operasyonunu hafifleten AI asistan kurgusu.",
    useCases: [
      "Online randevu oluşturma ve güncelleme",
      "Hizmet, fiyat ve uygunluk bilgisi paylaşma",
      "Hatırlatma ve iptal süreçlerini yönetme"
    ],
    highlights: [
      "Takvim senkronizasyonu ile çakışma önleme",
      "WhatsApp'tan hızlı randevu deneyimi",
      "Müşteri geçmişine göre kişiselleştirilmiş yanıtlar",
      "Hizmet yoğunluğu için planlama görünürlüğü"
    ],
    channels: ["Telefon", "WhatsApp", "Web Chat", "Email"],
    ctaTitle: "Salon randevularınızı kolaylaştırın",
    ctaBody: "Randevu alma, hatırlatma ve hizmet bilgilendirmesini tek akışta toplayın."
  },
  {
    slug: "support",
    label: "Müşteri Desteği",
    title: "Müşteri Desteği için AI Asistan",
    shortDescription: "Genel sorular ve SSS yanıtlama için akıllı destek.",
    intro:
      "SSS otomasyonu, talep oluşturma ve temsilciye kontrollü aktarım ile destek operasyonunuzu tek ekrana toplayın.",
    useCases: [
      "SSS yanıtlarını bağlamsal olarak üretme",
      "Talep açma ve önceliklendirme",
      "Yüksek güven gerektiren konularda canlı destek handoff"
    ],
    highlights: [
      "Dağınık kanal operasyonunu tek listede toplama",
      "Bekliyor, canlıda ve AI yönetiyor durum görünürlüğü",
      "Audit ve sahiplenme takibi",
      "Operasyon yöneticileri için okunabilir metrikler"
    ],
    channels: ["Telefon", "WhatsApp", "Web Chat", "Email"],
    ctaTitle: "Müşteri desteğinizi güçlendirin",
    ctaBody: "Tüm destek süreçlerini daha hızlı ve daha kontrollü hale getirin."
  }
];

export const PUBLIC_SOLUTIONS_STATS: PublicStat[] = [
  { value: "10K+", label: "Aylık Konuşma" },
  { value: "%90", label: "Otomatik Çözüm" },
  { value: "<3sn", label: "Ort. Yanıt Süresi" },
  { value: "%95", label: "Müşteri Memnuniyeti" }
];

export const PUBLIC_SOLUTIONS_ADVANTAGES: PublicCard[] = [
  {
    title: "5 Dakikada Kurulum",
    body: "Kod yazmadan, sektörünüze özel hazır şablonlarla hemen başlayın."
  },
  {
    title: "Çok Kanallı İletişim",
    body: "WhatsApp, web chat, e-posta ve sesli arama, tek panelden yönetin."
  },
  {
    title: "Akıllı Entegrasyonlar",
    body: "ikas, Shopify, Google Calendar ve daha fazlasıyla sorunsuz entegrasyon."
  },
  {
    title: "KVKK Uyumlu",
    body: "Verileriniz Türkiye'de, KVKK ve GDPR standartlarına tam uyumlu."
  }
];

export const PUBLIC_FAQ: PublicFaq[] = [
  {
    question: "Entegrasyon ne kadar sürer?",
    answer:
      "Standart kurulumlar genellikle 15-30 dakika içinde tamamlanır. Özel sistemler ve ileri eşleştirmeler 1-3 iş günü sürebilir."
  },
  {
    question: "Başlamak için hangi veriler gerekir?",
    answer:
      "En azından ürün, hizmet, politika ve sık sorulan soru içeriği ile başlanabilir. Entegrasyon bilgileri ve operasyon kuralları eklendikçe yanıt kalitesi artar."
  },
  {
    question: "AI hangi durumda insana devreder?",
    answer:
      "Kullanıcı açıkça insan desteği istediğinde, aynı konuda sistem tekrarlandığında veya yüksek güven gerektiren kritik işlemlerde kontrollü handoff devreye girer."
  },
  {
    question: "KVKK yaklaşımınız nedir?",
    answer:
      "Veri minimizasyonu, rol bazlı erişim, maskeleme, audit log ve kontrollü saklama politikaları ile KVKK ve GDPR gerekliliklerine uyum hedeflenir."
  },
  {
    question: "Paket aşımı nasıl çalışır?",
    answer:
      "Plan limitleri aşıldığında önce dahil kullanım, ardından ek paket veya kullanım bazlı ücretlendirme devreye girer."
  }
];

export const PUBLIC_PRICING_PLANS: PublicCard[] = [
  {
    badge: "15 dakika ücretsiz deneme — Kredi kartı gerekmez",
    title: "Deneme",
    body: "7 gün boyunca sınırlı yazılı kullanım ve telefon denemesi",
    meta: "Ücretsiz",
    bullets: [
      "50 yazılı etkileşim",
      "15 dk telefon görüşmesi",
      "1 eşzamanlı çağrı",
      "1 asistan",
      "Telefon",
      "WhatsApp",
      "Webchat",
      "E-posta",
      "E-ticaret entegrasyonu",
      "Google Takvim",
      "Analitik",
      "Toplu arama"
    ],
    href: "/auth/signup",
    actionLabel: "Ücretsiz Deneyin"
  },
  {
    title: "Başlangıç",
    body: "Yalnızca yazılı kanallar için aylık başlangıç paketi",
    meta: "2.499₺/ay",
    bullets: [
      "500 yazılı etkileşim",
      "5 asistan",
      "WhatsApp",
      "Webchat",
      "E-posta",
      "E-ticaret entegrasyonu",
      "Google Takvim",
      "Analitik"
    ],
    href: "/auth/signup",
    actionLabel: "Hemen Başlayın"
  },
  {
    badge: "En Popüler",
    title: "Profesyonel",
    body: "Yazılı kullanım havuzu ve ses dakikalarını birlikte sunar",
    meta: "7.499₺/ay • Aşım: 23₺/dk",
    bullets: [
      "2000 yazılı etkileşim",
      "500 dk görüşme",
      "2 eşzamanlı çağrı",
      "10 asistan",
      "Telefon",
      "WhatsApp",
      "Webchat",
      "E-posta",
      "E-ticaret entegrasyonu",
      "Google Takvim",
      "Analitik",
      "Toplu arama",
      "Özel CRM webhook entegrasyonu",
      "Öncelikli destek"
    ],
    href: "/auth/signup",
    actionLabel: "Hemen Başlayın"
  },
  {
    title: "Kurumsal",
    body: "Özel yazılı etkileşim, ses dakikası ve eşzamanlı çağrı limitleri",
    meta: "İletişime Geçin • Aşım: 23₺/dk",
    bullets: [
      "Özel yazılı etkileşim limiti",
      "Özel ses dakikası limiti",
      "5+ eşzamanlı çağrı",
      "Özel asistan limiti",
      "Telefon",
      "WhatsApp",
      "Webchat",
      "E-posta",
      "E-ticaret entegrasyonu",
      "Google Takvim",
      "Analitik",
      "Toplu arama",
      "Özel CRM webhook entegrasyonu",
      "Öncelikli destek",
      "API erişimi",
      "Özel kurulum ve destek",
      "Özel entegrasyonlar",
      "SLA garantisi"
    ],
    href: "/contact",
    actionLabel: "Bize Ulaşın"
  }
];

export const PUBLIC_PAY_AS_YOU_GO: PublicCard = {
  eyebrow: "Esnek Kullanım",
  title: "Kullandıkça Öde",
  body: "Aylık taahhüt yok. Ses dakikaları ve yazılı etkileşimler kullanım bakiyesinden düşer.",
  meta: "23₺/dk • Minimum 4 dk yükleme (92₺)",
  bullets: [
    "Telefon + yazılı kanallar dahil",
    "5 asistan",
    "2,5₺/etkileşim",
    "Bakiye süresi dolmaz"
  ],
  href: "/auth/signup",
  actionLabel: "Hemen Başlayın"
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
        title: "Konuşanabilir Yapay Zeka Yeni Standart",
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
  { step: "1", title: "Asistan Oluştur", body: "10 dakikada ilk asistanınızı oluşturun." },
  { step: "2", title: "Bilgi Tabanı Ekle", body: "Dokümanlarınızı yükleyin, AI öğrensin." },
  { step: "3", title: "Kanalları Bağla", body: "WhatsApp, email ve web chat kanallarını entegre edin." },
  { step: "4", title: "Yayına Alın", body: "Müşterilerinize hizmet vermeye başlayın." }
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
  { value: "2023", label: "Kuruluş Yılı" },
  { value: "15+", label: "Yıl İş Deneyimi" },
  { value: "4", label: "İletişim Kanalı" },
  { value: "16", label: "Desteklenen Dil" }
];

export const PUBLIC_ABOUT_STORY: PublicCard[] = [
  {
    title: "Nereden Geldik",
    body:
      "2010'dan bu yana farklı sektörlerde yazılım, e-ticaret ve dijital pazarlama alanlarında deneyim edinildi. 2023'te bu deneyim yapay zeka ile birleşerek Candit kuruldu."
  },
  {
    title: "Neden Los Angeles",
    body:
      "Candit, yapay zeka ve teknoloji ekosisteminin kalbinde, Los Angeles'ta kuruldu. Türk kuruculara sahip ekip önce Türkiye'deki KOBİ pazarında değer üretmeyi hedefledi."
  },
  {
    title: "Misyonumuz",
    body:
      "Her işletmenin büyüklüğünden bağımsız olarak 7/24 profesyonel, tutarlı ve kişiselleştirilmiş müşteri hizmeti sunabilmesini sağlamak."
  },
  {
    title: "Vizyonumuz",
    body:
      "Müşteri iletişiminin yapay zeka ile tamamen dönüştüğü, her işletmenin kurumsal kalitede hizmet verebildiği bir dünya inşa etmek."
  },
  {
    title: "Kültürümüz",
    body:
      "Küçük ama tutkulu bir ekip. Her entegrasyon, her iyileştirme ve her ürün kararı müşteri ihtiyaçlarından hareketle geliştiriliyor."
  }
];

export const PUBLIC_TEAM: PublicCard[] = [
  { title: "Nurettin Erzen", body: "Kurucu & CEO. Ürün vizyonu, iş stratejisi ve ortaklıkları yönetir." },
  { title: "Miraç Öztürk", body: "CTO. Teknik altyapı, backend mimarisi, AI pipeline ve sistem güvenliğini yönetir." },
  { title: "Davut Pehlivanlı", body: "Türkiye Operasyonları Danışmanı. Büyüme stratejisi ve satış süreçlerinde yön verir." },
  { title: "Eyüp Yorulmaz", body: "Yazılım Geliştirici. Frontend ve backend geliştirme süreçlerinde aktif rol alır." },
  { title: "Ramazan Badeli", body: "Yazılım Geliştirici. Entegrasyon geliştirme ve test süreçlerinde görev alır." },
  { title: "Merve Çınar", body: "Pazarlama & İçerik. Dijital pazarlama stratejileri ve marka iletişimini yönetir." }
];

export const PUBLIC_CONTACT_TRUST: PublicCard[] = [
  { title: "Dakikalar İçinde Kurulum", body: "Teknik bilgi gerektirmez. Hemen başlayın." },
  { title: "4 Kanal, Tek AI", body: "Telefon, WhatsApp, Chat ve Email" },
  { title: "Kurumsal Güvenlik", body: "KVKK uyumlu, verileriniz güvende" },
  { title: "Özel Destek", body: "Kurulum ve entegrasyonda yanınızdayız" }
];

export const PUBLIC_CONTACT_METRICS: PublicStat[] = [
  { value: "%85", label: "Daha hızlı yanıt" },
  { value: "7/24", label: "Kesintisiz hizmet" },
  { value: "1.8s", label: "Ort. yanıt süresi" },
  { value: "4x", label: "Daha fazla kapasite" }
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
    title: "4. Saklama / Retention / Silme Politikası",
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
      "Platform, işletmelere yapay zeka destekli müşteri iletişimi ve operasyon yönetimi sunan bir SaaS ürünüdür."
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
