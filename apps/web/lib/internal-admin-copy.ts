import type { SiteLocale } from "./i18n";

export function getInternalAdminCopy(locale: SiteLocale) {
  if (locale === "en") {
    return {
      dashboardTitle: "Admin Panel",
      dashboardSubtitle: "Monitor platform health, customer segments, and commercial lifecycle from one internal view.",
      redAlertTitle: "Red Alert",
      redAlertSubtitle:
        "Track security signals, application failures, assistant quality, and operational issues in one place.",
      usersTitle: "Users",
      usersSubtitle: "Manage customer workspaces, owner accounts, plans, and usage from a single list.",
      leadsTitle: "Lead Inbox",
      leadsSubtitle: "Review public contact submissions, update their status, and keep pilot onboarding visible.",
      enterpriseTitle: "Enterprise",
      enterpriseSubtitle: "Create custom enterprise customers, prepare tailored offers, and monitor contract accounts.",
      accountDetailTitle: "Customer Details",
      accountDetailSubtitle: "Review billing, usage, and owner access for the selected workspace.",
      refresh: "Refresh",
      retry: "Retry",
      noData: "No data found.",
      loading: "Loading...",
      totalCustomers: "Total Customers",
      activeCustomers: "Active Customers",
      suspendedCustomers: "Suspended Customers",
      todayCandidateProcessing: "Candidate Processing Today",
      todayAiInterviews: "AI Interviews Today",
      openAlerts: "Open Alerts",
      openLeadInbox: "Open Lead Inbox",
      enterpriseCustomers: "Enterprise Customers",
      trialAccounts: "Trial Accounts",
      trialActive: "Active Trial",
      trialExpired: "Expired Trial",
      billingRisk: "Billing Risk",
      segment: "Segment",
      allSegments: "All Segments",
      segmentTrial: "Trial",
      segmentTrialActive: "Active Trial",
      segmentTrialExpired: "Expired Trial",
      segmentBillingRisk: "Billing Risk",
      trialLifecycle: "Trial Lifecycle",
      trialStatus: "Trial Status",
      trialStartedAt: "Trial Started",
      trialEndsAt: "Trial Ends",
      daysRemaining: "Days Remaining",
      customerName: "Person Name",
      startDate: "Start Date",
      endDate: "End Date",
      customerListTitle: "Customer List",
      planSegments: "Plan & Trial Segments",
      planDistribution: "Plan Distribution",
      customers: "Users",
      redAlerts: "Red Alert",
      leads: "Leads",
      enterprise: "Enterprise",
      searchPlaceholder: "Search by customer, owner, or email...",
      searchUsersPlaceholder: "Search by person, company, or email...",
      searchLeadsPlaceholder: "Search by name, company, email, or message...",
      searchEnterprisePlaceholder: "Search enterprise customer...",
      all: "All",
      allPlans: "All Plans",
      allStatuses: "All Statuses",
      allWorkspaceStatuses: "All Workspace Statuses",
      allCategories: "All Categories",
      allSeverities: "All Severities",
      lastSeen: "Last Seen",
      customer: "Customer",
      category: "Category",
      severity: "Severity",
      source: "Source",
      message: "Message",
      repeats: "Repeats",
      status: "Status",
      action: "Action",
      details: "Details",
      overview: "Overview",
      owner: "Owner",
      billing: "Billing",
      usage: "Usage",
      jobs: "Jobs",
      candidates: "Candidates",
      applications: "Applications",
      interviews: "Interviews",
      nextInvoice: "Next Invoice",
      currentPlan: "Current Plan",
      billingEmail: "Billing Email",
      workspaceStatus: "Workspace Status",
      ownerAccess: "Owner Access",
      members: "Team Members",
      recentNotifications: "Recent Notifications",
      recentCheckouts: "Recent Payment Links",
      recentJobs: "Recent Jobs",
      updatePlan: "Update Plan",
      planKey: "Plan",
      monthlyAmount: "Monthly Amount (USD cents)",
      seatsIncluded: "Included Seats",
      activeJobsIncluded: "Included Active Jobs",
      candidateProcessingIncluded: "Included Candidate Processing",
      aiInterviewsIncluded: "Included AI Interviews",
      savePlan: "Save Plan",
      grantUsage: "Add Manual Quota",
      grantLabel: "Grant Label",
      addQuota: "Add Quota",
      suspendWorkspace: "Suspend Workspace",
      activateWorkspace: "Activate Workspace",
      deleteWorkspace: "Mark as Deleted",
      sendResetLink: "Send Owner Reset Link",
      createEnterpriseCustomer: "Create Enterprise Customer",
      companyName: "Company Name",
      ownerFullName: "Owner Full Name",
      ownerEmail: "Owner Email",
      note: "Note",
      openCheckout: "Open Payment Link",
      paymentLinkSent: "Payment link sent.",
      stripeNotReady: "Stripe is not ready. The customer was created, but no payment link was generated.",
      internalOnly: "This area is restricted to the internal admin team.",
      contactSales: "Contact Sales",
      noAlerts: "No alerts found for the selected filters.",
      noLeads: "No lead found for the current filters.",
      noCustomers: "No customer matched the current filters.",
      noEnterprise: "No enterprise customer found yet.",
      created: "Created",
      emailDelivery: "Email Delivery",
      pending: "Pending",
      active: "Active",
      inactive: "Inactive",
      sent: "Sent",
      failed: "Failed",
      suspended: "Suspended",
      deleted: "Deleted",
      createdAt: "Created At",
      createdOn: "Created On",
      workspace: "Customer",
      workspaceOwner: "Account Owner",
      ownerStatus: "Owner Status",
      lastLogin: "Last Login",
      plan: "Plan",
      basePlan: "Base Plan",
      usageSummary: "Usage Summary",
      candidateCount: "Candidates",
      applicationCount: "Applications",
      interviewCount: "Interviews",
      teamMembers: "Team Members",
      recentActivity: "Recent Activity",
      viewDetails: "View Details",
      backToUsers: "Back to Users",
      statusActions: "Status Actions",
      accountSettings: "Account Settings",
      planSettings: "Plan Settings",
      quotaGrants: "Manual Quota Grants",
      saveChanges: "Save Changes",
      saving: "Saving...",
      create: "Create",
      creating: "Creating...",
      processing: "Processing...",
      suspendWorkspaceConfirm: "Suspend Workspace",
      activateWorkspaceConfirm: "Activate Workspace",
      deleteWorkspaceConfirm: "Mark as Deleted",
      ownerResetInfo: "Sends a fresh invitation link to the workspace owner and revokes existing sessions.",
      noOwner: "No owner user found.",
      noRecentJobs: "No recent job found.",
      noRecentNotifications: "No recent notification found.",
      noRecentCheckouts: "No recent payment link found.",
      openCheckoutLink: "Open Payment Link",
      quotaLabelSeats: "Seats",
      quotaLabelActiveJobs: "Active Jobs",
      quotaLabelCandidateProcessing: "Candidate Processing",
      quotaLabelAiInterviews: "AI Interviews",
      grantSeats: "Add Seats",
      grantActiveJobs: "Add Active Jobs",
      grantCandidateProcessing: "Add Candidate Processing",
      grantAiInterviews: "Add AI Interviews",
      planSaved: "Plan updated.",
      quotaSaved: "Manual quota added.",
      workspaceStatusSaved: "Workspace status updated.",
      ownerResetSent: "Owner reset link sent.",
      enterpriseCreated: "Enterprise customer created.",
      createEnterpriseLead: "Create Enterprise Customer",
      enterpriseListTitle: "Enterprise Accounts",
      enterpriseListSubtitle: "Manage contract customers, custom offers, and payment links.",
      enterpriseSummaryTotal: "Total Enterprise",
      enterpriseSummaryActive: "Active Contracts",
      enterpriseSummaryPending: "Pending Offers",
      enterpriseSummarySuspended: "Suspended",
      filterByStatus: "Filter by Status",
      filterByPlan: "Filter by Plan",
      tenantStatus: "Workspace Status",
      billingStatus: "Billing Status",
      actions: "Actions",
      recentPaymentLinks: "Recent Payment Links",
      openCustomer: "Open Customer",
      generatedLink: "Generated Link",
      generatedLinkDescription: "A payment link is ready for this custom offer.",
      stripeDisabled: "Stripe is not configured. The customer record was created without a payment link.",
      leadStatusSaved: "Lead status updated.",
      search: "Search",
      accountUsage: "Account Usage",
      featureSet: "Feature Set",
      advancedReporting: "Advanced Reporting",
      calendarIntegrations: "Calendar Integrations",
      brandedCandidateExperience: "Branded Candidate Experience",
      customIntegrations: "Custom Integrations",
      billingAmountHint: "Enter monthly amount in USD cents for custom offers.",
      planHintStarterGrowth: "Starter and Growth use catalog defaults unless you override the quota values below.",
      openCustomerWorkspace: "Open Customer Workspace",
      linkSent: "Link Sent",
      notSent: "Not Sent"
    };
  }

  return {
    dashboardTitle: "Yönetici Paneli",
    dashboardSubtitle: "Platform sağlığını, müşteri segmentlerini ve ticari yaşam döngüsünü tek iç görünümden izleyin.",
    redAlertTitle: "Kırmızı Alarm",
    redAlertSubtitle:
      "Güvenlik sinyallerini, uygulama hatalarını, asistan kalitesini ve operasyon olaylarını tek yerde izleyin.",
    usersTitle: "Kullanıcılar",
    usersSubtitle: "Müşteri çalışma alanlarını, hesap sahiplerini, planları ve kullanımı tek listeden yönetin.",
    leadsTitle: "Lead Inbox",
    leadsSubtitle: "Public contact kayıtlarını görün, durumlarını güncelleyin ve pilot onboarding hattını görünür tutun.",
    enterpriseTitle: "Kurumsal",
    enterpriseSubtitle: "Özel kurumsal müşteri oluşturun, teklif hazırlayın ve sözleşmeli hesapları yönetin.",
    accountDetailTitle: "Müşteri Detayı",
    accountDetailSubtitle: "Seçili çalışma alanının abonelik, kullanım ve sahip erişimini yönetin.",
    refresh: "Yenile",
    retry: "Tekrar dene",
    noData: "Veri bulunamadı.",
    loading: "Yükleniyor...",
    totalCustomers: "Toplam Müşteri",
    activeCustomers: "Aktif Müşteri",
    suspendedCustomers: "Askıya Alınan",
    todayCandidateProcessing: "Bugün Aday İşleme",
    todayAiInterviews: "Bugün AI Mülakat",
    openAlerts: "Açık Alarm",
    openLeadInbox: "Açık Lead Inbox",
    enterpriseCustomers: "Kurumsal Müşteri",
    trialAccounts: "Deneme Hesapları",
    trialActive: "Aktif Deneme",
    trialExpired: "Denemesi Biten",
    billingRisk: "Abonelik Riski",
    segment: "Segment",
    allSegments: "Tüm Segmentler",
      segmentTrial: "Deneme",
    segmentTrialActive: "Aktif Deneme",
    segmentTrialExpired: "Denemesi Biten",
    segmentBillingRisk: "Abonelik Riski",
    trialLifecycle: "Deneme Yaşam Döngüsü",
    trialStatus: "Deneme Durumu",
    trialStartedAt: "Deneme Başlangıcı",
    trialEndsAt: "Deneme Bitişi",
    daysRemaining: "Kalan Gün",
    customerName: "Kişi Adı",
    startDate: "Başlangıç Tarihi",
    endDate: "Bitiş Tarihi",
    customerListTitle: "Müşteri Listesi",
    planSegments: "Plan ve Deneme Segmentleri",
    planDistribution: "Plan Dağılımı",
    customers: "Kullanıcılar",
    redAlerts: "Kırmızı Alarm",
    leads: "Leadler",
    enterprise: "Kurumsal",
    searchPlaceholder: "Müşteri, hesap sahibi veya e-posta ara...",
    searchUsersPlaceholder: "Kişi adı, şirket adı veya e-posta ile ara...",
    searchLeadsPlaceholder: "İsim, şirket, e-posta veya mesaj ara...",
    searchEnterprisePlaceholder: "Kurumsal müşteri ara...",
    all: "Tümü",
    allPlans: "Tüm Planlar",
    allStatuses: "Tüm Durumlar",
    allWorkspaceStatuses: "Tüm Çalışma Alanları",
    allCategories: "Tüm Kategoriler",
    allSeverities: "Tüm Önem Düzeyleri",
    lastSeen: "Son Görülme",
    customer: "Müşteri",
    category: "Kategori",
    severity: "Önem",
    source: "Kaynak",
    message: "Mesaj",
    repeats: "Tekrar",
    status: "Durum",
    action: "İşlem",
    details: "Detay",
    overview: "Genel Görünüm",
    owner: "Hesap Sahibi",
    billing: "Abonelik",
    usage: "Kullanım",
    jobs: "İlan",
    candidates: "Aday",
    applications: "Başvuru",
    interviews: "Mülakat",
    nextInvoice: "Sonraki Fatura",
    currentPlan: "Mevcut Plan",
    billingEmail: "Fatura E-postası",
    workspaceStatus: "Çalışma Alanı Durumu",
    ownerAccess: "Sahip Erişimi",
    members: "Ekip Üyeleri",
    recentNotifications: "Son Bildirimler",
    recentCheckouts: "Son Ödeme Linkleri",
    recentJobs: "Son İlanlar",
    updatePlan: "Planı Güncelle",
    planKey: "Plan",
    monthlyAmount: "Aylık Tutar (USD cent)",
    seatsIncluded: "Dahil Kullanıcı",
    activeJobsIncluded: "Dahil Aktif İlan",
    candidateProcessingIncluded: "Dahil Aday İşleme",
    aiInterviewsIncluded: "Dahil AI Mülakat",
    savePlan: "Planı Kaydet",
    grantUsage: "Manuel Kota Ekle",
    grantLabel: "Artış Etiketi",
    addQuota: "Kotayı Ekle",
    suspendWorkspace: "Çalışma Alanını Askıya Al",
    activateWorkspace: "Çalışma Alanını Aktifleştir",
    deleteWorkspace: "Silinmiş Olarak İşaretle",
    sendResetLink: "Sahibe Şifre Linki Gönder",
    createEnterpriseCustomer: "Kurumsal Müşteri Oluştur",
    companyName: "Şirket Adı",
    ownerFullName: "Sahip Ad Soyad",
    ownerEmail: "Sahip E-postası",
    note: "Not",
    openCheckout: "Ödeme Linkini Aç",
    paymentLinkSent: "Ödeme linki gönderildi.",
    stripeNotReady: "Stripe hazır değil. Müşteri oluşturuldu ancak ödeme linki üretilmedi.",
    internalOnly: "Bu alan yalnızca iç yönetim ekibine açıktır.",
    contactSales: "Satış Ekibi",
    noAlerts: "Seçili filtreler için alarm bulunamadı.",
    noLeads: "Mevcut filtrelere uyan lead bulunamadı.",
    noCustomers: "Mevcut filtrelere uyan müşteri bulunamadı.",
    noEnterprise: "Henüz kurumsal müşteri bulunmuyor.",
    created: "Oluşturuldu",
    emailDelivery: "E-posta Teslimatı",
    pending: "Bekliyor",
    active: "Aktif",
    inactive: "Pasif",
    sent: "Gönderildi",
    failed: "Başarısız",
    suspended: "Askıda",
    deleted: "Silinmiş",
    createdAt: "Oluşturulma",
    createdOn: "Oluşturuldu",
    workspace: "Müşteri",
    workspaceOwner: "Hesap Sahibi",
    ownerStatus: "Sahip Durumu",
    lastLogin: "Son Giriş",
    plan: "Plan",
    basePlan: "Temel Plan",
    usageSummary: "Kullanım Özeti",
    candidateCount: "Aday",
    applicationCount: "Başvuru",
    interviewCount: "Mülakat",
    teamMembers: "Ekip Üyeleri",
    recentActivity: "Son Hareketler",
    viewDetails: "Detayı Aç",
    backToUsers: "Kullanıcılara Dön",
    statusActions: "Durum İşlemleri",
    accountSettings: "Hesap Ayarları",
    planSettings: "Plan Ayarları",
    quotaGrants: "Manuel Kota Ekleri",
    saveChanges: "Değişiklikleri Kaydet",
    saving: "Kaydediliyor...",
    create: "Oluştur",
    creating: "Oluşturuluyor...",
    processing: "İşleniyor...",
    suspendWorkspaceConfirm: "Çalışma Alanını Askıya Al",
    activateWorkspaceConfirm: "Çalışma Alanını Aktifleştir",
    deleteWorkspaceConfirm: "Silinmiş Olarak İşaretle",
    ownerResetInfo: "Çalışma alanı sahibine yeni bir davet linki gönderir ve mevcut oturumları kapatır.",
    noOwner: "Sahip kullanıcı bulunamadı.",
    noRecentJobs: "Son ilan bulunmuyor.",
    noRecentNotifications: "Son bildirim bulunmuyor.",
    noRecentCheckouts: "Son ödeme linki bulunmuyor.",
    openCheckoutLink: "Ödeme Linkini Aç",
    quotaLabelSeats: "Kullanıcı",
    quotaLabelActiveJobs: "Aktif İlan",
    quotaLabelCandidateProcessing: "Aday İşleme",
    quotaLabelAiInterviews: "AI Mülakat",
    grantSeats: "Kullanıcı Ekle",
    grantActiveJobs: "Aktif İlan Ekle",
    grantCandidateProcessing: "Aday İşleme Ekle",
    grantAiInterviews: "AI Mülakat Ekle",
    planSaved: "Plan güncellendi.",
    quotaSaved: "Manuel kota eklendi.",
    workspaceStatusSaved: "Çalışma alanı durumu güncellendi.",
    ownerResetSent: "Sahip erişim linki gönderildi.",
    enterpriseCreated: "Kurumsal müşteri oluşturuldu.",
    createEnterpriseLead: "Kurumsal Müşteri Oluştur",
    enterpriseListTitle: "Kurumsal Hesaplar",
    enterpriseListSubtitle: "Sözleşmeli müşterileri, özel teklifleri ve ödeme linklerini yönetin.",
    enterpriseSummaryTotal: "Toplam Kurumsal",
    enterpriseSummaryActive: "Aktif Sözleşme",
    enterpriseSummaryPending: "Bekleyen Teklif",
    enterpriseSummarySuspended: "Askıya Alınan",
    filterByStatus: "Duruma Göre Filtrele",
    filterByPlan: "Plana Göre Filtrele",
    tenantStatus: "Çalışma Alanı Durumu",
    billingStatus: "Abonelik Durumu",
    actions: "İşlemler",
    recentPaymentLinks: "Son Ödeme Linkleri",
    openCustomer: "Müşteriyi Aç",
    generatedLink: "Üretilen Link",
    generatedLinkDescription: "Bu özel teklif için ödeme linki hazır.",
    stripeDisabled: "Stripe yapılandırılmadı. Müşteri kaydı ödeme linki olmadan oluşturuldu.",
    leadStatusSaved: "Lead durumu güncellendi.",
    search: "Ara",
    accountUsage: "Hesap Kullanımı",
    featureSet: "Özellik Seti",
    advancedReporting: "Gelişmiş Raporlama",
    calendarIntegrations: "Takvim Entegrasyonları",
    brandedCandidateExperience: "Markalı Aday Deneyimi",
    customIntegrations: "Özel Entegrasyonlar",
    billingAmountHint: "Özel teklif için aylık tutarı USD cent olarak girin.",
    planHintStarterGrowth: "Starter ve Growth seçildiğinde katalog varsayılanları kullanılır; aşağıdaki limitlerle override edebilirsiniz.",
    openCustomerWorkspace: "Müşteri Panelini Aç",
    linkSent: "Link gönderildi",
    notSent: "Henüz gönderilmedi"
  };
}

