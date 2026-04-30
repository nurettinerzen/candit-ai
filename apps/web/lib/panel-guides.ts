export type PanelGuideKey =
  | "dashboard"
  | "jobs"
  | "jobCreate"
  | "jobDetail"
  | "applications"
  | "applicationDetail"
  | "interviews"
  | "candidates"
  | "candidateCreate"
  | "candidateDetail"
  | "reports"
  | "sourcing"
  | "sourcingProject"
  | "team"
  | "settings"
  | "subscription"
  | "adminDashboard"
  | "adminLeads"
  | "adminSettings"
  | "adminUsers"
  | "tenantDetail"
  | "adminEnterprise"
  | "adminRedAlert"
  | "auditLogs"
  | "aiSupport";

type LocalizedText = {
  tr: string;
  en: string;
};

export type PanelGuideEntry = {
  title: LocalizedText;
  summary: LocalizedText;
  highlights: LocalizedText[];
};

export const PANEL_GUIDES: Record<PanelGuideKey, PanelGuideEntry> = {
  dashboard: {
    title: {
      tr: "Genel Bakış",
      en: "Overview"
    },
    summary: {
      tr: "İşe alım operasyonunun günlük özetini görür, bekleyen işleri ve dikkat gerektiren sinyalleri hızlıca fark edersiniz.",
      en: "See the daily summary of your hiring operations and quickly spot pending work and signals that need attention."
    },
    highlights: [
      {
        tr: "Günlük operasyon özeti",
        en: "Daily operations summary"
      },
      {
        tr: "Bekleyen kararlar ve aktif görüşmeler",
        en: "Pending decisions and active interviews"
      },
      {
        tr: "Kritik aksiyonlara hızlı geçiş",
        en: "Quick jump to critical actions"
      }
    ]
  },
  jobs: {
    title: {
      tr: "İlan Merkezi",
      en: "Job Center"
    },
    summary: {
      tr: "İlanları oluşturur, yayın durumlarını takip eder ve her ilan üzerinden başvuru ile mülakat akışına girersiniz.",
      en: "Create job posts, track publishing status, and enter the application and interview flow from each posting."
    },
    highlights: [
      {
        tr: "İlan oluşturma ve yayın yönetimi",
        en: "Job creation and publishing control"
      },
      {
        tr: "İlan bazlı aday ve başvuru görünümü",
        en: "Candidate and application view by job"
      },
      {
        tr: "Operasyon akışına tek giriş noktası",
        en: "Single entry point into operations"
      }
    ]
  },
  jobCreate: {
    title: {
      tr: "Yeni İlan Hazırla",
      en: "Create New Job"
    },
    summary: {
      tr: "Yeni ilan formunda pozisyon, gereksinim ve yayın bilgilerini toplar; AI taslağını bu akışta üretirsiniz.",
      en: "Collect role, requirement, and publishing information in the new job form and generate the AI draft in this flow."
    },
    highlights: [
      {
        tr: "Pozisyon ve gereksinim girişi",
        en: "Role and requirement entry"
      },
      {
        tr: "AI ilan taslağı hazırlığı",
        en: "AI job draft preparation"
      },
      {
        tr: "Yayın öncesi kontrol",
        en: "Pre-publish review"
      }
    ]
  },
  jobDetail: {
    title: {
      tr: "İlan Detayı",
      en: "Job Detail"
    },
    summary: {
      tr: "Bir ilanın komuta merkezi gibi çalışır; adayları, başvuru durumlarını ve mülakat aksiyonlarını bu sayfadan yönetirsiniz.",
      en: "Acts as the command center for a job; manage candidates, application states, and interview actions from this page."
    },
    highlights: [
      {
        tr: "İlan bazlı operasyon yönetimi",
        en: "Job-level operations management"
      },
      {
        tr: "Aday ve aşama görünürlüğü",
        en: "Candidate and stage visibility"
      },
      {
        tr: "Mülakat ve karar aksiyonları",
        en: "Interview and decision actions"
      }
    ]
  },
  applications: {
    title: {
      tr: "Başvurular",
      en: "Applications"
    },
    summary: {
      tr: "İlan bazlı iş kuyruğunu yönetir, adayları aşamalara göre filtreler ve karar ekranlarına buradan geçersiniz.",
      en: "Manage the job-based work queue, filter candidates by stage, and move into decision screens from here."
    },
    highlights: [
      {
        tr: "İş kuyruğu görünümü",
        en: "Work queue view"
      },
      {
        tr: "Aşama ve durum filtreleri",
        en: "Stage and status filters"
      },
      {
        tr: "Karar ekranlarına hızlı geçiş",
        en: "Quick transition to decision screens"
      }
    ]
  },
  applicationDetail: {
    title: {
      tr: "Başvuru Detayı",
      en: "Application Detail"
    },
    summary: {
      tr: "Tek bir başvurunun karar ekranıdır; screening, mülakat ve rapor çıktıları bu sayfada birleşir.",
      en: "This is the decision screen for a single application; screening, interview, and report outputs come together on this page."
    },
    highlights: [
      {
        tr: "Karar destek görünümü",
        en: "Decision support view"
      },
      {
        tr: "Mülakat ve rapor çıktıları",
        en: "Interview and report outputs"
      },
      {
        tr: "Tek başvuru odaklı aksiyonlar",
        en: "Single-application actions"
      }
    ]
  },
  interviews: {
    title: {
      tr: "Mülakatlar",
      en: "Interviews"
    },
    summary: {
      tr: "AI mülakat davetlerini, devam eden oturumları ve tamamlanan görüşmeleri tek listede izlersiniz.",
      en: "Track AI interview invitations, ongoing sessions, and completed interviews in one list."
    },
    highlights: [
      {
        tr: "Davet, oturum ve sonuç takibi",
        en: "Invitation, session, and outcome tracking"
      },
      {
        tr: "Aktif durum kartları",
        en: "Live status cards"
      },
      {
        tr: "Görüşme operasyon görünürlüğü",
        en: "Interview operations visibility"
      }
    ]
  },
  candidates: {
    title: {
      tr: "Adaylar",
      en: "Candidates"
    },
    summary: {
      tr: "Tüm aday havuzunu, başvurularını ve temel iletişim bilgilerini tek ekranda tararsınız.",
      en: "Browse the full talent pool, their applications, and core contact information on a single screen."
    },
    highlights: [
      {
        tr: "Aday havuzu görünümü",
        en: "Talent pool view"
      },
      {
        tr: "Başvuru geçmişi ve filtreleme",
        en: "Application history and filtering"
      },
      {
        tr: "Aday detayına hızlı giriş",
        en: "Quick entry into candidate detail"
      }
    ]
  },
  candidateCreate: {
    title: {
      tr: "Yeni Aday Kaydı",
      en: "New Candidate Record"
    },
    summary: {
      tr: "Manuel aday kaydı açar, yinelenen kayıt kontrolüyle havuza yeni aday eklersiniz.",
      en: "Create a manual candidate record and add a new person to the pool with duplicate checks."
    },
    highlights: [
      {
        tr: "Manuel aday ekleme",
        en: "Manual candidate creation"
      },
      {
        tr: "Duplicate kontrolü",
        en: "Duplicate validation"
      },
      {
        tr: "Aday havuzuna giriş",
        en: "Entry into the candidate pool"
      }
    ]
  },
  candidateDetail: {
    title: {
      tr: "Aday Detayı",
      en: "Candidate Detail"
    },
    summary: {
      tr: "Adayın profilini, belgelerini, başvurularını ve AI değerlendirme sinyallerini tek sayfada incelersiniz.",
      en: "Review the candidate’s profile, documents, applications, and AI evaluation signals on a single page."
    },
    highlights: [
      {
        tr: "Aday profili ve belgeler",
        en: "Candidate profile and documents"
      },
      {
        tr: "Başvuru geçmişi",
        en: "Application history"
      },
      {
        tr: "AI sinyal ve not görünürlüğü",
        en: "AI signal and notes visibility"
      }
    ]
  },
  reports: {
    title: {
      tr: "Raporlar",
      en: "Reports"
    },
    summary: {
      tr: "Operasyon, dönüşüm ve AI katkısı metriklerini yönetim ve İK raporlaması için izlersiniz.",
      en: "Monitor operations, conversion, and AI impact metrics for HR and executive reporting."
    },
    highlights: [
      {
        tr: "Yönetim özeti",
        en: "Executive summary"
      },
      {
        tr: "Süreç ve dönüşüm görünürlüğü",
        en: "Process and conversion visibility"
      },
      {
        tr: "AI katkısı ve zaman kazancı",
        en: "AI contribution and time savings"
      }
    ]
  },
  sourcing: {
    title: {
      tr: "Sourcing",
      en: "Sourcing"
    },
    summary: {
      tr: "Yeni yetenek keşfi projeleri açar, yeniden keşif ve ilk iletişim hazırlığını aynı akışta yönetirsiniz.",
      en: "Open new talent discovery projects and manage rediscovery and outreach preparation in the same flow."
    },
    highlights: [
      {
        tr: "Yetenek keşfi projeleri",
        en: "Talent discovery projects"
      },
      {
        tr: "Yeniden keşif ve ilk iletişim temeli",
        en: "Rediscovery and outreach foundation"
      },
      {
        tr: "Pozisyon bağlantılı sourcing akışı",
        en: "Role-linked sourcing flow"
      }
    ]
  },
  sourcingProject: {
    title: {
      tr: "Sourcing Projesi",
      en: "Sourcing Project"
    },
    summary: {
      tr: "Seçili sourcing projesinde önerilen adayları, yeniden keşif sonuçlarını ve ilk iletişim hazırlığını yönetirsiniz.",
      en: "Manage recommended candidates, rediscovery results, and outreach preparation inside the selected sourcing project."
    },
    highlights: [
      {
        tr: "Proje bazlı yetenek keşfi",
        en: "Project-based talent discovery"
      },
      {
        tr: "Yeniden keşif ve kısa liste akışı",
        en: "Rediscovery and shortlist flow"
      },
      {
        tr: "İlk iletişim hazırlık görünümü",
        en: "Outreach preparation view"
      }
    ]
  },
  team: {
    title: {
      tr: "Ekip",
      en: "Team"
    },
    summary: {
      tr: "Üye davetlerini, rol değişikliklerini ve şirket hesabı erişimini ayrı bir ekip yüzeyinden yönetirsiniz.",
      en: "Manage invitations, role changes, and company account access from a dedicated team surface."
    },
    highlights: [
      {
        tr: "Yeni üye daveti ve koltuk görünürlüğü",
        en: "New teammate invites and seat visibility"
      },
      {
        tr: "Rol, durum ve davet aksiyonları",
        en: "Role, status, and invitation actions"
      },
      {
        tr: "Erişim yönetimini abonelikten ayıran net akış",
        en: "A clear access flow separated from subscription management"
      }
    ]
  },
  settings: {
    title: {
      tr: "Ayarlar",
      en: "Settings"
    },
    summary: {
      tr: "Şirket profilini, güvenlik ayarlarını ve kritik hesap aksiyonlarını buradan yönetirsiniz.",
      en: "Manage the company profile, security settings, and critical account actions from here."
    },
    highlights: [
      {
        tr: "Şirket profili ve varsayılan hesap bilgileri",
        en: "Company profile and default account details"
      },
      {
        tr: "Şifre ve doğrulama akışları",
        en: "Password and verification flows"
      },
      {
        tr: "Kritik hesap aksiyonları",
        en: "Critical account actions"
      }
    ]
  },
  subscription: {
    title: {
      tr: "Abonelik",
      en: "Subscription"
    },
    summary: {
      tr: "Plan, kota, fatura ve ödeme adımlarını bu sayfadan yönetirsiniz.",
      en: "Manage plans, quotas, billing, and payment steps from this page."
    },
    highlights: [
      {
        tr: "Plan ve kota görünürlüğü",
        en: "Plan and quota visibility"
      },
      {
        tr: "Ödeme ve fatura yönetimi",
        en: "Billing and payment management"
      },
      {
        tr: "Yükseltme ve ek paket akışları",
        en: "Upgrade and add-on flows"
      }
    ]
  },
  adminDashboard: {
    title: {
      tr: "Yönetici Paneli",
      en: "Admin Dashboard"
    },
    summary: {
      tr: "İç yönetim için kritik metrikleri, operasyon dağılımını ve sistem çapı görünürlüğü burada izlersiniz.",
      en: "Monitor critical internal metrics, operations distribution, and system-wide visibility here."
    },
    highlights: [
      {
        tr: "İç yönetim özeti",
        en: "Internal admin summary"
      },
      {
        tr: "Sistem çapı dağılım kartları",
        en: "System-wide distribution cards"
      },
      {
        tr: "Kritik alanlara hızlı yönlendirme",
        en: "Quick links into critical areas"
      }
    ]
  },
  adminLeads: {
    title: {
      tr: "Leadler",
      en: "Leads"
    },
    summary: {
      tr: "Gelen lead kayıtlarını durumlarına göre takip eder ve satış ya da operasyon akışına hazırlarsınız.",
      en: "Track inbound leads by status and prepare them for sales or operations follow-up."
    },
    highlights: [
      {
        tr: "Lead listesi ve filtreleme",
        en: "Lead listing and filtering"
      },
      {
        tr: "Durum bazlı önceliklendirme",
        en: "Status-based prioritization"
      },
      {
        tr: "Takip aksiyonlarına hazırlık",
        en: "Preparation for follow-up actions"
      }
    ]
  },
  adminSettings: {
    title: {
      tr: "Sistem Ayarları",
      en: "System Settings"
    },
    summary: {
      tr: "Sistem düzeyi politika, plan ve operasyon parametrelerini kurum genelinde buradan yönetirsiniz.",
      en: "Manage system-level policies, plan rules, and operational parameters across the organization from here."
    },
    highlights: [
      {
        tr: "Politika ve limit ayarları",
        en: "Policy and limit settings"
      },
      {
        tr: "Operasyon parametreleri",
        en: "Operational parameters"
      },
      {
        tr: "Kurum genelinde yapılandırma kontrolü",
        en: "Organization-wide configuration control"
      }
    ]
  },
  adminUsers: {
    title: {
      tr: "Kullanıcılar",
      en: "Users"
    },
    summary: {
      tr: "Şirket hesabı ve kullanıcı dağılımını izler, plan segmentlerine göre erişim ve kullanım görünürlüğü elde edersiniz.",
      en: "Monitor company account and user distribution and gain access and usage visibility by plan segment."
    },
    highlights: [
      {
        tr: "Şirket hesabı ve kullanıcı segmentasyonu",
        en: "Company account and user segmentation"
      },
      {
        tr: "Plan bazlı dağılım görünürlüğü",
        en: "Plan-based distribution visibility"
      },
      {
        tr: "Detay sayfalarına geçiş",
        en: "Navigation into detail pages"
      }
    ]
  },
  tenantDetail: {
    title: {
      tr: "Müşteri Hesabı Detayı",
      en: "Customer Account Detail"
    },
    summary: {
      tr: "Tek bir müşterinin hesap, plan, kota ve ödeme operasyonlarını detay seviyesinde yönetirsiniz.",
      en: "Manage a single customer’s account, plan, quota, and payment operations in detail."
    },
    highlights: [
      {
        tr: "Hesap ve fatura görünürlüğü",
        en: "Account and billing visibility"
      },
      {
        tr: "Kota ve plan kontrolü",
        en: "Quota and plan control"
      },
      {
        tr: "Yönetim aksiyonları",
        en: "Administrative actions"
      }
    ]
  },
  adminEnterprise: {
    title: {
      tr: "Kurumsal",
      en: "Enterprise"
    },
    summary: {
      tr: "Kurumsal satış teklifleri, checkout linkleri ve enterprise paket akışlarını buradan hazırlarsınız.",
      en: "Prepare enterprise sales offers, checkout links, and enterprise package flows from here."
    },
    highlights: [
      {
        tr: "Enterprise teklif hazırlığı",
        en: "Enterprise offer preparation"
      },
      {
        tr: "Özel checkout akışları",
        en: "Custom checkout flows"
      },
      {
        tr: "Kurumsal paket yönetimi",
        en: "Enterprise package management"
      }
    ]
  },
  adminRedAlert: {
    title: {
      tr: "Kırmızı Alarm",
      en: "Red Alert"
    },
    summary: {
      tr: "Kritik risk, hata ve anomali sinyallerini önceliklendirip hızlı müdahale için takip edersiniz.",
      en: "Prioritize critical risks, errors, and anomaly signals and track them for fast response."
    },
    highlights: [
      {
        tr: "Kritik olay görünürlüğü",
        en: "Critical event visibility"
      },
      {
        tr: "Risk ve şiddet filtreleri",
        en: "Risk and severity filters"
      },
      {
        tr: "Hızlı müdahale odağı",
        en: "Fast-response focus"
      }
    ]
  },
  auditLogs: {
    title: {
      tr: "Denetim Kayıtları",
      en: "Audit Logs"
    },
    summary: {
      tr: "İşe alım ekibi ve AI aksiyonlarının izini sürer, hangi işlem ne zaman yapılmış bunu doğrularsınız.",
      en: "Trace recruiter and AI actions and verify what happened and when."
    },
    highlights: [
      {
        tr: "İşlem geçmişi görünürlüğü",
        en: "Action history visibility"
      },
      {
        tr: "Filtrelenebilir denetim izi",
        en: "Filterable audit trail"
      },
      {
        tr: "Kararların doğrulanabilirliği",
        en: "Decision traceability"
      }
    ]
  },
  aiSupport: {
    title: {
      tr: "AI Destek Merkezi",
      en: "AI Support Center"
    },
    summary: {
      tr: "AI destek akışının sağlık durumunu, son görevleri ve yedek akış davranışlarını kontrol edersiniz.",
      en: "Check the health of the AI support flow, recent tasks, and fallback behavior."
    },
    highlights: [
      {
        tr: "AI akışı sağlık görünümü",
        en: "AI flow health view"
      },
      {
        tr: "Son görev ve durum kontrolü",
        en: "Recent tasks and status control"
      },
      {
        tr: "Yedek akış görünürlüğü",
        en: "Fallback visibility"
      }
    ]
  }
};

