// @ts-nocheck
export type SiteLocale = "tr" | "en";

export const DEFAULT_SITE_LOCALE: SiteLocale = "tr";
export const SITE_LOCALE_STORAGE_KEY = "ai_interviewer_site_locale";

const TURKISH_PHRASE_FIXES: Record<string, string> = {
  "MaviYaka AI Recruiter": "Mavi Yaka AI Recruiter",
  "Genel Bakis": "Genel Bakış",
  "Turkiye odakli": "Türkiye odaklı",
  "ise alim": "işe alım",
  "isletim paneli": "işletim paneli",
  "Yenile": "Yenile",
  "Tekrar dene": "Tekrar dene",
  "Oturum Aç": "Giriş Yap",
  "Login ekranina git": "Giriş ekranına git",
  "Header Dev Session": "Header Geliştirme Oturumu",
  "JWT Session": "JWT Oturumu",
  "Web Auth Mode": "Web Kimlik Doğrulama Modu",
  "Token Transport": "Token Taşıma",
  "Sunucu oturumu dogrulanirken panel hazirlaniyor.": "Sunucu oturumu doğrulanırken panel hazırlanıyor.",
  "AI sadece onerir ve kanit gosterir. Kritik kararlar her zaman insan onayi ile uygulanir.":
    "AI sadece önerir ve kanıt gösterir. Kritik kararlar her zaman insan onayı ile uygulanır.",
  "Yatırımcı demosu için başvuru ekranlarında AI farklı durumlarda görünür.":
    "Yatırımcı demosu için başvuru ekranlarında AI farklı durumlarda görünür.",
  "Turkiye odakli mavi yaka ve giris seviyesi rollerin yayin yonetimi.":
    "Türkiye odaklı mavi yaka ve giriş seviyesi rollerin yayın yönetimi.",
  "Aday kaydi olusturuldugunda duplicate kontrolu otomatik uygulanir.":
    "Aday kaydı oluşturulduğunda duplicate kontrolü otomatik uygulanır.",
  "Bu ekran recruiter akisinin kalbidir: aday-ilan baglama, stage yonetimi ve AI destek gorunurlugu.":
    "Bu ekran recruiter akışının kalbidir: aday-ilan bağlama, stage yönetimi ve AI destek görünürlüğü.",
  "Aday bilgileri, CV dokumanlari, parsing durumu ve bagli basvurular.":
    "Aday bilgileri, CV dokümanları, parsing durumu ve bağlı başvurular.",
  "Interview Session Merkezi": "Mülakat Oturum Merkezi",
  "Feature Flag Kontrolu": "Özellik Bayrağı Kontrolü",
  "Feature Flag Kontrolü": "Özellik Bayrağı Kontrolü",
  "Demo flag kaydı bulunamadı.": "Demo bayrak kaydı bulunamadı.",
  "AI task run kaydı bulunamadı.": "AI görev çalıştırma kaydı bulunamadı.",
  "Likely Fit Gozlemleri": "Muhtemel Uyum Gözlemleri",
  "Likely Fit Sinyalleri": "Muhtemel Uyum Sinyalleri",
  "Runtime durum": "Çalışma zamanı durumu",
  "Time to hire (ortalama)": "İşe alım süresi (ortalama)",
  "Time to hire (medyan)": "İşe alım süresi (medyan)",
  "Meeting Link": "Toplantı Bağlantısı",
  "Fallback/None": "Yedek/Yok",
  "template mevcut": "şablon mevcut",
  "template eksik (degraded)": "şablon eksik (degraded)",
  "COMPLETED session yok": "COMPLETED oturum yok",
  "Session başlatıldı.": "Oturum başlatıldı.",
  "Session tamamlandı.": "Oturum tamamlandı.",
  "Session iptal edildi.": "Oturum iptal edildi.",
  "Session yeniden planlandi.": "Oturum yeniden planlandı.",
  "Session bulunmuyor": "Oturum bulunmuyor",
  "Session yonetim yetkiniz yok.": "Oturum yönetim yetkiniz yok.",
  "Transcript yonetim yetkiniz yok.": "Transkript yönetim yetkiniz yok.",
  "Transcript kalite inceleme yetkiniz yok.": "Transkript kalite inceleme yetkiniz yok.",
  "Interview planlama yetkiniz yok.": "Mülakat planlama yetkiniz yok.",
  "Interview yeniden planlama yetkiniz yok.": "Mülakat yeniden planlama yetkiniz yok.",
  "Interview planlama basarisiz.": "Mülakat planlama başarısız.",
  "Interview yeniden planlama basarisiz.": "Mülakat yeniden planlama başarısız.",
  "Interview session planlandi.": "Mülakat oturumu planlandı.",
  "Interview tabanli": "Mülakat tabanlı",
  "Screening tabanli": "Ön eleme tabanlı",
  "CV tabanli": "CV tabanlı",
  "Interview/Report tabanli": "Mülakat/Rapor tabanlı",
  "Application ID ile filtrele": "Başvuru ID ile filtrele",
  "Transcript sessiona baglandi.": "Transkript oturuma bağlandı.",
  "Interview listesi yüklenemedi.": "Mülakat listesi yüklenemedi.",
  "Interview sessionları yükleniyor...": "Mülakat oturumları yükleniyor...",
  "Filtreye uygun interview session bulunamadı.": "Filtreye uygun mülakat oturumu bulunamadı.",
  "AI sadece destekleyici cikarim uretir. Nihai karar recruiter tarafindadir.":
    "AI sadece destekleyici çıkarım üretir. Nihai karar recruiter tarafındadır.",
  "Planlanan, devam eden ve tamamlanan mülakat sessionları tek listede görüntülenir.":
    "Planlanan, devam eden ve tamamlanan mülakat oturumları tek listede görüntülenir.",
  "AI destek akisinin ac/kapat kontrolu, son gorev durumlari ve fallback gorunurlugu.":
    "AI destek akışının aç/kapat kontrolü, son görev durumları ve fallback görünürlüğü.",
  "Recruiter kararlarinin ve AI sistem aksiyonlarinin izlenebilirligi.":
    "Recruiter kararlarının ve AI sistem aksiyonlarının izlenebilirliği.",
  "Recruiter paneli icin aktif bir oturum bulunamadi.":
    "Recruiter paneli için aktif bir oturum bulunamadı.",
  "Giris ekranina git": "Giriş ekranına git",
  "Pipeline verisi bulunamadi.": "Pipeline verisi bulunamadı.",
  "Bekleyen islem bulunmuyor.": "Bekleyen işlem bulunmuyor.",
  "Entegrasyonlar, AI durumu, altyapi ve denetim kayitlari.":
    "Entegrasyonlar, AI yapılandırması, sistem durumu ve denetim kayıtları.",
  "Sistem Ayarlari": "Ayarlar & Bağlantılar",
  "Tum Sistemler Aktif": "Tüm Sistemler Aktif",
  "Bazi Sistemlerde Sorun Var": "Bazı Sistemlerde Sorun Var",
  "Henuz entegrasyon baglantisi yok.": "Henüz entegrasyon bağlantısı yapılmamış.",
  "Google Calendar baglantisi": "Google Calendar Bağlantısı",
  "Google Calendar Bagla": "Google Calendar Bağla",
  "Google Calendar basariyla baglandi!": "Google Calendar başarıyla bağlandı!",
  "Sorular Türkçe olarak tek tek sorulur. Yanıtlarınız recruiter ekibine iletilir. Nihai kararı her zaman insan verir.":
    "Sorular Türkçe olarak tek tek sorulur. Yanıtlarınız recruiter ekibine iletilir. Nihai kararı her zaman insan verir."
};

const TURKISH_WORD_FIXES: Array<[string, string]> = [
  ["Turkiye", "Türkiye"],
  ["turkiye", "türkiye"],
  ["Bakis", "Bakış"],
  ["bakis", "bakış"],
  ["Basvuru", "Başvuru"],
  ["basvuru", "başvuru"],
  ["Basvurular", "Başvurular"],
  ["basvurular", "başvurular"],
  ["Basvurdu", "Başvurdu"],
  ["basvurdu", "başvurdu"],
  ["Basarisiz", "Başarısız"],
  ["basarisiz", "başarısız"],
  ["Baslangic", "Başlangıç"],
  ["baslangic", "başlangıç"],
  ["Baslat", "Başlat"],
  ["baslat", "başlat"],
  ["Baslati", "Başlatı"],
  ["baslati", "başlatı"],
  ["Mulakat", "Mülakat"],
  ["mulakat", "mülakat"],
  ["Gorusme", "Görüşme"],
  ["gorusme", "görüşme"],
  ["Gorev", "Görev"],
  ["gorev", "görev"],
  ["Guncelle", "Güncelle"],
  ["guncelle", "güncelle"],
  ["Guncelleniyor", "Güncelleniyor"],
  ["guncelleniyor", "güncelleniyor"],
  ["Guncelleme", "Güncelleme"],
  ["guncelleme", "güncelleme"],
  ["Yukleniyor", "Yükleniyor"],
  ["yukleniyor", "yükleniyor"],
  ["Yukleme", "Yükleme"],
  ["yukleme", "yükleme"],
  ["Yukle", "Yükle"],
  ["yukle", "yükle"],
  ["Yuklendi", "Yüklendi"],
  ["yuklendi", "yüklendi"],
  ["Yukleyen", "Yükleyen"],
  ["yukleyen", "yükleyen"],
  ["Yonetici", "Yönetici"],
  ["yonetici", "yönetici"],
  ["Oneri", "Öneri"],
  ["oneri", "öneri"],
  ["Onerir", "Önerir"],
  ["onerir", "önerir"],
  ["Ozet", "Özet"],
  ["ozet", "özet"],
  ["Ozeti", "Özeti"],
  ["ozeti", "özeti"],
  ["Olustur", "Oluştur"],
  ["olustur", "oluştur"],
  ["Olusturulma", "Oluşturulma"],
  ["olusturulma", "oluşturulma"],
  ["Olusturuluyor", "Oluşturuluyor"],
  ["olusturuluyor", "oluşturuluyor"],
  ["Olusturuldu", "Oluşturuldu"],
  ["olusturuldu", "oluşturuldu"],
  ["Kanit", "Kanıt"],
  ["kanit", "kanıt"],
  ["Kayit", "Kayıt"],
  ["kayit", "kayıt"],
  ["Kaydi", "Kaydı"],
  ["kaydi", "kaydı"],
  ["Katilim", "Katılım"],
  ["katilim", "katılım"],
  ["Kullanici", "Kullanıcı"],
  ["kullanici", "kullanıcı"],
  ["Ilan", "İlan"],
  ["ilan", "ilan"],
  ["Iptal", "İptal"],
  ["iptal", "iptal"],
  ["Is", "İş"],
  ["Ise", "İşe"],
  ["ise", "işe"],
  ["Isletim", "İşletim"],
  ["isletim", "işletim"],
  ["Icgorusu", "İçgörüsü"],
  ["icgorusu", "içgörüsü"],
  ["Insan", "İnsan"],
  ["insan", "insan"],
  ["Sifre", "Şifre"],
  ["sifre", "şifre"],
  ["Sec", "Seç"],
  ["sec", "seç"],
  ["Gec", "Geç"],
  ["gec", "geç"],
  ["Gecmis", "Geçmiş"],
  ["gecmis", "geçmiş"],
  ["Iletisim", "İletişim"],
  ["iletisim", "iletişim"],
  ["Iliski", "İlişki"],
  ["iliski", "ilişki"],
  ["Inceleme", "İnceleme"],
  ["inceleme", "inceleme"],
  ["Deger", "Değer"],
  ["deger", "değer"],
  ["Degisim", "Değişim"],
  ["degisim", "değişim"],
  ["Dogrul", "Doğrul"],
  ["dogrul", "doğrul"],
  ["Ayni", "Aynı"],
  ["ayni", "aynı"],
  ["Acik", "Açık"],
  ["acik", "açık"],
  ["Ac", "Aç"],
  ["Maas", "Maaş"],
  ["maas", "maaş"],
  ["Saglayici", "Sağlayıcı"],
  ["saglayici", "sağlayıcı"],
  ["Yapi", "Yapı"],
  ["yapi", "yapı"],
  ["Yapilandirilmis", "Yapılandırılmış"],
  ["yapilandirilmis", "yapılandırılmış"],
  ["On", "Ön"],
  ["Ornek", "Örnek"],
  ["ornek", "örnek"],
  ["Guven", "Güven"],
  ["guven", "güven"],
  ["Guclu", "Güçlü"],
  ["guclu", "güçlü"],
  ["Siradaki", "Sıradaki"],
  ["siradaki", "sıradaki"],
  ["Henuz", "Henüz"],
  ["henuz", "henüz"],
  ["Kuyruga", "Kuyruğa"],
  ["kuyruga", "kuyruğa"],
  ["Goster", "Göster"],
  ["goster", "göster"],
  ["Uretim", "Üretim"],
  ["uretim", "üretim"],
  ["Uret", "Üret"],
  ["uret", "üret"],
  ["Arsiv", "Arşiv"],
  ["arsiv", "arşiv"],
  ["Interview", "Mülakat"],
  ["interview", "mülakat"],
  ["Session", "Oturum"],
  ["session", "oturum"],
  ["Feature", "Özellik"],
  ["feature", "özellik"],
  ["Flag", "Bayrağı"],
  ["flag", "bayrağı"],
  ["Application", "Başvuru"],
  ["application", "başvuru"],
  ["Login", "Giriş"],
  ["login", "giriş"],
  ["Runtime", "Çalışma Zamanı"],
  ["runtime", "çalışma zamanı"],
  ["Mode", "Mod"],
  ["mode", "mod"],
  ["Provider", "Sağlayıcı"],
  ["provider", "sağlayıcı"],
  ["Vardiyali", "Vardiyalı"],
  ["vardiyali", "vardiyalı"]
];