export function formatInternalPlan(planKey: "STARTER" | "GROWTH" | "ENTERPRISE", locale: SiteLocale) {
  if (locale === "en") {
    return planKey === "STARTER" ? "Starter" : planKey === "GROWTH" ? "Growth" : "Enterprise";
  }

  return planKey === "STARTER" ? "Starter" : planKey === "GROWTH" ? "Growth" : "Enterprise";
}

export function formatTenantStatus(status: "ACTIVE" | "SUSPENDED" | "DELETED", locale: SiteLocale) {
  if (locale === "en") {
    return status === "ACTIVE" ? "Active" : status === "SUSPENDED" ? "Suspended" : "Deleted";
  }

  return status === "ACTIVE" ? "Aktif" : status === "SUSPENDED" ? "Askıda" : "Silinmiş";
}

export function formatBillingStatus(status: string, locale: SiteLocale) {
  if (locale === "en") {
    switch (status) {
      case "TRIALING":
        return "Trialing";
      case "ACTIVE":
        return "Active";
      case "PAST_DUE":
        return "Past Due";
      case "INCOMPLETE":
        return "Incomplete";
      case "CANCELED":
        return "Canceled";
      default:
        return status;
    }
  }

  switch (status) {
    case "TRIALING":
      return "Deneme";
    case "ACTIVE":
      return "Aktif";
    case "PAST_DUE":
      return "Ödeme Gecikti";
    case "INCOMPLETE":
      return "Eksik Kurulum";
    case "CANCELED":
      return "İptal";
    default:
      return status;
  }
}

