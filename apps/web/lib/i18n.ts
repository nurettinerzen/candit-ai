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
  Dil: "Language",
  "Operasyon Özeti": "Operations Summary",
  "Demo Senaryoları": "Demo Scenarios",
  "Planlanan Sonraki Yetenek": "Planned Next Capability",
  "İlan Merkezi": "Job Center",
  "Yeni İlan Hazırla": "Prepare New Posting",
  "İlanı Kaydet": "Save Posting",
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
  Raporlar: "Reports",
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
  Durum: "Status",
  Tarih: "Date",
  Aksiyon: "Action",
  Kaynak: "Source",
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
  "Screening support görevi kuyruğa alındı.": "Screening support task has been queued."
};

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
  "Bugün": "Today",
  "Cevap gönderilemedi.": "Response could not be submitted.",
  "CODE: açıklama": "CODE: description",
  "CSV Yükle": "Upload CSV",
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
  "Stage Güncelleme": "Stage Update",
  "Stage hatası": "Stage error",
  "Stage ve Karar İşlemleri": "Stage and Decision Actions",
  "Stage'i Güncelle": "Update Stage",
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
  "Rol ailesi zorunludur.": "Role family is required.",
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
  "Rapor Oluşturma": "Report Generation",
  "Screening tabanlı": "Screening-based",
  "Sertifika doğrulaması gerekli": "Certificate verification required",
  "Session başlatıldı.": "Session started.",
  "Session tamamlandı.": "Session completed.",
  "Türkiye odaklı AI destekli recruiter işletim paneli":
    "Turkey-focused AI-assisted recruiter operations dashboard",
  "Bugün dikkat edilmesi gerekenler ve işe alım süreçlerinizin özeti.":
    "Summary of today’s priorities and your hiring pipeline.",
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
  "Yönetici İncelemesi": "Hiring Manager Review",
  "Teklif Aşamasında": "Offer Stage",
  "Reddedildi": "Rejected",
  "İşe Alındı": "Hired"
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
  "Aday uygun gorunmekle birlikte sertifika teyidi sonrasi karar verilmelidir.":
    "The candidate appears suitable, but a decision should be made after certificate verification.",
  "Candidate uygun gorunmekle birlikte sertifika teyidi sonrasi karar verilmelidir.":
    "The candidate appears suitable, but a decision should be made after certificate verification.",
  "Adayin depo deneyimi mevcut.": "The candidate has warehouse experience.",
  "Adayin depo ve vardiya deneyimi role uyum sinyali veriyor.":
    "The candidate's warehouse and shift experience indicates role-fit signals.",
  "Aday depo operasyonunda 5 yila yakin deneyim sinyali veriyor.":
    "The candidate shows signals of nearly 5 years of warehouse operations experience.",
  "Aday role temel uyum sinyali veriyor ancak sertifika teyidi kritik.":
    "The candidate shows baseline role-fit signals, but certificate verification is critical.",
  "Adayi recruiter review asamasinda tutup sertifika teyidi sonrasi karar verin.":
    "Keep the candidate in recruiter review and decide after certificate verification.",
  "Aday sertifika yenilemesinin devam ettigini belirtti.":
    "The candidate stated that certificate renewal is still in progress.",
  "Aday gece vardiyasi deneyimini belirtti.": "The candidate stated night-shift experience.",
  "Aday gece vardiyasi tecrubesini aktardi.": "The candidate reported night-shift experience.",
  "Aday vardiya uygunlugu sinyali verdi.": "The candidate showed shift-suitability signals.",
  "Gece vardiyasinda calisma beyan edildi.": "Night-shift availability was stated.",
  "Interview transcriptinde vardiya uyumu sinyali var.":
    "The interview transcript shows shift-compatibility signals.",
  "Belge teyidi sonrasi candidate yeniden degerlendirilsin.":
    "Reassess the candidate after document verification.",
  "Depo deneyimi mevcut.": "Warehouse experience is present.",
  "Vardiya uyumu sinyali pozitif.": "Shift-compatibility signal is positive.",
  "Belge teyidi bitmeden final ilerleme onerilmez.":
    "Final progression is not recommended before document verification.",
  "Sertifika teyidi tamamlanmadan ilerleme riski bulunuyor.":
    "There is progression risk before certificate verification is complete.",
  "Sertifika dokumani teyit adimini tamamla.":
    "Complete the certificate document verification step.",
  "Candidate sertifika yenilemesinin devam ettigini belirtti.":
    "The candidate stated that certificate renewal is still in progress.",
  "Sertifika dogrulama adimini tamamlayip tekrar degerlendir.":
    "Complete the certificate verification step and reassess.",
  "Sertifika teyidi sonrasi recruiter degerlendirmesi ile ilerleyin.":
    "Proceed with recruiter evaluation after certificate verification.",
  "Neden Uygun?": "Why Fit?",
  "Ne Risk Var?": "What Risks Exist?",
  "Belirsizlik (orta)": "Uncertainty (medium)",
  "Depo Operations Sesli İlk Interview V1": "Warehouse Operations Voice Initial Interview V1",
  "Depo Operations Sesli Ilk Interview V1": "Warehouse Operations Voice Initial Interview V1",
  "Sertifika dogrulamasi tamamlanmadi.": "Certificate verification is not completed.",
  "Sertifika dogrulamasi tamamlanmadan nihai karar verilmemeli.":
    "A final decision should not be made before certificate verification is completed.",
  "Sertifika dogrulamasi eksik": "Certificate verification is missing",
  "Sertifika dogrulama adimi tamamlanmadan ilerleme karari riskli olabilir.":
    "Progression decisions may be risky before the certificate verification step is completed.",
  "Sertifika teyidi henuz tamamlanmadi.": "Certificate verification has not been completed yet.",
  "Belge teyidi eksik.": "Document verification is missing.",
  "Belge teyidi tamamlanmadan nihai karar verilmemeli.":
    "A final decision should not be made before document verification is completed.",
  "Belge teyidi tamamlanana kadar recruiter review'da tut.":
    "Keep it in recruiter review until document verification is completed.",
  "Belgeyi dogrulayip screening notunu guncelleyin.":
    "Verify the document and update the screening note.",
  "Sertifika kontrolu sonrasi ilerletme degerlendirilebilir.":
    "Advancement can be considered after certificate verification.",
  "Sertifika yenileme sureci devam ediyor.": "Certificate renewal process is ongoing.",
  "Sertifika yenileme sureci oldugu belirtildi.":
    "It was stated that the certificate renewal process is ongoing.",
  "Forklift sertifika dokumaninin guncel kopyasi bekleniyor.":
    "An up-to-date copy of the forklift certificate document is pending.",
  "Forklift sertifika teyidi tamamlanmadan kesin ilerleme onerilmez.":
    "Definitive advancement is not recommended before forklift certificate verification is completed.",
  "Forklift sertifika belgesinin guncel kopyasi":
    "Up-to-date copy of the forklift certificate",
  "Forklift sertifika belgesinin dogrulanmasi": "Verification of the forklift certificate",
  "Vardiya uyum sinyali": "Shift-compatibility signal",
  "Vardiya calisma sinyali mevcut.": "Shift-work signal is present.",
  "Depo operasyon deneyimi": "Warehouse operations experience",
  "Depo operasyon deneyimi role iliskin temel uyum gosteriyor.":
    "Warehouse operations experience shows baseline fit for the role.",
  "Depo operasyonu, stok kontrolu ve sevkiyat hazirlama adimlarinda deneyim mevcut.":
    "There is experience in warehouse operations, stock control, and shipment preparation steps.",
  "Depo operasyonunda hizli adapte olma ihtimali yuksek olabilir.":
    "There may be a high likelihood of fast adaptation in warehouse operations.",
  "Depo/Lojistik role gecis icin pozitif sinyal":
    "Positive signal for transition into warehouse/logistics roles",
  "Perakende ve kasa deneyimi kasiyer rolune temel uyum sinyali veriyor.":
    "Retail and cashier experience provides baseline fit signals for the cashier role.",
  "Perakende deneyimi sayesinde role temel uyum sinyali guclu.":
    "Retail experience provides a strong baseline role-fit signal.",
  "Musteri iletisim senaryosu sonrasi karar verilmesi uygun.":
    "It is appropriate to decide after a customer-communication scenario.",
  "Kisa bir musteri senaryosu gorusmesi sonrasi screening tamamlanabilir.":
    "Screening can be completed after a short customer-scenario interview.",
  "Temel screening bilgisi yeterli.": "Basic screening information is sufficient.",
  "REPORT_GENERATION icin tamamlanmis interview session bulunamadi.":
    "No completed interview session was found for REPORT_GENERATION.",
  "REPORT_GENERATION task'i icin interview session baglami bulunamadi.":
    "No interview session context was found for the REPORT_GENERATION task.",
  "Mulakat oturumu olmadigi icin rapor uretilemedi.":
    "The report could not be generated because there is no interview session.",
  "Basvuru stage bilgisi screening baglami olarak kullanildi.":
    "Application stage information was used as screening context.",
  "sertifika dogrulamasi bekleniyor": "certificate verification is pending",
  "vardiya duzeni": "shift schedule",
  "Vardiya uyumu": "Shift compatibility",
  "Vardiya ve operasyon deneyimi metinde yer aliyor.":
    "Shift and operations experience appears in the text.",
  "Birden fazla depo rol sinyali bulundu.": "Multiple warehouse role signals were detected.",
  "kasa islemleri, musteri iletisim, vardiya planina uyum":
    "checkout operations, customer communication, alignment with shift planning",
  "2 yil depo deneyimi": "2 years of warehouse experience"
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

