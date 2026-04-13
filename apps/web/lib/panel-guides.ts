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
      tr: "Manuel aday kaydı açar, duplicate kontrolüyle havuza yeni aday eklersiniz.",
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
      tr: "Yeni talent discovery projeleri açar, rediscovery ve outreach hazırlığını aynı akışta yönetirsiniz.",
      en: "Open new talent discovery projects and manage rediscovery and outreach preparation in the same flow."
    },
    highlights: [
      {
        tr: "Talent discovery projeleri",
        en: "Talent discovery projects"
      },
      {
        tr: "Rediscovery ve outreach temeli",
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
      tr: "Seçili sourcing projesinde önerilen adayları, rediscovery sonuçlarını ve outreach hazırlığını yönetirsiniz.",
      en: "Manage recommended candidates, rediscovery results, and outreach preparation inside the selected sourcing project."
    },
    highlights: [
      {
        tr: "Proje bazlı talent discovery",
        en: "Project-based talent discovery"
      },
      {
        tr: "Rediscovery ve shortlist akışı",
        en: "Rediscovery and shortlist flow"
      },
      {
        tr: "Outreach hazırlık görünümü",
        en: "Outreach preparation view"
      }
    ]
  },
  settings: {
    title: {
      tr: "Ekip ve Erişim",
      en: "Team and Access"
    },
    summary: {
      tr: "Ekip erişimi, rol yönetimi ve çalışma alanı temel ayarlarını buradan kontrol edersiniz.",
      en: "Control team access, role management, and core workspace settings from here."
    },
    highlights: [
      {
        tr: "Kullanıcı ve rol yönetimi",
        en: "User and role management"
      },
      {
        tr: "Davet ve doğrulama akışları",
        en: "Invitation and verification flows"
      },
      {
        tr: "Çalışma alanı erişim kontrolü",
        en: "Workspace access control"
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
      tr: "Tenant ve kullanıcı dağılımını izler, plan segmentlerine göre erişim ve kullanım görünürlüğü elde edersiniz.",
      en: "Monitor tenant and user distribution and gain access and usage visibility by plan segment."
    },
    highlights: [
      {
        tr: "Tenant ve kullanıcı segmentasyonu",
        en: "Tenant and user segmentation"
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
      tr: "Recruiter ve AI aksiyonlarının izini sürer, hangi işlem ne zaman yapılmış bunu doğrularsınız.",
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
      tr: "AI destek akışının sağlık durumunu, son görevleri ve fallback davranışlarını kontrol edersiniz.",
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
        tr: "Fallback görünürlüğü",
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