export function quotaKeyLabel(
  key: "SEATS" | "ACTIVE_JOBS" | "CANDIDATE_PROCESSING" | "AI_INTERVIEWS",
  locale: SiteLocale
) {
  if (locale === "en") {
    switch (key) {
      case "SEATS":
        return "Seats";
      case "ACTIVE_JOBS":
        return "Active Jobs";
      case "CANDIDATE_PROCESSING":
        return "Candidate Processing";
      case "AI_INTERVIEWS":
        return "AI Interviews";
    }
  }

  switch (key) {
    case "SEATS":
      return "Kullanıcı";
    case "ACTIVE_JOBS":
      return "Aktif İlan";
    case "CANDIDATE_PROCESSING":
      return "Aday İşleme";
    case "AI_INTERVIEWS":
      return "AI Mülakat";
  }
}

export function formatMemberStatus(status: "ACTIVE" | "INVITED" | "DISABLED", locale: SiteLocale) {
  if (locale === "en") {
    return status === "ACTIVE" ? "Active" : status === "INVITED" ? "Invited" : "Disabled";
  }

  return status === "ACTIVE" ? "Aktif" : status === "INVITED" ? "Davet Bekliyor" : "Pasif";
}

export function formatAlertCategory(
  category: "APPLICATION" | "SECURITY" | "ASSISTANT" | "OPERATIONS",
  locale: SiteLocale
) {
  if (locale === "en") {
    switch (category) {
      case "APPLICATION":
        return "Application";
      case "SECURITY":
        return "Security";
      case "ASSISTANT":
        return "Assistant";
      case "OPERATIONS":
        return "Operations";
    }
  }

  switch (category) {
    case "APPLICATION":
      return "Uygulama";
    case "SECURITY":
      return "Güvenlik";
    case "ASSISTANT":
      return "Asistan";
    case "OPERATIONS":
      return "Operasyon";
  }
}