const EN_TO_TR_PHRASE_TRANSLATIONS: Record<string, string> = Object.entries(
  EN_PHRASE_TRANSLATIONS
).reduce<Record<string, string>>((acc, [tr, en]) => {
  if (!acc[en]) {
    acc[en] = tr;
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

  const canonicalized = applyPhraseMap(text, EN_TO_TR_PHRASE_TRANSLATIONS);
  const phraseFixed = applyPhraseMap(canonicalized, TURKISH_PHRASE_FIXES);
  return applyPhraseMap(phraseFixed, TURKISH_WORD_FIX_MAP);
}

function translateTurkishUiToEnglish(text: string) {
  return applyPhraseMap(applyPhraseMap(text, EN_PHRASE_TRANSLATIONS), EN_WORD_TRANSLATION_MAP)
    .replace(/(\d+)\s+gün/giu, "$1 days")
    .replace(/(\d+)\s+segment/giu, "$1 segments")
    .replace(/kuyruğa alındı\./giu, "has been queued.")
    .replace(/\s{2,}/g, " ");
}

export function transformUiText(text: string, locale: SiteLocale) {
  const normalized = normalizeTurkishUiText(text);
  if (locale === "tr") {
    return normalized;
  }

  return translateTurkishUiToEnglish(normalized);
}