const EN_PHRASE_TRANSLATIONS: Record<string, string> = {
  "Ürün": "Product",
  "Hesap": "Account",
  "İç Yönetim": "Internal Admin",
  "Kaynak Bulma": "Sourcing",
  "Kaynak Bulma (Beta)": "Sourcing (Beta)",
  Beta: "Beta",
  "İşe alım işletim paneli": "Recruiting operations console",
  "Çıkış Yap": "Sign Out",
  "Çıkış yapılıyor...": "Signing out...",
  "Bu sayfa için gerekli yetkiniz bulunmuyor.": "You do not have permission to access this page.",
  "Abonelik": "Subscription",
  "Raporlar": "Reports",
  "Yönetim": "Admin",
  "Abonelik bilgileri yükleniyor...": "Loading subscription details...",
  "Mevcut planınızı, kullanım durumunuzu ve ek paket satın alma akışlarını tek merkezden yönetin.":
    "Manage your current plan, usage, and add-on purchases from one place.",
  "Kullanım Durumu": "Usage Status",
  "Aylık Maliyet": "Monthly Cost",
  "Faturalandırma": "Billing",
  "Aylık": "Monthly",
  "aylık": "monthly",
  "Sonraki Fatura": "Next Invoice",
  "Dönem sonu": "Period end",
  "Ek Paket Satın Al": "Buy Add-ons",
  "Dahil kullanımınız bittiğinde ek paketler devreye girer.":
    "Add-ons kick in when your included usage runs out.",
  "Mevcut Plan": "Current Plan",
  "Bize Ulaşın": "Contact Us",
  "kullanıcı": "users",
  "aktif ilan": "active jobs",
  "aday işleme": "candidate processing",
  "mülakat": "interviews",
  "+ ek paket": "+ add-on",
  "Kullanıcı limiti doldu.": "User limit reached.",
  "Aktif ilan limiti doldu.": "Active job limit reached.",
  "Aday işleme limiti doldu.": "Candidate processing limit reached.",
  "AI mülakat limiti doldu.": "AI interview limit reached.",
  "Kullanıcı kullanımınız %80 seviyesine ulaştı.": "User usage has reached 80%.",
  "Aktif ilan kullanımınız %80 seviyesine ulaştı.": "Active job usage has reached 80%.",
  "Aday işleme kullanımınız %80 seviyesine ulaştı.": "Candidate processing usage has reached 80%.",
  "AI mülakat kullanımınız %80 seviyesine ulaştı.": "AI interview usage has reached 80%.",
  "Admin": "Admin",
  "Stripe ödeme sayfası yeni sekmede açıldı.": "Stripe checkout opened in a new tab.",
  "User limit doldu.": "User limit reached.",
  "Active job limit doldu.": "Active job limit reached.",
  "Candidate processing limit doldu.": "Candidate processing limit reached.",
  "AI interview limit doldu.": "AI interview limit reached.",
  "User limit yaklaşıyor.": "User limit is approaching.",
  "Active job limit yaklaşıyor.": "Active job limit is approaching.",
  "Candidate processing limit yaklaşıyor.": "Candidate processing limit is approaching.",
  "AI interview limit yaklaşıyor.": "AI interview limit is approaching.",
  ACTIVE: "Active",
  TRIALING: "Trial",
  PAST_DUE: "Past due",
  INCOMPLETE: "Incomplete",
  CANCELED: "Canceled",
  OPEN: "Open",
  PAID: "Paid",
  EXPIRED: "Expired",
  FAILED: "Failed",
  COMPLETE: "Complete",
  PENDING: "Pending",
  "Ek paket ödeme sayfası yeni sekmede açıldı.": "Add-on checkout opened in a new tab.",
  "Fatura ve ödeme yönetimi yeni sekmede açıldı.": "Billing and payment management opened in a new tab.",
  "Ödeme işlemi başarıyla tamamlandı.": "Payment completed successfully.",
  "Ödeme akışı iptal edildi.": "Payment flow was canceled.",
  "Abonelik verisi bulunamadı.": "Subscription data was not found.",
  "Stripe kurulumu tamamlanmadığı için self servis satın alma işlemleri şu an pasif durumda.":
    "Self-serve purchases are currently disabled because Stripe setup is incomplete.",
  "İç yönetim panelini aç": "Open internal admin panel",
  "Bu metrik mevcut planınızda kapalı.": "This metric is unavailable on your current plan.",
  "Mevcut plan": "Current plan",
  "Faturaları yönet": "Manage billing",
  "Satın Al": "Buy",
  "Açılıyor...": "Opening...",
  "Dönem özeti": "Billing period summary",
  "Başlangıç": "Start",
  "Bitiş": "End",
  "Fatura e-postası": "Billing email",
  "Ödeme durumu": "Payment status",
  "Özel teklif": "Custom pricing",
  "Henüz eklenmedi": "Not added yet",
  "Planda dahil olanlar": "Included in plan",
  "Kullanım durumu": "Usage status",
  "Sayaçlar ekip daveti, aktif ilan, aday işleme ve AI mülâkat akışlarına bağlı olarak güncellenir.":
    "Counters update based on team invites, active jobs, candidate processing, and AI interview flows.",
  "Paketler": "Plans",
  "Mevcut": "Current",
  "Popüler": "Popular",
  "Growth'a geç": "Upgrade to Growth",
  "Starter'a dön": "Switch to Starter",
  "Deneme": "Trial",
  "Aktif": "Active",
  "Ödeme gecikti": "Payment overdue",
  "İptal": "Canceled",
  "Özel": "Custom",
  "Durum": "Status",
  "Tarih": "Date",
  "Kaynak": "Source",
  "Reddedilen": "Rejected",
  "Aktif ilan": "Active jobs",
  "Aday işleme": "Candidate processing",
  "AI mülakat": "AI interviews",
  "AI mülâkat": "AI interviews",
  "Küçük ekipler ve düşük hacim için. Az sayıda aktif ilan ve temel recruiter operasyonu.":
    "For small teams and lower volume. Includes a small number of active jobs and core recruiter operations.",
  "Asıl satış paketi. Daha yüksek hacim, AI interview kapasitesi ve takvim entegrasyonları.":
    "Core sales plan. Higher volume, AI interview capacity, and calendar integrations.",
  "Büyük ekipler için özel kota, branded candidate experience, özel entegrasyon ve SLA.":
    "For larger teams with custom quotas, branded candidate experience, custom integrations, and SLA.",
  "E-posta desteği": "Email support",
  "Öncelikli destek": "Priority support",
  "Özel onboarding + SLA": "Custom onboarding + SLA",
  "Ek AI Mülakat Paketi 10": "Extra AI interview pack 10",
  "Mevcut dönem için +10 AI mülakat hakkı.": "+10 AI interview credits for the current period.",
  "Ek AI Mülakat Paketi 25": "Extra AI interview pack 25",
  "Mevcut dönem için +25 AI mülakat hakkı.": "+25 AI interview credits for the current period.",
  "Ek Aday İşleme Paketi 50": "Extra candidate processing pack 50",
  "Mevcut dönem için +50 aday işleme hakkı.": "+50 candidate processing credits for the current period.",
  "Ek Aday İşleme Paketi 100": "Extra candidate processing pack 100",
  "Mevcut dönem için +100 aday işleme hakkı.": "+100 candidate processing credits for the current period.",
  "Limit asmadan once ek aday isleme ve ek AI mulakat paketleri satin alabilirsiniz.":
    "You can buy extra candidate processing and AI interview packs before you hit the limit.",
  "Starter hızlı başlangıç için, Growth ise günlük operasyonu taşıyan ana plan olarak konumlanır.":
    "Starter is for quick setup, while Growth is positioned as the main plan for day-to-day operations.",
  "Önerilen": "Recommended",
  "Takvim entegrasyonları açık": "Calendar integrations included",
  "Takvim entegrasyonu yok": "No calendar integration",
  "Gelişmiş raporlama açık": "Advanced reporting included",
  "Gelişmiş raporlama metrikleri mevcut planınızda kapalı. Growth planına geçtiğinizde burada görünecek.":
    "Advanced reporting metrics are locked on your current plan. They will appear here after upgrading to Growth.",
  "Temel raporlama": "Basic reporting",
  "İç teklif akışını aç": "Open internal quote flow",
  "Özel kota, SLA ve kurumsal entegrasyonlar için satış ekibiyle ilerlenir.":
    "Custom quotas, SLA, and enterprise integrations are handled through sales.",
  "Ek paketler": "Add-ons",
  "Dönem içinde ek kullanım ihtiyacı doğduğunda satın alabileceğiniz self servis paketler.":
    "Self-serve packages you can buy when you need additional usage during the billing period.",
  "Kurulum ve hizmet paketi": "Setup and service package",
  "Satın al": "Buy now",
  "Dahil": "Included",
  "Sağlıklı": "Healthy",
  "Sınıra yaklaştı": "Near limit",
  "Limit doldu": "Limit reached",
  "Kalan": "Remaining",
  "Kullanım": "Usage",
  "Bu alan yalnızca iç yönetim ekibi için açıktır.": "This area is only available to the internal admin team.",
  "Müşteri görünümüne dön": "Back to customer view",
  "İç ekip için kullanıcılar, kırmızı alarm, abonelikler ve kurumsal teklif akışları tek merkezde.":
    "Users, red alerts, subscriptions, and enterprise quote flows are managed here for the internal team.",
  "Kullanıcılar": "Users",
  "Kırmızı Alarm": "Red Alerts",
  "Kritik uyarı görünmüyor": "No critical alerts visible",
  "kritik uyarı": "critical alerts",
  "Kurulum eksik": "Setup incomplete",
  "Kırmızı alarm": "Red alerts",
  "Sağlayıcı, teslimat ve abonelik uyarıları tek listede görünür.":
    "Provider, delivery, and subscription alerts appear in a single list.",
  "Aktif bir kritik uyarı bulunmuyor.": "There are no active critical alerts.",
  "Kritik": "Critical",
  "Uyarı": "Warning",
  "Hesap içindeki aktif ekip, davet bekleyen kullanıcılar ve son oturum görünürlüğü.":
    "View active team members, pending invitations, and last session activity in this account.",
  "Toplam": "Total",
  "Davet": "Invited",
  "Pasif": "Inactive",
  "Kullanıcı kaydı bulunamadı.": "No user records found.",
  "Ad": "Name",
  "Rol": "Role",
  "Son giriş": "Last login",
  "Henüz giriş yok": "No login yet",
  "Mevcut plan, kullanım ve son oluşturulan ödeme kayıtları bu tenant bağlamında takip edilir.":
    "Track the current plan, usage, and recently created payment records in this tenant context.",
  "Plan özeti": "Plan summary",
  "Dönem": "Period",
  "Henüz ödeme bağlantısı oluşturulmadı.": "No payment links have been created yet.",
  "Tür": "Type",
  "İçerik": "Content",
  "Tutar": "Amount",
  "Bağlantı / gönderim": "Link / delivery",
  "Ödeme": "Payment",
  "Ödeme bağlantısını aç": "Open payment link",
  "Bağlantı henüz hazır değil": "Link is not ready yet",
  "Bağlantıyı gönder": "Send link",
  "Kurumsal teklif, özel kota ve ödeme linki akışı yalnızca iç ekip tarafından buradan yönetilir.":
    "Enterprise quotes, custom quotas, and payment link flows are managed here by the internal team only.",
  "Seçili hesap bağlamı": "Selected account context",
  "Varsayılan fatura e-postası": "Default billing email",
  "Aylık tutar": "Monthly amount",
  "Kullanıcı limiti": "User limit",
  "Aktif ilan limiti": "Active job limit",
  "Aday işleme limiti": "Candidate processing limit",
  "AI mülâkat limiti": "AI interview limit",
  "İşe alım operasyonunuzun günlük özeti.": "Your daily recruiting operations summary.",
  "Aksiyonlar": "Actions",
  "Önce tamamlanması gereken işler burada listelenir.":
    "Items that should be completed first are listed here.",
  "Şu anda öne çıkan aksiyon bulunmuyor.": "There are no standout actions right now.",
  "Karar bekleyen başvurular": "Applications awaiting decision",
  "Feedback bekleyen mülakatlar": "Interviews awaiting feedback",
  "Bekleyen görüşme davetleri": "Pending interview invites",
  "Devam eden görüşmeler": "Ongoing interviews",
  "Sorunlu oturumlar": "Problematic sessions",
  "Yaklaşan Görüşmeler": "Upcoming Interviews",
  "Bugünkü yoğunluk ve sıradaki planlı görüşmeler.":
    "Today's workload and the next scheduled interviews.",
  "Bugün planlanan": "Scheduled today",
  "Devam eden": "Running",
  "Yaklaşan planlı görüşme bulunmuyor.": "There are no upcoming scheduled interviews.",
  "Planlı": "Scheduled",
  "Detaylar": "Details",
  "Dikkat gerektiren konular var": "There are items that need attention",
  "Şu anda kritik uyarı bulunmuyor.": "There are no critical alerts right now.",
  "İş Kuyruğu": "Work Queue",
  "Aksiyon gerektiren başvurular, öncelik sırasına göre.": "Applications requiring action, ordered by priority.",
  "Tüm Adaylar": "All Candidates",
  "Pozisyon": "Position",
  "Güncelleme": "Updated",
  "Detay": "Details",
  "Bu ekran iş kuyruğudur. Aday profili ayrı sayfadadır; buradan ilan bazlı karar ekranına girilir.":
    "This screen is the work queue. Candidate profiles live on separate pages; from here you enter the posting-based decision flow.",
  "Manuel giriş gerekiyorsa yeni başvuruyu buradan oluşturabilirsiniz.":
    "If manual entry is needed, you can create a new application here.",
  "Tek linkli AI görüşme davetlerini, devam eden oturumları ve tamamlanan görüşmeleri takip edin.":
    "Track single-link AI interview invites, live sessions, and completed interviews.",
  "Bekleniyor": "Pending",
  "Devam Ediyor": "In Progress",
  "Başarısız": "Failed",
  "Katılım Yok": "No Show",
  "İptal Edildi": "Cancelled",
  "Dikkat": "Attention",
  "İlan oluşturma, aday yönetimi ve işe alım süreçlerinizin merkezi.":
    "The central hub for job creation, candidate management, and hiring workflows.",
  "Yeni ilan hazırlayabilir ve uygun olduğunda yayına alabilirsiniz.":
    "You can prepare a new posting and publish it when you're ready.",
  "Yeni ilanı taslak olarak hazırlayabilirsiniz; yeniden yayına almak veya yayınlamak için önce slot açmanız ya da paketinizi yükseltmeniz gerekir.":
    "You can prepare the new posting as a draft; to publish or republish it, you must first free up a slot or upgrade your plan.",
  "Aktif ilan kotası": "Active job quota",
  "Limit yaklaşıyor": "Approaching limit",
  "Kullanim ve limitler": "Usage and limits",
  "Kullanımı yenile": "Refresh usage",
  "Seat": "Seat",
  "Aday isleme": "Candidate processing",
  "AI interview": "AI interview",
  "add-on": "add-on",
  "Yaklaşıyor": "Approaching",
  "Bağlı": "Connected",
  "Yapılandırılmadı": "Not configured",
  "Google Calendar başarıyla bağlandı!": "Google Calendar connected successfully!",
  "Bağlantı hatası": "Connection error",
  "Hesap sahipliği, ekip yetkileri, entegrasyonlar ve AI sistem davranışları.":
    "Manage account ownership, team permissions, integrations, and AI system behavior.",
  "Ayarlar": "Settings",
  Dil: "Language",
  "Operasyon Özeti": "Operations Summary",
  "Demo Senaryoları": "Demo Scenarios",
  "Planlanan Sonraki Yetenek": "Planned Next Capability",
  "İlan Merkezi": "Job Center",
  "Yeni İlan Hazırla": "Prepare New Posting",
  "Yeni İlan Taslağı Hazırla": "Prepare New Draft Posting",
  "İlanı Kaydet": "Save Posting",
  "Aboneliği Gör": "View Subscription",
  "Aktif ilan kotası dolu": "Active job quota full",
  "Abonelik görünürlüğü": "Subscription visibility",
  "Pozisyon Komuta Merkezi": "Requisition Command Center",
  "Kaynak Bulma Projesi": "Sourcing Project",
  "Harici Kaynaklı Aday": "Externally Sourced Candidate",
  "Kaynak Bulma’yı Aç": "Open Sourcing",
  "Başvuru, mülakat ve recruiter karar akışı aynı yerden izlenir.":
    "Application, interview, and recruiter decision flow are tracked in one place.",
  "İçe aktarılan ve yeniden keşfedilen adaylar dahil":
    "Includes imported and rediscovered candidates.",
  "Bu ilanı taslakta tutabilir, slot açıldığında yayına alabilirsiniz.":
    "You can keep this posting as a draft and publish it when a slot becomes available.",
  "Aday Havuzu": "Candidate Pool",
  "Yeni Aday Ekle": "Add New Candidate",
  "Başvuru Operasyon Paneli": "Application Operations Panel",
  "Yeni Başvuru Aç": "Create New Application",
  "Aday Profili": "Candidate Profile",
  "CV Yükleme ve Parsing": "CV Upload and Parsing",
  "Son Parsed Profil": "Latest Parsed Profile",
  "Adayı İlana Bağla": "Attach Candidate to Posting",
  "Mülakat Oturum Merkezi": "Interview Session Center",
  "Özellik Bayrağı Kontrolü": "Feature Flag Control",
  "Muhtemel Uyum Gözlemleri": "Likely Fit Observations",
  "Muhtemel Uyum Sinyalleri": "Likely Fit Signals",
  "İşe alım süresi (ortalama)": "Time to hire (average)",
  "İşe alım süresi (medyan)": "Time to hire (median)",
  "Toplantı Bağlantısı": "Meeting Link",
  Başvurular: "Applications",
  "İş İlanları": "Job Postings",
  "Yeni İş İlanı": "New Job Posting",
  "AI Destek Merkezi": "AI Support Center",
  "Denetim Kayıtları": "Audit Logs",
  "AI Ayarları": "AI Settings",
  "AI Özellikleri": "AI Features",
  "AI Sağlayıcıları": "AI Providers",
  "AI Davranış Kuralları": "AI Behavior Rules",
  "Ayarlar & Bağlantılar": "Settings & Connections",
  "Bağlantılar": "Connections",
  "Sistem Durumu": "System Status",
  "Mülakatlar": "Interviews",
  "Genel Bakış": "Overview",
  "İnceleme Bekleyen": "Awaiting Review",
  "Randevu Bekleyen": "Awaiting Schedule",
  "Devam Eden": "In Progress",
  "Sorunlu": "Problematic",
  "Bekleyen İşlemler": "Pending Actions",
  "Karar Bekleyen": "Decision Needed",
  "Ön Değerlendirme Bekleyen": "Awaiting Screening",
  "Aşama Dağılımı": "Stage Distribution",
  "Süreç Metrikleri": "Process Metrics",
  "Dönüşüm Oranları": "Conversion Rates",
  "İşe Alım Süresi": "Time to Hire",
  "Görüşme Kalitesi": "Interview Quality",
  "Hızlı Erişim": "Quick Access",
  "Genel Bağlantı Durumu": "Overall Connection Status",
  "Tüm sistemler aktif": "All systems active",
  "Bazı bağlantılarda sorun var": "Some connections have issues",
  "Dikkat gerektiren konular": "Items needing attention",
  "Aranan Nitelikler": "Required Qualifications",
  "Temel Bilgiler": "Basic Information",
  "Çalışma Koşulları": "Work Conditions",
  "Çalışma Modeli": "Work Model",
  "Çalışma Şekli": "Work Type",
  "Pozisyon Açıklaması": "Position Description",
  "AI taslak oluştururken bu açıklamayı temel alır.":
    "AI uses this description as the basis for the draft.",
  "Pozisyonun temel sorumlulukları ve beklentiler...":
    "Core responsibilities and expectations for the position...",
  "Nitelik yazın...": "Enter qualification...",
  "Tercih Edilen": "Preferred",
  "Seçiniz": "Select",
  "Ofisten (On-site)": "On-site",
  Hibrit: "Hybrid",
  Uzaktan: "Remote",
  "Tam Zamanlı": "Full-time",
  "Yarı Zamanlı": "Part-time",
  Vardiyalı: "Shift-based",
  Stajyer: "Intern",
  Sözleşmeli: "Contract",
  Operasyon: "Operations",
  Satış: "Sales",
  Pazarlama: "Marketing",
  "İnsan Kaynakları": "Human Resources",
  Finans: "Finance",
  "Bilgi Teknolojileri": "Information Technology",
  "Müşteri Hizmetleri": "Customer Service",
  Üretim: "Production",
  Lojistik: "Logistics",
  Diğer: "Other",
  "Vardiyalı çalışma düzenine uyum": "Adaptability to a shift-based work schedule",
  "Depo veya saha operasyonu deneyimi": "Warehouse or field operations experience",
  "Ağır yük kaldırma kapasitesi": "Ability to lift heavy loads",
  "Satış hedeflerine yönelik çalışma deneyimi": "Experience working toward sales targets",
  "CRM araçları kullanım bilgisi": "Familiarity with CRM tools",
  "Aktif müşteri portföyü yönetimi": "Active client portfolio management",
  "Dijital pazarlama kampanya yönetimi": "Digital marketing campaign management",
  "Sosyal medya platformlarında içerik üretimi": "Content creation for social media platforms",
  "Google Analytics veya benzeri araç deneyimi": "Experience with Google Analytics or similar tools",
  "İşe alım süreçleri yönetimi": "Recruitment process management",
  "SGK ve bordro mevzuatı bilgisi": "Knowledge of payroll and social security legislation",
  "Çalışan ilişkileri ve oryantasyon deneyimi": "Employee relations and onboarding experience",
  "Muhasebe ve finans raporlama deneyimi": "Accounting and financial reporting experience",
  "ERP sistemi kullanım bilgisi (SAP, Logo vb.)": "Experience with ERP systems (SAP, Logo, etc.)",
  "Bütçe planlama ve maliyet analizi": "Budget planning and cost analysis",
  "Yazılım geliştirme veya sistem yönetimi deneyimi":
    "Software development or systems administration experience",
  "Versiyon kontrol ve CI/CD süreçleri bilgisi":
    "Knowledge of version control and CI/CD processes",
  "Ağ ve sunucu altyapısı yönetimi": "Network and server infrastructure management",
  "Çağrı merkezi veya müşteri destek deneyimi": "Call center or customer support experience",
  "Şikayet yönetimi ve çözüm odaklı yaklaşım":
    "Complaint management and a solution-oriented approach",
  "Çoklu iletişim kanallarında hizmet deneyimi":
    "Experience serving across multiple communication channels",
  "Üretim hattı operasyon deneyimi": "Production line operations experience",
  "İş sağlığı ve güvenliği sertifikası": "Occupational health and safety certification",
  "Kalite kontrol süreçleri bilgisi": "Knowledge of quality control processes",
  "Sevkiyat ve depo yönetimi deneyimi": "Shipment and warehouse management experience",
  "Rota planlama ve filo takibi bilgisi": "Knowledge of route planning and fleet tracking",
  "Tedarik zinciri süreçlerine hakimiyet": "Familiarity with supply chain processes",
  "Henüz yayınlanmadı": "Not published yet",
  "Başvuru kabul ediliyor": "Accepting applications",
  "Başvuru kapatıldı": "Applications closed",
  "Bu ilanı taslak veya yayında olarak kaydedebilirsiniz.":
    "You can save this posting as draft or published.",
  "Şu anda yalnızca taslak oluşturabilirsiniz. Yayına almak için önce bir ilanı arşivleyin ya da planınızı yükseltin.":
    "You can only create a draft right now. To publish it, archive a posting first or upgrade your plan.",
  "Yukarıdaki bilgilere göre profesyonel ilan metni oluşturur. Taslağı düzenleyip harici platformlara kopyalayabilirsiniz.":
    "Generates a professional job posting based on the information above. You can edit the draft and copy it to external platforms.",
  "Aktif ilan kotanız dolu. İlanı taslak olarak kaydedebilir, daha sonra slot açıldığında yayına alabilirsiniz.":
    "Your active job quota is full. You can save the posting as a draft and publish it later when a slot becomes available.",
  "Aktif ilan kotanız dolu. Bu ilanı yeniden yayına almak için önce bir ilanı arşivleyin ya da planınızı yükseltin.":
    "Your active job quota is full. To republish this posting, archive another posting first or upgrade your plan.",
  "Arşivle": "Archive",
  "Tekrar Yayınla": "Republish",
  Yayınla: "Publish",
  "Eksik / Uyarı": "Missing / Warning",
  "Kaynak projesi": "Sourcing project",
  "Doğrudan başvuru akışı": "Direct application flow",
  "Aday görüşme linki": "Candidate interview link",
  "Outreach:": "Outreach:",
  "Mülakat Daveti Hazır": "Interview Invite Ready",
  "Aktif Invite / Outreach": "Active Invites / Outreach",
  Prospect: "Prospect",
  "akışa bağlandı": "linked to the workflow",
  invite: "invites",
  "outreach yanıt bekliyor": "outreach awaiting reply",
  "E-posta mevcut, tek tıkla AI invite gönderebilirsiniz":
    "Email is available; you can send an AI invite in one click.",
  "başarılı": "successful",
  hata: "errors",
  "Adayı Reddet": "Reject Candidate",
  "Evet, Davet Gönder": "Yes, Send Invite",
  "Evet, Reddet": "Yes, Reject",
  "adayına tek linkli AI mülakat daveti gönderilecek. Bu akışta slot seçimi yoktur.":
    "will receive a single-link AI interview invitation. There is no slot selection in this flow.",
  "adayı reddedilecek.": "will be rejected.",
  "Henüz değerlendirilmedi": "Not evaluated yet",
  "Güçlü Uyum": "Strong Match",
  Uyumlu: "Match",
  "Kısmi Uyum": "Partial Match",
  "Düşük Uyum": "Low Match",
  "Son outreach konusu:": "Last outreach subject:",
  "Otomatik değerlendirme sonuçları güncellendi.":
    "Automatic evaluation results were updated.",
  "Otomatik değerlendirme sonuçları da güncellendi.":
    "Automatic evaluation results were also updated.",
  "Otomatik güncelleme zaman aşımına uğradı. Süreç arka planda devam ediyor olabilir.":
    "Automatic refresh timed out. The process may still continue in the background.",
  "Bazı adayların son durumu ekrana geç yansıdı. Sayfa arka planda tekrar güncellenebilir.":
    "Some candidates' latest status appeared late. The page may refresh again in the background.",
  "Abonelik bilgileri yüklenemedi.": "Subscription details could not be loaded.",
  "Plan değişikliği başlatılamadı.": "Plan change could not be started.",
  "Ek paket satın alma akışı başlatılamadı.": "Add-on purchase flow could not be started.",
  "Müşteri portalı açılamadı.": "Customer portal could not be opened.",
  "Nitelik Ekle": "Add Qualification",
  "Çalışma Modeli / Vardiya": "Work Model / Shift",
  "Maaş Alt Sınır (TRY)": "Salary Min (TRY)",
  "Maaş Üst Sınır (TRY)": "Salary Max (TRY)",
  "Departman / Birim": "Department / Unit",
  "Yayın Durumu": "Publication Status",
  "Interview Session Merkezi": "Interview Session Center",
  "Sesli Ön Görüşme Oturumu": "Voice Pre-Screen Session",
  "Görüşmeye Katıl": "Join Interview",
  "Canlı Görüşme": "Live Interview",
  "Görüşme Sonlandı": "Interview Ended",
  "Görüşme Tamamlandı": "Interview Completed",
  "Internal Fallback Kontrolleri": "Internal Fallback Controls",
  "Oturum kontrol ediliyor": "Checking session",
  "Oturum gerekli": "Session required",
  "Yetki yok": "Access denied",
  "Giriş ekranına git": "Go to login",
  Yenile: "Refresh",
  Ara: "Search",
  Temizle: "Clear",
  "Filtreyi Uygula": "Apply Filter",
  Uygula: "Apply",
  Aç: "Open",
  Kapat: "Disable",
  Vazgeç: "Cancel",
  Kaydet: "Save",
  Sil: "Delete",
  "Tekrar dene": "Retry",
  "Yükleniyor...": "Loading...",
  "Güncelleniyor...": "Updating...",
  "Kaydediliyor...": "Saving...",
  "Gönderiliyor...": "Submitting...",
  "Oluşturuluyor...": "Creating...",
  "Kuyruğa alınıyor...": "Queueing...",
  "Kuyruğa alındı.": "Queued.",
  "Açık": "Enabled",
  "Kapalı": "Disabled",
  "Zorunlu": "Required",
  "Opsiyonel": "Optional",
  "Belirtilmedi": "Not specified",
  "Transcript yok": "No transcript",
  "Session yok": "No session",
  "Parsing yok": "No parsing",
  "Henüz parse edilmedi": "Not parsed yet",
  "Mikrofon hazır": "Microphone ready",
  "Mikrofon izni isteniyor...": "Requesting microphone permission...",
  "Mikrofon izni verilmedi": "Microphone permission denied",
  "Mikrofon kontrol edilmedi": "Microphone not checked",
  "Tarayıcı sesli tanımayı desteklemiyor": "Browser does not support speech recognition",
  Hazır: "Ready",
  Hazırlanıyor: "Preparing",
  "Hazırlanıyor...": "Preparing...",
  "Bağlanıyor": "Connecting",
  "Tamamlandı": "Completed",
  "Sonlandı": "Ended",
  "Dinleniyor": "Listening",
  "Dinleniyor...": "Listening...",
  "AI Konuşuyor": "AI Speaking",
  "Yanıt Bekleniyor": "Waiting for answer",
  "Yanıt İşleniyor": "Processing answer",
  "Sizi dinliyorum...": "Listening to you...",
  "Soruyu Tekrar Et": "Repeat Question",
  "Sesli Yanıtla": "Answer by voice",
  "Metinle Yanıt (fallback)": "Answer by text (fallback)",
  "Metin Yanıtını Gönder": "Submit text answer",
  "Mikrofonu Aç ve Görüşmeye Katıl": "Enable microphone and join interview",
  "Oturumu Sonlandır": "End session",
  "Görüşmeyi Başlat / Devam Et": "Start / Continue Interview",
  "Yeniden Planla": "Reschedule",
  "Interview Planla": "Schedule Interview",
  "Screening Desteği Tetikle": "Trigger Screening Support",
  "Transcripti Sessiona Bağla": "Attach Transcript to Session",
  "Kalite Durumunu Kaydet": "Save Quality Status",
  "Adayı Kaydet": "Save Candidate",
  "İş İlanını Kaydet": "Save Job Posting",
  "Yeni Aday Kaydı": "New Candidate Record",
  "Aday listesine dön": "Back to candidate list",
  "İş ilanlarına dön": "Back to job postings",
  "Başvuru operasyonuna geç": "Go to application operations",
  "Görüşme merkezine geç": "Go to interview center",
  "AI destek merkezini aç": "Open AI support center",
  "Aday seçiniz": "Select candidate",
  "İlan seçiniz": "Select posting",
  "Tüm stage'ler": "All stages",
  "Tüm ilanlar": "All postings",
  "Tüm durumlar": "All statuses",
  "Açık İş İlanı": "Open Job Posting",
  "Toplam Aday": "Total Candidates",
  "Aktif Başvuru": "Active Applications",
  "Ortalama Rapor Güveni": "Average Report Confidence",
  "Pipeline Dağılımı": "Pipeline Distribution",
  "Zaman ve Kalite": "Time and Quality",
  "Kullanıcı": "User",
  Tenant: "Tenant",
  Roller: "Roles",
  Oturum: "Session",
  Evet: "Yes",
  Hayır: "No",
  Aksiyon: "Action",
  Telefon: "Phone",
  "E-posta": "Email",
  Lokasyon: "Location",
  Workspace: "Workspace",
  "Vardiya Tipi": "Shift Type",
  "Maaş Min (TRY)": "Salary Min (TRY)",
  "Maaş Max (TRY)": "Salary Max (TRY)",
  "İş Tanımı": "Job Description",
  Gereksinimler: "Requirements",
  "Gereksinim Ekle": "Add Requirement",
  "Aynı CV için zaten çalışan bir parsing görevi var.":
    "A parsing task is already running for the same CV.",
  "CV parsing görevi kuyruğa alındı.": "CV parsing task has been queued.",
  "Screening support görevi zaten çalışıyor.": "Screening support task is already running.",
  "Screening support görevi kuyruğa alındı.": "Screening support task has been queued.",

  // Job detail command center
  "Toplam Başvuru": "Total Applicants",
  "Skoru Hazır": "Score Ready",
  "Ort. Uyum Skoru": "Avg. Fit Score",
  "İşlem Bekliyor": "Action Required",
  "Aday Akışı": "Candidate Pipeline",
  "Teklif / Sonuç": "Offer / Result",
  "İlan Bilgilerini Göster": "Show Posting Details",
  "İlan Bilgilerini Gizle": "Hide Posting Details",
  "Aday ara (ad, e-posta, telefon)...": "Search candidates (name, email, phone)...",
  "Tüm Kaynaklar": "All Sources",
  "Toplu Aday Ekle": "Bulk Add Candidates",
  "CSV Yükle": "Upload CSV",
  "aday gösteriliyor": "candidates shown",
  "Aramayla eşleşen aday bulunamadı.": "No candidates matched the search.",
  "Bu ilana henüz aday başvurusu yok.": "No candidates have applied to this posting yet.",
  "Uyum Skoru": "Fit Score",
  "Uyum skoru adayın role tahmini uygunluğunu, güven ise bu skorun eldeki veriyle ne kadar sağlam olduğunu gösterir.":
    "Fit score shows the candidate's estimated suitability for the role, while confidence shows how solid that score is based on the available data.",
  "Güven": "Confidence",
  "Uyarılar": "Warnings",
  "Sonraki Adım": "Next Step",
  "İşlem": "Action",
  "İşlem tamamlandı.": "Action completed.",
  "Güçlü": "Strong",
  "İyi": "Good",
  "Orta": "Average",
  "Zayıf": "Weak",
  "Yüksek": "High",
  "Düşük": "Low",
  "CV Yok": "No CV",
  "CV İşlenmedi": "CV Not Parsed",
  "Eksik Bilgi": "Missing Info",
  "Risk": "Risk",
  "Değerlendir": "Evaluate",
  "Ön Eleme Başlat": "Start Screening",
  "Ön eleme görevi kuyruğa alındı.": "Screening task has been queued.",
  "Görüşmeye Davet Et": "Invite to Interview",
  "Randevu Bekliyor": "Awaiting Appointment",
  "Görüşme Bekliyor": "Awaiting Interview",
  "Görüşme Devam": "Interview In Progress",
  "Sonuçları İncele": "Review Results",
  "Karar Ver": "Make Decision",
  "Aday ön değerlendirme aşamasına alındı.": "Candidate moved to the screening stage.",
  "Aday recruiter inceleme bekleyenler listesine alındı.":
    "Candidate moved to the recruiter review queue.",
  "Aday reddedildi.": "Candidate was rejected.",
  "Uyum skoru hesabı kuyruğa alındı.": "Fit score calculation has been queued.",
  "Görüşme daveti süreci başlatıldı.": "Interview invitation flow has started.",
  "Görüşme daveti gönderildi. Aday hemen başlayabilir veya daha sonra planlayabilir.":
    "Interview invitation sent. The candidate can start immediately or plan for later.",

  // Job creation draft preview
  "İlan Taslağı": "Posting Draft",
  "İlan taslağı": "Job posting draft",
  "Önizleme": "Preview",
  "Önizlemeyi Gizle": "Hide Preview",
  "Metni Kopyala": "Copy Text",
  "Kopyalandı!": "Copied!",
  "Pozisyon bilgilerini girin. Kaydettikten sonra veya öncesinde ilan taslağını kopyalayarak harici platformlarda yayınlayabilirsiniz.":
    "Enter position details. You can copy the posting draft for external platforms before or after saving.",
  "Aşağıdaki taslak metin, girdiğiniz bilgilerden otomatik oluşturulur. Harici platformlarda (Kariyer.net, LinkedIn vb.) ilan yayınlamak için kopyalayıp kullanabilirsiniz.":
    "The draft below is auto-generated from the information you entered. Copy and use it to publish on external platforms (Kariyer.net, LinkedIn, etc.).",
  "AI Destekli İlan Taslağı": "AI-Assisted Posting Draft",
  "Pozisyon bilgilerini girin. İsterseniz kaydetmeden önce AI ile ilan taslağı üretip düzenleyebilir, ardından harici platformlara kopyalayabilirsiniz.":
    "Enter position details. If you want, you can generate and edit an AI job posting draft before saving, then copy it to external platforms.",
  "Bilgileri girdikten sonra Taslak Oluştur diyerek modelden ilan metni üretin. Oluşan taslağı burada düzenleyebilir ve harici platformlara kopyalayabilirsiniz.":
    "After entering the details, click Generate Draft to have the model create a job posting. You can edit the resulting draft here and copy it to external platforms.",
  "Revizyon Notu": "Revision Note",
  "İsterseniz beğenmediğiniz taslağı burada vereceğiniz notla yeniden yazdırabilirsiniz.":
    "If you are not happy with the draft, you can have it rewritten based on the note you provide here.",
  "Örnek: Daha kurumsal bir ton kullan, vardiya bilgisini daha net vurgula, nitelikleri daha kısa yaz.":
    "Example: Use a more corporate tone, emphasize the shift details more clearly, and shorten the qualifications.",
  "Taslak hazırlanıyor...": "Preparing draft...",
  "Yeniden yazılıyor...": "Rewriting...",
  "Taslak Oluştur": "Generate Draft",
  "Yeniden Oluştur": "Regenerate",
  "Nota Göre Yeniden Yaz": "Rewrite Based on Note",
  "Taslağı Kopyala": "Copy Draft",
  "Taslak AI ile oluşturuldu. Dilerseniz düzenleyip kopyalayabilirsiniz.":
    "The draft was created with AI. You can edit and copy it if you like.",
  "Taslak güncel değil. Form bilgilerinde değişiklik yaptınız; en doğru metin için yeniden oluşturun.":
    "The draft is out of date. You changed the form details; regenerate it for the most accurate text.",
  "Taslak oluşturduğunuzda ilan metni burada görünecek.":
    "The job posting text will appear here once you generate a draft.",
  "Taslak oluşturmak için ilan başlığı en az 3 karakter olmalı.":
    "Job title must be at least 3 characters to generate a draft.",
  "Taslak oluşturmak için departman, iş tanımı veya en az bir nitelik girin.":
    "Enter a department, job description, or at least one qualification to generate a draft.",
  "İlan taslağı oluşturulamadı.": "Job posting draft could not be created.",
  "AI sağlayıcısı hazır değil; kural tabanlı taslak üretildi.":
    "AI provider is not ready; a rule-based draft was generated.",
  "AI yanıtı geçerli bir ilan taslağı üretmedi; kural tabanlı taslak gösteriliyor.":
    "The AI response did not produce a valid job posting draft; a rule-based draft is being shown.",
  "AI taslak üretimi başarısız oldu; kural tabanlı taslak gösteriliyor.":
    "AI draft generation failed; a rule-based draft is being shown.",

  // Raporlar page
  "İşe alım süreçlerinizin performansını ve dönüşüm oranlarını takip edin.":
    "Track the performance and conversion rates of your hiring processes.",
  "İşe Alım Süresi (Ort.)": "Time to Hire (Avg.)",
  "Ön eleme oranı": "Screening rate",
  "Mülakata geçiş oranı": "Interview conversion rate",
  "İşe alım oranı": "Hire rate",
  "İşe alınan aday sayısı": "Total hired candidates",
  "Ortalama süre (gün)": "Average duration (days)",
  "Medyan süre (gün)": "Median duration (days)",
  "Transkript kalite ortalaması": "Transcript quality average",
  "Rapor güven ortalaması": "Report confidence average",
  "İncelenen transkript sayısı": "Transcripts reviewed",
  "Üretilen rapor sayısı": "Reports generated",

  // Interviews page extras
  "Planlanan, devam eden ve tamamlanan görüşmeleri takip edin. İnceleme bekleyenlere öncelik verin.":
    "Track scheduled, in-progress, and completed interviews. Prioritize those awaiting review.",
  "Voice görüşmelerde açılan bağlantı adayın gerçek mülakat ekranıdır; recruiter tarafında önizleme amacıyla da kullanılabilir.":
    "In voice interviews, the opened link is the candidate's actual interview screen; recruiters can also use it for preview.",
  "Aday Görüşme Ekranı": "Candidate Interview Screen",
  "Önizle": "Preview",
  "Planlanmış": "Scheduled",
  "Bugün": "Today",
  "Aday Havuzuna Dön": "Back to Candidate Pool",

  // Ayarlar page extras
  "Entegrasyon ve bağlantı durumları, AI yapılandırması, sistem sağlığı ve denetim kayıtları.":
    "Integration and connection status, AI configuration, system health, and audit logs.",
  "Google Calendar entegrasyonu ile görüşmeleri otomatik olarak takviminize ekleyebilirsiniz.":
    "With Google Calendar integration, you can automatically add interviews to your calendar."
};

Object.assign(EN_PHRASE_TRANSLATIONS, {
  "Mevcut planinizi, kullanım durumunuzu ve ek paket satın alma akışlarını tek merkezden yönetin.":
    "Manage your current plan, usage, and add-on purchases from one place.",
  "Küçük ekipler ve düşük hacim için. Az sayıda aktif posting ve temel recruiter operasyonu.":
    "For small teams and lower volume. Includes a small number of active postings and core recruiter operations.",
  "Asıl satış paketi. Daha yüksek hacim, AI interview kapasitesi ve takvim entegrasyonları.":
    "Core sales plan. Higher volume, AI interview capacity, and calendar integrations.",
  "Faturaları yönet": "Manage billing",
  "Admin paneli": "Admin panel",
  "Fatura": "Invoice",
  "Faturalama e-postası": "Billing email",
  "Eksik ayar": "Incomplete setup",
  "Aktif plan": "Current plan",
  "Takvim entegrasyonu": "Calendar integration",
  "Takvim entegrasyonları": "Calendar integrations",
  "Yok": "None",
  "Planlar": "Plans",
  "Add-onlar": "Add-ons",
  "Servis paketi": "Service package",
  "Ödeme linki oluştur": "Create payment link",
  "Ödeme bağlantıları": "Payment links",
  "Ödeme linkini aç": "Open payment link",
  "Link hazır değil": "Link not ready",
  "Linki gönder": "Send link",
  "Teklif oluştur": "Create quote",
  "Limit aşmadan önce ek interview, ek aday işleme veya servis odaklı paket satın alabilirsiniz.":
    "Buy extra interview, candidate processing, or service-focused packages before hitting your limits.",
  "Limit asmadan once ek interview, ek aday isleme veya servis odakli paket satin alabilirsiniz.":
    "Buy extra interview, candidate processing, or service-focused packages before hitting your limits.",
  "Enterprise teklif oluştur": "Create enterprise quote",
  "Owner burada custom limitleri belirler, ödeme linkini oluşturur ve isterse kullanıcıya e-posta ile gönderir.":
    "The owner can define custom limits here, create the payment link, and optionally email it to the customer.",
  "Calendar / Meet entegrasyonu": "Calendar / Meet integration",
  "Branded candidate experience": "Branded candidate experience",
  "Özel entegrasyon yetkisi": "Custom integration entitlement",
  "Enterprise ödeme linki oluştur": "Create enterprise payment link",
  "Oluşan checkout linklerini buradan izleyebilir ve kullanıcıya tekrar gönderebilirsiniz.":
    "Track generated checkout links here and resend them to users.",
  "Tür": "Type",
  "Etiket": "Label",
  "Bağlantı / Gönderim": "Link / delivery",
  "Yeni Üye Davet Et": "Invite New User",
  "Üye Listesi": "Member List",
  "Owner olarak sisteme yeni menajer veya personel ekleyebilirsiniz.":
    "As the owner, you can invite new managers or staff members.",
  "Hesapta tek bir owner bulunur. Menajer operasyonu yönetir, personel günlük iş akışında çalışır.":
    "There is one owner per account. Managers oversee operations and staff handle daily workflow.",
  "Davet / Son Giriş": "Invite / Last Login",
  "Davet:": "Invite:",
  "Son giriş:": "Last login:",
  "Aktifleştir": "Activate",
  "Pasifleştir": "Deactivate",
  "Daveti Tekrar Gönder": "Resend Invitation",
  "Owner Yap": "Make Owner",
  "Devrediliyor...": "Transferring...",
  "İşleniyor...": "Processing...",
  "Tüm sistemler aktif": "All systems active",
  "Bazı bağlantılarda sorun var": "Some connections have issues",
  "Bağlı Servisler": "Connected Services",
  "Henüz entegrasyon bağlantısı yapılmamış.": "No integrations have been connected yet.",
  "Google Calendar Bağlantısı": "Google Calendar Connection",
  "Görüşmeleri takvime otomatik yansıtmak için bağlayabilirsiniz.":
    "Connect it to sync interviews to your calendar automatically.",
  "AI Davranış Kuralları": "AI Behavior Rules",
  "AI yardımcı rolde kalır, kritik kararlar insanda olur.":
    "AI remains assistive and critical decisions stay with humans.",
  "AI Özellikleri": "AI Features",
  "Owner hesabıyla AI destek özelliklerini açıp kapatabilirsiniz.":
    "You can enable or disable AI support features with the owner account.",
  "Özellik": "Feature",
  "Kilitli": "Locked",
  "Son AI Görevleri": "Recent AI Tasks",
  "Kapsam": "Scope",
  "Zaman": "Time",
  "Sistem Özeti": "System Summary",
  "Teknik bileşenlerin genel durumu ve servis hazırlığı.":
    "Overall status of technical components and service readiness.",
  "Bileşen": "Component",
  "Hazır": "Ready",
  "İlan Merkezi": "Job Center",
  "Yayında": "Published",
  "Taslak": "Draft",
  "Arşiv": "Archived",
  "başvuru": "applications",
  "Bu dönem": "This period",
  "aktif ilan kullanıyorsunuz.": "active jobs are in use.",
  "aktif": "active",
  "davet bekliyor": "pending invites",
  "uyarı": "alerts",
  "Ödeme linki gönderilecek e-posta": "Email to receive the payment link",
  "Stripe Portalı": "Stripe Portal",
  "Ödeme bağlantısı": "Payment link",
  "Ödeme bağlantısı gönderilemedi.": "Payment link could not be sent.",
  "Ödeme bağlantısı henüz hazır değil": "Payment link is not ready yet",
  "Plan ödeme linki hazırlandı.": "Plan checkout link is ready.",
  "Add-on ödeme linki hazırlandı.": "Add-on checkout link is ready.",
  "Stripe müşteri portalı açıldı.": "Stripe customer portal opened.",
  "Enterprise teklif ödeme linki hazırlandı.": "Enterprise quote payment link is ready.",
  "Ödeme linki göndermek için e-posta giriniz.": "Enter an email address to send the payment link.",
  "Ödeme linki gönderilemedi.": "Payment link could not be sent.",
  "Kurumsal teklif için ödeme sayfası oluşturuldu.": "Enterprise checkout page created.",
  "Kurumsal teklif oluşturulamadı.": "Enterprise quote could not be created.",
  "Ayarlar yuklenemedi.": "Settings could not be loaded.",
  "Odeme linki gondermek icin e-posta giriniz.": "Enter an email address to send the payment link.",
  "Odeme linki gonderilemedi.": "Payment link could not be sent.",
  "Odeme linki olustur": "Create payment link",
  "Odeme linkini ac": "Open payment link",
  "Linki gonder": "Send link",
  "Hazirlaniyor...": "Preparing...",
  "Gonderiliyor...": "Sending...",
  "Stripe musteri portali acildi.": "Stripe customer portal opened.",
  "Plan odeme linki hazirlandi.": "Plan checkout link is ready.",
  "Add-on odeme linki hazirlandi.": "Add-on checkout link is ready.",
  "Enterprise teklif odeme linki hazirlandi.": "Enterprise quote payment link is ready.",
  "Ayarlar": "Settings",
  "Gelişmiş raporlama": "Advanced reporting",
  "Markalı aday deneyimi": "Branded candidate experience",
  "Özel entegrasyonlar": "Custom integrations",
  "Fatura bilgileri": "Billing details",
  "Kota limitleri": "Quota limits",
  "Aylık tutar (kuruş)": "Monthly amount (cents)",
  "Aylık tutar (cent)": "Monthly amount (cents)",
  "Kullanımı yenile": "Refresh usage",
  "Seat limiti aktif ve davet bekleyen ekip kullanıcılarını kapsar. AI interview kotası davet oluştuğunda tüketilir.":
    "The seat limit includes active and invited team members. AI interview quota is consumed when an invite is created.",
  "Kullanıcı kotası": "Seat quota",
  "Davet bekleyen kullanıcılar da bu limite dahildir.": "Pending invitations also count against this limit.",
  "Ekip kullanıcı limiti dolu. Yeni davet için plan yükseltin.": "Your team seat limit is full. Upgrade the plan to invite another user.",
  "Dönem bilgisi": "Billing period",
  "Stripe hazırlığı": "Stripe readiness",
  "Limitler tek merkezden izlenir. Kritik noktalarda sistem blok koyar ve upgrade / add-on önerir.":
    "Limits are tracked from one place. The system blocks at critical points and recommends upgrades or add-ons.",
  "Starter giriş paketi, Growth ise asıl satış paketi olarak konumlandı.":
    "Starter is the entry plan, while Growth is positioned as the main sales plan.",
  "Fatura / teklif e-postası": "Billing / quote email",
  "Teklif notu / SLA / onboarding kapsamı": "Quote note / SLA / onboarding scope",
  "Kullanıcı": "User",
  "Kullanıcılar": "Users",
  "Adaylar": "Candidates",
  "Genel Bakış": "Overview",
  "Detaya git": "Go to details",
  "Aday": "Candidate",
  "Güncelleme": "Updated",
  "Aktif Görüşme": "Active Interviews",
  "Feedback bekleyen mülakatlar": "Interviews awaiting feedback",
  "Abonelik kullanımı şu an yüklenemedi.": "Subscription usage could not be loaded right now.",
  "Yeni ilan hazırlayabilir ve uygun olduğunda yayına alabilirsiniz.":
    "You can prepare a new job and publish it when a slot becomes available.",
  "Yeni ilanı taslak olarak hazırlayabilirsiniz; yeniden yayına almak veya yayınlamak için önce slot açmanız ya da paketinizi yükseltmeniz gerekir.":
    "You can prepare the new job as a draft; to republish or publish it, you need to free up a slot or upgrade your plan first.",
  "Şu anda aksiyon gerektiren başvuru bulunmuyor.":
    "There are no applications requiring action right now.",
  "Bu dönem aktif ilan kullanıyorsunuz.": "Active jobs are in use this period."
});