export function formatAlertSeverity(severity: "critical" | "warning", locale: SiteLocale) {
  if (locale === "en") {
    return severity === "critical" ? "Critical" : "Warning";
  }

  return severity === "critical" ? "Kritik" : "Uyarı";
}

export function formatInternalRole(role: "OWNER" | "MANAGER" | "STAFF", locale: SiteLocale) {
  if (locale === "en") {
    switch (role) {
      case "OWNER":
        return "Owner";
      case "MANAGER":
        return "Manager";
      case "STAFF":
        return "Staff";
    }
  }

  switch (role) {
    case "OWNER":
      return "Hesap Sahibi";
    case "MANAGER":
      return "Menajer";
    case "STAFF":
      return "Uzman / Personel";
  }
}

export function formatJobStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED", locale: SiteLocale) {
  if (locale === "en") {
    switch (status) {
      case "DRAFT":
        return "Draft";
      case "PUBLISHED":
        return "Published";
      case "ARCHIVED":
        return "Archived";
    }
  }

  switch (status) {
    case "DRAFT":
      return "Taslak";
    case "PUBLISHED":
      return "Yayında";
    case "ARCHIVED":
      return "Arşiv";
  }
}

export function formatGenericDeliveryStatus(status: string, locale: SiteLocale) {
  if (locale === "en") {
    switch (status) {
      case "QUEUED":
        return "Queued";
      case "SENT":
        return "Sent";
      case "FAILED":
        return "Failed";
      case "PENDING":
        return "Pending";
      default:
        return status;
    }
  }

  switch (status) {
    case "QUEUED":
      return "Sırada";
    case "SENT":
      return "Gönderildi";
    case "FAILED":
      return "Başarısız";
    case "PENDING":
      return "Bekliyor";
    default:
      return status;
  }
}