export function getPanelGuideEntry(key: PanelGuideKey) {
  return PANEL_GUIDES[key];
}

export function getLocalizedGuideText(text: LocalizedText, locale: string) {
  return locale === "en" ? text.en : text.tr;
}

export function getLocalizedGuideItems(items: LocalizedText[], locale: string) {
  return items.map((item) => getLocalizedGuideText(item, locale));
}

const PANEL_GUIDE_STEPS: Record<PanelGuideKey, LocalizedText[]> = {
  dashboard: [
    {
      tr: "Önce karar bekleyen başvuruları, geri bildirim bekleyen mülakatları ve aktif oturumları kontrol edin.",
      en: "Start with applications awaiting decisions, interviews waiting for feedback, and active sessions."
    },
    {
      tr: "Üstteki sinyal kartlarından öncelikli işi seçip ilgili kuyruğa geçin.",
      en: "Use the signal cards at the top to jump into the highest-priority queue."
    },
    {
      tr: "Aday veya mülakat detayına girip bekleyen operasyonu ilerletin.",
      en: "Open the candidate or interview detail and move the pending operation forward."
    }
  ],
  jobs: [
    {
      tr: "Aktif, taslak ve arşiv ilan dağılımını ilk satırdan gözden geçirin.",
      en: "Review the distribution of active, draft, and archived jobs from the first row."
    },
    {
      tr: "Durum filtresiyle doğru ilan grubunu daraltın ve ilgili ilanı açın.",
      en: "Narrow the right job group with the status filter and open the relevant listing."
    },
    {
      tr: "İlan detayından aday, başvuru ve mülakat akışına devam edin.",
      en: "Continue into candidate, application, and interview flows from the job detail."
    }
  ],
  jobCreate: [
    {
      tr: "Pozisyon, ekip ve temel gereksinim bilgilerini eksiksiz girin.",
      en: "Fill in the role, team, and core requirement fields completely."
    },
    {
      tr: "AI taslağını üretip metni yayın öncesi gözden geçirin.",
      en: "Generate the AI draft and review the text before publishing."
    },
    {
      tr: "Yayın ayarlarını doğrulayıp ilanı kaydedin veya taslak bırakın.",
      en: "Confirm publishing settings and save the listing or keep it as a draft."
    }
  ],
  jobDetail: [
    {
      tr: "İlan durumunu, aday hacmini ve üstteki temel rol bilgilerini kontrol edin.",
      en: "Check the job status, candidate volume, and the key role details at the top."
    },
    {
      tr: "Aşama görünümünden hangi aday grubunun aksiyon beklediğini belirleyin.",
      en: "Use the stage view to identify which candidate group is waiting for action."
    },
    {
      tr: "İlgili aday ya da başvuru kaydına girerek mülakat ve karar sürecini yönetin.",
      en: "Open the relevant candidate or application record to manage interviews and decisions."
    }
  ],
  applications: [
    {
      tr: "Üst kartlardan hangi aşamada yoğunluk olduğunu hızlıca görün.",
      en: "Use the top cards to quickly see which stage has the current workload."
    },
    {
      tr: "Filtreler ve arama ile iş kuyruğunu daraltıp doğru başvuruyu bulun.",
      en: "Use filters and search to narrow the work queue and find the right application."
    },
    {
      tr: "Başvuru detayına geçip işe alım kararını veya sonraki adımı uygulayın.",
      en: "Open the application detail and apply the recruiter decision or next step."
    }
  ],
  applicationDetail: [
    {
      tr: "Aday özeti, mevcut aşama ve AI çıktısını birlikte okuyarak başlayın.",
      en: "Start by reviewing the candidate summary, current stage, and AI output together."
    },
    {
      tr: "Rapor, mülakat ve kanıt alanlarını karar vermeden önce karşılaştırın.",
      en: "Compare the report, interview, and evidence sections before making a decision."
    },
    {
      tr: "Bu ekran üzerinden aşama değiştirin, beklemeye alın ya da süreci ilerletin.",
      en: "Change stage, place the record on hold, or move the process forward from this screen."
    }
  ],
  interviews: [
    {
      tr: "Planlanan, devam eden ve sorunlu oturumları üst durum kartlarından ayırın.",
      en: "Separate scheduled, running, and problematic sessions using the status cards at the top."
    },
    {
      tr: "Sekmelerle doğru oturum kümesini filtreleyip ilgili görüşmeyi seçin.",
      en: "Filter the right session set with tabs and select the relevant interview."
    },
    {
      tr: "Adayı takip etmek veya sorunu çözmek için ilişkili kayda geçin.",
      en: "Move into the related record to follow up with the candidate or resolve the issue."
    }
  ],
  candidates: [
    {
      tr: "Arama ve filtrelerle aday havuzunda doğru kişiyi bulun.",
      en: "Use search and filters to find the right person in the talent pool."
    },
    {
      tr: "Satırlardaki başvuru bağlarını okuyarak adayın aktif süreçlerini anlayın.",
      en: "Read the linked applications in each row to understand the candidate’s active processes."
    },
    {
      tr: "Aday detayına girin veya eksik kişi için yeni kayıt açın.",
      en: "Open the candidate detail or create a new record for a missing person."
    }
  ],
  candidateCreate: [
    {
      tr: "Temel kimlik ve iletişim alanlarını eksiksiz doldurun.",
      en: "Complete the core identity and contact fields."
    },
    {
      tr: "CV ve kaynak bilgisini ekleyip yinelenen kayıt uyarılarını kontrol edin.",
      en: "Add the CV and source information, then check duplicate warnings."
    },
    {
      tr: "Kaydı oluşturup gerekiyorsa başvuru akışına bağlayın.",
      en: "Create the record and link it into the application flow if needed."
    }
  ],
  candidateDetail: [
    {
      tr: "Adayın kaynak, iletişim ve kayıt özetini üst bölümden doğrulayın.",
      en: "Confirm the candidate’s source, contact details, and record summary from the top section."
    },
    {
      tr: "Bağlı başvurular, CV verisi ve geçmiş hareketleri birlikte inceleyin.",
      en: "Review linked applications, CV data, and historical activity together."
    },
    {
      tr: "Gerekli aksiyon için ilgili başvuru veya mülakat ekranına geçin.",
      en: "Move into the relevant application or interview screen for the next action."
    }
  ],
  reports: [
    {
      tr: "Önce yönetici özeti ve AI katkısı bloklarıyla genel resmi okuyun.",
      en: "Start with the executive summary and AI impact blocks to understand the overall picture."
    },
    {
      tr: "Operasyon, dönüşüm ve süreç hızı panellerini birlikte yorumlayın.",
      en: "Interpret the operations, conversion, and process speed panels together."
    },
    {
      tr: "Bu ekranı İK operasyonu ve üst yönetim raporlaması için ortak görünüm olarak kullanın.",
      en: "Use this screen as a shared view for HR operations and leadership reporting."
    }
  ],
  sourcing: [
    {
      tr: "Aktif sourcing projelerini ve hangi requisition'a bağlı olduklarını kontrol edin.",
      en: "Review active sourcing projects and the requisitions they are linked to."
    },
    {
      tr: "İlgili projeyi açıp aday keşfi, kısa liste ve ilk iletişim durumunu inceleyin.",
      en: "Open the relevant project and inspect discovery, shortlist, and outreach status."
    },
    {
      tr: "Yeni rol için pipeline gerekiyorsa buradan yeni proje başlatın.",
      en: "Start a new project here when a role still needs pipeline creation."
    }
  ],
  sourcingProject: [
    {
      tr: "Bağlı requisition ve hedef profil özetini üst bölümde doğrulayın.",
      en: "Confirm the linked requisition and target profile summary at the top."
    },
    {
      tr: "Bulunan adayları, kısa liste kalitesini ve ilk iletişim hazırlığını gözden geçirin.",
      en: "Review discovered talent, shortlist quality, and outreach plan."
    },
    {
      tr: "Seçilen adayları işe alım akışına taşıyın veya proje aksiyonlarını güncelleyin.",
      en: "Move selected talent into the hiring flow or update the project actions."
    }
  ],
  team: [
    {
      tr: "Önce koltuk kapasitesini ve bekleyen davetleri kontrol edin.",
      en: "Check seat capacity and pending invites first."
    },
    {
      tr: "Yeni üyeyi davet edin veya mevcut kullanıcının rol ve durumunu güncelleyin.",
      en: "Invite a new teammate or update an existing user's role and status."
    },
    {
      tr: "Yaptığınız değişikliğin listede doğru yansıdığını hemen doğrulayın.",
      en: "Confirm that your change is reflected correctly in the list right away."
    }
  ],
  settings: [
    {
      tr: "Önce şirket profilini güncelleyin; yeni taslaklarda kullanılacak ana bilgiler burada durur.",
      en: "Update the company profile first; the main details used in new drafts live here."
    },
    {
      tr: "Ardından güvenlik alanında parola ve doğrulama durumunu gözden geçirin.",
      en: "Then review password and verification status in the security section."
    },
    {
      tr: "Tehlikeli aksiyonlara yalnızca gerçekten gerekli olduğunda ilerleyin.",
      en: "Only proceed with dangerous actions when they are truly necessary."
    }
  ],
  subscription: [
    {
      tr: "Mevcut planı, yaşam döngüsü durumunu ve kullanım limitlerini birlikte okuyun.",
      en: "Read the current plan, lifecycle state, and usage limits together."
    },
    {
      tr: "Paketleri veya kotaları karşılaştırıp doğru yükseltme kararını verin.",
      en: "Compare packages or quotas and decide on the right upgrade path."
    },
    {
      tr: "Gerekirse ödeme akışına geçin veya satış ekibiyle devam edin.",
      en: "Proceed to checkout or continue with sales when needed."
    }
  ],
  adminDashboard: [
    {
      tr: "Önce müşteri, alarm ve lead özet bloklarını tarayın.",
      en: "Start by scanning the customer, alert, and lead summary blocks."
    },
    {
      tr: "İlgili iç operasyon alanına bölüm kartlarından geçin.",
      en: "Enter the relevant internal operations area from the section cards."
    },
    {
      tr: "Risk veya gelir etkisi yüksek alanları önce önceliklendirin.",
      en: "Prioritize the areas with the highest operational or revenue risk first."
    }
  ],
  adminLeads: [
    {
      tr: "Yeni ve işlemdeki potansiyel müşteri kayıtlarını listeden ayırın.",
      en: "Separate new and in-progress public lead records from the list."
    },
    {
      tr: "Durum filtresi ve arama ile takip edeceğiniz lead setini daraltın.",
      en: "Use status filters and search to narrow the lead set you will follow up on."
    },
    {
      tr: "Lead durumunu güncelleyip satış veya onboarding hattına yönlendirin.",
      en: "Update the lead status and route it into sales or onboarding."
    }
  ],
  adminSettings: [
    {
      tr: "AI kuralları, sağlayıcı durumu ve altyapı uyarılarını birlikte kontrol edin.",
      en: "Check AI rules, provider health, and infrastructure warnings together."
    },
    {
      tr: "Yalnızca yönettiğiniz olay veya akışla ilgili kontrolü değiştirin.",
      en: "Change only the control related to the incident or workflow you are managing."
    },
    {
      tr: "Yenileyip sistem durumunun beklediğiniz gibi güncellendiğini doğrulayın.",
      en: "Refresh and confirm that the system state updated as expected."
    }
  ],
  adminUsers: [
    {
      tr: "Plan ve segment dağılımını üst kartlardan okuyun.",
      en: "Read the plan and segment distribution from the top cards."
    },
    {
      tr: "Arama ve filtrelerle doğru müşteri grubunu daraltın.",
      en: "Narrow the right customer group with search and filters."
    },
    {
      tr: "Hesap detayına geçip plan, kota veya erişim yönetimini yapın.",
      en: "Open the account detail to manage plan, quota, or access."
    }
  ],
  tenantDetail: [
    {
      tr: "Üstteki durum rozetlerinden şirket hesabı ve abonelik durumunu doğrulayın.",
      en: "Confirm the company account and billing state from the status badges at the top."
    },
    {
      tr: "Kullanım, sahip erişimi ve son hareketleri birlikte değerlendirin.",
      en: "Review usage, owner access, and recent activity together."
    },
    {
      tr: "Gerekliyse plan, kota veya şirket hesabı aksiyonunu bu ekrandan uygulayın.",
      en: "Apply the required plan, quota, or company account action from this screen."
    }
  ],
  adminEnterprise: [
    {
      tr: "Kurumsal müşteri listesi, teklif durumu ve ödeme hazırlığını kontrol edin.",
      en: "Review the enterprise customer list, offer status, and payment status."
    },
    {
      tr: "Doğru hesabı açıp sözleşme veya teklif detaylarını inceleyin.",
      en: "Open the right account and inspect its contract or offer details."
    },
    {
      tr: "Gerekirse ödeme linki üretin veya ticari kaydı güncelleyin.",
      en: "Generate a payment link or update the commercial record when needed."
    }
  ],
  adminRedAlert: [
    {
      tr: "Önce önem ve kategori filtreleriyle doğru alarm kümesini ayırın.",
      en: "Start by isolating the right alert set with severity and category filters."
    },
    {
      tr: "Tekrar sayısı, kaynak ve mesaj bağlamıyla alarmı okuyun.",
      en: "Read the alert together with its repeat count, source, and message context."
    },
    {
      tr: "İlgili ekip veya akışa geçip çözüm adımını başlatın.",
      en: "Move into the relevant team or flow and start the resolution step."
    }
  ],
  auditLogs: [
    {
      tr: "Kişi, olay veya varlık bazlı filtrelerle kayıt kümesini daraltın.",
      en: "Narrow the log set with actor, event, or entity-based filters."
    },
    {
      tr: "Zaman çizgisini kullanarak neyin ne zaman olduğunu doğrulayın.",
      en: "Use the timeline to verify what happened and when."
    },
    {
      tr: "Kritik işe alım ekibi veya AI aksiyonlarını inceleme sırasında çapraz kontrol edin.",
      en: "Cross-check critical recruiter or AI actions during investigations."
    }
  ],
  aiSupport: [
    {
      tr: "Sağlayıcı durumu, görev sağlığı ve yedek akış görünümünü üstten kontrol edin.",
      en: "Check provider status, task health, and fallback visibility from the top."
    },
    {
      tr: "Son görev kayıtlarını ve uyarıları inceleyip problem noktasını bulun.",
      en: "Inspect recent task runs and warnings to find the failure point."
    },
    {
      tr: "Gerekirse ilgili AI destek akışını yeniden deneyin, açın veya üst ekibe taşıyın.",
      en: "Retry, re-enable, or escalate the affected AI support flow when needed."
    }
  ]
};

export function getLocalizedGuideSteps(key: PanelGuideKey, locale: string) {
  return getLocalizedGuideItems(PANEL_GUIDE_STEPS[key], locale);
}