Object.assign(EN_PHRASE_TRANSLATIONS, {
  "\u26A0\uFE0F Katılmadı": "\u26A0\uFE0F No-show",
  "\u2705 İlerlet": "\u2705 Advance",
  "\u2705 Tamamlandı": "\u2705 Completed",
  "\u274C Başarısız": "\u274C Failed",
  "✅ Görüşme tamamlandı": "✅ Interview completed",
  "💬 Görüşmede Ne Sorulmalı?": "💬 What Should Be Asked in the Interview?",
  "📅 Görüşmeye Davet Et": "📅 Invite to Interview",
  "📧 Görüşme daveti gönderildi": "📧 Interview invitation sent",
  "Açıklama": "Description",
  "Açıklama (örnek: gece vardiyası çalışabilmeli)":
    "Description (example: must be available for night shift)",
  "Ad Soyad; Telefon; E-posta; Lokasyon; Deneyim (yıl)":
    "Full Name; Phone; Email; Location; Experience (years)",
  "Ad, e-posta veya telefon ile arayın...": "Search by name, email, or phone...",
  "Aday": "Candidate",
  "Aday:": "Candidate:",
  "Aday adı en az 2 karakter olmalı.": "Candidate name must be at least 2 characters.",
  "Aday detayı yüklenemedi.": "Candidate details could not be loaded.",
  "Aday detayı yükleniyor...": "Loading candidate details...",
  "Aday ID:": "Candidate ID:",
  "Aday katılmadı": "Candidate did not attend",
  "Aday listesi yüklenemedi.": "Candidate list could not be loaded.",
  "Aday oluşturulamadı.": "Candidate could not be created.",
  "Aday Uyum Skoru": "Candidate Fit Score",
  "Aday randevu seçimi bekleniyor.": "Waiting for candidate appointment selection.",
  "Aday isterse hemen başlayabilir, ister daha sonra planlayabilir.":
    "The candidate can start immediately or plan for later.",
  "Aday vardiya çıkışı sonrası aranacak": "Candidate will be called after shift.",
  "Aday ve ilan seçimi zorunludur.": "Candidate and posting selection are required.",
  "ADAY: Son iş yerimde depoda ürün toplama yaptım...":
    "CANDIDATE: In my last role, I handled warehouse order picking...",
  "Adaylar yükleniyor...": "Loading candidates...",
  "AI Açıklaması": "AI Explanation",
  "AI bir sonraki soruyu hazırlıyor...": "AI is preparing the next question...",
  "AI bu değerlendirmeden emin": "AI is confident in this assessment",
  "AI bu değerlendirmeden emin değil — dikkatli inceleyin":
    "AI is not confident in this assessment — review carefully",
  "AI çalıştırılmadı": "AI not executed",
  "AI destek merkezi yüklenemedi.": "AI support center could not be loaded.",
  "AI destek merkezi yükleniyor...": "Loading AI support center...",
  "AI Görev Geçmişi": "AI Task History",
  "AI Görev Geçmişi (Teknik)": "AI Task History (Technical)",
  "AI görev hatası": "AI task error",
  "AI görev kaydı bulunamadı.": "No AI task record found.",
  "AI Görev Tetikleme": "AI Task Triggering",
  "AI Görev Tetikleme (Gelişmiş)": "AI Task Triggering (Advanced)",
  "AI görev yetkisi gerekli.": "AI task permission is required.",
  "AI görevi kuyruğa alınamadı.": "AI task could not be queued.",
  "AI görüşmeyi kapattı.": "AI closed the interview.",
  "AI görüşmeyi otomatik yönetiyor.": "AI is managing the interview automatically.",
  "AI Karar Özeti": "AI Decision Summary",
  "AI orta düzeyde emin": "AI is moderately confident",
  "AI Önerisi": "AI Recommendation",
  "AI özelliklerini buradan açıp kapatabilirsiniz. Otomatik red kuralı gereği kapalıdır.":
    "You can enable or disable AI features here. Auto-reject remains disabled by policy.",
  "AI Rapor ve Öneri Detayı": "AI Report and Recommendation Detail",
  "AI sadece tavsiye verir, nihai karar insanındır":
    "AI only provides recommendations; the final decision belongs to a human.",
  "AI sadece yardımcı": "AI is assistive only",
  "AI sadece yardımcı rol üstlenir": "AI serves only an assistive role",
  "AI sıradaki soruyu hazırlıyor.": "AI is preparing the next question.",
  "AI size sırayla sorular soracaktır.": "AI will ask you questions one by one.",
  "AI sorusu gösterildi. Yanıtınız için dinlemeye geçiliyor...":
    "AI question shown. Listening for your response...",
  "AI yanıtınızı değerlendiriyor.": "AI is evaluating your response.",
  "Aktif AI Sağlayıcıları": "Active AI Providers",
  "Aktif Başvurular": "Active Applications",
  "Aktif İlanlar": "Active Job Postings",
  "Aktif sağlayıcı:": "Active provider:",
  "Altyapı Durumu": "Infrastructure Status",
  "Arama kriterlerine uygun aday bulunamadı.": "No candidates matched the search criteria.",
  "Arşiv": "Archive",
  "Arşivlendi": "Archived",
  "Aşama": "Stage",
  "Aşama Değişiminde AI İncelemesi": "AI Review on Stage Change",
  "Aşama Geçmişi": "Stage History",
  "Aşama geçmişi yok.": "No stage history.",
  "Audit kayıtları yükleniyor...": "Loading audit records...",
  "Audit log verisi alınamadı.": "Could not fetch audit log data.",
  "Ayarlar yüklenemedi.": "Settings could not be loaded.",
  "Ayarlar yükleniyor...": "Loading settings...",
  "Bağlanılıyor...": "Connecting...",
  "Bağlantı Bekleniyor": "Waiting for connection",
  "Bağlantı Gönderildi": "Link Sent",
  "Bağlı": "Connected",
  "Başarısız": "Failed",
  "Başlangıç": "Start",
  "Başvuranlar": "Applicants",
  "Başvuru": "Application",
  "Başvuru Aç": "Open Application",
  "Başvuru açmak için bir iş ilanı seçmelisiniz.":
    "You must select a job posting to create an application.",
  "Başvuru Detayı": "Application Detail",
  "Başvuru detayı yüklenemedi.": "Application detail could not be loaded.",
  "Başvuru detayı yükleniyor...": "Loading application detail...",
  "Başvuru hatası": "Application error",
  "Başvuru oluşturulamadı.": "Application could not be created.",
  "Başvuru verileri alınamadı.": "Application data could not be retrieved.",
  "Başvuru Yönetimi": "Application Management",
  "Başvurular": "Applications",
  "Başvurular yükleniyor...": "Loading applications...",
  "Bekliyor": "Pending",
  "Belirgin risk kaydı yok.": "No notable risk records.",
  "Bir hata oluştu.": "An error occurred.",
  "Boş cevap gönderilemez.": "Empty answers cannot be submitted.",
  "Bu aday için henüz başvuru yok.": "There are no applications for this candidate yet.",
  "Bu aday için henüz CV incelemesi yapılmadı.": "CV review has not been completed for this candidate yet.",
  "Bu başvuru için AI görev kaydı bulunmadı.": "No AI task record found for this application.",
  "Bu başvuru için AI önerisi bulunmuyor.": "No AI recommendation found for this application.",
  "Bu başvuru için AI raporu bulunmuyor.": "No AI report found for this application.",
  "Bu başvuru için audit kaydı bulunmadı.": "No audit record found for this application.",
  "Bu başvuru için henüz ön değerlendirme yapılmadı.":
    "No pre-screening has been completed for this application yet.",
  "Bu başvuru için uyum skoru henüz hesaplanmadı.":
    "Fit score has not been calculated for this application yet.",
  "Bu başvuruya bağlı görüşme kaydı bulunmuyor.":
    "No interview record is linked to this application.",
  "Bu başvuruya bağlı insan onayı kaydı bulunmuyor.":
    "No human approval record is linked to this application.",
  "Bu filtreye uygun ilan bulunamadı.": "No postings matched this filter.",
  "Bu filtreye uygun mülakat oturumu bulunamadı.":
    "No interview sessions matched this filter.",
  "Bu görüşme randevusu iptal edilmiştir.": "This interview appointment has been cancelled.",
  "Bu ilana henüz aday başvurusu yok.": "There are no candidate applications for this posting yet.",
  "Cevap gönderilemedi.": "Response could not be submitted.",
  "CODE: açıklama": "CODE: description",
  "CSV Yükle": "Upload CSV",
  "CSV Aktarım": "CSV import",
  "Manuel Giriş": "Manual entry",
  "Referans": "Referral",
  "Doğrudan Başvuru": "Walk-in application",
  "Ajans": "Agency",
  "Kariyer Portalı": "Career portal",
  "CV inceleme hatası": "CV review error",
  "CV inceleme işlemi başlatılamadı.": "CV review process could not be started.",
  "CV incelemesi başarısız oldu.": "CV review failed.",
  "CV incelemesi tamamlandı.": "CV review completed.",
  "CV inceleniyor, lütfen bekleyin...": "CV is being reviewed, please wait...",
  "CV İşleme": "CV Processing",
  "CV kaydı yok": "No CV record",
  "CV Özeti": "CV Summary",
  "CV tabanlı": "CV-based",
  "CV yükleme hatası": "CV upload error",
  "CV yüklenemedi.": "CV could not be uploaded.",
  "CV'yi İncele": "Review CV",
  "Çalışma Zamanı Sağlayıcıları": "Runtime Providers",
  "Davet gönderiliyor...": "Sending invitation...",
  "Değer": "Value",
  "Değerlendir": "Evaluate",
  "Değerlendirme devam ediyor...": "Evaluation in progress...",
  "Değerlendirme Güveni": "Evaluation Confidence",
  "Değerlendirme tamamlandı": "Evaluation completed",
  "Değerlendirme yapılmadı": "Not evaluated",
  "Değiştiren": "Changed by",
  "Demo Davranış Durumu": "Demo Behavior Status",
  "Denetim kaydı bulunamadı.": "No audit record found.",
  "Deneyim boşluğu var": "There is an experience gap",
  "Deneyim özeti bulunamadı.": "Experience summary not found.",
  "Detaylı Skorlar": "Detailed Scores",
  "Devre Dışı": "Disabled",
  "Dış Kaynak Adı": "External Source Name",
  "Dosya Seç": "Select File",
  "Düşük güven": "Low confidence",
  "Ek inceleme gerekli.": "Additional review required.",
  "Eğitim geçmişi eksik": "Education history is missing",
  "Eksik alan işaretlenmedi.": "No missing field was marked.",
  "Eksik bilgi işaretlenmedi.": "No missing information was marked.",
  "ElevenLabs bağlantısı kurulamadı.": "ElevenLabs connection could not be established.",
  "En az 1 geçerli aday gerekli.": "At least 1 valid candidate is required.",
  "Feature flag güncellenemedi.": "Feature flag could not be updated.",
  "Filtreye uygun audit kaydı bulunamadı.": "No audit records matched the filter.",
  "Filtreye uygun başvuru bulunamadı.": "No applications matched the filter.",
  "Form doğrulama": "Form validation",
  "Geçerli aday bulunamadı. Başlık satırında 'Ad' veya 'Name' kolonu olmalı.":
    "No valid candidate found. Header row must contain an 'Ad' or 'Name' column.",
  "Geçersiz link. Lütfen e-postadaki linki kontrol ediniz.":
    "Invalid link. Please check the link in your email.",
  "Geçiş": "Transition",
  "Genel bakış verileri yüklenemedi.": "Overview data could not be loaded.",
  "Genel bakış yükleniyor...": "Loading overview...",
  "Gerçek LLM": "Real LLM",
  "Gerçek model çağrısı kullanılır.": "Real model call is used.",
  "Giriş başarısız.": "Sign in failed.",
  "Giriş yap": "Sign in",
  "Giriş yapılıyor...": "Signing in...",
  "Google Calendar Bağla": "Connect Google Calendar",
  "Google Calendar Bağlantısı": "Google Calendar Connection",
  "Görev": "Task",
  "Görev ID": "Task ID",
  "Görev Tipi": "Task Type",
  "Görüşme": "Interview",
  "Görüşme Akışı": "Interview Flow",
  "Görüşme bağlantısı geçersiz. Lütfen linki kontrol edin.":
    "Interview link is invalid. Please check the link.",
  "Görüşme başlatılamadı.": "Interview could not be started.",
  "Görüşme Bekliyor": "Interview Pending",
  "Görüşme daveti gönderildi. Aday randevu seçimi için e-posta alacak.":
    "Interview invitation sent. Candidate will receive an email to choose an appointment slot.",
  "Görüşme daveti gönderildi. Aday aynı e-postadan hemen başlayabilir veya daha sonra planlayabilir.":
    "Interview invitation sent. The candidate can start immediately from the same email or plan for later.",
  "Görüşme daveti gönderildi. Adaya direkt görüşme linki iletildi.":
    "Interview invitation sent. A direct interview link was delivered to the candidate.",
  "Görüşme daveti gönderilemedi.": "Interview invitation could not be sent.",
  "Görüşme daveti oluşturuldu.": "Interview invitation created.",
  "Görüşme Detayı": "Interview Detail",
  "Görüşme Devam": "Interview Ongoing",
  "Görüşme devam ediyor": "Interview in progress",
  "Görüşme Durumu": "Interview Status",
  "Görüşme Formatı": "Interview Format",
  "Görüşme Formatı:": "Interview Format:",
  "Görüşme hatası": "Interview error",
  "Görüşme kalitesi verisi henüz oluşmadı.": "Interview quality data is not available yet.",
  "Görüşme kayıtlarınız recruiter ekibi tarafından incelenecektir.":
    "Your interview records will be reviewed by the recruiter team.",
  "Görüşme Oturumları": "Interview Sessions",
  "Görüşme Oturumları Detayı": "Interview Sessions Detail",
  "Görüşme oturumu hazırlanıyor...": "Preparing interview session...",
  "Görüşme oturumu yüklenemedi.": "Interview session could not be loaded.",
  "Görüşme Planlama": "Interview Scheduling",
  "Görüşme planlama yetkisi gerekli.": "Interview scheduling permission is required.",
  "Görüşme Randevusu": "Interview Appointment",
  "Görüşme sonlandırıldı.": "Interview ended.",
  "Görüşme tamamlandı.": "Interview completed.",
  "Görüşme tamamlandı. Teşekkür ederiz.": "Interview completed. Thank you.",
  "Görüşme yaklaşık 15-20 dakika sürecektir.": "The interview will take about 15-20 minutes.",
  "Görüşmede Sorulması Gerekenler": "What Should Be Asked in Interview",
  "Görüşmeye Davet Et": "Invite to Interview",
  "Görüşmeye Katılın": "Join the Interview",
  "Güçlü": "Strong",
  "Güçlü Eşleşme": "Strong Match",
  "Güçlü Sinyaller": "Strong Signals",
  "Güçlü Yönler": "Strengths",
  "Güven": "Confidence",
  "Hayır (kural gereği)": "No (policy rule)",
  "Hayır (kural)": "No (rule)",
  "Hazır Değil": "Not Ready",
  "Henüz başvuru verisi bulunmuyor.": "No application data available yet.",
  "Henüz entegrasyon bağlantısı yapılmamış.": "No integration connection established yet.",
  "Henüz görüşme kaydı bulunmuyor.": "No interview record yet.",
  "Henüz incelenmedi": "Not reviewed yet",
  "Henüz not yok.": "No notes yet.",
  "Henüz soru-cevap kaydı oluşmadı.": "No question-answer record yet.",
  "Henüz yeterli veri bulunmuyor.": "Insufficient data yet.",
  "Her soruyu sesli veya yazılı olarak cevaplayabilirsiniz.":
    "You can answer each question by voice or text.",
  "Hesaplanıyor...": "Calculating...",
  "Hızlı İşlemler": "Quick Actions",
  "Integration connection kaydı yok.": "No integration connection record.",
  "Interview planlama başarısız.": "Interview scheduling failed.",
  "Interview session planlandı.": "Interview session scheduled.",
  "Interview timeline kaydı bulunamadı.": "Interview timeline record not found.",
  "Interview yeniden planlama başarısız.": "Interview rescheduling failed.",
  "İçe aktarılıyor...": "Importing...",
  "İK Uzmanı": "HR Specialist",
  "İlan": "Job Posting",
  "İlan Başlığı": "Job Posting Title",
  "İlan başlığı en az 3 karakter olmalı.": "Job title must be at least 3 characters.",
  "İlan detayı yükleniyor...": "Loading job posting detail...",
  "İlan oluşturulamadı.": "Job posting could not be created.",
  "İlanlar yüklenemedi.": "Job postings could not be loaded.",
  "İlanlar yükleniyor...": "Loading job postings...",
  "İlerleme": "Progress",
  "İlerlet": "Advance",
  "İletişim": "Contact",
  "İlgili çalışma alanı": "Relevant workspace",
  "İncele": "Review",
  "İnceleme": "Review",
  "İnceleme devam ediyor, sayfayı yenileyerek kontrol edebilirsiniz.":
    "Review is in progress, refresh the page to check updates.",
  "İnceleme Güveni": "Review Confidence",
  "İnceleme kaydediliyor...": "Saving review...",
  "İncelendi": "Reviewed",
  "İncelenemedi": "Review Failed",
  "İnceleniyor...": "Review in progress...",
  "İnceleniyor…": "Review in progress...",
  "İnsan Kararı": "Human Decision",
  "İnsan kararı zorunlu": "Human decision is mandatory",
  "İnsan Onay Kayıtları": "Human Approval Records",
  "İnsan onayı": "Human approval",
  "İnsan onayı kutusu işaretlenmelidir.": "Human approval checkbox must be selected.",
  "İnsan Onaylı Karar": "Human-approved Decision",
  "İptal edildi": "Cancelled",
  "İptal Edildi": "Cancelled",
  "İş Deneyimi Özeti": "Work Experience Summary",
  "İşe alım işletim paneli": "Recruitment operations dashboard",
  "İşe alım oranı": "Hiring rate",
  "İşe Alım Süresi (Ort.)": "Time to Hire (Avg.)",
  "İşe alım süresi verisi henüz oluşmadı.": "Time-to-hire data is not available yet.",
  "İşe alınan aday sayısı": "Number of hired candidates",
  "İşlem": "Action",
  "İşlem başarısız.": "Operation failed.",
  "İyi": "Good",
  "İyi Eşleşme": "Good Match",
  "Kalite incelemesi için session seçiniz.": "Select a session for quality review.",
  "Kalite skoru sayısal olmalıdır.": "Quality score must be numeric.",
  "Karar tipi": "Decision type",
  "Kanıt Bağlantıları": "Evidence Links",
  "Kanıt bağlantısı bulunamadı.": "No evidence links found.",
  "Kanıt bağlı recruiter raporu": "Evidence-linked recruiter report",
  "Kanıt Kaynakları": "Evidence Sources",
  "Kanıt metni bulunamadı.": "Evidence text not found.",
  "Kanıt sayısı": "Evidence count",
  "Karar gönderimi başarısız.": "Decision submission failed.",
  "Karar hatası": "Decision error",
  "Karar için neden kodu zorunludur.": "Reason code is required for a decision.",
  "Karar ve Aşama Yönetimi": "Decision and Stage Management",
  "Karar ve Teknik Aşama Yönetimi": "Decision and Technical Stage Management",
  "Kararı Kaydet": "Save Decision",
  "Kayıt": "Record",
  "Kayıt ID": "Record ID",
  "Kayıt Tarihi": "Record Date",
  "Kayıt tipi": "Record type",
  "Kaynak adı": "Source name",
  "Kaynak Bağlam": "Source Context",
  "Kısa Listeye Al": "Shortlist",
  "Kısa süreli iş deneyimleri": "Short employment tenures",
  "Konuşmanız otomatik kaydedilecek.": "Your speech will be recorded automatically.",
  "Kritik aksiyonlarda insan onayı": "Human approval on critical actions",
  "Lokasyon uyumsuzluğu": "Location mismatch",
  "Maaş Aralığı": "Salary Range",
  "Maaş beklentisi uyumsuz": "Salary expectation mismatch",
  "Manuel Planlama (Gelişmiş)": "Manual Scheduling (Advanced)",
  "Medyan süre": "Median time",
  "Metin okunamadı": "Text could not be read",
  "Metin tutarlılığı kontrol edildi": "Text consistency checked",
  "Mevcut Aşama": "Current Stage",
  "Mevcut Durum": "Current Status",
  "Mikrofon başlatılamadı. Yazılı yanıt verebilirsiniz.":
    "Microphone could not be started. You can answer in text.",
  "Mikrofon izni verilmedi. Yazılı yanıt verebilirsiniz.":
    "Microphone permission was denied. You can answer in text.",
  "Mikrofon kullanılamıyor. Yazılı yanıt verebilirsiniz.":
    "Microphone is unavailable. You can answer in text.",
  "Mikrofon kullanılamıyorsa yazılı yanıt verebilirsiniz.":
    "If microphone is unavailable, you can answer in text.",
  "Mikrofon ve görüşme oturumu hazırlanıyor.":
    "Preparing microphone and interview session.",
  "Minimum maaş maksimum maaştan büyük olamaz.":
    "Minimum salary cannot be greater than maximum salary.",
  "Mode Detayı (link notu/telefon/lokasyon)": "Mode Detail (link note/phone/location)",
  "Mülakat": "Interview",
  "Mülakat Daveti": "Interview Invitation",
  "Mülakat listesi yüklenemedi.": "Interview list could not be loaded.",
  "Mülakat oturumları yükleniyor...": "Loading interview sessions...",
  "Mülakata geçiş oranı": "Interview conversion rate",
  "Nihai kararı her zaman insan verir.": "The final decision is always made by a human.",
  "Nitelik adı (örnek: vardiya_uygunlugu)": "Qualification name (example: shift_eligibility)",
  "Nitelik adı (örnek: vardiya_uygunluğu)": "Qualification name (example: shift_eligibility)",
  "Oluşturma": "Creation",
  "Oluşturulma": "Created At",
  "Onay Kayıtları": "Approval Records",
  "Onaylandı": "Confirmed",
  "Onaylayın": "Confirm",
  "Orta Eşleşme": "Moderate Match",
  "Orta güven": "Medium confidence",
  "Ortalama süre": "Average time",
  "Otomatik (aktif bağlantı/fallback)": "Automatic (active integration/fallback)",
  "Otomatik Ön Değerlendirme": "Automatic Pre-screening",
  "Otomatik Red (Devre Dışı)": "Automatic Rejection (Disabled)",
  "Oturum Aç": "Sign In",
  "Oturum aktif değil.": "Session is not active.",
  "Oturum hatası": "Session error",
  "Oturum sonlandırılamadı.": "Session could not be terminated.",
  "Oturum verileri yükleniyor.": "Loading session data.",
  "Ön değerlendirme başlatıldı. Birkaç saniye içinde sonuç hazır olacak.":
    "Pre-screening started. The result will be ready in a few seconds.",
  "Ön değerlendirme yetkisi gerekli.": "Pre-screening permission is required.",
  "Ön değerlendirme zaten devam ediyor. Birkaç saniye içinde sonuç hazır olacak.":
    "Pre-screening is already in progress. The result will be ready in a few seconds.",
  "Ön eleme oranı": "Pre-screening rate",
  "Öneri ID": "Recommendation ID",
  "Önerilen Aksiyon": "Recommended Action",
  "Önerilen Sonraki Adım": "Recommended Next Step",
  "Örn. +90 5xx... veya Adres": "e.g. +90 5xx... or Address",
  "Özellik": "Feature",
  "Özellik kaydı bulunamadı.": "Feature record not found.",
  "Özet bulunamadı.": "Summary not found.",
  "Planlandı": "Scheduled",
  "Planlanıyor...": "Scheduling...",
  "Planlanmış": "Scheduled",
  "Pozisyon için fazla nitelikli": "Overqualified for the role",
  "Pozisyon için yetersiz nitelik": "Underqualified for the role",
  "Pozisyonun temel sorumlulukları, vardiya koşulları ve gerekli beklentiler...":
    "Core responsibilities, shift conditions, and required expectations for the role...",
  "Randevu oluşturulamadı.": "Appointment could not be created.",
  "Randevu Bekliyor": "Awaiting Appointment",
  "Randevu Seçin": "Select Appointment",
  "Randevunuz oluşturuldu!": "Your appointment has been created!",
  "Randevunuz oluşturulmuş": "Your appointment is already created",
  "Randevunuz oluşturuluyor...": "Your appointment is being created...",
  "Rapor + Öneri hazır": "Report + Recommendation ready",
  "Rapor güveni (ort.)": "Report confidence (avg.)",
  "Rapor İçgörüsü": "Report Insight",
  "Rapor örneklemi": "Report sample size",
  "Rapor ve Öneri Arşivi (Teknik)": "Report and Recommendation Archive (Technical)",
  "Rapor verileri yüklenemedi.": "Report data could not be loaded.",
  "Rapor/Öneri Geçmişi": "Report/Recommendation History",
  "Raporlar yükleniyor...": "Loading reports...",
  "Recruiter manuel incelemesi tamamlanmalıdır.":
    "Recruiter manual review must be completed.",
  "Riskler ve Uyarılar": "Risks and Warnings",
  "Sadece öneridir": "Recommendation only",
  "Sağlayıcı": "Provider",
  "Sağlayıcı bulunamadı.": "Provider not found.",
  "Screening hatası": "Screening error",
  "Screening support başlatılamadı.": "Screening support could not be started.",
  "Ses tanıma motoru kullanılamıyor.": "Speech recognition engine is unavailable.",
  "Ses/yanıt hatası": "Voice/response error",
  "Sesli Görüşmeyi Başlat": "Start Voice Interview",
  "Session aksiyonu başarısız.": "Session action failed.",
  "Session seçiniz": "Select session",
  "Session yeniden planlandı.": "Session rescheduled.",
  "Session yönetim yetkiniz yok.": "You do not have permission to manage session.",
  "Sırada": "Queued",
  "Sıralama": "Sorting",
  "Skor (Düşük)": "Score (Low)",
  "Skor (Yüksek)": "Score (High)",
  "Son AI Görev Çalışmaları": "Recent AI Task Runs",
  "Son AI Önerisi": "Latest AI Recommendation",
  "Son Güncelleme": "Last Update",
  "Sonraki Adım": "Next Step",
  "Sonraki Adımlar": "Next Steps",
  "Sonuç": "Result",
  "Sonuç hakkında en kısa sürede bilgilendirileceksiniz.":
    "You will be informed about the result as soon as possible.",
  "Soru sesi oynatılamadı. Yazılı yanıt verebilirsiniz.":
    "Question audio could not be played. You can answer in text.",
  "Soru tekrarlanamadı.": "Question could not be repeated.",
  "Sorularınız için recruiter ekibiyle iletişime geçebilirsiniz.":
    "For questions, you can contact the recruiter team.",
  "Soruyu cevaplamak için konuşun. AI sizi dinliyor.":
    "Speak to answer the question. AI is listening.",
  "Stage değişimi başarısız.": "Stage change failed.",
  "Stage değişimi için neden kodu zorunludur.": "Reason code is required for stage change.",
  "Stage Geçişi": "Stage Transition",
  "Aşama Geçişi": "Stage Transition",
  "Stage Güncelleme": "Stage Update",
  "Stage hatası": "Stage error",
  "Aşama hatası": "Stage error",
  "Stage ve Karar İşlemleri": "Stage and Decision Actions",
  "Stage'i Güncelle": "Update Stage",
  "Aşamayı Güncelle": "Update Stage",
  "Süreç:": "Process:",
  "Süresi Doldu": "Expired",
  "Şifre": "Password",
  "Şu anda bekleyen işlem bulunmuyor. Tüm süreçler yolunda.":
    "There are no pending actions right now. All processes are on track.",
  "Tarayıcı izin adımı dışında tur kontrolü sizden istenmez.":
    "No turn control is required from you except browser permission steps.",
  "Teknik Zaman Çizelgesi (Audit)": "Technical Timeline (Audit)",
  "Tekrar İncele": "Review Again",
  "Template seçiniz": "Select template",
  "Toplam Başvuru": "Total Applications",
  "Toplam İlan": "Total Job Postings",
  "Toplu Aday Ekle": "Bulk Add Candidates",
  "Rol Ailesi": "Role Family",
  "Departman": "Department",
  "Departman zorunludur.": "Department is required.",
  "Transcript Ekle / Güncelle": "Add / Update Transcript",
  "Transcript için session seçiniz.": "Select a session for transcript.",
  "Transcript kalite durumu güncellendi.": "Transcript quality status updated.",
  "Transcript kalite inceleme yetkiniz yok.":
    "You do not have transcript quality review permission.",
  "Transcript Kalite İncelemesi": "Transcript Quality Review",
  "Transcript kalite incelemesi başarısız.": "Transcript quality review failed.",
  "Transcript metni boş olamaz.": "Transcript text cannot be empty.",
  "Transcript sessiona bağlandı.": "Transcript attached to session.",
  "Transcript yönetim yetkiniz yok.": "You do not have transcript management permission.",
  "Transcript yükleme başarısız.": "Transcript upload failed.",
  "Transkript örneklemi": "Transcript sample size",
  "Tüm Kaynaklar": "All Sources",
  "Tümü": "All",
  "Uygun Saat Seçiniz": "Select Available Time",
  "Uygunluk/başlangıç tarihi belirsiz": "Availability/start date is unclear",
  "Uyum skorlama görevi kuyruğa alındı. Sonuç birkaç saniye içinde hazır olacak.":
    "Fit scoring task queued. The result will be ready in a few seconds.",
  "Uyum skoru hatası": "Fit score error",
  "Uyum skoru henüz hesaplanmadı.": "Fit score has not been calculated yet.",
  "Uyum skoru yüklenemedi.": "Fit score could not be loaded.",
  "Uyum skoru yükleniyor...": "Loading fit score...",
  "V1 Güvenlik Kuralı:": "V1 Security Rule:",
  "vardiyalı": "shift-based",
  "vardiyalı, tam zamanlı, yarı zamanlı...": "shift-based, full-time, part-time...",
  "Veri yüklenemedi.": "Data could not be loaded.",
  "Yanıt algılanamadı. Yeniden konuşabilir veya yazılı yanıt verebilirsiniz.":
    "Response could not be detected. You can speak again or answer in text.",
  "Yanıt bekleniyor...": "Waiting for answer...",
  "Yanıt duyulamadı. Tekrar dinleniyor...": "Response could not be heard. Listening again...",
  "Yanıt kaydedildi. AI sıradaki adımı belirliyor...":
    "Response saved. AI is determining the next step...",
  "Yanıtınız sesli olarak alınıyor.": "Your response is being captured by voice.",
  "Yanıtınızı buraya yazabilirsiniz.": "You can type your response here.",
  "Yapılandırılmadı": "Not configured",
  "Yapılandırılmış": "Configured",
  "Yapılandırılmış Sesli Ön Görüşme": "Structured Voice Pre-interview",
  "Yayında": "Published",
  "Yazılı Yanıt": "Text Response",
  "Yeniden İncele": "Re-review",
  "Yeniden planlama için session seçiniz.": "Select a session for rescheduling.",
  "Yeniden planlanıyor...": "Rescheduling...",
  "Yeniden planlanmalı": "Should be rescheduled",
  "Yetenekler tam olarak belirtilmemiş": "Skills are not clearly specified",
  "Yükleme": "Upload",
  "Yüklemek için bir CV dosyası seçin.": "Select a CV file to upload.",
  "Yüksek güven": "High confidence",
  "Zayıf": "Weak",
  "Zayıf Eşleşme": "Weak Match",
  "Planlanan, devam eden ve tamamlanan görüşmeleri takip edin. İnceleme bekleyenlere öncelik verin.":
    "Track scheduled, ongoing, and completed interviews. Prioritize items awaiting review.",
  "Planlanan Tarih": "Scheduled Date",
  "Aday Linki": "Candidate Link",
  "Aday bekleniyor": "Candidate is waiting",
  "Sonuçları İncele": "Review Results",
  "Depo Operasyon Personeli": "Warehouse Operations Staff",
  "Market Kasiyeri": "Store Cashier",
  "Müşteri Destek Temsilcisi": "Customer Support Representative",
  "Musteri Destek Temsilcisi": "Customer Support Representative",
  "Depo Elemanı": "Warehouse Worker",
  "Depo Elemani": "Warehouse Worker",
  "Satış Danışmanı": "Sales Associate",
  "Satis Danismani": "Sales Associate",
  "Perakende Mağaza": "Retail Store",
  "Perakende Magaza": "Retail Store",
  "Depo/Lojistik": "Warehouse/Logistics",
  "Operasyon": "Operations",
  "Aç": "Open",
  "AI task run kaydı bulunamadı.": "AI task run record not found.",
  "Ayşe Doğan; 0532 111 2233; ayse@email.com; İstanbul; 4\nAli Yılmaz; 0533 222 3344; ali@email.com; İstanbul; 3":
    "Ayse Dogan; 0532 111 2233; ayse@email.com; Istanbul; 4\nAli Yilmaz; 0533 222 3344; ali@email.com; Istanbul; 3",
  "Demo flag kaydı bulunamadı.": "Demo flag record not found.",
  "Feature Flag Kontrolü": "Feature Flag Control",
  "Hayır": "No",
  "Hazır": "Ready",
  "Hazırlanıyor": "Preparing",
  "Interview tabanlı": "Interview-based",
  "Interview tabanlı rapor/öneri görevleri kuyruğa alındı.":
    "Interview-based report/recommendation tasks queued.",
  "Interview/Report tabanlı": "Interview/Report-based",
  "İptal": "Cancelled",
  "İstanbul": "Istanbul",
  "Katılım Yok": "No-show",
  "LLM yoksa deterministic fallback kullanılır.":
    "If no LLM is available, deterministic fallback is used.",
  "Ön Değerlendirme": "Pre-screening",
  "Ön Değerlendirme Desteği": "Pre-screening Support",
  "Ön Değerlendirme Oluştur": "Create Pre-screening",
  "Ön Eleme": "Pre-screening",
  "Ön Eleme Başlat": "Start Pre-screening",
  "Ön Görüşme": "Pre-interview",
  "Öneri": "Recommendation",
  "Öneri İçgörüsü": "Recommendation Insight",
  "Öneri Oluşturma": "Recommendation Generation",
  "Örnek: warehouse, retail, call_center":
    "Example: warehouse, retail, call_center",
  "Örnek: Operasyon, Mağaza, Çağrı Merkezi":
    "Example: Operations, Store, Call Center",
  "Rapor Oluşturma": "Report Generation",
  "Screening tabanlı": "Screening-based",
  "Sertifika doğrulaması gerekli": "Certificate verification required",
  "Session başlatıldı.": "Session started.",
  "Session tamamlandı.": "Session completed.",
  "Türkiye odaklı AI destekli recruiter işletim paneli":
    "Turkey-focused AI-assisted recruiter operations dashboard",
  "Bugün dikkat edilmesi gerekenler ve işe alım süreçlerinizin özeti.":
    "Summary of today’s priorities and your hiring pipeline.",
  "Bu ekran aday listesi değil, işe alım operasyonunuzun genel özetidir.":
    "This screen is not a candidate list; it is your hiring operations overview.",
  "Bugün Yapılacaklar": "Today's Priorities",
  "Feedback Bekleyenler": "Awaiting Feedback",
  "Modül Görünümü": "Module Overview",
  "İş Kuyruğu": "Work Queue",
  "İş Kuyruğunu Aç": "Open Work Queue",
  "Mülakatlara Git": "Go to Interviews",
  "İlanlara Git": "Go to Jobs",
  "Raporlara Git": "Go to Reports",
  "İş Kuyruğu sayfası": "Work Queue page",
  "Başvuru Karar Merkezi": "Application Decision Center",
  "Bu ekran iş kuyruğudur. Aday profili ayrı sayfadadır; buradan ilan bazlı karar ekranına girilir.":
    "This screen is the work queue. Candidate profile is a separate page; from here you open the job-specific decision screen.",
  "Bu ekran aday profili değil, bu ilana ait başvurunun karar ve takip ekranıdır.":
    "This screen is not the candidate profile; it is the decision and tracking screen for this application.",
  "Karar Merkezi": "Decision Center",
  "Hızlı recruiter aksiyonları burada. Gelişmiş formlar aşağıda kalır.":
    "Quick recruiter actions live here. Advanced forms stay below.",
  "Başvuru Özeti": "Application Summary",
  "Ekip Notları": "Team Notes",
  "Toplam Kayıt": "Total Records",
  "Planlı Mülakat": "Scheduled Interviews",
  "Kişi Profili": "Person Profile",
  "Notu Kaydet": "Save Note",
  "Not eklemek için ek yetki gerekiyor.": "Additional permission is required to add notes.",
  "Mülakat tamamlandı, rapor ve öneri hazır. Recruiter kararı bekleniyor.":
    "Interview completed; report and recommendation are ready. Waiting for recruiter decision.",
  "AI ön değerlendirme yapıldı. Recruiter incelemesi bekleniyor.":
    "AI pre-screening completed. Waiting for recruiter review.",
  "Yeni başvurular henüz AI tarafından değerlendirilmedi.":
    "New applications have not yet been evaluated by AI.",
  "Karar Ver": "Decide",
  "Başvuruyu Aç": "Open Application",
  "İnceleme Bekliyor": "Awaiting Review",
  "Başvurdu": "Applied",
  "Mülakat Planlandı": "Interview Scheduled",
  "Mülakat Tamamlandı": "Interview Completed",
  "Karar Bekliyor": "Decision Pending",
  "Bekletildi": "On Hold",
  "İlerletildi": "Advanced",
  "Yönetici İncelemesi": "Hiring Manager Review",
  "Recruiter İncelemesi": "Recruiter Review",
  "Teklif": "Offer",
  "Teklife Geçti": "Moved to Offer",
  "Teklif Aşamasında": "Offer Stage",
  "Reddedildi": "Rejected",
  "İşe Alındı": "Hired",
  "Yeni Aşama": "New Stage"
});