export function translateInternalAdminMessage(message: string, locale: SiteLocale) {
  if (locale !== "en") {
    return message;
  }

  const exactMap: Record<string, string> = {
    "Bu alan yalnızca iç yönetim ekibi için açıktır.": "This area is restricted to the internal admin team.",
    "Müşteri hesabı bulunamadı.": "Customer account could not be found.",
    "Abonelik hesabı bulunamadı.": "Subscription account could not be found.",
    "En az bir kota artışı girilmelidir.": "Enter at least one quota adjustment.",
    "Hesap sahibi bulunamadı.": "Owner account could not be found.",
    "Aylık fiyat 0'dan büyük olmalıdır.": "Monthly price must be greater than zero.",
    "Yeni müşteri kaydı için benzersiz tenant ID üretilemedi.": "A unique tenant ID could not be generated for the new customer.",
    "Bildirim teslimatı başarısız oldu.": "Notification delivery failed.",
    "Lead kaydı bulunamadı.": "Lead record could not be found.",
    "Refresh token tekrar kullanımı tespit edildi.": "Refresh token reuse detected.",
    "Abonelik ödemesi gecikti.": "Subscription payment is past due.",
    "Abonelik kurulumu tamamlanmadı.": "Subscription setup is incomplete."
  };

  return exactMap[message] ?? message;
}