Object.assign(EN_PHRASE_TRANSLATIONS, {
  "Yönetim ve Teknik Detaylar": "Management and Technical Details",
  "Yeni stage": "New stage",
  "Neden kodu": "Reason code",
  "Stage'i Update": "Update Stage",
  "Referans rapor": "Reference report",
  "CV Çözümleme": "CV Parsing",
  "Report Üretimi": "Report Generation",
  "Recommendation Üretimi": "Recommendation Generation",
  "Candidate Uyum Skorlama": "Candidate Fit Scoring",
  "Son AI Raporu": "Latest AI Report",
  "Report geçmişi": "Report history",
  "Recommendation geçmişi": "Recommendation history",
  "Entity bazlı audit logs": "Entity-based audit logs",
  "Teknik Detay": "Technical Details",
  "Adayın pozisyona uyumunu gösteren değerlendirme.":
    "Assessment showing the candidate's fit for the role.",
  "Uyum Skorunu Hesapla": "Calculate Fit Score",
  "Skoru Yenile": "Refresh Score",
  "Skoru Refresh": "Refresh Score",
  "Adayın başvuruya uygunluğu hakkında AI tavsiyesi.":
    "AI recommendation about the candidate's suitability for the application.",
  "Pre-screening Desteği": "Pre-screening Support",
  "Değerlendirme Paketi": "Review Pack",
  "Başlat": "Start",
  "Tamamla": "Complete",
  "Web Sesli": "Web Voice",
  "Session iptal edildi.": "Session cancelled.",
  "Transcript kaydediliyor...": "Saving transcript...",
  "Uyum skorlama tetiklenemedi.": "Fit scoring could not be triggered.",
  "Interview planlama yetkiniz yok.": "You do not have permission to schedule interviews.",
  "Interview tarihi zorunludur.": "Interview date is required.",
  "Interview yeniden planlama yetkiniz yok.":
    "You do not have permission to reschedule interviews.",
  "template mevcut": "template available",
  "template eksik (degraded)": "template missing (degraded)",
  CANDIDATE: "Candidate",
  "Aday uygun görünmekle birlikte sertifika teyidi sonrası karar verilmelidir.":
    "The candidate appears suitable, but a decision should be made after certificate verification.",
  "Aday uygun gorunmekle birlikte sertifika teyidi sonrasi karar verilmelidir.":
    "The candidate appears suitable, but a decision should be made after certificate verification.",
  "Candidate uygun görünmekle birlikte sertifika teyidi sonrası karar verilmelidir.":
    "The candidate appears suitable, but a decision should be made after certificate verification.",
  "Candidate uygun gorunmekle birlikte sertifika teyidi sonrasi karar verilmelidir.":
    "The candidate appears suitable, but a decision should be made after certificate verification.",
  "Adayın depo deneyimi mevcut.": "The candidate has warehouse experience.",
  "Adayin depo deneyimi mevcut.": "The candidate has warehouse experience.",
  "Adayın depo ve vardiya deneyimi role uyum sinyali veriyor.":
    "The candidate's warehouse and shift experience indicates role-fit signals.",
  "Adayin depo ve vardiya deneyimi role uyum sinyali veriyor.":
    "The candidate's warehouse and shift experience indicates role-fit signals.",
  "Aday depo operasyonunda 5 yıla yakın deneyim sinyali veriyor.":
    "The candidate shows signals of nearly 5 years of warehouse operations experience.",
  "Aday depo operasyonunda 5 yila yakin deneyim sinyali veriyor.":
    "The candidate shows signals of nearly 5 years of warehouse operations experience.",
  "Aday role temel uyum sinyali veriyor ancak sertifika teyidi kritik.":
    "The candidate shows baseline role-fit signals, but certificate verification is critical.",
  "Adayı recruiter review aşamasında tutup sertifika teyidi sonrası karar verin.":
    "Keep the candidate in recruiter review and decide after certificate verification.",
  "Adayi recruiter review asamasinda tutup sertifika teyidi sonrasi karar verin.":
    "Keep the candidate in recruiter review and decide after certificate verification.",
  "Aday sertifika yenilemesinin devam ettiğini belirtti.":
    "The candidate stated that certificate renewal is still in progress.",
  "Aday sertifika yenilemesinin devam ettigini belirtti.":
    "The candidate stated that certificate renewal is still in progress.",
  "Aday gece vardiyası deneyimini belirtti.": "The candidate stated night-shift experience.",
  "Aday gece vardiyasi deneyimini belirtti.": "The candidate stated night-shift experience.",
  "Aday gece vardiyası tecrübesini aktardı.": "The candidate reported night-shift experience.",
  "Aday gece vardiyasi tecrubesini aktardi.": "The candidate reported night-shift experience.",
  "Aday vardiya uygunluğu sinyali verdi.": "The candidate showed shift-suitability signals.",
  "Aday vardiya uygunlugu sinyali verdi.": "The candidate showed shift-suitability signals.",
  "Gece vardiyasında çalışma beyan edildi.": "Night-shift availability was stated.",
  "Gece vardiyasinda calisma beyan edildi.": "Night-shift availability was stated.",
  "Interview transcriptinde vardiya uyumu sinyali var.":
    "The interview transcript shows shift-compatibility signals.",
  "Belge teyidi sonrası candidate yeniden değerlendirilsin.":
    "Reassess the candidate after document verification.",
  "Belge teyidi sonrasi candidate yeniden degerlendirilsin.":
    "Reassess the candidate after document verification.",
  "Depo deneyimi mevcut.": "Warehouse experience is present.",
  "Vardiya uyumu sinyali pozitif.": "Shift-compatibility signal is positive.",
  "Belge teyidi bitmeden final ilerleme önerilmez.":
    "Final progression is not recommended before document verification.",
  "Belge teyidi bitmeden final ilerleme onerilmez.":
    "Final progression is not recommended before document verification.",
  "Sertifika teyidi tamamlanmadan ilerleme riski bulunuyor.":
    "There is progression risk before certificate verification is complete.",
  "Sertifika dokümanı teyit adımını tamamla.":
    "Complete the certificate document verification step.",
  "Sertifika dokumani teyit adimini tamamla.":
    "Complete the certificate document verification step.",
  "Candidate sertifika yenilemesinin devam ettiğini belirtti.":
    "The candidate stated that certificate renewal is still in progress.",
  "Candidate sertifika yenilemesinin devam ettigini belirtti.":
    "The candidate stated that certificate renewal is still in progress.",
  "Sertifika doğrulama adımını tamamlayıp tekrar değerlendir.":
    "Complete the certificate verification step and reassess.",
  "Sertifika dogrulama adimini tamamlayip tekrar degerlendir.":
    "Complete the certificate verification step and reassess.",
  "Sertifika teyidi sonrasi recruiter degerlendirmesi ile ilerleyin.":
    "Proceed with recruiter evaluation after certificate verification.",
  "Neden Uygun?": "Why Fit?",
  "Ne Risk Var?": "What Risks Exist?",
  "Belirsizlik (orta)": "Uncertainty (medium)",
  "Depo Operations Sesli İlk Interview V1": "Warehouse Operations Voice Initial Interview V1",
  "Depo Operations Sesli Ilk Interview V1": "Warehouse Operations Voice Initial Interview V1",
  "Sertifika doğrulaması tamamlanmadı.": "Certificate verification is not completed.",
  "Sertifika dogrulamasi tamamlanmadi.": "Certificate verification is not completed.",
  "Sertifika doğrulaması tamamlanmadan nihai karar verilmemeli.":
    "A final decision should not be made before certificate verification is completed.",
  "Sertifika dogrulamasi tamamlanmadan nihai karar verilmemeli.":
    "A final decision should not be made before certificate verification is completed.",
  "Sertifika doğrulaması eksik": "Certificate verification is missing",
  "Sertifika dogrulamasi eksik": "Certificate verification is missing",
  "Sertifika doğrulama adımı tamamlanmadan ilerleme kararı riskli olabilir.":
    "Progression decisions may be risky before the certificate verification step is completed.",
  "Sertifika dogrulama adimi tamamlanmadan ilerleme karari riskli olabilir.":
    "Progression decisions may be risky before the certificate verification step is completed.",
  "Sertifika teyidi henüz tamamlanmadı.": "Certificate verification has not been completed yet.",
  "Sertifika teyidi henuz tamamlanmadi.": "Certificate verification has not been completed yet.",
  "Belge teyidi eksik.": "Document verification is missing.",
  "Belge teyidi tamamlanmadan nihai karar verilmemeli.":
    "A final decision should not be made before document verification is completed.",
  "Belge teyidi tamamlanana kadar recruiter review'da tut.":
    "Keep it in recruiter review until document verification is completed.",
  "Belgeyi doğrulayıp screening notunu güncelleyin.":
    "Verify the document and update the screening note.",
  "Belgeyi dogrulayip screening notunu guncelleyin.":
    "Verify the document and update the screening note.",
  "Sertifika kontrolü sonrası ilerletme değerlendirilebilir.":
    "Advancement can be considered after certificate verification.",
  "Sertifika kontrolu sonrasi ilerletme degerlendirilebilir.":
    "Advancement can be considered after certificate verification.",
  "Sertifika yenileme süreci devam ediyor.": "Certificate renewal process is ongoing.",
  "Sertifika yenileme sureci devam ediyor.": "Certificate renewal process is ongoing.",
  "Sertifika yenileme süreci olduğu belirtildi.":
    "It was stated that the certificate renewal process is ongoing.",
  "Sertifika yenileme sureci oldugu belirtildi.":
    "It was stated that the certificate renewal process is ongoing.",
  "Forklift sertifika dokümanının güncel kopyası bekleniyor.":
    "An up-to-date copy of the forklift certificate document is pending.",
  "Forklift sertifika dokumaninin guncel kopyasi bekleniyor.":
    "An up-to-date copy of the forklift certificate document is pending.",
  "Forklift sertifika teyidi tamamlanmadan kesin ilerleme önerilmez.":
    "Definitive advancement is not recommended before forklift certificate verification is completed.",
  "Forklift sertifika teyidi tamamlanmadan kesin ilerleme onerilmez.":
    "Definitive advancement is not recommended before forklift certificate verification is completed.",
  "Forklift sertifika belgesinin güncel kopyası":
    "Up-to-date copy of the forklift certificate",
  "Forklift sertifika belgesinin guncel kopyasi":
    "Up-to-date copy of the forklift certificate",
  "Forklift sertifika belgesinin doğrulanması": "Verification of the forklift certificate",
  "Forklift sertifika belgesinin dogrulanmasi": "Verification of the forklift certificate",
  "Vardiya uyum sinyali": "Shift-compatibility signal",
  "Vardiya çalışma sinyali mevcut.": "Shift-work signal is present.",
  "Vardiya calisma sinyali mevcut.": "Shift-work signal is present.",
  "Depo operasyon deneyimi": "Warehouse operations experience",
  "Depo operasyon deneyimi role ilişkin temel uyum gösteriyor.":
    "Warehouse operations experience shows baseline fit for the role.",
  "Depo operasyon deneyimi role iliskin temel uyum gosteriyor.":
    "Warehouse operations experience shows baseline fit for the role.",
  "Depo operasyonu, stok kontrolü ve sevkiyat hazırlama adımlarında deneyim mevcut.":
    "There is experience in warehouse operations, stock control, and shipment preparation steps.",
  "Depo operasyonu, stok kontrolu ve sevkiyat hazirlama adimlarinda deneyim mevcut.":
    "There is experience in warehouse operations, stock control, and shipment preparation steps.",
  "Depo operasyonunda hızlı adapte olma ihtimali yüksek olabilir.":
    "There may be a high likelihood of fast adaptation in warehouse operations.",
  "Depo operasyonunda hizli adapte olma ihtimali yuksek olabilir.":
    "There may be a high likelihood of fast adaptation in warehouse operations.",
  "Depo/Lojistik role geçiş için pozitif sinyal":
    "Positive signal for transition into warehouse/logistics roles",
  "Depo/Lojistik role gecis icin pozitif sinyal":
    "Positive signal for transition into warehouse/logistics roles",
  "Perakende ve kasa deneyimi kasiyer rolüne temel uyum sinyali veriyor.":
    "Retail and cashier experience provides baseline fit signals for the cashier role.",
  "Perakende ve kasa deneyimi kasiyer rolune temel uyum sinyali veriyor.":
    "Retail and cashier experience provides baseline fit signals for the cashier role.",
  "Perakende deneyimi sayesinde role temel uyum sinyali güçlü.":
    "Retail experience provides a strong baseline role-fit signal.",
  "Perakende deneyimi sayesinde role temel uyum sinyali guclu.":
    "Retail experience provides a strong baseline role-fit signal.",
  "Müşteri iletişim senaryosu sonrası karar verilmesi uygun.":
    "It is appropriate to decide after a customer-communication scenario.",
  "Musteri iletisim senaryosu sonrasi karar verilmesi uygun.":
    "It is appropriate to decide after a customer-communication scenario.",
  "Kısa bir müşteri senaryosu görüşmesi sonrası screening tamamlanabilir.":
    "Screening can be completed after a short customer-scenario interview.",
  "Kisa bir musteri senaryosu gorusmesi sonrasi screening tamamlanabilir.":
    "Screening can be completed after a short customer-scenario interview.",
  "Temel screening bilgisi yeterli.": "Basic screening information is sufficient.",
  "REPORT_GENERATION için tamamlanmış interview session bulunamadı.":
    "No completed interview session was found for REPORT_GENERATION.",
  "REPORT_GENERATION icin tamamlanmis interview session bulunamadi.":
    "No completed interview session was found for REPORT_GENERATION.",
  "REPORT_GENERATION task'i için interview session bağlamı bulunamadı.":
    "No interview session context was found for the REPORT_GENERATION task.",
  "REPORT_GENERATION task'i icin interview session baglami bulunamadi.":
    "No interview session context was found for the REPORT_GENERATION task.",
  "Mülakat oturumu olmadığı için rapor üretilemedi.":
    "The report could not be generated because there is no interview session.",
  "Mulakat oturumu olmadigi icin rapor uretilemedi.":
    "The report could not be generated because there is no interview session.",
  "Başvuru stage bilgisi screening bağlamı olarak kullanıldı.":
    "Application stage information was used as screening context.",
  "Basvuru stage bilgisi screening baglami olarak kullanildi.":
    "Application stage information was used as screening context.",
  "sertifika doğrulaması bekleniyor": "certificate verification is pending",
  "sertifika dogrulamasi bekleniyor": "certificate verification is pending",
  "vardiya düzeni": "shift schedule",
  "vardiya duzeni": "shift schedule",
  "Vardiya uyumu": "Shift compatibility",
  "Vardiya ve operasyon deneyimi metinde yer alıyor.":
    "Shift and operations experience appears in the text.",
  "Vardiya ve operasyon deneyimi metinde yer aliyor.":
    "Shift and operations experience appears in the text.",
  "Birden fazla depo rol sinyali bulundu.": "Multiple warehouse role signals were detected.",
  "kasa işlemleri, müşteri iletişim, vardiya planına uyum":
    "checkout operations, customer communication, alignment with shift planning",
  "kasa islemleri, musteri iletisim, vardiya planina uyum":
    "checkout operations, customer communication, alignment with shift planning",
  "2 yıl depo deneyimi": "2 years of warehouse experience",
  "2 yil depo deneyimi": "2 years of warehouse experience"
});

Object.assign(EN_PHRASE_TRANSLATIONS, {
  Beklet: "Hold",
  Riskler: "Risks",
  "Sertifika teyidi sonrası recruiter değerlendirmesi ile ilerleyin.":
    "Proceed with recruiter evaluation after certificate verification.",
  "Sertifika teyidi sonrası recruiter değerlendirmesi ile ilerleyin":
    "Proceed with recruiter evaluation after certificate verification.",
  "Sertifika teyidi sonrasi recruiter degerlendirmesi ile ilerleyin.":
    "Proceed with recruiter evaluation after certificate verification.",
  "Sertifika teyidi sonrasi recruiter degerlendirmesi ile ilerleyin":
    "Proceed with recruiter evaluation after certificate verification.",
  "Candidate depo operasyonunda 5 yıla yakın deneyim sinyali veriyor.":
    "The candidate shows signals of nearly 5 years of warehouse operations experience.",
  "Candidate depo operasyonunda 5 yıla yakın deneyim sinyali veriyor":
    "The candidate shows signals of nearly 5 years of warehouse operations experience.",
  "Candidate depo operasyonunda 5 yila yakin deneyim sinyali veriyor.":
    "The candidate shows signals of nearly 5 years of warehouse operations experience.",
  "Candidate depo operasyonunda 5 yila yakin deneyim sinyali veriyor":
    "The candidate shows signals of nearly 5 years of warehouse operations experience.",
  "Vardiya çalışma sinyali mevcut.": "Shift-work signal is present.",
  "Vardiya çalışma sinyali mevcut": "Shift-work signal is present.",
  "Vardiya calisma sinyali mevcut.": "Shift-work signal is present.",
  "Vardiya calisma sinyali mevcut": "Shift-work signal is present.",
  "Forklift sertifikası yenileme süreci tamamlanmamış.":
    "Forklift certificate renewal process is not completed.",
  "Forklift sertifikası yenileme süreci tamamlanmamış":
    "Forklift certificate renewal process is not completed.",
  "Forklift sertifikası yenileme süreci tamamlanmamış olabilir.":
    "Forklift certificate renewal process may not be completed.",
  "Forklift sertifikası yenileme süreci tamamlanmamış olabilir":
    "Forklift certificate renewal process may not be completed.",
  "Forklift sertifikasi yenileme sureci tamamlanmamis.":
    "Forklift certificate renewal process is not completed.",
  "Forklift sertifikasi yenileme sureci tamamlanmamis olabilir.":
    "Forklift certificate renewal process may not be completed.",
  sertifika_dogrulama_dokumani: "certificate_verification_document",
  "Interview daveti gönderildiğinde, candidate e-posta ile randevu seçim linki alır ve kendi uygun olduğu zamanı seçer.":
    "When the interview invitation is sent, the candidate receives an email with an appointment-selection link and chooses a suitable time.",
  "Interview daveti gönderildiğinde, candidate e-posta ile randevu seçim linki alır ve kendi uygun olduğu zamanı seçer":
    "When the interview invitation is sent, the candidate receives an email with an appointment-selection link and chooses a suitable time.",
  "Görüşme daveti gönderildiğinde, aday e-posta ile randevu seçim linki alır ve kendi uygun olduğu zamanı seçer.":
    "When the interview invitation is sent, the candidate receives an email with an appointment-selection link and chooses a suitable time.",
  "Aday e-posta ile direkt AI görüşme linki alır. İster hemen katılır, ister aynı e-postadaki planlama linkiyle daha sonraki bir zamanı seçer.":
    "The candidate receives a direct AI interview link by email. They can join immediately or choose a later time from the planning link in the same email.",
  "Görüşme daveti gönderildiğinde aday önce direkt AI görüşme linki alır. Uygun değilse aynı e-postadaki planlama linkiyle daha sonraki bir zamanı seçebilir.":
    "When the interview invitation is sent, the candidate first receives a direct AI interview link. If it is not convenient, they can choose a later time from the planning link in the same email.",
  "Belge teyidi sonrası candidate yeniden değerlendirilsin.":
    "Reassess the candidate after document verification.",
  "Belge teyidi sonrası candidate yeniden değerlendirilsin":
    "Reassess the candidate after document verification.",
  "Belge teyidi sonrasi candidate yeniden degerlendirilsin.":
    "Reassess the candidate after document verification.",
  "Belge teyidi sonrasi candidate yeniden degerlendirilsin":
    "Reassess the candidate after document verification.",
  "Interview transcriptinde vardiya uyumu sinyali var.":
    "The interview transcript shows shift-compatibility signals.",
  "Interview transcriptinde vardiya uyumu sinyali var":
    "The interview transcript shows shift-compatibility signals.",
  "V1 Security Rule: AI çıktısı otomatik karar uygulamaz. Stage etkileyen tüm kararlar recruiter/hiring manager onayı ve audit izi ile tamamlanır.":
    "V1 Security Rule: AI output cannot apply automatic decisions. All stage-impacting decisions require recruiter/hiring manager approval and an audit trail.",
  "AI çıktısı otomatik karar uygulamaz. Stage etkileyen tüm kararlar recruiter/hiring manager onayı ve audit izi ile tamamlanır.":
    "AI output cannot apply automatic decisions. All stage-impacting decisions require recruiter/hiring manager approval and an audit trail."
});

Object.assign(EN_PHRASE_TRANSLATIONS, {
  "AI ile İlan Taslağı": "AI Posting Draft",
  "Pozisyon bilgilerini girin. AI taslak oluşturup harici platformlara kopyalayabilirsiniz.":
    "Enter the position details. AI can generate a draft and you can copy it to external platforms.",
  "Departman seçtiğinizde önerilen nitelikler otomatik eklenir. Dilediğiniz gibi düzenleyebilirsiniz.":
    "Recommended qualifications are added automatically when you select a department. You can edit them as you like.",
  "İlan Durumu": "Job Posting Status",
  "Maaş Alt Sınır (₺)": "Minimum Salary (₺)",
  "Maaş Üst Sınır (₺)": "Maximum Salary (₺)",
  "Örn: Depo Operasyon Personeli": "E.g. Warehouse Operations Staff",
  "Örn: İstanbul, Ankara, Bursa": "E.g. Istanbul, Ankara, Bursa",
  "Örn: 28000": "E.g. 28000",
  "Örn: 36000": "E.g. 36000",
  "Örn: Daha samimi bir dil kullan, maaş bilgisini vurgula":
    "E.g. Use a friendlier tone and emphasize the salary",
  "Taslağı beğenmediyseniz notunuzu yazıp tekrar oluşturun.":
    "If you don't like the draft, leave a note and generate it again.",
  "Yayında slotunuz dolu olduğu için bu ilanı önce taslak olarak hazırlayabilirsiniz.":
    "Your published slots are full, so you can prepare this posting as a draft first.",
  "Mülakat daveti": "Interview invitation",
  "Gönderilen AI mülakat linki": "Sent AI interview link",
  "Gönderilen AI mülakat linkini aç": "Open the sent AI interview link",
  "Son geçerlilik": "Valid until",
  "AI Ön Eleme Sırada": "AI Pre-screening Queued",
  "AI Ön Eleme Başlayacak": "AI Pre-screening Starting",
  "Başvuru yeni eklendi; screening ve fit score hazırlanacak.":
    "The application was just added; screening and fit score are being prepared.",
  "Skor ve recruiter review paketi hazırlanıyor.":
    "The score and recruiter review pack are being prepared.",
  "Sourcing outreach gönderilmiş. Yanıt gelirse hızlıca akışa alın.":
    "Sourcing outreach has been sent. Move the candidate into the flow quickly if they reply.",
  "AI değerlendirmesini inceleyip recruiter kararını verin.":
    "Review the AI evaluation and make the recruiter decision.",
  "Ön eleme tamamlandı. Tek tıkla AI first interview gönderebilirsiniz.":
    "Pre-screening is complete. You can send the AI first interview in one click.",
  "İlan arşivlenecek ve yeni başvuru kabul edilmeyecek. Onaylıyor musunuz?":
    "This posting will be archived and no new applications will be accepted. Do you confirm?",
  "CV Yükle": "Upload CV",
  "Toplu CV Yükle": "Bulk CV Upload",
  "PDF ve DOCX başta olmak üzere CV dosyalarını topluca bırakın. Sistem aday kaydını oluşturur, CV'yi parse eder ve değerlendirme zincirini kuyruğa alır.":
    "Drop CV files in bulk, especially PDF and DOCX. The system creates candidate records, parses the CV, and queues the evaluation chain.",
  "Yalnızca PDF, DOC, DOCX veya TXT dosyaları yüklenebilir.":
    "Only PDF, DOC, DOCX, or TXT files can be uploaded.",
  "En az bir CV dosyası ekleyin.": "Add at least one CV file.",
  "CV yükleme işlemi tamamlanamadı.": "CV upload could not be completed.",
  "CV dosyalarını buraya bırakın": "Drop CV files here",
  Kaldır: "Remove",
  "✓ İlerlet — Güçlü uyum tespit edildi": "Advance — Strong fit detected",
  "🔍 İncele — Detaylı değerlendirme önerilir": "Review — Detailed evaluation is recommended",
  "✕ Reddet — Uyum düşük": "Reject — Low fit",
  "Taslak oluşturuldu": "Draft created",
  "Yanıt geldi": "Reply received",
  "Gönderime hazır": "Ready to send",
  "Gönderim başarısız": "Send failed",
  "Gönderim iptal edildi": "Sending canceled",
  "Outreach bilgisi yok": "No outreach information",
  "AI Ön Eleme Bekleniyor": "Awaiting AI Pre-screening",
  "Ön eleme tamamlandı; AI first interview daveti göndermeye hazır.":
    "Pre-screening is complete; ready to send the AI first interview invitation.",
  "AI mülakat tamamlandı; raporu inceleyip recruiter kararını verin.":
    "The AI interview is complete; review the report and make the recruiter decision.",
  "Sourcing outreach gönderildi; yanıt gelirse hızlıca değerlendirin.":
    "Sourcing outreach has been sent; review quickly if a reply comes in.",
  "Applicant akışı screening ve fit score adımlarını sürdürüyor.":
    "The applicant flow is continuing through screening and fit score steps.",
  "Bağlı değil": "Not connected",
  "Seçili ilan": "Selected job",
  "yıl deneyim": "years experience",
  "Yüklenen CV'leri otomatik inceler ve özet çıkarır.":
    "Automatically reviews uploaded CVs and creates a summary.",
  "Başvuru geldiğinde AI ön eleme yapar.": "Runs AI pre-screening when an application arrives.",
  "Aday değerlendirme raporu üretir.": "Generates candidate evaluation reports.",
  "Uygunluk önerisi ve skor hesaplar.": "Calculates fit suggestions and scores.",
  "Yeni başvurularda otomatik ön eleme başlatır.":
    "Automatically starts pre-screening for new applications.",
  "Aşama geçişlerinde otomatik AI incelemesi yapar.":
    "Runs automatic AI review on stage transitions.",
  "Kural gereği kapalı tutulur.": "Kept disabled by policy.",
  "Davet Bekliyor": "Invite Pending",
  "Ayarlar yüklenemedi.": "Settings could not be loaded.",
  "Feature flag güncellenemedi.": "Feature flag could not be updated.",
  "Davet gönderilemedi.": "Invitation could not be sent.",
  "Davet tekrar gönderilemedi.": "Invitation could not be resent.",
  "Rol güncellenemedi.": "Role could not be updated.",
  "Durum güncellenemedi.": "Status could not be updated.",
  "Sahiplik devredilemedi.": "Ownership could not be transferred.",
  "kullanıcısını pasifleştirmek istiyor musunuz?":
    "do you want to deactivate this user?",
  "kullanıcısını yeni hesap sahibi yapmak istiyor musunuz?":
    "do you want to make this user the new account owner?",
  "Plan ödeme linki hazırlandı.": "Plan payment link is ready.",
  "Plan ödeme bağlantısı oluşturulamadı.": "Plan payment link could not be created.",
  "Add-on ödeme linki hazırlandı.": "Add-on payment link is ready.",
  "Add-on ödeme bağlantısı oluşturulamadı.": "Add-on payment link could not be created.",
  "Stripe müşteri portalı açıldı.": "Stripe customer portal opened.",
  "Müşteri portalı açılamadı.": "Customer portal could not be opened.",
  "Enterprise teklif ödeme linki hazırlandı.": "Enterprise quote payment link is ready.",
  "Enterprise teklif bağlantısı oluşturulamadı.": "Enterprise quote link could not be created.",
  "Ödeme linki göndermek için e-posta giriniz.":
    "Enter an email to send the payment link.",
  "Ödeme linki gönderilemedi.": "Payment link could not be sent.",
  "Calendly henüz yapılandırılmamış.": "Calendly is not configured yet.",
  "Henüz yapılandırılmamış.": "Not configured yet."
});

Object.assign(EN_PHRASE_TRANSLATIONS, {
  "Rapor verileri yüklenemedi.": "Report data could not be loaded.",
  "Raporlar yükleniyor...": "Loading reports...",
  "İşe alım süreçlerinizin performansını ve dönüşüm oranlarını takip edin.":
    "Track the performance and conversion rates of your hiring workflows.",
  "Aktif İlanlar": "Active job postings",
  "Değerlendirme Güveni": "Evaluation confidence",
  "Ön eleme oranı": "Screening rate",
  "Mülakata geçiş oranı": "Interview progression rate",
  "İşe alınan aday sayısı": "Number of hires",
  "Ortalama süre": "Average time",
  "Medyan süre": "Median time",
  "İşe alım süresi verisi henüz oluşmadı.": "Time-to-hire data is not available yet.",
  "Transkript kalitesi (ort.)": "Transcript quality (avg.)",
  "Rapor güveni (ort.)": "Report confidence (avg.)",
  "Transkript örneklemi": "Transcript sample size",
  "Rapor örneklemi": "Report sample size",
  "Görüşme kalitesi verisi henüz oluşmadı.": "Interview quality data is not available yet.",
  "AI destek merkezi yüklenemedi.": "AI support center could not be loaded.",
  "Sağlayıcı bulunamadı.": "No provider was found.",
  "LLM yoksa deterministic fallback kullanılır.": "A deterministic fallback is used when no LLM is available.",
  "Gerçek model çağrısı kullanılır.": "A live model call is used.",
  "AI sadece yardımcı": "AI is advisory only",
  "Otomatik red": "Automatic rejection",
  "Hayır (kural)": "No (policy)",
  "Kritik aksiyonlarda insan onayı": "Human approval for critical actions",
  "Infrastructure Readiness": "Infrastructure Readiness",
  "CV Extraction": "CV Extraction",
  "Speech Runtime": "Speech Runtime",
  "Calendly OAuth": "Calendly OAuth",
  "Google OAuth": "Google OAuth",
  "Email Provider": "Email Provider",
  "Demo akışında kullanılan AI bayrakları. `ai.auto_reject.enabled` kural gereği açılamaz.":
    "AI flags used in the demo flow. `ai.auto_reject.enabled` cannot be enabled by policy.",
  "Bu alanda sadece hesap sahibi değişiklik yapabilir. Siz salt okunur görünümdesiniz.":
    "Only the account owner can make changes in this area. You are in read-only mode.",
  "Feature flag güncellenemedi.": "The feature flag could not be updated.",
  "Outreach Composer": "Outreach Composer",
  Alıcılar: "Recipients",
  Template: "Template",
  "Mail konusu": "Email subject",
  "Recruiter review sonrası tekli veya bulk e-posta gönderin.":
    "Send single or bulk emails after recruiter review.",
  "Recruiter Review Notu": "Recruiter Review Note",
  "Bu mesaj neden uygun, hangi segment için gidiyor?":
    "Why is this message appropriate, and which segment is it for?",
  "Sequence Foundation": "Sequence Foundation",
  "Taslak Olarak Kaydet": "Save as Draft",
  Gönder: "Send",
  "Discovery Kalitesi": "Discovery Quality",
  "Sayfa tipi": "Page type",
  "Özet Profil": "Profile Summary",
  "Güncel rol": "Current role",
  "Neden Uygun?": "Why is this a fit?",
  "Henüz belirgin güçlü sinyal yok.": "There are no strong signals yet.",
  "Riskler ve Eksikler": "Risks and Gaps",
  "Kanıtlar": "Evidence",
  "Beceriler ve Diller": "Skills and Languages",
  "Kaynak Provenance": "Source Provenance",
  "Outreach Geçmişi": "Outreach History",
  "Hızlı değerlendirme notu...": "Quick evaluation note...",
  "Akışa Alındı": "Moved into workflow",
  "Uygun Değil": "Not a Fit",
  "Giriş başarısız.": "Sign-in failed.",
  "Hesabınıza giriş yapın": "Sign in to your account",
  "Kullanıcı Adı / E-posta": "Username / Email",
  "Giriş yapılıyor...": "Signing in...",
  "Giriş Yap": "Sign In",
  "Demo hesabıyla giriş yap": "Sign in with demo account",
  "Ana sayfaya dön": "Back to home",
  "Hesap oluştur": "Create account",
  "Şifre en az 8 karakter olmalıdır.": "Password must be at least 8 characters.",
  "Şifre tekrar alanı eşleşmiyor.": "Password confirmation does not match.",
  "Hesap oluşturulamadı.": "Account could not be created.",
  "Hesap Oluştur": "Create Account",
  "İlk kullanıcı otomatik olarak owner olur. Aktif auth modu:":
    "The first user becomes the owner automatically. Active auth mode:",
  "Şirket Adı": "Company Name",
  "Hesap oluşturuluyor...": "Creating account...",
  "Zaten hesabınız varsa": "If you already have an account,",
  "giriş yapın": "sign in",
  "Landing sayfasına dönmek için": "To go back to the landing page,",
  buraya: "here",
  "tıklayın": "click",
  "Veriler yüklenemedi.": "Data could not be loaded.",
  "Kullanım ve limitler": "Usage and limits",
  "Aktif + davet bekleyen ekip hesabı": "Active and pending invited team accounts",
  "Henüz ekip üyesi bulunmuyor.": "There are no team members yet.",
  "Davet Gönder": "Send Invite",
  "Ad Soyad": "Full Name",
  "Evet": "Yes",
  "Son AI görevi bulunmuyor.": "No recent AI task was found.",
  "Dikkat gerektiren konular:": "Items requiring attention:",
  "Yönetim verileri yüklenemedi.": "Admin data could not be loaded.",
  "Yönetim verileri yükleniyor...": "Loading admin data...",
  "Abonelikler": "Subscriptions",
  "Kurumsal": "Enterprise",
  "Seçili hesap": "Selected account",
  "Tenant": "Tenant",
  "Kota özeti": "Quota summary",
  "Eksik kurulum": "Incomplete setup",
  "Özellikler": "Features",
  "İç not": "Internal note",
  "SLA, onboarding kapsamı veya teklif notu": "SLA, onboarding scope, or proposal note",
  "ör. satin-alma@firma.com": "e.g. procurement@company.com",
  "ör. finans@firma.com": "e.g. finance@company.com",
  "ör. 199900": "e.g. 199900",
  "ör. 25": "e.g. 25",
  "ör. 40": "e.g. 40",
  "ör. 2500": "e.g. 2500",
  "ör. 400": "e.g. 400",
  "Tüm adaylar ve başvuruları tek ekranda.": "View all candidates and their applications on one screen.",
  "Aday adı, e-posta veya telefon...": "Candidate name, email, or phone...",
  "Tüm Durumlar": "All statuses",
  "Tüm İlanlar": "All job postings",
  "Tüm Kaynaklar": "All sources",
  "Filtreye uygun sonuç bulunamadı.": "No results match the filters.",
  "CSV/TSV dosyası çözümlenemedi. Başlık satırı ve en az bir veri satırı gerekli.":
    "The CSV/TSV file could not be parsed. A header row and at least one data row are required.",
  "Mapping sonrası geçerli lead bulunamadı.": "No valid lead remained after mapping.",
  "Import tamamlanamadı.": "Import could not be completed.",
  "En az bir public profile URL girin.": "Enter at least one public profile URL.",
  "URL ingestion tamamlanamadı.": "URL ingestion could not be completed.",
  "Ad soyad zorunlu.": "Full name is required.",
  "Lead oluşturulamadı.": "Lead could not be created.",
  "Recruiter-Assisted Lead Ingestion": "Recruiter-Assisted Lead Ingestion",
  "CSV/job board export, public profile URL ve tekli lead oluşturma ile sourcing projesine gerçek aday ekleyin.":
    "Add real candidates to the sourcing project with CSV/job board exports, public profile URLs, and single lead creation.",
  "CV paketi elinizdeyse applicant flow’a geçirmek için":
    "If you already have a CV package and want to move it into the applicant flow,",
  "İlan Merkezi üzerindeki toplu CV yükleme": "use the bulk CV upload flow in Job Center",
  "CSV, TSV veya dış job board export dosyasını yükleyin; alan eşlemesini gözden geçirip project’e alın.":
    "Upload a CSV, TSV, or external job board export; review field mapping and add it to the project.",
  "Hızlı preset": "Quick preset",
  "Opsiyonel kaynak etiketi": "Optional source label",
  "CSV / Export Dosyası Seç": "Choose CSV / Export File",
  "Önizleme": "Preview",
  "Unvan yok": "No title",
  "İletişim yok": "No contact details",
  "Lead Listesini Project’e Al": "Import Lead List into Project",
  "Public Profile URL Paste": "Public Profile URL Paste",
  "Kişisel site, portfolio, GitHub benzeri public profile URL’lerini yapıştırın. Sistem kişi profili doğrularsa project’e alır.":
    "Paste personal site, portfolio, or public profile URLs such as GitHub. If the system validates a person profile, it adds it to the project.",
  "Recruiter notu / neden bu URL'leri ekliyorum?":
    "Recruiter note / why am I adding these URLs?",
  "URL'ler işleniyor...": "Processing URLs...",
  "URL'leri Prospect Olarak İşle": "Process URLs as Prospects",
  "Tekli Manual Lead": "Single Manual Lead",
  "Recruiter’ın dışarıda bulduğu tekil lead’i hızlıca sourcing project’e ekleyin.":
    "Quickly add a single lead the recruiter found externally to the sourcing project.",
  "Lead ekleniyor...": "Adding lead...",
  "Tekli Lead Oluştur": "Create Single Lead",
  "İşlenen kayıt": "Processed records",
  "Yeni profil / Yeni prospect": "New profiles / New prospects",
  "Merge / Duplicate": "Merged / Duplicate",
  "Mevcut candidate eşleşmesi": "Existing candidate matches",
  "İlk hata": "First error",
  "AI mülakat ayarları": "AI interview settings",
  "Soru listesi yüklenemedi.": "Question list could not be loaded.",
  "Template yüklenemedi.": "Template could not be loaded.",
  "En az bir soru bırakmalısınız.": "You must keep at least one question.",
  "Davet gönderilemedi.": "Invite could not be sent.",
  "Soru listesi hazırlanıyor...": "Preparing question list...",
  "Eşleşme": "Match",
  "Adayı Kaydet": "Save Candidate",
  "Form doğrulama": "Form validation",
  "Aday adı en az 2 karakter olmalı.": "Candidate name must be at least 2 characters.",
  "Aday oluşturulamadı.": "Candidate could not be created.",
  "Yeni Aday Kaydı": "New Candidate Record",
  "Aday Havuzuna Dön": "Back to Candidate Pool",
  "Vazgeç": "Cancel",
  "Audit log verisi alınamadı.": "Audit log data could not be retrieved.",
  "Entity tipi (opsiyonel)": "Entity type (optional)",
  "Entity ID (opsiyonel)": "Entity ID (optional)",
  Metadata: "Metadata",
  "Sourcing ekranı yüklenemedi.": "Sourcing screen could not be loaded.",
  "Sourcing projesi açılamadı.": "Sourcing project could not be opened.",
  "Sourcing görünümü hazırlanıyor...": "Preparing sourcing view...",
  "Requisition bağlantılı talent discovery, rediscovery ve outreach foundation.":
    "Requisition-linked talent discovery, rediscovery, and outreach foundation.",
  "Henüz sourcing projesi yok. İlan seçerek başlayın.":
    "There is no sourcing project yet. Start by selecting a job posting.",
  "Henüz kaydedilmiş prospect yok.": "There are no saved prospects yet.",
  "AI destekli ön görüşmenize buradan katılabilirsiniz.":
    "You can join your AI-assisted pre-interview here.",
  "Görüşme Odası": "Interview Room",
  "Hazırlık Ekranına Dön": "Back to Preparation Screen",
  "Görüşme oturumu hazırlanıyor...": "Preparing interview session...",
  "Oturum hatası": "Session error",
  "Tahmini Süre": "Estimated Duration",
  "Son Geçerlilik": "Valid Until",
  "Aynı linki geçerlilik süresi boyunca kullanabilirsiniz. Görüşme tamamlandığında bağlantı tekrar açılamaz.":
    "You can use the same link until it expires. Once the interview is completed, the link cannot be opened again.",
  "Görüşme öncesi öneriler": "Pre-interview tips",
  "Sessiz bir ortamda olduğunuzdan emin olun": "Make sure you are in a quiet environment",
  "Hoparlör ve mikrofonunuzun çalıştığını kontrol edin":
    "Check that your speaker and microphone are working",
  "Görüşmeyi tek seferde tamamlamayı planlayın":
    "Plan to complete the interview in one sitting",
  "Sorular sesli gelir, doğal bir şekilde yanıt verin":
    "Questions are asked aloud; answer naturally",
  "Görüşmeye Devam Et": "Continue Interview",
  "Görüşmeyi Başlat": "Start Interview",
  "Görüşme Davetinin Süresi Doldu": "Interview Invitation Expired",
  "Bu link artık kullanılamaz. Yeni bir görüşme daveti gerekirse işe alım ekibiyle iletişime geçilmelidir.":
    "This link can no longer be used. If a new interview invitation is needed, contact the hiring team.",
  "Görüşme Sonlandı": "Interview Ended",
  "Oturum tamamlanmadan sonlandı. Gerekirse yeni bir görüşme bağlantısı için işe alım ekibiyle iletişime geçebilirsiniz.":
    "The session ended before it was completed. If needed, you can contact the hiring team for a new interview link.",
  "Teşekkür ederiz. Görüşme sonuçlarınız değerlendirilecektir.":
    "Thank you. Your interview results will be reviewed.",
  "Merkezi aday profiline yönlendiriliyor...": "Redirecting to the central candidate profile...",
  "Başvuru oluşturmak için bir iş ilanı seçmelisiniz.":
    "You must select a job posting to create an application.",
  "CV inceleniyor...": "CV is being analyzed...",
  "Bu CV zaten inceleniyor.": "This CV is already being analyzed.",
  "CV incelemesi tamamlandı.": "CV analysis completed.",
  "CV incelemesi başarısız oldu.": "CV analysis failed.",
  "İnceleme devam ediyor, sayfayı yenileyerek kontrol edebilirsiniz.":
    "Analysis is still running. Refresh the page to check again.",
  "CV inceleme işlemi başlatılamadı.": "CV analysis could not be started.",
  "Yüklemek için bir CV dosyası seçin.": "Select a CV file to upload.",
  "CV yüklenemedi.": "CV could not be uploaded.",
  "İlan detayı yükleniyor...": "Loading job detail...",
  "Aday adı, e-posta veya telefon ara": "Search candidate name, email, or phone",
  "Minimum skor": "Minimum score",
  "Sıralama": "Sort",
  "Skor ↓": "Score ↓",
  "Skor ↑": "Score ↑",
  "Tarih (Yeni)": "Date (Newest)",
  "Tarih (Eski)": "Date (Oldest)",
  "İşlem": "Action",
  "En az 1 geçerli aday gerekli.": "At least one valid candidate is required.",
  "Bir hata oluştu.": "An error occurred.",
  "Toplu Aday Ekle": "Add Candidates in Bulk",
  "Her satıra bir aday. Alanlar noktalı virgül veya tab ile ayrılır:":
    "One candidate per line. Separate fields with semicolons or tabs:",
  "Ad Soyad; Telefon; E-posta; Lokasyon; Deneyim (yıl)":
    "Full Name; Phone; Email; Location; Experience (years)",
  "Dış Kaynak Adı": "External Source Name",
  "Kaynak adı": "Source name",
  "Kurumsal düzeyde veri güvenliği": "Enterprise-grade data security",
  "AI destekli mülakat deneyimi": "AI-powered interview experience",
  "Hemen başlayın": "Get started",
  "Hesap oluşturun, pozisyonu tanımlayın ve mülakat sorularını belirleyin. AI destekli işe alım süreciniz dakikalar içinde aktif olsun.": "Create your account, define the position and set interview questions. Your AI-powered hiring process will be active in minutes.",
  "Bu optimizasyonun iş sonuçlarına etkisini somut verilerle paylaşabilir misiniz?": "Can you share the business impact of this optimization with concrete data?",
  "Tabi, sayfa hızındaki iyileşme sayesinde dönüşüm oranı %18 arttı ve aylık 200 bin TL ek gelir sağladık. Ayrıca bounce rate %35 düştü.": "Sure, thanks to the page speed improvement, conversion rate increased by 18% and we generated an additional 200K TL monthly revenue. Also, bounce rate dropped by 35%."
});

// ── Landing page (landing-hero.tsx) translations ──
Object.assign(EN_PHRASE_TRANSLATIONS, {
  // Hero
  "Ön Eleme.": "Pre-screening.",
  "Kaynak Bulma.": "Sourcing.",
  "Mülakat.": "Interview.",
  "Yapay zekâ destekli işe alım platformu.": "AI-powered hiring platform.",

  // Manifesto
  "Her gün yüzlerce CV inceleniyor ama doğru adayı bulmak imkansız hissettiriyor. Candit bunu değiştiriyor.":
    "Hundreds of CVs reviewed every day, yet finding the right candidate feels impossible. Candit changes that.",

  // Hero sub / buttons
  "Adaylarınızı hangi kanaldan ulaşırsa ulaşsın aynı hız, aynı kalite ve aynı profesyonellikle değerlendirin.":
    "Evaluate your candidates with the same speed, quality, and professionalism — no matter how they apply.",
  "Ücretsiz Deneyin": "Try Free",
  "Nasıl çalışır?": "How it works?",

  // Dashboard mockup
  "İşe Alım Paneli": "Hiring Dashboard",
  "Bugün": "Today",
  "Bu Hafta": "This Week",
  "Bu Ay": "This Month",
  "Toplam Aday": "Total Candidates",
  "+186 bu hafta": "+186 this week",
  "Aktif Pozisyon": "Active Positions",
  "12 departmanda": "across 12 departments",
  "Tamamlanan Mülakat": "Completed Interviews",
  "+23% önceki haftaya göre": "+23% vs last week",
  "İşe Alım Oranı": "Hire Rate",
  "+3.2% artış": "+3.2% increase",

  // Channel bars
  "AI Mülakat": "AI Interview",
  "Ön Eleme": "Pre-screening",
  "CV Analizi": "CV Analysis",
  "Değerlendirme": "Assessment",

  // Activity feed
  "Yeni aday mülakata başladı": "New candidate started interview",
  "AI değerlendirme tamamlandı": "AI assessment completed",
  "3 yeni başvuru alındı": "3 new applications received",
  "Aday raporu oluşturuldu": "Candidate report generated",
  "2dk önce": "2m ago",
  "5dk önce": "5m ago",
  "12dk önce": "12m ago",
  "18dk önce": "18m ago",

  // Modules section
  "Modüller": "Modules",
  "Her adımda aynı kalite": "Consistent quality at every step",
  "İş ilanı, başvuru toplama, ön eleme ve AI mülakat süreçlerinin hepsi tek platformda yönetilir.":
    "Job posting, application collection, pre-screening, and AI interviews are all managed on one platform.",
  "Adaylara otomatik sesli veya yazılı mülakat uygulayın. AI, yanıtları anlık analiz eder ve puanlar.":
    "Conduct automatic voice or text interviews with candidates. AI analyzes and scores responses in real time.",
  "Aday Değerlendirme": "Candidate Assessment",
  "Yetkinlik bazlı AI puanlaması ile adayları objektif şekilde karşılaştırın ve sıralayın.":
    "Compare and rank candidates objectively with competency-based AI scoring.",
  "Aday Yönetimi": "Candidate Management",
  "Tüm başvuruları tek panelden takip edin. Durum güncellemeleri ve iletişim otomatik yönetilir.":
    "Track all applications from a single dashboard. Status updates and communication are managed automatically.",
  "Analitik": "Analytics",
  "İşe alım süreci metriklerini gerçek zamanlı izleyin. Darboğazları tespit edip süreci optimize edin.":
    "Monitor hiring process metrics in real time. Identify bottlenecks and optimize your workflow.",

  // Interview demo section
  "Canlı Mülakat": "Live Interview",
  "AI asistanımız adayla birebir görüşme yapar, yanıtları anında analiz eder. Siz sadece sonuçları değerlendirin.":
    "Our AI assistant conducts one-on-one interviews with candidates and analyzes responses instantly. You just review the results.",
  "Candit Asistan": "Candit Assistant",
  "Selen Yılmaz": "Selen Yilmaz",

  // Chat messages (interview Q&A)
  "Selen Hanım, son pozisyonunuzdaki en büyük teknik zorluğu anlatır mısınız?":
    "Selen, could you tell us about the biggest technical challenge in your last role?",
  "Yüksek trafikli bir e-ticaret sitesinde performans sorunları yaşadık. React memo ve code splitting ile sayfa yüklenme süresini 3 saniyeden 800 milisaniyeye düşürdüm.":
    "We had performance issues on a high-traffic e-commerce site. Using React memo and code splitting, I reduced page load time from 3 seconds to 800 milliseconds.",

  // Proof stats
  "Daha Hızlı İşe Alım": "Faster Hiring",
  "İşe alım sürecini otomatikleştirerek ortalama kapanma süresini %87 kısaltın.":
    "Automate your hiring process and reduce average time-to-fill by 87%.",
  "Kesintisiz Mülakat": "Non-stop Interviews",
  "AI mülakat 7 gün 24 saat aktif. Adaylar istedikleri zaman mülakata girebilir.":
    "AI interviews are available 24/7. Candidates can interview whenever they want.",
  "Verimlilik Artışı": "Efficiency Boost",
  "İnsan kaynakları ekibinizin verimliliği ortalama 12 kat artar.":
    "Your HR team's productivity increases by an average of 12x.",

  // Workflow section
  "Nasıl Çalışır": "How It Works",
  "Dört adımda işe alıma başlayın": "Start hiring in four steps",
  "Pozisyonu tanımlayın, adayları analiz edin, AI mülakat yaptırın, en iyi adayı seçin.":
    "Define the position, analyze candidates, run AI interviews, and pick the best candidate.",
  "Pozisyonu Tanımlayın": "Define the Position",
  "İş ilanını oluşturun, mülakat sorularını ve değerlendirme kriterlerini belirleyin.":
    "Create the job posting and set interview questions and evaluation criteria.",
  "Adayları Analiz Edin": "Analyze Candidates",
  "CV'leri otomatik analiz edin, ön eleme kriterleriyle adayları filtreleyin.":
    "Automatically analyze CVs and filter candidates with pre-screening criteria.",
  "AI Mülakat Yaptırın": "Run AI Interviews",
  "Adaylar sizin belirlediğiniz sorularla mülakata girer. AI yanıtları analiz eder, yetkinlik raporu oluşturur.":
    "Candidates are interviewed with questions you define. AI analyzes responses and generates a competency report.",
  "En İyi Adayı Seçin": "Pick the Best Candidate",
  "Karşılaştırmalı raporlarla en uygun adayı belirleyin ve teklifinizi iletin.":
    "Identify the best-fit candidate with comparative reports and send your offer.",

  // Security section
  "Güvenlik": "Security",
  "Aday verileri KVKK ve GDPR standartlarında korunur. Şifreli depolama, rol bazlı erişim ve otomatik veri yaşam döngüsü yönetimi.":
    "Candidate data is protected to KVKK and GDPR standards. Encrypted storage, role-based access, and automatic data lifecycle management.",
  "Güvenlik Katmanları": "Security Layers",
  "Kimlik Doğrulama": "Authentication",
  "Çok faktörlü güvenli giriş": "Multi-factor secure login",
  "AI Koruma": "AI Protection",
  "Uygunsuz içerik filtreleme": "Inappropriate content filtering",
  "Veri Şifreleme": "Data Encryption",
  "AES-256 şifreleme": "AES-256 encryption",
  "KVKK Uyumu": "KVKK Compliance",
  "Tam uyumlu veri işleme": "Fully compliant data processing",

  // CTA section
  "Başlayalım": "Get Started",
});

Object.assign(EN_PHRASE_TRANSLATIONS, {
  // Header / footer nav
  "Çözümler": "Solutions",
  "Fiyatlar": "Pricing",
  "Kaynaklar": "Resources",
  "AI destekli işe alım platformu": "AI-powered hiring platform",

  // Footer column titles
  "Şirket": "Company",

  // Footer column links
  "Entegrasyonlar": "Integrations",
  "Güncellemeler": "Updates",
  "Teknoloji": "Technology",
  "Perakende": "Retail",
  "Sağlık": "Healthcare",
  "Finans": "Finance",
  "Üretim ve Lojistik": "Manufacturing & Logistics",
  "Blog": "Blog",
  "Yardım": "Help",
  "API Dokümantasyonu": "API Documentation",
  "Hakkımızda": "About Us",
  "Gizlilik Politikası": "Privacy Policy",

  // Footer bottom
  "Tüm hakları saklıdır": "All rights reserved",
  "Gizlilik": "Privacy",
  "Kullanım Koşulları": "Terms of Use",

  // Footer copy
  "Ön eleme, kaynak bulma ve mülakat süreçlerini yapay zekâ ile otomatikleştirin. Doğru adayı daha hızlı bulun.":
    "Automate pre-screening, sourcing, and interview processes with AI. Find the right candidate faster.",
});

// ─── Public Site Pages ───────────────────────────────────────────────
Object.assign(EN_PHRASE_TRANSLATIONS, {
  // ProductStage
  "Sistem aktif": "System active",
  "Tek platform, tam kontrol": "One platform, full control",
  "Tüm işe alım süreçleri tek panelde buluşur.": "All hiring processes come together in one panel.",
  "daha hızlı işe alım": "faster hiring",
  "Modüller": "Modules",
  "Performans metrikleri": "Performance metrics",
  "Tek platform ile daha hızlı, daha doğru işe alım.": "Faster, more accurate hiring with one platform.",
  "Ön eleme, AI mülakat ve değerlendirme süreçleri aynı akış içinde otomatik yönetilir.":
    "Pre-screening, AI interview, and evaluation processes are managed automatically in the same flow.",
  "Değerlendirme doğruluğu": "Evaluation accuracy",
  "Süreç hızı": "Process speed",
  "Aday memnuniyeti": "Candidate satisfaction",
  "Örnek akış": "Sample flow",
  "AI mülakat değerlendirmesi": "AI interview evaluation",
  "Aday AI mülakat ile başlar, değerlendirme otomatik oluşturulur ve sonuçlar panele düşer.":
    "The candidate starts with an AI interview, the evaluation is created automatically, and the results appear in the panel.",
  "AI Mülakat": "AI Interview",
  "Ön Eleme": "Pre-Screening",
  "Analitik": "Analytics",
  "Tüm mülakat ve değerlendirme kayıtları tek panelde görünür.":
    "All interview and evaluation records are visible in one panel.",

  // Home channels
  "AI Mülakat": "AI Interview",
  "Adaylara otomatik sesli veya yazılı mülakat uygulayın. AI yanıtları anlık analiz eder ve puanlar.":
    "Conduct automated voice or text interviews with candidates. AI analyzes and scores responses in real time.",
  "Ön Eleme": "Pre-Screening",
  "CV ve başvuru bilgilerini AI ile tarayın, pozisyona uygun adayları otomatik filtreleyin.":
    "Scan CVs and application data with AI, automatically filter candidates suitable for the position.",
  "Aday Yönetimi": "Candidate Management",
  "Tüm başvuruları tek panelden takip edin. Durum güncellemeleri ve iletişim otomatik yönetilir.":
    "Track all applications from one panel. Status updates and communication are managed automatically.",
  "Analitik": "Analytics",
  "İşe alım süreci metriklerini gerçek zamanlı izleyin. Darboğazları tespit edip optimize edin.":
    "Monitor hiring process metrics in real time. Identify and optimize bottlenecks.",

  // Home proof stats
  "Tutarlı": "Consistent",
  "Değerlendirme Çıktıları": "Evaluation Outputs",
  "Yapılandırılmış screening, mülakat ve rapor çıktıları ile ekip içinde ortak karar zemini oluşturun.":
    "Create a common decision ground within the team with structured screening, interview, and report outputs.",
  "7/24": "24/7",
  "Kesintisiz Mülakat": "Non-Stop Interviews",
  "AI mülakat 7 gün 24 saat aktif. Adaylar istedikleri zaman mülakata girebilir.":
    "AI interviews are active 24/7. Candidates can enter the interview whenever they want.",
  "Daha az": "Less",
  "Manuel Tekrar": "Manual Repetition",
  "Tekrarlayan ön eleme, özet ve raporlama adımlarını otomatikleştirerek işe alım ekibinin odağını koruyun.":
    "Maintain the hiring team's focus by automating repetitive pre-screening, summary, and reporting steps.",

  // Home steps
  "Pozisyonu tanımlayın": "Define the position",
  "İş ilanını oluşturun, mülakat sorularını ve değerlendirme kriterlerini belirleyin.":
    "Create the job posting, set interview questions and evaluation criteria.",
  "Adayları yönlendirin": "Direct candidates",
  "Mülakat linkini paylaşın veya başvuru formunuza entegre edin. Adaylar kolayca katılsın.":
    "Share the interview link or integrate it into your application form. Let candidates easily participate.",
  "AI mülakat yaptırın": "Conduct AI interviews",
  "Adaylar sizin belirlediğiniz sorularla mülakata girer. AI yanıtları analiz eder ve raporlar.":
    "Candidates enter the interview with the questions you defined. AI analyzes the responses and reports.",
  "En iyi adayı seçin": "Select the best candidate",
  "Karşılaştırmalı raporlarla en uygun adayı belirleyin ve teklifinizi iletin.":
    "Identify the most suitable candidate with comparative reports and extend your offer.",

  // Features page
  "Güçlü Özellikler": "Powerful Features",
  "İşe alım sürecinizi güçlendirecek AI yetenekleri": "AI capabilities to power up your hiring process",
  "AI mülakat, aday tarama, iş ilanı yönetimi ve analitik araçları tek platformda. Hızlı kurulum, derin entegrasyonlar ve ölçeklenebilir otomasyon.":
    "AI interviews, candidate screening, job posting management, and analytics tools in one platform. Quick setup, deep integrations, and scalable automation.",
  "Hemen Başlayın": "Get Started",
  "Özellikleri Keşfedin": "Explore Features",
  "Operasyon görünürlüğü ve yönetim araçları": "Operations visibility and management tools",
  "Dashboard, güvenlik ve entegrasyon katmanlarıyla ekibiniz ve yöneticileriniz aynı veriden karar verir.":
    "Your team and managers make decisions from the same data with dashboard, security, and integration layers.",
  "Dakikalar içinde yayına alın": "Go live in minutes",
  "Dört adımda AI mülakat sisteminizi kurun ve işe alım süreçlerinizde canlı hizmete başlayın.":
    "Set up your AI interview system in four steps and go live with your hiring processes.",
  "Her sektöre özel AI işe alım çözümleri": "AI hiring solutions tailored to every industry",
  "Teknoloji, perakende, sağlık, finans ve üretim sektörlerine özel mülakat akışları.":
    "Interview workflows customized for technology, retail, healthcare, finance, and manufacturing industries.",
  "Çözümü incele": "Explore solution",
  "Merak edilenler": "Frequently asked",
  "Özellikler, entegrasyon ve kullanım hakkında en çok sorulan sorular.":
    "The most frequently asked questions about features, integrations, and usage.",
  "AI ile işe alım deneyiminizi dönüştürün": "Transform your hiring experience with AI",
  "Tüm özelliklerimizi ücretsiz deneyin. Kurulum dakikalar içinde tamamlanır, teknik bilgi gerekmez.":
    "Try all our features for free. Setup is completed in minutes, no technical knowledge required.",

  // Feature groups
  "Adaylara sesli veya görüntülü AI mülakatları otomatik gerçekleştirin.":
    "Automatically conduct voice or video AI interviews with candidates.",
  "Pozisyona özel soru setleri": "Position-specific question sets",
  "Sesli ve görüntülü mülakat desteği": "Voice and video interview support",
  "Gerçek zamanlı değerlendirme": "Real-time evaluation",
  "Otomatik transkript ve özet": "Automatic transcript and summary",
  "Ön Eleme (Screening)": "Pre-Screening",
  "Başvuruları AI ile hızlıca tarayın, uygun adayları öne çıkarın.":
    "Quickly scan applications with AI and highlight suitable candidates.",
  "CV ve başvuru formu analizi": "CV and application form analysis",
  "Pozisyon-aday uyum skoru": "Position-candidate fit score",
  "Otomatik kısa liste oluşturma": "Automatic shortlisting",
  "Özelleştirilebilir eleme kriterleri": "Customizable screening criteria",
  "Aday Değerlendirme": "Candidate Evaluation",
  "Her adayı yapılandırılmış puanlama ile objektif değerlendirin.":
    "Objectively evaluate each candidate with structured scoring.",
  "Yetkinlik bazlı skorlama": "Competency-based scoring",
  "Teknik ve davranışsal analiz": "Technical and behavioral analysis",
  "Karşılaştırmalı aday raporu": "Comparative candidate report",
  "Önyargı azaltma metrikleri": "Bias reduction metrics",
  "İş İlanı Yönetimi": "Job Posting Management",
  "İlanlarınızı oluşturun, yayınlayın ve başvuruları tek yerden takip edin.":
    "Create and publish your postings and track applications from one place.",
  "Hızlı ilan oluşturma şablonları": "Quick posting creation templates",
  "Çoklu pozisyon yönetimi": "Multi-position management",
  "Başvuru havuzu takibi": "Application pool tracking",
  "Kariyer sayfası entegrasyonu": "Career page integration",
  "Analitik ve Raporlama": "Analytics and Reporting",
  "İşe alım sürecinizin her adımını ölçün ve optimize edin.":
    "Measure and optimize every step of your hiring process.",
  "Mülakat performans metrikleri": "Interview performance metrics",
  "Aday dönüşüm hunisi": "Candidate conversion funnel",
  "Pozisyon bazlı süre analizi": "Position-based time analysis",
  "Ekip verimliliği raporları": "Team efficiency reports",
  "Entegrasyonlar": "Integrations",
  "Pilot kapsamındaki takvim ve API entegrasyonlarını kontrollü şekilde devreye alın.":
    "Activate pilot-scope calendar and API integrations in a controlled manner.",
  "Google Calendar ve Google Meet": "Google Calendar and Google Meet",
  "Calendly bağlantısı": "Calendly connection",
  "ATS genel API / webhook": "ATS generic API / webhook",
  "Kaynak Bulma (beta)": "Sourcing (beta)",

  // Feature operations
  "İşe Alım Kontrol Paneli": "Hiring Control Panel",
  "Tüm işe alım sürecinizi tek ekrandan takip edin ve yönetin.":
    "Track and manage your entire hiring process from one screen.",
  "Pozisyon bazlı ilerleme ve doluluk oranları": "Position-based progress and fill rates",
  "Mülakat tamamlanma ve değerlendirme metrikleri": "Interview completion and evaluation metrics",
  "Aday havuzu ve süreç hattı görünürlüğü": "Candidate pool and pipeline visibility",
  "Ekip performansı ve SLA takibi": "Team performance and SLA tracking",
  "Güvenlik ve KVKK": "Security and KVKK",
  "Aday verilerini güvenle saklayın, KVKK ve GDPR uyumlu çalışın.":
    "Store candidate data securely and work in compliance with KVKK and GDPR.",
  "Rol bazlı erişim ve yetkilendirme": "Role-based access and authorization",
  "Aday verisi maskeleme ve anonimleştirme": "Candidate data masking and anonymization",
  "Veri saklama süresi politikaları ve otomatik silme": "Data retention policies and automatic deletion",
  "Tüm adaylarınızı tek havuzda yönetin, geçmiş verilere kolayca erişin.":
    "Manage all your candidates in a single pool, easily access historical data.",
  "Merkezi aday veritabanı ve arama": "Central candidate database and search",
  "Aday etiketleme ve segmentasyon": "Candidate tagging and segmentation",
  "Geçmiş mülakat ve değerlendirme kayıtları": "Historical interview and evaluation records",

  // Solutions page
  "Sektörel AI Çözümleri": "Industry AI Solutions",
  "Sektörünüze özel AI mülakat asistanı": "AI interview assistant tailored to your industry",
  "Teknoloji, perakende, sağlık, finans ve üretim sektörlerine özel AI mülakat ve ön eleme akışları ile hemen başlayın.":
    "Get started with AI interview and pre-screening workflows customized for technology, retail, healthcare, finance, and manufacturing.",
  "Çözümleri Keşfedin": "Explore Solutions",
  "Sektörünüzü seçin, hemen başlayın": "Choose your industry, get started now",
  "Her çözüm, sektörün ihtiyaçlarına özel AI mülakat akışları, ön eleme kriterleri ve değerlendirme metrikleriyle donatıldı.":
    "Each solution is equipped with AI interview workflows, pre-screening criteria, and evaluation metrics tailored to industry needs.",
  "Neden Candit.ai?": "Why Candit.ai?",
  "Sektörden bağımsız olarak her işe alım ekibine değer katan temel avantajlar.":
    "Core advantages that add value to every hiring team regardless of industry.",
  "Karar öncesi merak edilenler": "Pre-decision FAQs",
  "Çözümler, entegrasyon süreci ve fiyatlandırma hakkında en sık sorulan sorular.":
    "Frequently asked questions about solutions, integration process, and pricing.",
  "Sektörünüze özel AI işe alım çözümünü deneyin": "Try the AI hiring solution tailored to your industry",
  "Listede olsun ya da olmasın, sektörünüze uygun mülakat ve ön eleme akışını birlikte tasarlayalım.":
    "Whether listed or not, let's design the interview and pre-screening workflow that fits your industry together.",

  // Solution stats
  "Daha hızlı": "Faster",
  "İşe alım akışı": "Hiring workflow",
  "Çoklu rol": "Multi-role",
  "Desteklenen senaryolar": "Supported scenarios",
  "Ön eleme çıktıları": "Pre-screening outputs",
  "Ölçeklenebilir": "Scalable",
  "Aday kapasitesi": "Candidate capacity",

  // Solution advantages
  "Hızlı İşe Alım Döngüsü": "Fast Hiring Cycle",
  "AI ön eleme ve mülakat ile işe alım döngüsündeki tekrarları azaltın ve ekip hızını artırın.":
    "Reduce repetition in the hiring cycle with AI pre-screening and interviews, and increase team speed.",
  "Objektif Aday Değerlendirme": "Objective Candidate Evaluation",
  "Yapılandırılmış skorlama ile önyargıyı azaltın, tutarlı kararlar verin.":
    "Reduce bias with structured scoring and make consistent decisions.",
  "Ölçeklenebilir Alım": "Scalable Hiring",
  "Tek pozisyondan toplu alıma kadar her ölçekte AI mülakat gerçekleştirin.":
    "Conduct AI interviews at every scale, from single positions to bulk hiring.",
  "Uyum Odaklı": "Compliance-Focused",
  "Aday verilerini rol bazlı erişim, denetim izi ve yaşam döngüsü kontrolleriyle yönetin.":
    "Manage candidate data with role-based access, audit trails, and lifecycle controls.",

  // Solution detail page
  "Ana Sayfa": "Home",
  "Çözümler": "Solutions",
  "Hesap Oluştur": "Create Account",
  "Fiyatları İncele": "View Pricing",
  "Kullanım Senaryoları": "Use Cases",
  "Nasıl Çalışır?": "How Does It Work?",
  "Saha gerçeğine yakın örnek akışlar": "Real-world example workflows",
  "Sektörünüze özel AI mülakat ve ön eleme senaryolarını inceleyin.":
    "Explore AI interview and pre-screening scenarios specific to your industry.",
  "Senaryo": "Scenario",
  "Operasyonun kritik avantajları": "Critical advantages of the operation",
  "Bu sektördeki işe alım sürecinizi hızlandıran temel avantajlar.":
    "Key advantages that accelerate your hiring process in this industry.",
  "Kullanılan Araçlar": "Tools Used",
  "İşe alım sürecinin her adımında AI desteği": "AI support at every step of the hiring process",
  "Candit'in temel araçları bu sektör çözümünde nasıl kullanılıyor?":
    "How are Candit's core tools used in this industry solution?",

  // Solution detail - per industry
  "Teknoloji Sektörü İçin AI İşe Alım": "AI Hiring for the Technology Sector",
  "Yazılımcı, mühendis ve teknik pozisyonlarda hızlı ve doğru işe alım.":
    "Fast and accurate hiring for developer, engineer, and technical positions.",
  "Teknik yetkinlik değerlendirmesi, kodlama becerisi analizi ve kültür uyumu skorlaması ile teknoloji sektöründe doğru adayı bulun.":
    "Find the right candidate in the technology sector with technical competency evaluation, coding skill analysis, and culture fit scoring.",
  "Yazılım geliştirici teknik mülakat ve değerlendirme": "Software developer technical interview and evaluation",
  "Mühendislik pozisyonları için yetkinlik bazlı ön eleme": "Competency-based pre-screening for engineering positions",
  "Toplu stajyer ve yeni mezun alımı": "Bulk intern and new graduate hiring",
  "Teknik soru setleri ile derinlemesine değerlendirme": "In-depth evaluation with technical question sets",
  "Kod analizi ve problem çözme becerisi ölçümü": "Code analysis and problem-solving skill measurement",
  "Hızlı işe alım döngüsü ile yetenek kaybını önleme": "Preventing talent loss with a fast hiring cycle",
  "Çoklu pozisyon ve ekip bazlı süreç hattı yönetimi": "Multi-position and team-based pipeline management",
  "Teknik ekibinizi AI ile güçlendirin": "Strengthen your technical team with AI",
  "Doğru yazılımcıyı bulmak artık günler değil, saatler sürüyor.": "Finding the right developer now takes hours, not days.",

  "Perakende Sektörü İçin AI İşe Alım": "AI Hiring for the Retail Sector",
  "Yüksek hacimli mağaza ve depo personeli alımını hızlandırın.": "Accelerate high-volume store and warehouse staff hiring.",
  "Sezonluk kampanya dönemlerinde yüzlerce başvuruyu AI ile tarayın, uygun adayları dakikalar içinde belirleyin.":
    "Scan hundreds of applications with AI during seasonal campaign periods and identify suitable candidates in minutes.",
  "Mağaza personeli toplu alımı ve hızlı ön eleme": "Bulk store staff hiring and fast pre-screening",
  "Sezonluk kampanya dönemi işe alım otomasyonu": "Seasonal campaign period hiring automation",
  "Bölge bazlı aday havuzu yönetimi": "Regional candidate pool management",
  "Yüksek hacimli başvurularda otomatik filtreleme": "Automatic filtering for high-volume applications",
  "Vardiya ve lokasyon uyumu kontrolü": "Shift and location compatibility check",
  "Hızlı işe alıştırma için standart mülakat akışları": "Standard interview workflows for fast onboarding",
  "Bölge müdürleri için özel raporlama": "Custom reporting for regional managers",
  "Perakende alımlarınızı hızlandırın": "Accelerate your retail hiring",
  "Sezonluk işe alımları AI ile yönetin, mağazalarınız zamanında açılsın.":
    "Manage seasonal hiring with AI, so your stores open on time.",

  "Sağlık Sektörü İçin AI İşe Alım": "AI Hiring for the Healthcare Sector",
  "Hemşire, teknisyen ve sağlık personeli alımında hız ve uyum.": "Speed and compliance in hiring nurses, technicians, and healthcare staff.",
  "Sertifika doğrulama, vardiya uyumu ve yetkinlik değerlendirmesi ile sağlık sektörüne özel işe alım çözümleri.":
    "Hiring solutions specific to the healthcare sector with certificate verification, shift compatibility, and competency evaluation.",
  "Hemşire ve sağlık teknisyeni alımı": "Nurse and healthcare technician hiring",
  "Sertifika ve lisans uygunluk kontrolü": "Certificate and license eligibility check",
  "Vardiya bazlı uygunluk değerlendirmesi": "Shift-based eligibility evaluation",
  "Sektöre özel yetkinlik soru setleri": "Industry-specific competency question sets",
  "Sertifika ve belge doğrulama desteği": "Certificate and document verification support",
  "KVKK uyumlu hassas veri yönetimi": "KVKK-compliant sensitive data management",
  "Acil pozisyonlar için hızlandırılmış süreç": "Expedited process for urgent positions",
  "Sağlık ekibinizi doğru adaylarla tamamlayın": "Complete your healthcare team with the right candidates",
  "Kritik sağlık pozisyonlarını AI destekli süreçle hızla doldurun.": "Quickly fill critical healthcare positions with an AI-powered process.",

  "Finans Sektörü İçin AI İşe Alım": "AI Hiring for the Finance Sector",
  "Bankacılık, sigorta ve fintek pozisyonlarında nitelikli aday seçimi.": "Qualified candidate selection for banking, insurance, and fintech positions.",
  "Analitik düşünme, risk değerlendirme ve mevzuat bilgisi gibi kritik yetkinlikleri AI mülakat ile ölçün.":
    "Measure critical competencies like analytical thinking, risk assessment, and regulatory knowledge with AI interviews.",
  "Bankacılık ve sigorta pozisyonları için ön eleme": "Pre-screening for banking and insurance positions",
  "Fintek startup'ları için hızlı teknik değerlendirme": "Fast technical evaluation for fintech startups",
  "Uyum ve mevzuat bilgisi kontrolü": "Compliance and regulatory knowledge check",
  "Finansal yetkinlik ve analitik düşünme ölçümü": "Financial competency and analytical thinking measurement",
  "Mevzuat ve uyum bilgisi değerlendirmesi": "Regulatory and compliance knowledge evaluation",
  "Gizlilik odaklı aday veri yönetimi": "Privacy-focused candidate data management",
  "Kurumsal onay akışları ve rol bazlı erişim": "Corporate approval workflows and role-based access",
  "Finansal yetenekleri AI ile keşfedin": "Discover financial talent with AI",
  "Doğru finans profesyonelini bulmak için yapılandırılmış AI mülakatları kullanın.":
    "Use structured AI interviews to find the right finance professional.",

  "Üretim ve Lojistik İçin AI İşe Alım": "AI Hiring for Manufacturing and Logistics",
  "Fabrika, depo ve saha personeli alımında ölçeklenebilir çözüm.": "Scalable solution for factory, warehouse, and field staff hiring.",
  "Yüksek hacimli mavi yaka alımlarını AI ön eleme ve standart mülakat akışlarıyla hızlandırın.":
    "Accelerate high-volume blue-collar hiring with AI pre-screening and standard interview workflows.",
  "Üretim hattı operatörü ve teknisyen alımı": "Production line operator and technician hiring",
  "Depo ve lojistik personeli toplu işe alımı": "Bulk warehouse and logistics staff hiring",
  "Saha ekibi için bölge bazlı aday yönetimi": "Regional candidate management for field teams",
  "Mavi yaka pozisyonlarına özel soru setleri": "Question sets specific to blue-collar positions",
  "Fiziksel uygunluk ve vardiya tercihi kontrolü": "Physical fitness and shift preference check",
  "Toplu alımlarda ölçeklenebilir AI mülakat": "Scalable AI interviews for bulk hiring",
  "Fabrika ve depo bazlı raporlama": "Factory and warehouse-based reporting",
  "Üretim ve lojistik alımlarınızı ölçeklendirin": "Scale your manufacturing and logistics hiring",
  "Yüzlerce başvuruyu AI ile tarayın, doğru adayları saatler içinde belirleyin.":
    "Scan hundreds of applications with AI and identify the right candidates in hours.",

  // SolutionWorkflow
  "Araçları etkinleştirin": "Activate tools",
  "Adaylar AI mülakat ile değerlendirilir, yanıtlar analiz edilir ve yetkinlik raporu oluşturulur.":
    "Candidates are evaluated with AI interviews, responses are analyzed, and a competency report is generated.",
  "Sonuçları değerlendirin": "Evaluate results",
  "Mülakat tamamlanma, değerlendirme skoru ve karşılaştırmalı raporlarla en uygun adayı belirleyin.":
    "Identify the most suitable candidate with interview completion, evaluation score, and comparative reports.",
  "Pozisyonu tanımlayın, adayları yönlendirin ve AI mülakatı başlatın. Her adım otomatik yönetilir.":
    "Define the position, direct candidates, and start the AI interview. Each step is managed automatically.",

  // Pricing page
  "Şeffaf Fiyatlandırma": "Transparent Pricing",
  "İhtiyacınıza uygun planı seçin": "Choose the plan that fits your needs",
  "Ücretsiz deneme ile başlayıp, büyüdükçe ölçeklendirin. Gizli ücret yok, sürpriz yok.":
    "Start with a free trial and scale as you grow. No hidden fees, no surprises.",
  "Ücretsiz deneme — Kredi kartı gerekmez": "Free trial — No credit card required",
  "En Popüler": "Most Popular",
  "Ücretsiz": "Free",
  "İletişime Geçin": "Contact Us",
  "/ay": "/mo",
  "Özel fiyatlandırma": "Custom pricing",
  "Aşım": "Overage",
  "Platformu keşfedin. 7 gün boyunca temel özellikleri deneyin.": "Explore the platform. Try core features for 7 days.",
  "7 gün ücretsiz — Kredi kartı gerekmez": "7 days free — No credit card required",
  "Deneme": "Trial",
  "Starter": "Starter",
  "Tek işe alım uzmanı ile düzenli işe alım yapan ekipler için.": "For teams with a single recruiter doing regular hiring.",
  "Growth": "Growth",
  "Düzenli işe alım yapan küçük ekipler için.": "For small teams doing regular hiring.",
  "Kurumsal": "Enterprise",
  "Büyük ekipler için özel kota, branded deneyim, SLA ve entegrasyonlar.":
    "Custom quotas, branded experience, SLA, and integrations for large teams.",
  "Özel Teklif": "Custom Quote",
  "1 kullanıcı": "1 user",
  "2 kullanıcı": "2 users",
  "1 aktif ilan": "1 active job",
  "2 aktif ilan": "2 active jobs",
  "10 aktif ilan": "10 active jobs",
  "25 aday ön eleme": "25 candidate screenings",
  "100 aday işleme": "100 candidate processing",
  "500 aday işleme": "500 candidate processing",
  "3 AI mülakat": "3 AI interviews",
  "15 AI mülakat": "15 AI interviews",
  "50 AI mülakat": "50 AI interviews",
  "Temel raporlama": "Basic reporting",
  "Beta erişim gerekli": "Beta access required",
  "Sourcing modülü şu anda kontrollü beta erişiminde. İç yönetim ekibi dışında görünüm paylaşılmıyor.":
    "The sourcing module is currently in controlled beta. The view is not shared outside the internal admin team.",
  "E-posta desteği": "Email support",
  "Takvim entegrasyonları": "Calendar integrations",
  "Gelişmiş raporlama": "Advanced reporting",
  "Öncelikli destek": "Priority support",
  "Özel kullanıcı limiti": "Custom user limit",
  "Özel aktif ilan": "Custom active jobs",
  "Özel aday işleme": "Custom candidate processing",
  "Özel AI mülakat": "Custom AI interviews",
  "Özel işe alıştırma + SLA": "Custom onboarding + SLA",
  "Ücretsiz Deneyin": "Try Free",
  "Bize Ulaşın": "Contact Us",
  "Planınızı yükseltmeden, sadece ihtiyacınız olan ek kotayı satın alın.":
    "Buy just the extra quota you need without upgrading your plan.",
  "Ek Paketler": "Add-on Packs",
  "Planınızı Bozmadan Kapasite Artırın": "Increase Capacity Without Changing Your Plan",
  "Planınızı değiştirmeden yoğun dönemlerde ek aday işleme ve AI mülakat kotası satın alın.":
    "Buy extra candidate processing and AI interview quota during busy periods without changing your plan.",
  "Ek aday işleme: 1.099₺ / 50 aday": "Extra candidate processing: 1,099₺ / 50 candidates",
  "Ek aday işleme: 1.999₺ / 100 aday": "Extra candidate processing: 1,999₺ / 100 candidates",
  "Ek AI mülakat: 1.199₺ / 10 mülakat": "Extra AI interviews: 1,199₺ / 10 interviews",
  "Ek AI mülakat: 2.499₺ / 25 mülakat": "Extra AI interviews: 2,499₺ / 25 interviews",
  "Mevcut plana eklenir, dönem içinde aktif olur": "Added to current plan, active within the period",
  "Plana Ekle": "Add to Plan",
  "Ek paket detayları": "Add-on pack details",
  "Bu paketler mevcut plan kotanız yetmediğinde dönem içinde tek seferlik kapasite artışı sağlar.":
    "These packs provide a one-time capacity increase during the period when your current plan quota runs out.",
  "Kanal": "Channel",
  "Birim": "Unit",
  "Paket fiyatı": "Pack price",
  "Not": "Note",
  "Ek aday işleme": "Extra candidate processing",
  "Ek AI mülakat": "Extra AI interviews",
  "50 aday": "50 candidates",
  "100 aday": "100 candidates",
  "10 mülakat": "10 interviews",
  "25 mülakat": "25 interviews",
  "Düşük hacimli ek ihtiyaçlarda hızlı kapasite artışı için kullanılır.":
    "Used for quick capacity increase in low-volume additional needs.",
  "Aday ön eleme kotası dolduğunda daha avantajlı geniş paket seçeneğidir.":
    "A more cost-effective large pack option when the candidate pre-screening quota is full.",
  "Kısa süreli ek görüşme ihtiyacı için küçük mülakat paketi.":
    "Small interview pack for short-term additional interview needs.",
  "Dönem içinde daha yoğun AI mülakat kullanımı için daha avantajlı büyük paket seçeneğidir.":
    "A more cost-effective large pack option for heavier AI interview usage within the period.",
  "Hala kararsız mısınız?": "Still undecided?",
  "İhtiyacınıza göre doğru paketi birlikte seçelim.": "Let's choose the right package together for your needs.",
  "Sık Sorulan Sorular": "Frequently Asked Questions",
  "Fiyatlandırma hakkında merak edilenler": "FAQs about pricing",
  "Karar vermeden önce en sık gelen sorulara göz atın.": "Check the most frequently asked questions before deciding.",
  "Sorularınız mı var?": "Have questions?",
  "Bize ulaşın": "Contact us",

  // FAQ
  "AI mülakat nasıl çalışır?": "How does AI interview work?",
  "Aday, paylaşılan mülakat linkine tıklayarak görüşmeyi başlatır. AI asistan pozisyona özel soruları sırayla sorar, yanıtları gerçek zamanlı analiz eder ve detaylı bir değerlendirme raporu oluşturur.":
    "The candidate starts the interview by clicking the shared interview link. The AI assistant asks position-specific questions one by one, analyzes responses in real time, and generates a detailed evaluation report.",
  "Ön eleme (screening) süreci nedir?": "What is the pre-screening process?",
  "Adayların CV ve başvuru bilgileri AI tarafından analiz edilir, pozisyon gereksinimleriyle eşleştirilir ve uygunluk skoru hesaplanır. Belirlediğiniz kriterlere göre otomatik kısa liste oluşturulur.":
    "Candidates' CVs and application data are analyzed by AI, matched with position requirements, and a fit score is calculated. An automatic shortlist is created based on your criteria.",
  "Deneme sürümünde neler var?": "What's included in the trial?",
  "7 gün boyunca 1 kullanıcı, 1 aktif ilan, 25 aday ön eleme ve 3 AI mülakat hakkı ile platformu ücretsiz deneyebilirsiniz. Kredi kartı gerekmez.":
    "You can try the platform free for 7 days with 1 user, 1 active job, 25 candidate screenings, and 3 AI interviews. No credit card required.",
  "KVKK ve veri güvenliği nasıl sağlanıyor?": "How is KVKK and data security ensured?",
  "Platform; rol bazlı erişim, veri maskeleme, audit log ve yaşam döngüsü kontrolleriyle güvenli kullanım için tasarlanmıştır. KVKK ve GDPR süreçleri için gerekli operasyonel kontroller ekip bazında yapılandırılmalıdır.":
    "The platform is designed for secure use with role-based access, data masking, audit logs, and lifecycle controls. Operational controls required for KVKK and GDPR processes must be configured on a team basis.",
  "Mevcut ATS sistemimle entegre olabilir mi?": "Can it integrate with my existing ATS?",
  "Evet. Pilot aşamada REST API ve webhook desteği ile ATS sistemleriyle kontrollü entegrasyon kurulabilir. Hazır ve aktif bağlantı tarafında Google Calendar, Google Meet ve Calendly odaklı ilerliyoruz; diğer entegrasyonlar yol haritasına göre açılıyor.":
    "Yes. In the pilot phase, controlled integration with ATS systems can be set up via REST API and webhook support. On the ready and active connections side, we are focused on Google Calendar, Google Meet, and Calendly; other integrations are opened according to the roadmap.",

  // Integrations page
  "Pilot kapsamındaki entegrasyonlar": "Pilot-scope integrations",
  "Takvim, ATS ve webhook odaklı bağlantıları kontrollü şekilde devreye alın.":
    "Activate calendar, ATS, and webhook-focused connections in a controlled manner.",
  "Takvim ve Planlama": "Calendar and Scheduling",
  "ATS ve İşe Alım Sistemleri": "ATS and Hiring Systems",
  "Yol Haritası": "Roadmap",
  "İhtiyacınıza özel entegrasyon mu gerekiyor?": "Need a custom integration?",
  "Mevcut işe alım altyapınıza uygun özel bağlantı ihtiyacınız varsa ekibimizle planlayalım.":
    "If you need a custom connection that fits your existing hiring infrastructure, let's plan it with our team.",
  "Mülakat planlarını takvime bağlayın ve etkinlik oluşturun": "Connect interview schedules to your calendar and create events",
  "Uygun akışlarda görüşme linklerini Google ekosistemiyle yönetin": "Manage interview links through the Google ecosystem in suitable flows",
  "Aday planlama akışları için kurulum aşamasında, talep bazlı devreye alınır": "In setup phase for candidate scheduling flows, activated on demand",
  "Pilotta aktif": "Active in pilot",
  "Yakında": "Coming soon",
  "Panelde aç": "Open in panel",
  "İletişime geç": "Contact us",
  "Mevcut ATS verinizi REST tabanlı senkronizasyonla bağlayın": "Connect your existing ATS data with REST-based synchronization",
  "Başvuru ve mülakat olaylarını kendi sistemlerinize aktarın": "Transfer application and interview events to your own systems",
  "Dokümanı aç": "Open docs",
  "Kurumsal ekipler için mevcut işe alım altyapısına özel entegrasyon": "Custom integration for enterprise teams with existing hiring infrastructure",
  "Kurumsal": "Enterprise",
  "Kurumsal planlama ihtiyaçları için yol haritasında": "On the roadmap for enterprise scheduling needs",
  "Doğrudan toplantı oluşturma desteği yol haritasında": "Direct meeting creation support on the roadmap",
  "Çift yönlü veri eşleme ve özel saha senaryoları için hazırlanıyor": "Being prepared for two-way data mapping and custom field scenarios",
  "Yol Haritası": "Roadmap",
  "İhtiyaç paylaş": "Share your need",

  // Blog page
  "Candit Blog": "Candit Blog",
  "AI destekli işe alım hakkında en son yazılar": "Latest articles about AI-powered hiring",
  "Sektör trendleri, en iyi uygulamalar ve AI ile işe alım süreçlerinizi nasıl optimize edeceğinizi keşfedin.":
    "Discover industry trends, best practices, and how to optimize your hiring processes with AI.",
  "Yazıyı oku": "Read article",
  "Yeni içeriklerden haberdar olun": "Stay updated with new content",
  "AI ve işe alım dünyasındaki gelişmeleri takip edin": "Follow developments in AI and the hiring world",
  "Sektör trendleri, ürün güncellemeleri ve en iyi uygulamaları doğrudan e-posta adresinize alın.":
    "Get industry trends, product updates, and best practices delivered directly to your email.",
  "E-posta adresiniz": "Your email address",
  "Abone Ol": "Subscribe",

  // Blog article page
  "okuma": "read",
  "Yazı Bilgisi": "Article Info",
  "İlgili Yazılar": "Related Articles",
  "Bunları da okumak isteyebilirsiniz": "You might also want to read these",
  "AI destekli işe alım ve sektör trendleri hakkında ilgili yazılar.":
    "Related articles about AI-powered hiring and industry trends.",
  "AI ile işe alım sürecinizi dönüştürmeye hazır mısınız?": "Ready to transform your hiring process with AI?",
  "Platformumuzu ücretsiz deneyin ve farkı kendiniz görün.": "Try our platform for free and see the difference yourself.",

  // Blog article categories and titles
  "AI İşe Alım": "AI Hiring",
  "İşe Alım Operasyonları": "Hiring Operations",
  "Operasyon": "Operations",
  "Entegrasyon": "Integration",
  "AI Mülakatların Geleceği: 2026'da Neler Değişiyor?": "The Future of AI Interviews: What's Changing in 2026?",
  "Yapılandırılmış Mülakat Skorlaması Neden Daha Güvenilir?": "Why Is Structured Interview Scoring More Reliable?",
  "CV Ön Eleme Skorunu Doğru Okumak: Recruiter İçin Pratik Çerçeve": "Reading CV Pre-Screening Scores Correctly: A Practical Framework for Recruiters",
  "Aday Deneyimini Bozmadan Hızlanmak İçin 5 Pratik": "5 Practices to Speed Up Without Hurting Candidate Experience",
  "ATS Entegrasyonu Ne Zaman Gerekli, Ne Zaman Erken?": "When Is ATS Integration Necessary, When Is It Too Early?",
  "Hiring Manager ile Kalibrasyon Toplantıları Nasıl Kısalır?": "How to Shorten Calibration Meetings with Hiring Managers?",
  "15 Mart 2026": "March 15, 2026",
  "27 Mart 2026": "March 27, 2026",
  "15 Şubat 2026": "February 15, 2026",
  "4 Nisan 2026": "April 4, 2026",
  "22 Şubat 2026": "February 22, 2026",
  "8 Nisan 2026": "April 8, 2026",
  "5 dk": "5 min",
  "6 dk": "6 min",
  "7 dk": "7 min",

  // Blog article excerpts
  "Yapay zeka destekli mülakatlar sadece hız değil, daha tutarlı değerlendirme kalitesi de sunuyor. 2026'da öne çıkan pratikleri özetledik.":
    "AI-powered interviews offer not just speed but also more consistent evaluation quality. We summarized the standout practices in 2026.",
  "Serbest notlar yerine yapılandırılmış skor kartları kullanan ekipler neden daha hızlı ve daha savunulabilir karar alıyor?":
    "Why do teams using structured scorecards instead of free-form notes make faster and more defensible decisions?",
  "Skor tek başına karar değildir. CV ön eleme çıktısını hızlandırıcı olarak kullanırken hangi sinyallere bakmanız gerektiğini özetledik.":
    "A score alone is not a decision. We summarized which signals you should look at when using CV pre-screening output as an accelerator.",
  "Daha hızlı işe alım ile daha iyi aday deneyimi arasında seçim yapmak zorunda değilsiniz. Küçük ama etkili 5 uygulamayı derledik.":
    "You don't have to choose between faster hiring and better candidate experience. We compiled 5 small but effective practices.",
  "Her ekip ilk günden karmaşık entegrasyona ihtiyaç duymaz. ATS entegrasyonunun gerçekten ne zaman değer ürettiğini anlatıyoruz.":
    "Not every team needs complex integration from day one. We explain when ATS integration truly creates value.",
  "Hiring manager toplantıları uzuyorsa sorun çoğu zaman aday değil, sinyal formatıdır. Kalibrasyonu hızlandıran çerçeveyi paylaşıyoruz.":
    "If hiring manager meetings are dragging on, the problem is usually the signal format, not the candidate. We share the framework that speeds up calibration.",

  // Blog article section titles
  "Yapılandırılmış Değerlendirme Yeni Standart": "Structured Evaluation Is the New Standard",
  "İnsan + AI Birlikte Çalışıyor": "Human + AI Working Together",
  "Aday Deneyimi de Ölçülüyor": "Candidate Experience Is Also Being Measured",
  "Kazanan Model: Şeffaf ve Denetlenebilir Akış": "The Winning Model: Transparent and Auditable Workflow",
  "Aynı Sorular, Daha Kıyaslanabilir Sonuçlar": "Same Questions, More Comparable Results",
  "Not Kalitesi Kişiye Bağımlı Olmaktan Çıkar": "Note Quality Is No Longer Person-Dependent",
  "Denetlenebilir Karar Çerçevesi": "Auditable Decision Framework",
  "Sonuç: Daha Hızlı Kalibrasyon": "Result: Faster Calibration",
  "Skor, Bağlamla Birlikte Anlamlıdır": "A Score Is Meaningful with Context",
  "Eksik Bilgi Alanları Kritik Sinyaldir": "Missing Information Fields Are Critical Signals",
  "Otomatik Red İçin Değil, Önceliklendirme İçin": "For Prioritization, Not Automatic Rejection",
  "Skor + Mülakat + Hiring Manager Notu": "Score + Interview + Hiring Manager Note",
  "İlk Teması Netleştirin": "Clarify the First Contact",
  "Bekleme Süresini Sessizlikle Geçirmeyin": "Don't Let Waiting Time Pass in Silence",
  "Mülakat Sorularını Rol ile Uyumlu Tutun": "Keep Interview Questions Aligned with the Role",
  "Raporu İnsan Diline Çevirin": "Translate the Report into Human Language",
  "İlk Kırılma Noktası: Çift Veri Girişi": "First Breaking Point: Double Data Entry",
  "Pilotta Tam Kapsam Yerine Kontrollü Senaryo": "Controlled Scenario Instead of Full Coverage in Pilot",
  "Takvim Entegrasyonu Ayrı Bir Katmandır": "Calendar Integration Is a Separate Layer",
  "Entegrasyonun Başarısı Teknikten Çok Operasyoneldir": "Integration Success Is More Operational Than Technical",
  "Aynı Dili Konuşmak Gerekir": "Speaking the Same Language Is Essential",
  "Ham Notlar Yerine Karar Destek Paketi": "Decision Support Package Instead of Raw Notes",
  "İtiraz Noktalarını Önceden Görünür Kılın": "Make Objection Points Visible Upfront",
  "Sonuç: Daha Az Toplantı, Daha Net Karar": "Result: Fewer Meetings, Clearer Decisions",

  // Help page
  "Yardım Merkezi": "Help Center",
  "Candit ile hızlı başlangıç rehberi": "Quick start guide with Candit",
  "Platform kurulumundan ileri düzey kullanıma kadar ihtiyacınız olan tüm bilgiler burada.":
    "All the information you need from platform setup to advanced usage is here.",
  "Hızlı Başlangıç": "Quick Start",
  "Dakikalar içinde ilk mülakatınızı oluşturun": "Create your first interview in minutes",
  "Popüler Konular": "Popular Topics",
  "Sık kullanılan konular": "Frequently used topics",
  "SSS": "FAQ",
  "Başka sorunuz mu var?": "Have more questions?",
  "Aradığınızı bulamadınız mı?": "Couldn't find what you're looking for?",
  "Ekibimize doğrudan ulaşın, size en kısa sürede yardımcı olalım.":
    "Reach out to our team directly, and let us help you as soon as possible.",
  "Hesap Oluşturun": "Create Your Account",
  "Dakikalar içinde ücretsiz hesabınızı açın.": "Open your free account in minutes.",
  "Pozisyon Ekleyin": "Add a Position",
  "İş ilanınızı ve mülakat sorularınızı tanımlayın.": "Define your job posting and interview questions.",
  "Mülakat Linki Paylaşın": "Share Interview Link",
  "Adaylara mülakat linkini gönderin, başvurular otomatik başlasın.":
    "Send the interview link to candidates, let applications start automatically.",
  "Sonuçları Değerlendirin": "Evaluate Results",
  "AI raporlarıyla en uygun adayları hızlıca belirleyin.": "Quickly identify the most suitable candidates with AI reports.",
  "Güvenlik & Uyumluluk": "Security & Compliance",
  "Veri güvenliği, KVKK ve GDPR uyumluluğu": "Data security, KVKK and GDPR compliance",
  "Fiyatlandırma": "Pricing",
  "Planlar, özellikler ve fiyat karşılaştırması": "Plans, features, and price comparison",
  "Özellikler": "Features",
  "Tüm platform özellikleri ve yetenekleri": "All platform features and capabilities",
  "Keşfet": "Explore",
  "Takvim, ATS ve API entegrasyonları": "Calendar, ATS, and API integrations",

  // Docs API page
  "API Dokümantasyonu": "API Documentation",
  "Candit API ile entegre olun": "Integrate with Candit API",
  "REST API ve webhook desteği ile Candit'i mevcut İK sistemlerinize kolayca bağlayın.":
    "Easily connect Candit to your existing HR systems with REST API and webhook support.",
  "API anahtarıyla dakikalar içinde bağlanın.": "Connect in minutes with your API key.",
  "Kanallardan gelen mesajı işler ve AI yanıt akışını başlatır.": "Processes the incoming message and starts the AI response flow.",
  "Mülakatları, durumları ve değerlendirme bilgilerini listeler.": "Lists interviews, statuses, and evaluation details.",
  "Harici sistem olaylarını alıp operasyon akışını tetikler.": "Receives external system events and triggers the operations flow.",
  "Kimlik Doğrulama": "Authentication",
  "Bearer token ile API isteklerini güvenli şekilde yetkilendirin.": "Securely authorize API requests with a Bearer token.",
  "Webhook Bildirimleri": "Webhook Notifications",
  "Mülakat, değerlendirme, başvuru ve süreç olaylarını anlık takip edin.":
    "Track interview, evaluation, application, and process events in real time.",
  "Hız Limitleri": "Rate Limits",
  "Sistem kararlılığını korumak için dakikalık ve saatlik istek limitleri uygulanır.":
    "Per-minute and per-hour request limits are applied to maintain system stability.",
  "API entegrasyonunuz hakkında destek mi gerekiyor?": "Need support with your API integration?",
  "Teknik ekibimiz entegrasyon sürecinde size yardımcı olmaya hazır.":
    "Our technical team is ready to help you during the integration process.",

  // Security page
  "Verileriniz Güvende": "Your Data Is Safe",
  "Kurumsal düzeyde veri güvenliği": "Enterprise-grade data security",
  "Aday verileriniz KVKK ve GDPR standartlarında, endüstri lideri güvenlik protokolleriyle korunur.":
    "Your candidate data is protected by industry-leading security protocols at KVKK and GDPR standards.",
  "Güvenlik hakkında sorularınız mı var?": "Have questions about security?",
  "Veri güvenliği ve uyumluluk konusundaki sorularınızı yanıtlamaktan memnuniyet duyarız.":
    "We are happy to answer your questions about data security and compliance.",
  "İletişime Geçin": "Contact Us",
  "Veri Güvenliği": "Data Security",
  "Verileriniz katmanlı güvenlik kontrolleriyle korunur.": "Your data is protected by layered security controls.",
  "AES-256 ve TLS 1.3 ile uçtan uca şifreleme": "End-to-end encryption with AES-256 and TLS 1.3",
  "RBAC, MFA ve gelişmiş oturum yönetimi": "RBAC, MFA, and advanced session management",
  "DDoS koruması ve izole ağ mimarisi": "DDoS protection and isolated network architecture",
  "Yasal Uyumluluk": "Legal Compliance",
  "KVKK ve GDPR gereksinimlerine yönelik süreçler ve kontroller desteklenir.":
    "Processes and controls for KVKK and GDPR requirements are supported.",
  "KVKK için VİS, açık rıza, saklama ve silme politikaları": "VIS, explicit consent, retention, and deletion policies for KVKK",
  "GDPR için veri taşınabilirliği, silme talebi ve DPA desteği": "Data portability, deletion requests, and DPA support for GDPR",
  "Veri ihlali bildirim süreci ve veri minimizasyonu ilkesi": "Data breach notification process and data minimization principle",
  "AI Güvenliği": "AI Security",
  "Yapay zeka asistanı çoklu güvenlik katmanıyla korunur.": "The AI assistant is protected by multiple security layers.",
  "Aday verileri model eğitiminde kullanılmaz": "Candidate data is not used for model training",
  "Yanıtlar politika kontrolü ve içerik filtrelemeden geçer": "Responses go through policy control and content filtering",
  "Hassas veri maskeleme ve halüsinasyon engelleme koruma katmanları":
    "Sensitive data masking and hallucination prevention protection layers",
  "Operasyonel Güvenlik": "Operational Security",
  "Sistemler düzenli izleme, kayıt ve müdahale akışlarıyla korunur.":
    "Systems are protected with regular monitoring, logging, and incident response workflows.",
  "Anomali tespitli sürekli izleme": "Continuous monitoring with anomaly detection",
  "Kim, ne zaman, ne yaptı görünürlüğü için audit log": "Audit log for who did what and when visibility",
  "Günlük yedekleme ve olay müdahale planı": "Daily backup and incident response plan",

  // About page
  "Hakkımızda": "About Us",
  "İşe alımı yapay zeka ile yeniden tanımlıyoruz": "We are redefining hiring with artificial intelligence",
  "Her büyüklükteki şirketin en doğru adayı en hızlı şekilde bulabilmesi için AI destekli mülakat ve ön eleme çözümleri sunuyoruz.":
    "We offer AI-powered interview and pre-screening solutions so companies of all sizes can find the right candidate as quickly as possible.",
  "2024": "2024",
  "Kuruluş Yılı": "Founded",
  "B2B SaaS": "B2B SaaS",
  "Ürün Modeli": "Product Model",
  "TR / EN": "TR / EN",
  "Ürün Dili": "Product Language",
  "AI + Human": "AI + Human",
  "Karar Yaklaşımı": "Decision Approach",
  "Hikayemiz": "Our Story",
  "Nereden geldik, nereye gidiyoruz": "Where we came from, where we're going",
  "İşe alım süreçlerindeki deneyim, yapay zeka ile birleşerek Candit'i ortaya çıkardı.":
    "The experience in hiring processes combined with artificial intelligence to create Candit.",
  "Nereden Geldik": "Where We Came From",
  "Yıllarca işe alım süreçlerindeki verimsizlikleri ve önyargıları gözlemledik. 2024'te yapay zeka teknolojisini işe alım süreçleriyle birleştirerek Candit'i kurduk.":
    "We observed inefficiencies and biases in hiring processes for years. In 2024, we founded Candit by combining AI technology with hiring processes.",
  "Neden Los Angeles": "Why Los Angeles",
  "Candit, yapay zeka ve teknoloji ekosisteminin kalbinde, Los Angeles'ta kuruldu. Türk kuruculara sahip ekip önce Türkiye pazarında işe alım süreçlerini dönüştürmeyi hedefledi.":
    "Candit was founded in Los Angeles, at the heart of the AI and technology ecosystem. The team with Turkish founders initially aimed to transform hiring processes in the Turkish market.",
  "Misyonumuz": "Our Mission",
  "Her şirketin büyüklüğünden bağımsız olarak adaylarını yapay zeka destekli mülakatlarla objektif, hızlı ve tutarlı şekilde değerlendirebilmesini sağlamak.":
    "To enable every company, regardless of size, to evaluate candidates objectively, quickly, and consistently with AI-powered interviews.",
  "Vizyonumuz": "Our Vision",
  "İşe alım süreçlerinin yapay zeka ile tamamen dönüştüğü, her şirketin en doğru adayı en kısa sürede bulabildiği bir dünya inşa etmek.":
    "To build a world where hiring processes are completely transformed by AI and every company can find the right candidate in the shortest time.",
  "Kültürümüz": "Our Culture",
  "Küçük ama tutkulu bir ekip. Her özellik, her iyileştirme ve her ürün kararı İK ekiplerinin ve adayların ihtiyaçlarından hareketle geliştiriliyor.":
    "A small but passionate team. Every feature, improvement, and product decision is driven by the needs of HR teams and candidates.",
  "Ekibimiz": "Our Team",
  "Küçük ama tutkulu bir ekip": "A small but passionate team",
  "Her ürün kararı, her özellik ve her iyileştirme İK ekiplerinin ve adayların ihtiyaçlarından hareketle geliştiriliyor.":
    "Every product decision, feature, and improvement is driven by the needs of HR teams and candidates.",
  "Kurucu & CEO. Ürün vizyonu, iş stratejisi ve İK teknoloji ortaklıklarını yönetir.":
    "Founder & CEO. Manages product vision, business strategy, and HR technology partnerships.",
  "CTO. AI mülakat motoru, sunucu mimarisi, NLP altyapısı ve sistem güvenliğini yönetir.":
    "CTO. Manages AI interview engine, server architecture, NLP infrastructure, and system security.",
  "Türkiye Operasyonları Danışmanı. Büyüme stratejisi ve kurumsal satış süreçlerinde yön verir.":
    "Turkey Operations Advisor. Guides growth strategy and enterprise sales processes.",
  "Yazılım Geliştirici. Mülakat arayüzü ve aday deneyimi geliştirme süreçlerinde aktif rol alır.":
    "Software Developer. Takes an active role in interview interface and candidate experience development.",
  "Yazılım Geliştirici. ATS entegrasyonları ve analitik modülleri geliştirme süreçlerinde görev alır.":
    "Software Developer. Works on ATS integrations and analytics module development.",
  "Pazarlama & İçerik. İK sektörüne yönelik dijital pazarlama stratejileri ve marka iletişimini yönetir.":
    "Marketing & Content. Manages digital marketing strategies and brand communication for the HR industry.",
  "Hikayemizin bir parçası olun": "Be part of our story",
  "İşe alım süreçlerinizi AI ile dönüştürerek en doğru adayları en hızlı şekilde bulun.":
    "Find the right candidates as quickly as possible by transforming your hiring processes with AI.",

  // Contact page
  "İletişim": "Contact",
  "Size nasıl yardımcı olabiliriz?": "How can we help you?",
  "İşe alım süreçlerinizi AI ile dönüştürmek mi istiyorsunuz? Sorularınızı iletin, ekibimiz en kısa sürede size dönecektir.":
    "Want to transform your hiring processes with AI? Send us your questions, and our team will get back to you as soon as possible.",
  "Dakikalar İçinde Kurulum": "Setup in Minutes",
  "İlk AI mülakatınızı hemen oluşturun, teknik bilgi gerektirmez.": "Create your first AI interview right away, no technical knowledge required.",
  "AI Destekli Mülakat": "AI-Powered Interview",
  "Yapay zeka ile tutarlı ve objektif aday değerlendirmesi.": "Consistent and objective candidate evaluation with AI.",
  "Kurumsal Güvenlik": "Enterprise Security",
  "Rol bazlı erişim, audit görünürlüğü ve güvenli veri akışlarıyla tasarlandı.":
    "Designed with role-based access, audit visibility, and secure data flows.",
  "Özel Destek": "Dedicated Support",
  "Kurulum, ATS entegrasyonu ve eğitimde yanınızdayız.": "We're with you for setup, ATS integration, and training.",
  "Bize Mesaj Gönderin": "Send Us a Message",
  "Formu doldurarak bize ulaşın. Pilot hedefiniz, mevcut işe alım akışınız ve ihtiyaç duyduğunuz otomasyonları paylaşın.":
    "Reach out by filling out the form. Share your pilot goals, current hiring workflow, and the automations you need.",
  "Mesajı Gönder": "Send Message",
  "Mesajınız ulaştı": "Your message was received",
  "Ekibimiz kısa süre içinde size dönüş yapacak.": "Our team will get back to you shortly.",
  "Ön eleme akışı": "Pre-screening workflow",
  "Kesintisiz mülakat": "Non-stop interviews",
  "Dakikalar": "Minutes",
  "İlk shortlist görünürlüğü": "First shortlist visibility",
  "Tek panel": "One panel",
  "İşe alım uzmanı operasyonu": "Recruiter operations",

  // Legal page
  "Yasal": "Legal",

  // Privacy page
  "Gizlilik Politikası (Privacy Policy)": "Privacy Policy",
  "Kişisel verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu öğrenin.":
    "Learn how your personal data is collected, used, and protected.",
  "1. Toplanan Veriler": "1. Data Collected",
  "Platformu kullandığınızda hesap bilgileri, işletme bilgileri, entegrasyon verileri, iletişim verileri, kullanım logları ve otomasyon senaryoları toplanabilir.":
    "When you use the platform, account information, business information, integration data, communication data, usage logs, and automation scenarios may be collected.",
  "2. Verilerin Kullanım Amaçları": "2. Purposes of Data Use",
  "Veriler hizmeti sağlamak, entegrasyonları çalıştırmak, güvenliği korumak, teknik destek vermek ve yasal yükümlülükleri yerine getirmek amacıyla kullanılır.":
    "Data is used to provide services, run integrations, maintain security, provide technical support, and fulfill legal obligations.",
  "3. Veri Koruma Mekanizmaları": "3. Data Protection Mechanisms",
  "Şifreleme, HTTPS, OAuth 2.0, erişim kontrolleri ve düzenli güvenlik güncellemeleri ile veri güvenliği sağlanır.":
    "Data security is ensured with encryption, HTTPS, OAuth 2.0, access controls, and regular security updates.",
  "4. Saklama ve Silme Politikası": "4. Retention and Deletion Policy",
  "İletişim kayıtları platform üzerinden silinebilir. Hesap bilgileri hesap kapatılana kadar saklanır; bazı kayıtlar yasal gereklilikler nedeniyle daha uzun tutulabilir.":
    "Communication records can be deleted through the platform. Account information is retained until the account is closed; some records may be kept longer due to legal requirements.",
  "5. Üçüncü Taraflarla Paylaşım": "5. Sharing with Third Parties",
  "Entegrasyon sağlayıcıları, sesli arama ve yapay zeka servisleri, ödeme işleyiciler ve yasal zorunluluklar kapsamında sınırlı veri paylaşımı yapılabilir.":
    "Limited data sharing may occur with integration providers, voice call and AI services, payment processors, and within legal obligations.",
  "6. Çerezler": "6. Cookies",
  "Oturum yönetimi ve kullanıcı deneyiminin iyileştirilmesi için çerez kullanılabilir. Çerez tercihleri tarayıcı ayarlarından yönetilebilir.":
    "Cookies may be used for session management and improving user experience. Cookie preferences can be managed from browser settings.",
  "7. Kullanıcı Hakları": "7. User Rights",
  "Erişim, düzeltme, silme, itiraz ve veri taşınabilirliği hakları için info@candit.ai üzerinden başvuru yapılabilir.":
    "Applications for access, correction, deletion, objection, and data portability rights can be made via info@candit.ai.",
  "8. Çocukların Gizliliği": "8. Children's Privacy",
  "Platform 18 yaş altı kullanıcılara yönelik değildir ve ebeveyn izni olmadan bilerek veri toplanmaz.":
    "The platform is not intended for users under 18 and does not knowingly collect data without parental consent.",
  "9. Değişiklikler": "9. Changes",
  "Politika zaman zaman güncellenebilir. Önemli değişiklikler e-posta veya platform bildirimi ile duyurulur.":
    "The policy may be updated from time to time. Significant changes are announced via email or platform notification.",
  "10. İletişim": "10. Contact",
  "Gizlilik ile ilgili sorular için info@candit.ai adresine ulaşabilirsiniz.":
    "You can reach info@candit.ai for privacy-related questions.",

  // Terms page
  "Kullanım Koşulları (Terms of Service)": "Terms of Service",
  "Platformumuzu kullanırken geçerli olan kurallar, sorumluluklar ve haklarınız.":
    "The rules, responsibilities, and rights applicable when using our platform.",
  "1. Hizmet Tanımı": "1. Service Description",
  "Platform, işletmelere yapay zeka destekli işe alım ve mülakat yönetimi sunan bir SaaS ürünüdür.":
    "The platform is a SaaS product that offers AI-powered hiring and interview management to businesses.",
  "2. Hesap Oluşturma ve Yetkilendirme": "2. Account Creation and Authorization",
  "Hesap bilgilerinin doğruluğu ve güvenliği kullanıcı sorumluluğundadır. Yetkisiz erişim şüphesi gecikmeden bildirilmelidir.":
    "The accuracy and security of account information is the user's responsibility. Suspected unauthorized access must be reported without delay.",
  "3. Üçüncü Taraf Entegrasyonları": "3. Third-Party Integrations",
  "Google ve diğer sağlayıcılarla entegrasyon bağlandığında ilgili sağlayıcıların şartları da geçerli olabilir. Hizmet kesintilerinden platform sorumlu değildir.":
    "When integrations with Google and other providers are connected, those providers' terms may also apply. The platform is not responsible for service interruptions.",
  "4. Kabul Edilebilir Kullanım": "4. Acceptable Use",
  "Yasalara aykırı, spam, dolandırıcılık veya güvenlik önlemlerini aşmaya yönelik kullanım yasaktır.":
    "Use that violates laws, spam, fraud, or attempts to bypass security measures is prohibited.",
  "5. Planlar, Ücretlendirme ve Faturalandırma": "5. Plans, Pricing, and Billing",
  "Aylık, yıllık veya kullanım bazlı ücretlendirme uygulanabilir. Abonelik ve iade kuralları abonelik sayfasında belirtilir.":
    "Monthly, annual, or usage-based pricing may apply. Subscription and refund rules are specified on the subscription page.",
  "6. İçerik ve Veri Sorumluluğu": "6. Content and Data Responsibility",
  "Platforma yüklenen içerikler, entegrasyon verileri ve asistan talimatları kullanıcı sorumluluğundadır. Yasal yükümlülüklerin yerine getirilmesi müşteriye aittir.":
    "Content uploaded to the platform, integration data, and assistant instructions are the user's responsibility. Fulfilling legal obligations belongs to the customer.",
  "7. Fikri Mülkiyet": "7. Intellectual Property",
  "Platformun yazılımı, arayüzü ve marka unsurları Candit.ai'ye aittir. Tersine mühendislik ve yetkisiz erişim yasaktır.":
    "The platform's software, interface, and brand elements belong to Candit.ai. Reverse engineering and unauthorized access are prohibited.",
  "8. Hizmet Seviyesi ve Sorumluluk Sınırları": "8. Service Level and Liability Limits",
  "Platform olduğu gibi sunulur; dolaylı zararlardan sorumluluk kabul edilmez ve toplam sorumluluk ilgili dönemde ödenen ücretle sınırlıdır.":
    "The platform is provided as is; liability for indirect damages is not accepted, and total liability is limited to the fees paid in the relevant period.",
  "9. Fesih ve Hesap Kapatma": "9. Termination and Account Closure",
  "Hesap istenen zamanda kapatılabilir. Şartların ihlali halinde hesap askıya alınabilir veya kapatılabilir.":
    "The account can be closed at any time. In case of terms violation, the account may be suspended or closed.",
  "10. Değişiklikler": "10. Changes",
  "Koşullar önceden bildirimle güncellenebilir. Platformu kullanmaya devam etmek güncel koşulların kabulü anlamına gelir.":
    "Terms may be updated with prior notice. Continuing to use the platform means acceptance of the current terms.",
  "11. İletişim": "11. Contact",
  "Sorularınız için info@candit.ai adresine ulaşabilirsiniz.": "You can reach info@candit.ai for your questions.",

  // Changelog page
  "Neler Değişiyor?": "What's Changing?",
  "Ürün güncellemeleri ve yeni özellikler": "Product updates and new features",
  "Candit platformundaki son geliştirmeleri ve yeni özellikleri takip edin.":
    "Follow the latest developments and new features on the Candit platform.",
  "Yeni özelliklerden ilk siz haberdar olun": "Be the first to know about new features",
  "Hesap oluşturun ve platform güncellemelerini doğrudan takip edin.":
    "Create an account and follow platform updates directly.",
  "Haziran 2026": "June 2026",
  "Lansman Sertleştirme": "Launch Hardening",
  "Pilot lansman öncesi kimlik doğrulama güvenliği, iletişim formu alımı, yönetim görünürlüğü ve olay yönetimi omurgası sertleştirildi.":
    "Pre-pilot launch authentication security, contact form intake, admin visibility, and incident management backbone were hardened.",
  "Herkese açık iletişim formu gerçek sunucuya bağlandı": "Public contact form connected to the real server",
  "İç yönetim potansiyel müşteri gelen kutusu açıldı": "Internal admin lead inbox opened",
  "Güvenlik olayı ve kritik alarm kalıcılığı eklendi": "Security incident and critical alert persistence added",
  "Üretim ortamı kimlik doğrulama varsayılanları sertleştirildi": "Production environment authentication defaults hardened",
  "Mart 2026": "March 2026",
  "Takvim ve Planlama Akışı": "Calendar and Scheduling Flow",
  "Mülakat planlama tarafında Google ekosistemi ve Calendly odaklı planlama akışları güçlendirildi.":
    "Interview scheduling workflows focused on the Google ecosystem and Calendly were strengthened.",
  "Google Calendar bağlantı akışı güncellendi": "Google Calendar connection flow updated",
  "Google Meet / planlama bağlam desteği genişletildi": "Google Meet / scheduling context support expanded",
  "Calendly webhook senkronizasyonu geliştirildi": "Calendly webhook synchronization improved",
  "Yedek toplantı akışı görünür hale getirildi": "Fallback meeting flow made visible",
  "Şubat 2026": "February 2026",
  "Kaynak Bulma ve Aday Havuzu": "Sourcing and Candidate Pool",
  "Aday keşfi, potansiyel aday takibi ve mevcut havuzdan yeniden değerlendirme akışları ürünün çekirdeğine eklendi.":
    "Candidate discovery, prospect tracking, and re-evaluation flows from the existing pool were added to the product core.",
  "Kaynak bulma projesi ve potansiyel aday modeli açıldı": "Sourcing project and prospect model launched",
  "Yetenek profili kaynak katmanı eklendi": "Talent profile sourcing layer added",
  "Uyum skorlama ve iletişim temelleri güçlendirildi": "Fit scoring and communication foundations strengthened",
  "İşe alım uzmanı görünürlüğü geliştirildi": "Recruiter visibility improved",
  "Ocak 2026": "January 2026",
  "AI Mülakat Motoru": "AI Interview Engine",
  "AI destekli sesli ve yazılı mülakat altyapısı, transkript ve rapor katmanları ile birlikte devreye alındı.":
    "AI-powered voice and text interview infrastructure was deployed with transcript and report layers.",
  "AI sesli görüşme desteği": "AI voice interview support",
  "Transkript özetleme ve rapor oluşturma": "Transcript summarization and report generation",
  "Öneri ve işe alım uzmanı değerlendirme akışları": "Recommendation and recruiter evaluation workflows",
  "Mülakat çalışma zamanı yedek davranışları": "Interview runtime fallback behaviors",
  "Aralık 2025": "December 2025",
  "İşe Alım Uzmanı Çalışma Alanı": "Recruiter Workspace",
  "Kontrol paneli, ilanlar, adaylar, başvurular ve raporlar yüzeyleri tek çalışma alanı altında birleştirildi.":
    "Dashboard, postings, candidates, applications, and reports surfaces were unified under a single workspace.",
  "Genel bakış kontrol paneli": "Overview dashboard",
  "İlan ve başvuru akışı": "Posting and application flow",
  "Aday havuzu ve profil ekranları": "Candidate pool and profile screens",
  "İlk raporlama yüzeyi": "First reporting surface",
  "Kasım 2025": "November 2025",
  "İlk Ürün Omurgası": "Initial Product Backbone",
  "Kiracı, üye, kimlik doğrulama ve işe alım alan modelleriyle Candit'in ilk ürün omurgası kuruldu.":
    "Candit's initial product backbone was built with tenant, member, authentication, and hiring domain models.",
  "Kiracı ve çalışma alanı modeli": "Tenant and workspace model",
  "Kayıt / giriş / davet temelleri": "Registration / login / invitation foundations",
  "İlan, aday ve başvuru alan modeli": "Posting, candidate, and application domain model",
  "İlk iç yönetim omurgası": "Initial internal admin backbone",

  // Waitlist page
  "Hemen Başlayın": "Get Started",
  "Bekleme listesi yerine doğrudan hesap oluşturun": "Create an account directly instead of a waitlist",
  "Ücretsiz hesap oluşturun ve AI destekli işe alım platformunu hemen denemeye başlayın.":
    "Create a free account and start trying the AI-powered hiring platform right away.",
  "Owner hesabını açın": "Open your owner account",
  "İlk çalışma alanınızı ve yönetici hesabınızı birkaç dakika içinde oluşturun.":
    "Create your first workspace and admin account in a few minutes.",
  "Temel ayarları tamamlayın": "Complete basic settings",
  "Takım üyeleri, entegrasyonlar ve ürün ayarlarını içeriden yönetin.":
    "Manage team members, integrations, and product settings from within.",
  "Pilotu başlatın": "Start the pilot",
  "İlan, aday ve mülakat akışlarını gerçek kullanım senaryolarınızla çalıştırın.":
    "Run posting, candidate, and interview flows with your real use cases.",
  "Destek gerekiyorsa yazın": "Write to us if you need support",
  "Ekibimiz kurulum ve onboarding sürecinde size yardımcı olmaya hazır.":
    "Our team is ready to help you during setup and onboarding.",
  "Kayıt": "Registration",
  "Doğrudan hesap oluşturun": "Create an account directly",
  "Hemen hesap oluşturun ve AI destekli işe alım platformunu denemeye başlayın. Kurulum desteği için ekibimiz her zaman yanınızda.":
    "Create an account now and start trying the AI-powered hiring platform. Our team is always by your side for setup support.",
  "Owner hesabı": "Owner account",
  "E-posta doğrulama": "Email verification",
  "İlk workspace kurulumu": "First workspace setup",
  "İletişime Geçin": "Contact Us",

  // CTA section
  "Hazır mısınız?": "Are you ready?",
  "Fiyatları İncele": "View Pricing",

  // Dynamic solution detail strings (per-industry workflows)
  "Teknoloji sektörüne özel mülakat soruları ve değerlendirme kriterlerini belirleyin.":
    "Set interview questions and evaluation criteria specific to the technology sector.",
  "Perakende sektörüne özel mülakat soruları ve değerlendirme kriterlerini belirleyin.":
    "Set interview questions and evaluation criteria specific to the retail sector.",
  "Sağlık sektörüne özel mülakat soruları ve değerlendirme kriterlerini belirleyin.":
    "Set interview questions and evaluation criteria specific to the healthcare sector.",
  "Finans sektörüne özel mülakat soruları ve değerlendirme kriterlerini belirleyin.":
    "Set interview questions and evaluation criteria specific to the finance sector.",
  "Üretim ve Lojistik sektörüne özel mülakat soruları ve değerlendirme kriterlerini belirleyin.":
    "Set interview questions and evaluation criteria specific to the manufacturing and logistics sector.",
  "AI Mülakat, Ön Eleme, Analitik araçlarını aktif edin ve işe alım sürecinizi başlatın.":
    "Activate AI Interview, Pre-Screening, Analytics tools and start your hiring process.",
  "AI Mülakat, Ön Eleme, Aday Yönetimi araçlarını aktif edin ve işe alım sürecinizi başlatın.":
    "Activate AI Interview, Pre-Screening, Candidate Management tools and start your hiring process.",
  "Teknoloji operasyonuna uygun kurulum akışı": "Setup workflow suitable for technology operations",
  "Perakende operasyonuna uygun kurulum akışı": "Setup workflow suitable for retail operations",
  "Sağlık operasyonuna uygun kurulum akışı": "Setup workflow suitable for healthcare operations",
  "Finans operasyonuna uygun kurulum akışı": "Setup workflow suitable for finance operations",
  "Üretim ve Lojistik operasyonuna uygun kurulum akışı": "Setup workflow suitable for manufacturing and logistics operations",
  "Teknoloji İçin Öne Çıkanlar": "Highlights for Technology",
  "Perakende İçin Öne Çıkanlar": "Highlights for Retail",
  "Sağlık İçin Öne Çıkanlar": "Highlights for Healthcare",
  "Finans İçin Öne Çıkanlar": "Highlights for Finance",
  "Üretim ve Lojistik İçin Öne Çıkanlar": "Highlights for Manufacturing & Logistics",
  "Teknoloji sektöründe işe alım kalitesini ve hızını artıran temel avantajı temsil eder.":
    "Represents a key advantage that increases hiring quality and speed in the technology sector.",
  "Perakende sektöründe işe alım kalitesini ve hızını artıran temel avantajı temsil eder.":
    "Represents a key advantage that increases hiring quality and speed in the retail sector.",
  "Sağlık sektöründe işe alım kalitesini ve hızını artıran temel avantajı temsil eder.":
    "Represents a key advantage that increases hiring quality and speed in the healthcare sector.",
  "Finans sektöründe işe alım kalitesini ve hızını artıran temel avantajı temsil eder.":
    "Represents a key advantage that increases hiring quality and speed in the finance sector.",
  "Üretim ve Lojistik sektöründe işe alım kalitesini ve hızını artıran temel avantajı temsil eder.":
    "Represents a key advantage that increases hiring quality and speed in the manufacturing and logistics sector.",
  "Teknoloji sektöründe AI Mülakat aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the AI Interview tool in the technology sector.",
  "Teknoloji sektöründe Ön Eleme aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the Pre-Screening tool in the technology sector.",
  "Teknoloji sektöründe Analitik aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the Analytics tool in the technology sector.",
  "Perakende sektöründe AI Mülakat aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the AI Interview tool in the retail sector.",
  "Perakende sektöründe Ön Eleme aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the Pre-Screening tool in the retail sector.",
  "Perakende sektöründe Aday Yönetimi aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the Candidate Management tool in the retail sector.",
  "Sağlık sektöründe AI Mülakat aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the AI Interview tool in the healthcare sector.",
  "Sağlık sektöründe Ön Eleme aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the Pre-Screening tool in the healthcare sector.",
  "Sağlık sektöründe Analitik aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the Analytics tool in the healthcare sector.",
  "Finans sektöründe AI Mülakat aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the AI Interview tool in the finance sector.",
  "Finans sektöründe Ön Eleme aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the Pre-Screening tool in the finance sector.",
  "Finans sektöründe Analitik aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the Analytics tool in the finance sector.",
  "Üretim ve Lojistik sektöründe AI Mülakat aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the AI Interview tool in the manufacturing and logistics sector.",
  "Üretim ve Lojistik sektöründe Ön Eleme aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the Pre-Screening tool in the manufacturing and logistics sector.",
  "Üretim ve Lojistik sektöründe Aday Yönetimi aracı ile işe alım sürecinizi güçlendirin.":
    "Strengthen your hiring process with the Candidate Management tool in the manufacturing and logistics sector.",
  "Güvenlik": "Security",
  "Perakende": "Retail",
  "Sağlık": "Healthcare",
});

const EN_WORD_TRANSLATIONS: Array<[string, string]> = [
  ["Başvuru", "Application"],
  ["Başvurular", "Applications"],
  ["Aday", "Candidate"],
  ["Adaylar", "Candidates"],
  ["Rol", "Role"],
  ["Ailesi", "Family"],
  ["Mülakat", "Interview"],
  ["Görüşme", "Interview"],
  ["Oturum", "Session"],
  ["oturum", "session"],
  ["İş", "Job"],
  ["İlanı", "Posting"],
  ["İlanları", "Postings"],
  ["İlan", "Posting"],
  ["Operasyon", "Operations"],
  ["Paneli", "Panel"],
  ["Durumu", "Status"],
  ["Durum", "Status"],
  ["Yenile", "Refresh"],
  ["Yükleniyor", "Loading"],
  ["Yükleme", "Upload"],
  ["Planlanan", "Scheduled"],
  ["Bekliyor", "Pending"],
  ["Görev", "Task"],
  ["Görevleri", "Tasks"],
  ["Kayıtları", "Logs"],
  ["Kayıt", "Record"],
  ["Kayıtları", "Records"],
  ["Kaydet", "Save"],
  ["Sil", "Delete"],
  ["Aç", "Open"],
  ["Bağla", "Connect"],
  ["Kapat", "Disable"],
  ["Açık", "Enabled"],
  ["Kapalı", "Disabled"],
  ["Oluştur", "Create"],
  ["Oluşturuldu", "Created"],
  ["Oluşturuluyor", "Creating"],
  ["Güncelle", "Update"],
  ["Güncelleniyor", "Updating"],
  ["Gönder", "Submit"],
  ["Gönderiliyor", "Submitting"],
  ["Zorunlu", "Required"],
  ["Opsiyonel", "Optional"],
  ["Belirtilmedi", "Not specified"],
  ["Tarih", "Date"],
  ["Aksiyon", "Action"],
  ["Kaynak", "Source"],
  ["Özellik", "Feature"],
  ["Bayrağı", "Flag"],
  ["Çalışma Zamanı", "Runtime"],
  ["E-posta", "Email"],
  ["Telefon", "Phone"],
  ["Kullanıcı", "User"],
  ["Yetki", "Permission"],
  ["Yetkisi", "Permission"],
  ["Hata", "Error"],
  ["Başarısız", "Failed"],
  ["Tamamlandı", "Completed"],
  ["Planlandı", "Scheduled"],
  ["Devam Ediyor", "In progress"],
  ["İptal", "Cancelled"],
  ["Katılım Yok", "No-show"],
  ["Rapor", "Report"],
  ["Öneri", "Recommendation"],
  ["Transkript", "Transcript"],
  ["Ön", "Pre"],
  ["Eleme", "Screening"],
  ["Güven", "Confidence"],
  ["Kalite", "Quality"]
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWordLikeValue(value: string) {
  return /^[\p{L}\p{N}_]+$/u.test(value);
}

function toTitleCaseWord(value: string, locale: string) {
  if (!value) {
    return value;
  }

  const first = value.charAt(0);
  return first.toLocaleUpperCase(locale) + value.slice(1).toLocaleLowerCase(locale);
}

function buildSafeWordMap(
  pairs: Array<[string, string]>,
  options: { sourceLocale: string; targetLocale: string; minLength: number }
) {
  const map: Record<string, string> = {};

  for (const [fromRaw, toRaw] of pairs) {
    const from = fromRaw.trim();
    const to = toRaw.trim();
    if (!from || !to || !isWordLikeValue(from) || from.length < options.minLength) {
      continue;
    }

    const variants: Array<[string, string]> = [
      [from, to],
      [
        from.toLocaleLowerCase(options.sourceLocale),
        to.toLocaleLowerCase(options.targetLocale)
      ],
      [
        from.toLocaleUpperCase(options.sourceLocale),
        to.toLocaleUpperCase(options.targetLocale)
      ],
      [toTitleCaseWord(from, options.sourceLocale), toTitleCaseWord(to, options.targetLocale)]
    ];

    for (const [variantFrom, variantTo] of variants) {
      if (!map[variantFrom]) {
        map[variantFrom] = variantTo;
      }
    }
  }

  return map;
}

function applyPhraseMap(value: string, map: Record<string, string>) {
  let next = value;
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);

  for (const [from, to] of entries) {
    if (!next.includes(from)) {
      continue;
    }

    const isWordLikeKey = /^[\p{L}\p{N}_]+$/u.test(from);
    if (isWordLikeKey) {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}_])${escapeRegExp(from)}(?![\\p{L}\\p{N}_])`,
        "gu"
      );
      next = next.replace(pattern, to);
      continue;
    }

    next = next.split(from).join(to);
  }

  return next;
}

function applyRegexTranslations(value: string, patterns: Array<[RegExp, string]>) {
  let next = value;
  for (const [pattern, replacement] of patterns) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

Object.assign(EN_PHRASE_TRANSLATIONS, {
  // Public-site regression fixes
  "Şirket adı": "Company name",
  "Rol / Ekip": "Role / Team",
  Mesaj: "Message",
  "Örn: Nurettin Erzen": "Example: Nurettin Erzen",
  "İK, kurucu, işe alım lideri...": "HR, founder, hiring lead...",
  "İşe alım süreçleriniz, pilot hedefiniz ve ihtiyacınız olan akışlar hakkında kısa bilgi verin.":
    "Share a short note about your hiring processes, pilot goals, and the workflows you need.",
  "Mesaj gönderilemedi. Lütfen tekrar deneyin.":
    "Message could not be sent. Please try again.",
  "Gönderim başarısız oldu": "Submission failed",
  "Candit.ai ana sayfa": "Candit.ai home page",
  "Genel gezinme": "Main navigation",
  "AI ile işe alımın geleceği.": "The future of hiring with AI.",
  "Siparişim nerede?": "Where is my order?",
  "Gelişmiş HRIS Senkronizasyonu": "Advanced HRIS Synchronization",
  "Kazanan ekipler insan karar vericiyi süreçten çıkarmıyor; tekrar eden ön eleme, soru standardizasyonu ve raporlama işini AI'a bırakıp nihai kararı recruiter ve hiring manager'a bağlıyor.":
    "Winning teams do not remove the human decision-maker from the process; they let AI handle repetitive pre-screening, question standardization, and reporting, while keeping the final decision with the recruiter and hiring manager.",
  "Sistemin hangi sinyali neden ürettiği görülebildiğinde ekiplerin güveni artıyor. Bu yüzden özet, risk, eksik bilgi ve öneri katmanlarının açıklanabilir olması kritik hale geliyor.":
    "When teams can see why the system produced a signal, trust increases. That is why explainable layers for summaries, risks, missing information, and recommendations become critical.",
  "AI destekli skorlamada recruiter yalnızca serbest metin yazmak zorunda kalmaz. Yetkinlik, risk, eksik bilgi ve öneri katmanları hazır geldiği için değerlendirme kalitesi daha az değişken olur.":
    "With AI-assisted scoring, recruiters do not have to rely solely on free-text notes. Since competency, risk, missing information, and recommendation layers arrive ready-made, evaluation quality becomes less variable.",
  "Hiring manager ve recruiter aynı sinyalleri aynı formatta gördüğünde kalibrasyon toplantıları kısalır, karar döngüsü hızlanır ve gereksiz tekrar mülakatlar azalır.":
    "When hiring managers and recruiters see the same signals in the same format, calibration meetings get shorter, decision cycles speed up, and unnecessary repeat interviews decrease.",
  "Aynı skor iki farklı pozisyonda farklı anlam taşıyabilir. Bu yüzden ham puanın yanında deneyim kanıtı, eksik bilgi alanları ve risk notları birlikte okunmalıdır.":
    "The same score can mean different things for two different positions. That is why experience evidence, missing-information areas, and risk notes should be read alongside the raw score.",
  "CV skoru sisteminize hız kazandırabilir; ancak nihai kararı otomatik vermek yerine hangi adayın önce inceleneceğini belirlemek için daha güvenli kullanılır.":
    "CV scoring can speed up your system; however, it is safer to use it to determine which candidate should be reviewed first rather than making the final decision automatically.",
  "Adayın günlerce haber beklemesi en büyük kopuş noktalarından biridir. Küçük durum güncellemeleri bile güven duygusunu ciddi biçimde artırır.":
    "One of the biggest drop-off points is when candidates wait days without hearing anything. Even small status updates significantly increase the sense of trust.",
  "Genel geçer sorular adayın deneyimini zayıflatır. Pozisyonun gerçekten ölçmek istediği davranış ve teknik sinyallere göre soru seti özelleştirilmelidir.":
    "Generic questions weaken the candidate experience. The question set should be customized according to the behavioral and technical signals the role truly needs to measure.",
  "Hiring manager tarafında okunabilir, kısa ve denetlenebilir özetler karar süresini düşürür. AI çıktısının operasyonel değeri raporun okunabilirliğiyle doğrudan ilişkilidir.":
    "Readable, concise, and auditable summaries for hiring managers reduce decision time. The operational value of AI output is directly related to how readable the report is.",
  "Recruiter ekibi aynı aday bilgisini iki farklı sisteme giriyorsa entegrasyon ihtiyacı doğmuştur. Bu noktada webhook veya temel API senaryosu ciddi zaman kazandırır.":
    "If the recruiter team enters the same candidate information into two different systems, an integration need has emerged. At that point, a webhook or basic API scenario saves serious time.",
  "ATS ile veri senkronizasyonu ayrı, takvim ve görüşme provisioning akışı ayrıdır. Bu iki ihtiyacın birlikte mi yoksa aşamalı mı çözüleceği baştan netleşmelidir.":
    "ATS data synchronization is separate from calendar and interview provisioning flows. It should be clarified upfront whether these two needs will be solved together or in phases.",
  "Hiring manager çoğu zaman tüm görüşme notunu okumak istemez. Kısa özet, alıntı niteliğinde kanıtlar ve net bir karar önerisi toplantı verimini ciddi biçimde artırır.":
    "Hiring managers often do not want to read the full interview note. A short summary, quote-like evidence, and a clear decision recommendation significantly increase meeting efficiency.",
  "Eksik bilgi, belirsiz sinyal veya rol uyumu riski baştan görünür olduğunda tartışma daha somut ilerler. Bu da toplantıyı uzatan soyut yorumları azaltır.":
    "When missing information, ambiguous signals, or role-fit risks are visible upfront, the discussion becomes more concrete. This reduces the abstract comments that prolong meetings."
});

Object.assign(EN_PHRASE_TRANSLATIONS, {
  "Tüm başvuruları tek panelden takip edin. Durum güncellemelerini ve işe alım notlarını aynı akışta yönetin.":
    "Track all applications from a single panel. Manage status updates and hiring notes in the same flow.",
  "İşe alım süreci metriklerini tek panelde izleyin. Darboğazları görünür hale getirip akışı iyileştirin.":
    "Track hiring process metrics in one panel. Make bottlenecks visible and improve the flow.",
  "Uygun senaryolarda adaylar davet edilen bağlantı üzerinden süreci kendi zamanlarında tamamlayabilir.":
    "In suitable scenarios, candidates can complete the process in their own time through the invitation link.",
  "En güçlü adayları öne çıkarın": "Highlight the strongest candidates",
  "Karşılaştırmalı raporlarla sonraki görüşme veya teklif adımı için en uygun adayları belirleyin.":
    "Use comparative reports to identify the best candidates for the next interview or offer step.",
  "Adaylarla sesli veya yazılı AI mülakat akışlarını otomatik yürütün.":
    "Automatically run voice or text AI interview flows with candidates.",
  "Takvim ve API bağlantılarını ekip ihtiyacına göre kademeli şekilde devreye alın.":
    "Enable calendar and API connections gradually based on team needs.",
  "Sesli ve yazılı mülakat desteği": "Voice and text interview support",
  "Paylaşılabilir başvuru akışları": "Shareable application flows",
  "Google Calendar bağlantısı": "Google Calendar connection",
  "Google kimliği ile planlama akışı": "Scheduling flow with Google identity",
  "ATS REST API / webhook": "ATS REST API / webhook",
  "Özel entegrasyon keşfi": "Custom integration discovery",
  "Güvenlik ve veri yönetişimi": "Security and data governance",
  "Aday verilerini erişim kontrolü, denetim izi ve veri yaşam döngüsü süreçleriyle yönetin.":
    "Manage candidate data with access control, audit visibility, and data lifecycle processes.",
  "Audit log ve yönetim görünürlüğü": "Audit log and admin visibility",
  "Veri saklama ve silme süreçleri için operasyonel temel":
    "Operational foundation for data retention and deletion processes",
  "REST API ve webhook ile kontrollü ATS entegrasyon senaryoları planlanabilir. Takvim ve planlama bağlantıları ekip ihtiyacına göre kademeli açılır; tüm entegrasyonlar varsayılan olarak aktif gelmez.":
    "Controlled ATS integration scenarios can be planned with REST APIs and webhooks. Calendar and scheduling connections are enabled gradually according to team needs; integrations do not come active by default.",
  "Google takvim akışıyla eşleştirin": "Match it with the Google Calendar flow",
  "Mülakat planlarını Google takvim akışıyla eşleştirin":
    "Match interview plans with the Google Calendar flow",
  "Planlama akışlarında Google Meet bağlantı senaryolarını yönetin":
    "Manage Google Meet connection scenarios in scheduling flows",
  "Pilot kurulum": "Pilot setup",
  Değerlendirme: "Evaluation",
  "Talep olduğunda değerlendirilen planlama seçeneği":
    "A scheduling option evaluated when there is demand",
  "Aday ve başvuru verisi için REST tabanlı entegrasyon senaryoları planlayın":
    "Plan REST-based integration scenarios for candidate and application data",
  "Başvuru ve mülakat olaylarını kendi sistemlerinize aktarmak için webhook akışları tanımlayın":
    "Define webhook flows to send application and interview events to your own systems",
  "Kontrollü erişim": "Controlled access",
  "Veri güvenliği, erişim kontrolleri ve süreç yönetişimi":
    "Data security, access controls, and process governance",
  "Erişim ve Yetkilendirme": "Access and Authorization",
  "Çalışma alanı, oturum ve rol bazlı erişim sınırlarıyla ekip içi görünürlüğü kontrol altında tutun.":
    "Keep team visibility under control with workspace, session, and role-based access boundaries.",
  "Rol bazlı erişim sınırları": "Role-based access boundaries",
  "JWT tabanlı oturum akışı": "JWT-based session flow",
  "Kritik yönetim aksiyonları için denetim izi":
    "Audit trail for critical administrative actions",
  "Veri Yönetişimi": "Data Governance",
  "Aday verilerinin saklanması, görünürlüğü ve yaşam döngüsü için operasyonel kontroller oluşturun.":
    "Create operational controls for candidate data retention, visibility, and lifecycle.",
  "Saklama ve silme politikalarını ekip bazında tanımlama":
    "Define retention and deletion policies at the team level",
  "Hassas veri alanları için görünürlük kararları":
    "Visibility decisions for sensitive data fields",
  "KVKK ve GDPR süreçleri için iç operasyon sahipliği":
    "Internal operational ownership for KVKK and GDPR processes",
  "AI Güvenlik Yaklaşımı": "AI Security Approach",
  "AI çıktıları karar desteği olarak konumlanır; nihai karar ve hassas süreçler insan onayıyla ilerler.":
    "AI output is positioned as decision support; final decisions and sensitive processes move forward with human approval.",
  "AI çıktıları recruiter kararının yerine geçmez":
    "AI outputs do not replace recruiter decisions",
  "Eksik bilgi ve risk sinyalleri görünür hale getirilir":
    "Missing information and risk signals are made visible",
  "Politika, fallback ve gözden geçirme katmanlarıyla akış sertleştirilir":
    "The flow is hardened with policy, fallback, and review layers",
  "Operasyonel İzleme": "Operational Monitoring",
  "Sistem durumu, kritik olaylar ve temel audit görünürlüğüyle launch öncesi sertleştirme desteklenir.":
    "Pre-launch hardening is supported through system status, critical events, and core audit visibility.",
  "Sağlık kontrolleri ve runtime görünürlüğü": "Health checks and runtime visibility",
  "Kritik olay kaydı ve yönetim takibi": "Critical event logging and admin tracking",
  "Kademeli launch için checklist odaklı ilerleme":
    "Checklist-driven progress for a staged launch",
  "Sezonluk kampanya dönemlerinde yüksek hacimli başvuruları AI ile tarayın ve öncelikli adayları daha hızlı görünür hale getirin.":
    "Use AI to review high-volume applications during seasonal campaigns and surface priority candidates faster.",
  "Hassas veri yönetimi için operasyonel kontrol yaklaşımı":
    "An operational control approach for sensitive data management",
  "Nasıl Çalışıyoruz": "How We Work",
  "Candit ekibi ürün, mühendislik ve işe alım deneyimini bir araya getiren dağıtık bir çalışma modeliyle ilerler. Önceliğimiz Türkiye odaklı pilot ekiplerle gerçek kullanım üzerinden hızlı öğrenmek ve ürünü buna göre geliştirmektir.":
    "The Candit team works in a distributed model that combines product, engineering, and hiring experience. Our priority is to learn quickly from real usage with Turkey-focused pilot teams and shape the product accordingly.",
  "Takvim ve Planlama Hazırlıkları": "Calendar and Scheduling Preparation",
  "Mülakat planlama tarafında Google ekosistemi odaklı bağlantı hazırlıkları ve yedek akışlar güçlendirildi.":
    "Connection preparation focused on the Google ecosystem and fallback flows for interview scheduling were strengthened.",
  "Google Meet planlama bağlamı netleştirildi":
    "Google Meet scheduling context was clarified",
  "Pilot planlama ihtiyaçları için entegrasyon hazırlıkları sertleştirildi":
    "Integration readiness for pilot scheduling needs was hardened",
  "Pilot API Yüzeyi": "Pilot API Surface",
  "Kontrollü entegrasyonlar için temel uç noktalar":
    "Core endpoints for controlled integrations",
  "Servis durumu ve temel çalışma zamanı hazırlığını doğrular.":
    "Verifies service status and baseline runtime readiness.",
  "Etkin giriş sağlayıcılarını ve auth seçeneklerini listeler.":
    "Lists enabled sign-in providers and auth options.",
  "Pilot ve demo taleplerini public lead kuyruğuna kaydeder.":
    "Stores pilot and demo requests in the public lead queue.",
  "Desteklenen entegrasyon sağlayıcıları için gelen webhook olaylarını işler.":
    "Processes incoming webhook events for supported integration providers.",
  "Pilot ortam": "Pilot environment",
  "Pilot hazır": "Pilot-ready",
  "temel işe alım akışı": "core hiring flow",
  "Akış görünürlüğü": "Flow visibility",
  "Tek panel": "Single pane",
  operasyon: "operations",
  "Tek panelde izlenebilir işe alım akışı.": "A traceable hiring flow in one panel.",
  "Ön eleme, mülakat ve değerlendirme adımları aynı operasyon görünümü içinde takip edilir.":
    "Pre-screening, interviews, and evaluation steps are tracked within the same operational view.",
  "Ön eleme görünürlüğü": "Pre-screening visibility",
  "Mülakat akışı": "Interview flow",
  "Rapor ve karar desteği": "Reports and decision support",
  "Pozisyonu tanımlayın, adayları yönlendirin ve AI mülakat akışını başlatın. Süreç aynı panelde görünür kalır.":
    "Define the role, guide candidates, and start the AI interview flow. The process remains visible in the same panel.",
  "Takvim, ATS ve webhook bağlantılarını ekip ihtiyacına göre kademeli planlayın.":
    "Plan calendar, ATS, and webhook connections gradually based on team needs.",
  "Yeni içerikler ve ürün notları için bağlantıda kalın":
    "Stay connected for new content and product notes",
  "Şimdilik e-posta aboneliği yerine blog ve iletişim kanalı üzerinden güncellemeleri paylaşıyoruz.":
    "For now, we share updates through the blog and contact channel instead of an email subscription.",
  "Blog yazılarını inceleyin": "Browse blog posts",
  "Güncelleme talebi bırakın": "Leave an update request",
  "REST API ve webhook senaryolarıyla Candit'i mevcut İK sistemlerinize kontrollü biçimde bağlayın.":
    "Connect Candit to your existing HR systems in a controlled way with REST API and webhook scenarios.",
  "JWT ve provider tabanlı auth akışlarıyla korumalı uç noktalara erişin.":
    "Access protected endpoints with JWT and provider-based auth flows.",
  "Mülakat, değerlendirme, başvuru ve süreç olaylarını provider bazında takip edin.":
    "Track interview, evaluation, application, and process events by provider.",
  "Pilot stabilitesini korumak için istek limitleri ve kontrollü erişim uygulanır.":
    "Rate limits and controlled access are applied to protect pilot stability.",
  "Erişim, denetim izi ve veri yönetişimi kontrollerini kademeli olarak güçlendiren bir güvenlik yaklaşımı benimsiyoruz.":
    "We follow a security approach that gradually strengthens access, audit trail, and data governance controls."
  ,
  "Bazi readiness verileri eksik yüklendi.":
    "Some readiness data loaded incompletely.",
  "AI destek verisi su an eksik yuklendi.":
    "AI support data is currently incomplete.",
  "Entegrasyon readiness verisi su an eksik yuklendi.":
    "Integration readiness data is currently incomplete.",
  "Mulakat oturum verisi su an eksik yuklendi.":
    "Interview session data is currently incomplete.",
  "Planlama workflow verisi su an eksik yuklendi.":
    "Scheduling workflow data is currently incomplete.",
  "Bildirim teslimat verisi su an eksik yuklendi.":
    "Notification delivery data is currently incomplete.",
  "Calisma zamani dogrulama verisi su an eksik yuklendi.":
    "Runtime validation data is currently incomplete."
});

const EN_TO_TR_PHRASE_TRANSLATIONS: Record<string, string> = Object.entries(
  EN_PHRASE_TRANSLATIONS
).reduce<Record<string, string>>((acc, [tr, en]) => {
  const normalizedEnglish = en.trim();
  const isSafeReversePhrase =
    normalizedEnglish.length >= 3 &&
    /[\p{L}\p{N}]/u.test(normalizedEnglish);

  if (isSafeReversePhrase && !acc[normalizedEnglish]) {
    acc[normalizedEnglish] = tr;
  }
  return acc;
}, {});

const TURKISH_WORD_FIX_MAP = buildSafeWordMap(TURKISH_WORD_FIXES, {
  sourceLocale: "tr-TR",
  targetLocale: "tr-TR",
  minLength: 4
});

const EN_WORD_TRANSLATION_MAP = buildSafeWordMap(EN_WORD_TRANSLATIONS, {
  sourceLocale: "tr-TR",
  targetLocale: "en-US",
  minLength: 3
});

export function normalizeSiteLocale(raw: string | null | undefined): SiteLocale {
  if (!raw) {
    return DEFAULT_SITE_LOCALE;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  return "tr";
}

export function getLocaleTag(locale: SiteLocale) {
  return locale === "en" ? "en-US" : "tr-TR";
}

export function getActiveSiteLocale(): SiteLocale {
  if (typeof document === "undefined") {
    return DEFAULT_SITE_LOCALE;
  }

  return normalizeSiteLocale(document.documentElement.lang);
}

export function getActiveLocaleTag() {
  return getLocaleTag(getActiveSiteLocale());
}

export function normalizeTurkishUiText(text: string) {
  if (!text) {
    return text;
  }

  const compactText = normalizeWhitespace(text);
  const canonicalized = applyPhraseMap(compactText, EN_TO_TR_PHRASE_TRANSLATIONS);
  const phraseFixed = applyPhraseMap(canonicalized, TURKISH_PHRASE_FIXES);
  return normalizeWhitespace(applyPhraseMap(phraseFixed, TURKISH_WORD_FIX_MAP));
}

function translateTurkishUiToEnglish(text: string) {
  const normalizedText = normalizeWhitespace(text);
  const phraseTranslated = applyPhraseMap(normalizedText, EN_PHRASE_TRANSLATIONS);
  const shouldApplyWordMap =
    normalizedText.length <= 48 &&
    normalizedText.split(/\s+/).length <= 4;
  const wordAwareText = shouldApplyWordMap
    ? applyPhraseMap(phraseTranslated, EN_WORD_TRANSLATION_MAP)
    : phraseTranslated;
  const regexTranslated = applyRegexTranslations(wordAwareText, [
    [/Tümü\s*\((\d+)\)/giu, "All ($1)"],
    [/Yayında\s*\((\d+)\)/giu, "Published ($1)"],
    [/Taslak\s*\((\d+)\)/giu, "Draft ($1)"],
    [/Arşiv\s*\((\d+)\)/giu, "Archived ($1)"],
    [/Bu dönem\s+(\d+)\s*\/\s*(\d+)\s+aktif ilan kullanıyorsunuz\./giu, "You are using $1 / $2 active jobs this period."],
    [/(\d+)\s+başvuru/giu, "$1 applications"],
    [/(\d+)\s+ödeme kaydı/giu, "$1 payment records"],
    [/(\d+)\s+kritik uyarı/giu, "$1 critical alerts"],
    [/Ödeme bağlantısı\s+(.+?)\s+adresine gönderildi\./giu, "Payment link sent to $1."],
    [/Kullanıcı kullanımınız %(\d+)\s+seviyesine ulaştı\./giu, "User usage has reached $1%."],
    [/Aktif ilan kullanımınız %(\d+)\s+seviyesine ulaştı\./giu, "Active job usage has reached $1%."],
    [/Aday işleme kullanımınız %(\d+)\s+seviyesine ulaştı\./giu, "Candidate processing usage has reached $1%."],
    [/AI mülakat kullanımınız %(\d+)\s+seviyesine ulaştı\./giu, "AI interview usage has reached $1%."],
    [/Davet:\s*/giu, "Invite: "],
    [/Son giriş:\s*/giu, "Last login: "],
    [/Son geçerlilik:\s*(.+)/giu, "Valid until: $1"],
    [/^(.+)\s+için davet gönderiliyor\.$/giu, "Sending invite for $1."],
    [/(\d+)\s+kişi/giu, "$1 people"],
    [/Gün\s+(\d+)/giu, "Day $1"],
    [/(\d+)\s+yıl deneyim/giu, "$1 years experience"],
    [/(\d+)\s+aday algılandı/giu, "$1 candidates detected"],
    [/(\d+)\s+Aday Ekle/giu, "Add $1 Candidates"],
    [
      /(\d+)\s+satır algılandı\.\s+Alan eşlemesini kontrol edin;\s+sonraki aynı format import’larda mapping otomatik hatırlanır\./giu,
      "$1 rows detected. Review the field mapping; the same format will be remembered for future imports."
    ],
    [
      /Belge teyidi sonras[ıi]\s+candidate yeniden de[ğg]erlendirilsin\.?/giu,
      "Reassess the candidate after document verification."
    ],
    [
      /Interview transcriptinde vardiya uyumu sinyali var\.?/giu,
      "The interview transcript shows shift-compatibility signals."
    ],
    [
      /(?:Aday|Candidate)\s+depo operasyonunda\s+5\s+y[ıi]la?\s+yak[ıi]n deneyim sinyali veriyor\.?/giu,
      "The candidate shows signals of nearly 5 years of warehouse operations experience."
    ],
    [
      /Vardiya\s+ç?al[ıi][şs]ma sinyali mevcut\.?/giu,
      "Shift-work signal is present."
    ],
    [
      /Forklift sertifika[sıi]\s+yenileme s[üu]reci tamamlanmam[ıi]ş olabilir\.?/giu,
      "Forklift certificate renewal process may not be completed."
    ],
    [
      /Forklift sertifika[sıi]\s+yenileme s[üu]reci tamamlanmam[ıi]ş\.?/giu,
      "Forklift certificate renewal process is not completed."
    ],
    [
      /Interview daveti g[öo]nderildi[ğg]inde,\s*candidate e-?posta ile randevu se[çc]im linki al[ıi]r ve kendi uygun oldu[ğg]u zaman[ıi] se[çc]er\.?/giu,
      "When the interview invitation is sent, the candidate receives an email with an appointment-selection link and chooses a suitable time."
    ],
    [
      /V1 Security Rule:\s*AI ç[ıi]kt[ıi]s[ıi] otomatik karar uygulamaz\.?\s*Stage etkileyen t[üu]m kararlar recruiter\/hiring manager onay[ıi] ve audit izi ile tamamlan[ıi]r\.?/giu,
      "V1 Security Rule: AI output cannot apply automatic decisions. All stage-impacting decisions require recruiter/hiring manager approval and an audit trail."
    ],
    [
      /AI ç[ıi]kt[ıi]s[ıi] otomatik karar uygulamaz\.?\s*Stage etkileyen t[üu]m kararlar recruiter\/hiring manager onay[ıi] ve audit izi ile tamamlan[ıi]r\.?/giu,
      "AI output cannot apply automatic decisions. All stage-impacting decisions require recruiter/hiring manager approval and an audit trail."
    ]
  ]);

  return normalizeWhitespace(regexTranslated
    .replace(/(\d+)\s+gün/giu, "$1 days")
    .replace(/(\d+)\s*-\s*(\d+)\s+dk/giu, "$1-$2 min")
    .replace(/(\d+)\s+dk/giu, "$1 min")
    .replace(/(\d+)\s+sa\s+(\d+)\s+dk/giu, "$1 hr $2 min")
    .replace(/(\d+)\s+sa/giu, "$1 hr")
    .replace(/(\d+)\s+segment/giu, "$1 segments")
    .replace(/kuyruğa alındı\./giu, "has been queued.")
    .replace(/\s{2,}/g, " "));
}

export function transformUiText(text: string, locale: SiteLocale) {
  const normalized = normalizeTurkishUiText(text);
  if (locale === "tr") {
    return normalized;
  }

  return translateTurkishUiToEnglish(normalized);
}

export function translateUiText(text: string, locale: SiteLocale) {
  return transformUiText(text, locale);
}
