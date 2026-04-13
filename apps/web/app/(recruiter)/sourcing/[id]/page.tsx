"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OutreachComposerModal } from "../../../../components/outreach-composer-modal";
import { PageTitleWithGuide } from "../../../../components/page-guide";
import { ProspectDrawer } from "../../../../components/prospect-drawer";
import { SourcingIngestionPanel } from "../../../../components/sourcing-ingestion-panel";
import { useUiText } from "../../../../components/site-language-provider";
import { EmptyState, ErrorState, LoadingState } from "../../../../components/ui-states";
import { apiClient } from "../../../../lib/api-client";
import {
  PROSPECT_FIT_LABELS,
  PROSPECT_FIT_TONES,
  SOURCING_STAGE_META,
  SUPPRESSION_LABELS,
  TALENT_SOURCE_LABELS,
  formatDepartment
} from "../../../../lib/constants";
import {
  applicationDetailHref,
  decodeRouteEntityId,
  withApiBaseOverride
} from "../../../../lib/entity-routes";
import { formatCurrencyTry, formatDate } from "../../../../lib/format";
import type {
  SourcingImportedLead,
  SourcingProjectDetailReadModel,
  SourcingProspectStage,
  SourcingProspectView
} from "../../../../lib/types";

const STAGE_ORDER: SourcingProspectStage[] = [
  "NEEDS_REVIEW",
  "GOOD_FIT",
  "SAVED",
  "CONTACTED",
  "REPLIED",
  "CONVERTED",
  "REJECTED"
];

function splitCriteriaList(value: string) {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
}

function discoveryStateAppearance(
  status: SourcingProjectDetailReadModel["discovery"]["status"]
) {
  switch (status) {
    case "STRONG_RESULTS":
      return { label: "Güçlü Sonuç", tone: "#157f3b", background: "rgba(21, 127, 59, 0.08)" };
    case "LIMITED_RESULTS":
      return { label: "Sınırlı Sonuç", tone: "#946200", background: "rgba(148, 98, 0, 0.08)" };
    case "LOW_QUALITY_RESULTS":
      return { label: "Düşük Kalite", tone: "#9a3412", background: "rgba(154, 52, 18, 0.08)" };
    case "PUBLIC_DISCOVERY_WEAK":
      return { label: "Public Discovery Zayıf", tone: "#7c3aed", background: "rgba(124, 58, 237, 0.08)" };
    default:
      return { label: "Henüz Çalıştırılmadı", tone: "var(--text-secondary)", background: "rgba(148, 163, 184, 0.08)" };
  }
}

function qualityTone(label: SourcingProspectView["discoveryQuality"]["label"]) {
  switch (label) {
    case "HIGH":
      return { color: "#157f3b", background: "rgba(21, 127, 59, 0.08)" };
    case "MEDIUM":
      return { color: "#946200", background: "rgba(148, 98, 0, 0.08)" };
    case "LOW":
      return { color: "#9a3412", background: "rgba(154, 52, 18, 0.08)" };
    default:
      return { color: "var(--text-secondary)", background: "rgba(148, 163, 184, 0.08)" };
  }
}

function nextStepLabel(prospect: SourcingProspectView) {
  const latestOutreach = prospect.outreachHistory[0]?.status ?? null;

  if (prospect.attachedApplicationId) {
    return "Hiring akışına eklendi";
  }

  if (prospect.suppressionStatus !== "ALLOWED") {
    return SUPPRESSION_LABELS[prospect.suppressionStatus];
  }

  if (latestOutreach === "REPLIED") {
    return "Yanıt geldi";
  }

  if (latestOutreach === "SENT") {
    return "Yanıt bekleniyor";
  }

  if (latestOutreach === "FAILED") {
    return "Gönderim başarısız";
  }

  if (latestOutreach === "READY_TO_SEND" || latestOutreach === "DRAFT") {
    return "Outreach taslağı hazır";
  }

  return prospect.email ? "Outreach için uygun" : "İletişim bilgisi eksik";
}

type FilterGroupProps = {
  title: string;
  defaultOpen?: boolean;
  badge?: string | null;
  children: React.ReactNode;
};

function FilterGroup({ title, defaultOpen = false, badge, children }: FilterGroupProps) {
  return (
    <details className="sourcing-filter-group" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {badge ? <span className="sourcing-fg-badge">{badge}</span> : null}
          <span className="sourcing-fg-chevron" aria-hidden="true">&#x25BE;</span>
        </span>
      </summary>
      <div className="sourcing-filter-group-content">{children}</div>
    </details>
  );
}

type RailSectionProps = {
  title: string;
  defaultOpen?: boolean;
  badge?: string | null;
  children: React.ReactNode;
};

function RailSection({ title, defaultOpen = false, badge, children }: RailSectionProps) {
  return (
    <details className="sourcing-rail-section" open={defaultOpen}>
      <summary className="sourcing-rail-summary">
        <strong>{title}</strong>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {badge ? <span className="sourcing-rail-badge">{badge}</span> : null}
          <span className="sourcing-rail-chevron" aria-hidden="true">&#x25BE;</span>
        </span>
      </summary>
      <div className="sourcing-rail-content">{children}</div>
    </details>
  );
}

function buildDiscoveryPayload(input: {
  roleTitle: string;
  keyword: string;
  locationText: string;
  minYearsExperience: string;
  skillTags: string;
  companyBackground: string;
  languages: string;
  workModel: string;
  compensationMin: string;
  compensationMax: string;
  idealCandidateNotes: string;
}) {
  return {
    roleTitle: input.roleTitle.trim() || undefined,
    keyword: input.keyword.trim() || undefined,
    locationText: input.locationText.trim() || undefined,
    minYearsExperience: input.minYearsExperience ? Number(input.minYearsExperience) : undefined,
    skillTags: splitCriteriaList(input.skillTags),
    companyBackground: splitCriteriaList(input.companyBackground),
    languages: splitCriteriaList(input.languages),
    workModel: input.workModel.trim() || undefined,
    compensationMin: input.compensationMin ? Number(input.compensationMin) : undefined,
    compensationMax: input.compensationMax ? Number(input.compensationMax) : undefined,
    idealCandidateNotes: input.idealCandidateNotes.trim() || undefined
  };
}

function serializeDiscoveryPayload(payload: ReturnType<typeof buildDiscoveryPayload>) {
  return JSON.stringify({
    ...payload,
    skillTags: [...payload.skillTags].sort(),
    companyBackground: [...payload.companyBackground].sort(),
    languages: [...payload.languages].sort()
  });
}

export default function SourcingProjectDetailPage() {
  const { t } = useUiText();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = decodeRouteEntityId(params.id);
  const [data, setData] = useState<SourcingProjectDetailReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [fitFilter, setFitFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [workModelFilter, setWorkModelFilter] = useState<string>("");
  const [languageFilter, setLanguageFilter] = useState<string>("");
  const [educationFilter, setEducationFilter] = useState<string>("");
  const [minYears, setMinYears] = useState("");
  const [contactableOnly, setContactableOnly] = useState(false);

  const [selectedProspect, setSelectedProspect] = useState<SourcingProspectView | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [discoveryDetailOpen, setDiscoveryDetailOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const [criteriaRoleTitle, setCriteriaRoleTitle] = useState("");
  const [criteriaKeyword, setCriteriaKeyword] = useState("");
  const [criteriaLocation, setCriteriaLocation] = useState("");
  const [criteriaMinYears, setCriteriaMinYears] = useState("");
  const [criteriaSkillTags, setCriteriaSkillTags] = useState("");
  const [criteriaCompanyBackground, setCriteriaCompanyBackground] = useState("");
  const [criteriaLanguages, setCriteriaLanguages] = useState("");
  const [criteriaWorkModel, setCriteriaWorkModel] = useState("");
  const [criteriaCompensationMin, setCriteriaCompensationMin] = useState("");
  const [criteriaCompensationMax, setCriteriaCompensationMax] = useState("");
  const [criteriaNotes, setCriteriaNotes] = useState("");
  const criteriaHydratedRef = useRef(false);
  const lastAppliedDiscoverySignatureRef = useRef("");
  const inFlightDiscoverySignatureRef = useRef("");
  const latestDiscoveryRequestRef = useRef(0);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiClient.getSourcingProject(projectId);
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Sourcing projesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (!selectedProspect || !data) {
      return;
    }

    const refreshed = data.prospects.find((prospect) => prospect.id === selectedProspect.id) ?? null;
    setSelectedProspect(refreshed);
  }, [data, selectedProspect]);

  useEffect(() => {
    if (!data || criteriaHydratedRef.current) {
      return;
    }

    /* Inputs start empty — user fills criteria on demand.
       We only record the last-applied signature so the auto-discovery
       debounce does not fire a redundant run on first load. */
    const initialSignature = serializeDiscoveryPayload(
      buildDiscoveryPayload({
        roleTitle: "",
        keyword: "",
        locationText: "",
        minYearsExperience: "",
        skillTags: "",
        companyBackground: "",
        languages: "",
        workModel: "",
        compensationMin: "",
        compensationMax: "",
        idealCandidateNotes: ""
      })
    );

    lastAppliedDiscoverySignatureRef.current = initialSignature;
    criteriaHydratedRef.current = true;
  }, [data]);

  const discoveryPayload = useMemo(
    () =>
      buildDiscoveryPayload({
        roleTitle: criteriaRoleTitle,
        keyword: criteriaKeyword,
        locationText: criteriaLocation,
        minYearsExperience: criteriaMinYears,
        skillTags: criteriaSkillTags,
        companyBackground: criteriaCompanyBackground,
        languages: criteriaLanguages,
        workModel: criteriaWorkModel,
        compensationMin: criteriaCompensationMin,
        compensationMax: criteriaCompensationMax,
        idealCandidateNotes: criteriaNotes
      }),
    [
      criteriaCompanyBackground,
      criteriaCompensationMax,
      criteriaCompensationMin,
      criteriaKeyword,
      criteriaLanguages,
      criteriaLocation,
      criteriaMinYears,
      criteriaNotes,
      criteriaRoleTitle,
      criteriaSkillTags,
      criteriaWorkModel
    ]
  );
  const discoverySignature = useMemo(
    () => serializeDiscoveryPayload(discoveryPayload),
    [discoveryPayload]
  );

  const filteredProspects = useMemo(() => {
    const rows = data?.prospects ?? [];
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    return rows.filter((prospect) => {
      if (stageFilter && prospect.stage !== stageFilter) {
        return false;
      }
      if (fitFilter && prospect.fitLabel !== fitFilter) {
        return false;
      }
      if (sourceFilter && prospect.sourceKind !== sourceFilter) {
        return false;
      }
      if (locationFilter && prospect.locationText !== locationFilter) {
        return false;
      }
      if (companyFilter && prospect.currentCompany !== companyFilter) {
        return false;
      }
      if (workModelFilter && prospect.workModel !== workModelFilter) {
        return false;
      }
      if (languageFilter && !prospect.languages.includes(languageFilter)) {
        return false;
      }
      if (educationFilter && !prospect.education.includes(educationFilter)) {
        return false;
      }
      if (minYears && (prospect.yearsOfExperience ?? 0) < Number(minYears)) {
        return false;
      }
      if (
        contactableOnly &&
        (!prospect.email || prospect.suppressionStatus !== "ALLOWED")
      ) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return [
        prospect.fullName,
        prospect.headline,
        prospect.currentTitle,
        prospect.currentCompany,
        prospect.locationText,
        prospect.summary,
        ...prospect.skills
      ]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("tr-TR").includes(normalizedQuery));
    });
  }, [
    contactableOnly,
    companyFilter,
    data?.prospects,
    educationFilter,
    fitFilter,
    languageFilter,
    locationFilter,
    minYears,
    query,
    sourceFilter,
    stageFilter,
    workModelFilter
  ]);

  const selectedProspects = useMemo(
    () => filteredProspects.filter((prospect) => selectedIds.has(prospect.id)),
    [filteredProspects, selectedIds]
  );
  const attachableSelectedProspects = useMemo(
    () => selectedProspects.filter((prospect) => !prospect.attachedApplicationId),
    [selectedProspects]
  );
  const inviteReadySelectedProspects = useMemo(
    () => selectedProspects.filter((prospect) => Boolean(prospect.email)),
    [selectedProspects]
  );
  const discoveryAppearance = data ? discoveryStateAppearance(data.discovery.status) : null;
  const activeResultFilterCount = [
    query,
    stageFilter,
    fitFilter,
    sourceFilter,
    locationFilter,
    companyFilter,
    workModelFilter,
    languageFilter,
    educationFilter,
    minYears,
    contactableOnly ? "contactable" : ""
  ].filter(Boolean).length;
  const criteriaSummaryChips = useMemo(
    () =>
      [
        criteriaRoleTitle.trim() ? `Rol: ${criteriaRoleTitle.trim()}` : null,
        criteriaLocation.trim() ? `Lokasyon: ${criteriaLocation.trim()}` : null,
        criteriaMinYears.trim() ? `Deneyim: ${criteriaMinYears.trim()}+ yıl` : null,
        criteriaWorkModel.trim() ? `Model: ${criteriaWorkModel.trim()}` : null,
        ...splitCriteriaList(criteriaSkillTags).slice(0, 4).map((item) => `Skill: ${item}`)
      ].filter((item): item is string => Boolean(item)),
    [
      criteriaLocation,
      criteriaMinYears,
      criteriaRoleTitle,
      criteriaSkillTags,
      criteriaWorkModel
    ]
  );
  const recentDiscoveryLabel = data?.project.lastExternalDiscovery?.lastRunAt
    ? formatDate(data.project.lastExternalDiscovery.lastRunAt)
    : "Henüz çalışmadı";

  function resetResultFilters() {
    setQuery("");
    setStageFilter("");
    setFitFilter("");
    setSourceFilter("");
    setLocationFilter("");
    setCompanyFilter("");
    setWorkModelFilter("");
    setLanguageFilter("");
    setEducationFilter("");
    setMinYears("");
    setContactableOnly(false);
  }

  async function runAction<T>(task: () => Promise<T>) {
    setActionError("");
    try {
      return await task();
    } catch (actionLoadError) {
      setActionError(
        actionLoadError instanceof Error
          ? actionLoadError.message
          : "Sourcing aksiyonu tamamlanamadı."
      );
      return null;
    }
  }

  async function refreshProject() {
    setActionMessage("");
    const refreshed = await runAction(() => apiClient.refreshSourcingProject(projectId));
    if (refreshed) {
      setData(refreshed);
    }
  }

  async function handleStageChange(
    prospectId: string,
    stage: SourcingProspectStage,
    recruiterNote?: string
  ) {
    const result = await runAction(() =>
      apiClient.updateSourcingProspectStage(projectId, prospectId, {
        stage,
        recruiterNote
      })
    );
    if (!result) {
      return;
    }
    setActionMessage("Prospect durumu güncellendi.");
    await loadProject();
  }

  async function handleBulkStageChange(stage: SourcingProspectStage) {
    const ids = Array.from(selectedIds);
    const result = await runAction(() =>
      Promise.all(
        ids.map((id) =>
          apiClient.updateSourcingProspectStage(projectId, id, {
            stage
          })
        )
      )
    );
    if (!result) {
      return;
    }
    setSelectedIds(new Set());
    setActionMessage("Seçili prospect’ler güncellendi.");
    await loadProject();
  }

  async function handleBulkSuppression(status: "ALLOWED" | "DO_NOT_CONTACT") {
    if (selectedProspects.length === 0) {
      return;
    }

    const result = await runAction(() =>
      Promise.all(
        selectedProspects.map((prospect) =>
          apiClient.updateSourcingProfileSuppression(prospect.profileId, {
            status,
            reason: status === "ALLOWED" ? undefined : "Bulk recruiter aksiyonu"
          })
        )
      )
    );
    if (!result) {
      return;
    }
    setSelectedIds(new Set());
    setActionMessage(
      status === "DO_NOT_CONTACT"
        ? `${selectedProspects.length} prospect Do Not Contact olarak işaretlendi.`
        : `${selectedProspects.length} prospect yeniden iletişime açıldı.`
    );
    await loadProject();
  }

  async function handleBulkAttach() {
    if (selectedProspects.length === 0) {
      return;
    }

    const results = await runAction(() =>
      Promise.all(
        selectedProspects.map(async (prospect) => {
          if (prospect.attachedApplicationId) {
            return {
              status: "existing" as const,
              applicationId: prospect.attachedApplicationId
            };
          }

          try {
            const attached = await apiClient.attachSourcingProspect(projectId, prospect.id);
            return {
              status: "attached" as const,
              applicationId: attached.applicationId
            };
          } catch (error) {
            return {
              status: "error" as const,
              error: error instanceof Error ? error.message : "attach_failed"
            };
          }
        })
      )
    );

    if (!results) {
      return;
    }

    const attached = results.filter((item) => item.status === "attached").length;
    const existing = results.filter((item) => item.status === "existing").length;
    const failed = results.filter((item) => item.status === "error").length;

    setSelectedIds(new Set());
    setActionMessage(
      `${attached} prospect hiring akışına bağlandı.${existing > 0 ? ` ${existing} aday zaten bağlıydı.` : ""}`
    );
    if (failed > 0) {
      setActionError(`${failed} prospect attach edilemedi.`);
    }
    await loadProject();
  }

  async function handleBulkInvite() {
    if (selectedProspects.length === 0) {
      return;
    }

    const attachmentResults = await runAction(() =>
      Promise.all(
        selectedProspects.map(async (prospect) => {
          if (prospect.attachedApplicationId) {
            return {
              prospectId: prospect.id,
              applicationId: prospect.attachedApplicationId,
              attached: false,
              email: prospect.email
            };
          }

          try {
            const attached = await apiClient.attachSourcingProspect(projectId, prospect.id);
            return {
              prospectId: prospect.id,
              applicationId: attached.applicationId,
              attached: true,
              email: prospect.email
            };
          } catch {
            return {
              prospectId: prospect.id,
              applicationId: null,
              attached: false,
              email: prospect.email
            };
          }
        })
      )
    );

    if (!attachmentResults) {
      return;
    }

    const attachedCount = attachmentResults.filter((item) => item.attached).length;
    const missingEmailCount = attachmentResults.filter((item) => !item.email).length;
    const inviteApplicationIds = [...new Set(
      attachmentResults
        .filter((item) => Boolean(item.applicationId) && Boolean(item.email))
        .map((item) => item.applicationId as string)
    )];

    const inviteResult = inviteApplicationIds.length > 0
      ? await runAction(() => apiClient.bulkApproveInterview(inviteApplicationIds))
      : { total: 0, results: [] };
    if (!inviteResult) {
      return;
    }

    const inviteOk = inviteResult.results.filter((item) => item.status === "ok").length;
    const inviteFail = inviteResult.results.filter((item) => item.status === "error").length;

    setSelectedIds(new Set());
    setActionMessage(
      `${attachedCount} aday applicant akışına bağlandı. ${inviteOk} AI mülakat daveti gönderildi.${missingEmailCount > 0 ? ` ${missingEmailCount} adayda e-posta eksik olduğu için davet atlandı.` : ""}`
    );
    if (inviteFail > 0) {
      setActionError(`${inviteFail} aday için AI mülakat daveti oluşturulamadı.`);
    } else {
      setActionError("");
    }
    await loadProject();
  }

  async function handleAttach(prospectId: string) {
    const result = await runAction(() => apiClient.attachSourcingProspect(projectId, prospectId));
    if (!result) {
      return;
    }
    setActionMessage("Prospect mevcut hiring akışına bağlandı.");
    await loadProject();
    router.push(withApiBaseOverride(applicationDetailHref(result.applicationId), searchParams));
  }

  async function handleSuppression(profileId: string, status: "ALLOWED" | "DO_NOT_CONTACT" | "OPTED_OUT" | "NEEDS_REVIEW", reason?: string) {
    const result = await runAction(() =>
      apiClient.updateSourcingProfileSuppression(profileId, { status, reason })
    );
    if (!result) {
      return;
    }
    setActionMessage("Suppression durumu güncellendi.");
    await loadProject();
  }

  async function handleSendOutreach(payload: {
    prospectIds: string[];
    templateId?: string;
    subject?: string;
    body?: string;
    reviewNote?: string;
    sendNow?: boolean;
  }) {
    const result = await runAction(() => apiClient.sendSourcingOutreach(projectId, payload));
    if (!result) {
      return;
    }
    const sentCount = result.results.filter((item) => item.status === "SENT").length;
    const blockedCount = result.results.filter((item) => item.status === "BLOCKED").length;
    setActionMessage(
      sentCount > 0
        ? `${sentCount} outreach gönderildi.${blockedCount > 0 ? ` ${blockedCount} profil suppression nedeniyle engellendi.` : ""}`
        : "Outreach taslağı kaydedildi."
    );
    setOutreachOpen(false);
    setSelectedIds(new Set());
    await loadProject();
  }

  async function handleExternalDiscovery(
    payload = discoveryPayload,
    signature = discoverySignature
  ) {
    if (!payload.roleTitle) {
      return;
    }

    setDiscovering(true);
    setActionError("");
    inFlightDiscoverySignatureRef.current = signature;
    const requestId = latestDiscoveryRequestRef.current + 1;
    latestDiscoveryRequestRef.current = requestId;

    const result = await runAction(() =>
      apiClient.discoverSourcingProspects(projectId, payload)
    );

    if (latestDiscoveryRequestRef.current !== requestId) {
      return;
    }

    inFlightDiscoverySignatureRef.current = "";
    setDiscovering(false);

    if (!result) {
      return;
    }

    lastAppliedDiscoverySignatureRef.current = signature;
    setData(result.project);
    setSelectedIds(new Set());
    setSelectedProspect(null);
    setActionMessage("");
  }

  async function handleLeadImport(payload: {
    sourceType: "recruiter_import" | "public_profile_url" | "agency_upload" | "referral" | "job_board_export";
    sourceLabel?: string;
    leads: SourcingImportedLead[];
  }) {
    setActionError("");
    try {
      const result = await apiClient.importSourcingLeads(projectId, payload);
      setData(result.project);
      setSelectedIds(new Set());
      setSelectedProspect(null);
      setActionMessage(
        `${result.summary.processedRecords} kayıt işlendi. ${result.summary.newProfiles} yeni profil, ${result.summary.newProspects} yeni prospect, ${result.summary.duplicateProspects} duplicate.`
      );
      return result.summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lead import tamamlanamadı.";
      setActionError(message);
      throw error;
    }
  }

  useEffect(() => {
    if (!data || !criteriaHydratedRef.current || !discoveryPayload.roleTitle) {
      return;
    }

    if (
      discoverySignature === lastAppliedDiscoverySignatureRef.current ||
      discoverySignature === inFlightDiscoverySignatureRef.current
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void handleExternalDiscovery(discoveryPayload, discoverySignature);
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [data, discoveryPayload.roleTitle, discoverySignature]);

  async function handleUrlImport(payload: { urls: string[]; note?: string }) {
    setActionError("");
    try {
      const result = await apiClient.importSourcingProfileUrls(projectId, payload);
      setData(result.project);
      setSelectedIds(new Set());
      setSelectedProspect(null);
      setActionMessage(
        t(`${result.summary.processedRecords} URL prospect’e dönüştü. ${result.summary.newProfiles} yeni profil eklendi, ${result.summary.errorCount} URL işlenemedi.`)
      );
      return result.summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("URL ingestion tamamlanamadı.");
      setActionError(message);
      throw error;
    }
  }

  return (
    <section className="page-grid">
      <div style={{ marginBottom: 4 }}>
        <Link
          href={withApiBaseOverride("/sourcing", searchParams)}
          className="small"
          style={{ textDecoration: "none" }}
        >
          ← Sourcing
        </Link>
      </div>

      {loading ? (
        <section className="panel">
          <LoadingState message={t("Sourcing workbench hazırlanıyor...")} />
        </section>
      ) : null}

      {!loading && error ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadProject()}>
                {t("Tekrar dene")}
              </button>
            }
          />
        </section>
      ) : null}

      {!loading && !error && data ? (
        <>
          {/* ── Compact header ── */}
          <section className="panel" style={{ paddingBottom: 0 }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <div>
                <div className="small" style={{ marginBottom: 4 }}>
                  {data.project.job?.title ?? "Bağlı requisition yok"} · {formatDepartment(data.project.job?.roleFamily)}
                </div>
                <PageTitleWithGuide
                  guideKey="sourcingProject"
                  title={data.project.name}
                  style={{ margin: 0, fontSize: 22 }}
                />
                {data.project.job ? (
                  <div className="sourcing-role-banner">
                    <span className="sourcing-role-pill">
                      <strong>{data.project.job.locationText ?? "Esnek"}</strong> · {data.project.job.shiftType ?? "—"}
                    </span>
                    <span className="sourcing-role-pill">
                      {formatCurrencyTry(data.project.job.salaryMin)} – {formatCurrencyTry(data.project.job.salaryMax)}
                    </span>
                    {data.project.job.requirements.slice(0, 2).map((item) => (
                      <span key={item.value} className="sourcing-role-pill">{item.value}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="row-actions">
                <button type="button" className="ghost-button" onClick={() => setCopilotOpen(true)}>
                  {t("AI Yardımcı")}
                </button>
                <button type="button" className="ghost-button" onClick={() => void refreshProject()}>
                  {t("Yenile")}
                </button>
              </div>
            </div>

            {/* ── Pipeline funnel ── */}
            <div className="sourcing-stage-strip" style={{ marginTop: 8 }}>
              {STAGE_ORDER.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className={`sourcing-stage-card${stageFilter === stage ? " active" : ""}`}
                  onClick={() => setStageFilter((current) => (current === stage ? "" : stage))}
                >
                  <div className="small">{SOURCING_STAGE_META[stage].label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: SOURCING_STAGE_META[stage].color }}>
                    {data.funnel.byStage[stage] ?? 0}
                  </div>
                </button>
              ))}
            </div>

            {actionMessage ? (
              <div className="badge success" style={{ marginTop: 10, justifyContent: "center", padding: "8px 14px" }}>
                {actionMessage}
              </div>
            ) : null}
            {actionError ? (
              <div className="badge danger" style={{ marginTop: 10, justifyContent: "center", padding: "8px 14px" }}>
                {actionError}
              </div>
            ) : null}
          </section>

          {/* ── 2-column workbench ── */}
          <div className="sourcing-workbench">
            {/* ── Left filter rail (compact) ── */}
            <aside className="sourcing-filter-rail">
              <div className="sourcing-rail-label">
                <span className="rail-icon">⚡</span>
                {t("Canlı Arama")}
                {discovering ? (
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--primary)" }}>{t("güncelleniyor...")}</span>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <input
                  className="input"
                  value={criteriaRoleTitle}
                  onChange={(event) => setCriteriaRoleTitle(event.target.value)}
                  placeholder={t("Rol / title")}
                />
                <input
                  className="input"
                  value={criteriaLocation}
                  onChange={(event) => setCriteriaLocation(event.target.value)}
                  placeholder={t("Lokasyon")}
                />
                <div className="sourcing-inline-grid">
                  <input
                    className="input"
                    value={criteriaMinYears}
                    onChange={(event) => setCriteriaMinYears(event.target.value)}
                    placeholder={t("Min. yıl")}
                    inputMode="numeric"
                  />
                  <input
                    className="input"
                    value={criteriaWorkModel}
                    onChange={(event) => setCriteriaWorkModel(event.target.value)}
                    placeholder={t("Model")}
                  />
                </div>
                <input
                  className="input"
                  value={criteriaSkillTags}
                  onChange={(event) => setCriteriaSkillTags(event.target.value)}
                  placeholder={t("Skill (virgülle)")}
                />
                <input
                  className="input"
                  value={criteriaKeyword}
                  onChange={(event) => setCriteriaKeyword(event.target.value)}
                  placeholder={t("Ek anahtar kelime")}
                />
              </div>

              <FilterGroup title={t("Gelişmiş")} badge={[criteriaCompanyBackground, criteriaLanguages, criteriaCompensationMin, criteriaCompensationMax, criteriaNotes].filter(Boolean).length > 0 ? `${[criteriaCompanyBackground, criteriaLanguages, criteriaCompensationMin, criteriaCompensationMax, criteriaNotes].filter(Boolean).length}` : null}>
                <input
                  className="input"
                  value={criteriaCompanyBackground}
                  onChange={(event) => setCriteriaCompanyBackground(event.target.value)}
                  placeholder={t("Şirket geçmişi")}
                />
                <input
                  className="input"
                  value={criteriaLanguages}
                  onChange={(event) => setCriteriaLanguages(event.target.value)}
                  placeholder={t("Diller")}
                />
                <div className="sourcing-inline-grid">
                  <input
                    className="input"
                    value={criteriaCompensationMin}
                    onChange={(event) => setCriteriaCompensationMin(event.target.value)}
                    placeholder={t("Min ₺")}
                    inputMode="numeric"
                  />
                  <input
                    className="input"
                    value={criteriaCompensationMax}
                    onChange={(event) => setCriteriaCompensationMax(event.target.value)}
                    placeholder={t("Max ₺")}
                    inputMode="numeric"
                  />
                </div>
                <textarea
                  className="input"
                  value={criteriaNotes}
                  onChange={(event) => setCriteriaNotes(event.target.value)}
                  placeholder={t("Recruiter notu")}
                  style={{ minHeight: 48, resize: "vertical" }}
                />
              </FilterGroup>

              <div style={{ marginTop: 12 }}>
                <div className="sourcing-rail-label">
                  <span className="rail-icon">▽</span>
                  {t("Filtreler")}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    className="input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("İsim, skill, şirket ara...")}
                  />
                  <select className="select" value={fitFilter} onChange={(event) => setFitFilter(event.target.value)}>
                    <option value="">AI Fit</option>
                    {data.filters.fitLabels.map((fitLabel) => (
                      <option key={fitLabel} value={fitLabel}>
                        {PROSPECT_FIT_LABELS[fitLabel as keyof typeof PROSPECT_FIT_LABELS] ?? fitLabel}
                      </option>
                    ))}
                  </select>
                  <select className="select" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                    <option value="">Kaynak</option>
                    {data.filters.sourceKinds.map((sourceKind) => (
                      <option key={sourceKind} value={sourceKind}>
                        {TALENT_SOURCE_LABELS[sourceKind as keyof typeof TALENT_SOURCE_LABELS] ?? sourceKind}
                      </option>
                    ))}
                  </select>
                  <select className="select" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                    <option value="">Lokasyon</option>
                    {data.filters.locations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                  {data.filters.companies.length > 0 ? (
                    <select className="select" value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
                      <option value="">Şirket</option>
                      {data.filters.companies.map((company) => (
                        <option key={company.label} value={company.label}>
                          {company.label} ({company.count})
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {data.filters.workModels.length > 0 ? (
                    <select className="select" value={workModelFilter} onChange={(event) => setWorkModelFilter(event.target.value)}>
                      <option value="">Çalışma modeli</option>
                      {data.filters.workModels.map((workModel) => (
                        <option key={workModel} value={workModel}>
                          {workModel}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {data.filters.languages.length > 0 ? (
                    <select className="select" value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}>
                      <option value="">Dil</option>
                      {data.filters.languages.map((language) => (
                        <option key={language.label} value={language.label}>
                          {language.label} ({language.count})
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {data.filters.educations.length > 0 ? (
                    <select className="select" value={educationFilter} onChange={(event) => setEducationFilter(event.target.value)}>
                      <option value="">Eğitim</option>
                      {data.filters.educations.map((education) => (
                        <option key={education.label} value={education.label}>
                          {education.label} ({education.count})
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <label style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0" }}>
                    <input
                      type="checkbox"
                      checked={contactableOnly}
                      onChange={(event) => setContactableOnly(event.target.checked)}
                    />
                    <span style={{ fontSize: 12 }}>Sadece e-postası olan</span>
                  </label>
                  {activeResultFilterCount > 0 ? (
                    <button type="button" className="ghost-button" onClick={resetResultFilters} style={{ fontSize: 12 }}>
                      Filtreleri Temizle
                    </button>
                  ) : null}
                </div>
              </div>

            <FilterGroup title={t("Lead Import")} badge={t("Opsiyonel")}>
                <SourcingIngestionPanel
                  jobImportHref={
                    data.project.job
                      ? withApiBaseOverride(`/jobs/${data.project.job.id}`, searchParams)
                      : null
                  }
                  onImportLeads={handleLeadImport}
                  onImportUrls={handleUrlImport}
                />
              </FilterGroup>
            </aside>

            {/* ── Main results panel ── */}
            <main className="panel sourcing-results-panel">
              {/* Discovery status bar */}
              <div className="sourcing-discovery-bar" style={{ marginBottom: 14 }}>
                <span
                  className="sourcing-status-pill"
                  style={{
                    color: discoveryAppearance?.tone,
                    background: discoveryAppearance?.background
                  }}
                >
                  {discovering ? "Güncelleniyor..." : discoveryAppearance?.label}
                </span>
                <span className="small" style={{ margin: 0 }}>
                  {filteredProspects.length} / {data.prospects.length} prospect
                </span>
                <button
                  type="button"
                  className="discovery-detail-toggle"
                  onClick={() => setDiscoveryDetailOpen((prev) => !prev)}
                >
                  {discoveryDetailOpen ? "Gizle" : "Detay"}
                </button>
              </div>

              {discoveryDetailOpen ? (
                <div className="sourcing-discovery-detail" style={{ marginBottom: 14 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13 }}>{data.discovery.recruiterMessage}</p>
                  {data.discovery.recruiterGuidance.length > 0 ? (
                    <ul className="plain-list" style={{ marginBottom: 8 }}>
                      {data.discovery.recruiterGuidance.slice(0, 2).map((item) => (
                        <li key={item} className="list-row" style={{ alignItems: "flex-start" }}>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="small" style={{ margin: 0 }}>
                    Son run: {recentDiscoveryLabel} · Güçlü / Orta / Zayıf:{" "}
                    {data.project.lastExternalDiscovery?.highQualityResults ?? 0} /{" "}
                    {data.project.lastExternalDiscovery?.mediumQualityResults ?? 0} /{" "}
                    {data.project.lastExternalDiscovery?.lowQualityResults ?? 0}
                    {" · "}{data.compliance.message}
                  </p>
                </div>
              ) : null}

              {/* Bulk toolbar */}
              {selectedIds.size > 0 ? (
                <div className="sourcing-bulk-toolbar" style={{ marginBottom: 14 }}>
                  <div className="bulk-actions-left">
                    <span className="bulk-count">{selectedProspects.length} seçili</span>
                    <button type="button" className="ghost-button" onClick={() => void handleBulkStageChange("GOOD_FIT")}>
                      İyi Uyum
                    </button>
                    <button type="button" className="ghost-button" onClick={() => void handleBulkStageChange("SAVED")}>
                      Kaydet
                    </button>
                    <button type="button" className="ghost-button" onClick={() => setOutreachOpen(true)}>
                      Outreach
                    </button>
                    <button type="button" className="ghost-button" onClick={() => void handleBulkAttach()}>
                      İlana Ekle
                    </button>
                    <button type="button" className="button-link" onClick={() => void handleBulkInvite()}>
                      Mülakata Davet
                    </button>
                  </div>
                  <div className="bulk-actions-right">
                    <button type="button" className="ghost-button" onClick={() => void handleBulkSuppression("DO_NOT_CONTACT")}>
                      DNC
                    </button>
                    <button type="button" className="ghost-button" onClick={() => void handleBulkStageChange("REJECTED")}>
                      Reddet
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Column headers */}
              <div className="sourcing-results-headline">
                <span></span>
                <span>Aday</span>
                <span>Uyum</span>
              </div>

              {filteredProspects.length === 0 ? (
                <EmptyState
                  message={
                    activeResultFilterCount > 0
                      ? "Filtreler çok dar kaldı. Birkaç filtreyi kaldırıp listeyi genişletin."
                      : data.discovery.status === "PUBLIC_DISCOVERY_WEAK"
                        ? "Bu rol için public discovery zayıf kaldı. Title varyantlarını genişletin veya import/rediscovery ile destekleyin."
                        : "Henüz gösterilecek prospect yok."
                  }
                />
              ) : (
                <div className="sourcing-result-list compact">
                  {filteredProspects.map((prospect) => (
                    <article
                      key={prospect.id}
                      className={`sourcing-result-row compact${selectedIds.has(prospect.id) ? " selected" : ""}`}
                      onClick={() => setSelectedProspect(prospect)}
                    >
                      <div className="sourcing-result-grid">
                        <div className="sourcing-result-check">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(prospect.id)}
                            onChange={(event) => {
                              event.stopPropagation();
                              setSelectedIds((current) => {
                                const next = new Set(current);
                                if (event.target.checked) {
                                  next.add(prospect.id);
                                } else {
                                  next.delete(prospect.id);
                                }
                                return next;
                              });
                            }}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </div>

                        {/* Main content zone */}
                        <div className="sourcing-result-primary">
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{prospect.fullName}</span>
                            {prospect.currentTitle || prospect.headline ? (
                              <span className="small" style={{ marginLeft: 8 }}>
                                {prospect.currentTitle ?? prospect.headline}
                                {prospect.currentCompany ? ` · ${prospect.currentCompany}` : ""}
                              </span>
                            ) : null}
                          </div>
                          <div className="small" style={{ marginTop: 3, fontSize: 12 }}>
                            {[
                              prospect.locationText,
                              prospect.primarySourceLabel ?? TALENT_SOURCE_LABELS[prospect.sourceKind],
                              prospect.email ? "✉" : null
                            ].filter(Boolean).join(" · ")}
                          </div>
                          {prospect.skills.length > 0 ? (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                              {prospect.skills.slice(0, 4).map((skill) => (
                                <span key={skill} className="sourcing-chip" style={{ padding: "2px 7px", fontSize: 11 }}>
                                  {skill}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {/* Score / status zone */}
                        <div className="sourcing-result-status">
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              color: PROSPECT_FIT_TONES[prospect.fitLabel]
                            }}
                          >
                            {PROSPECT_FIT_LABELS[prospect.fitLabel]}
                          </div>
                          <div className="small" style={{ marginTop: 2 }}>
                            {prospect.fitScore != null ? `${Math.round(prospect.fitScore)} / 100` : "—"}
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <span className="sourcing-chip muted" style={{ padding: "2px 8px", fontSize: 11 }}>
                              {SOURCING_STAGE_META[prospect.stage].label}
                            </span>
                          </div>
                          <div className="small" style={{ marginTop: 4, fontSize: 11 }}>
                            {nextStepLabel(prospect)}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </main>
          </div>

          {/* ── Copilot slide-over drawer ── */}
          <div
            className={`sourcing-copilot-overlay${copilotOpen ? " open" : ""}`}
            onClick={() => setCopilotOpen(false)}
          />
          <aside className={`sourcing-copilot-drawer${copilotOpen ? " open" : ""}`}>
            <div className="section-head" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>AI Yardımcı</h2>
                <p className="small" style={{ marginTop: 4 }}>
                  Öneriler ve rediscovery bilgileri
                </p>
              </div>
              <button type="button" className="ghost-button" onClick={() => setCopilotOpen(false)}>
                Kapat
              </button>
            </div>

            <RailSection title={t("Önerilen adaylar")} defaultOpen badge={`${data.copilot.recommendedCandidates.length}`}>
              <ul className="plain-list">
                {data.copilot.recommendedCandidates.map((candidate) => (
                  <li key={candidate.id} className="list-row" style={{ alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{candidate.fullName}</div>
                      <div className="small">{candidate.reason}</div>
                    </div>
                    <span className="small">{candidate.fitScore ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </RailSection>

            {data.copilot.searchRefinements.length > 0 ? (
              <RailSection title={t("Arama önerileri")} badge={`${data.copilot.searchRefinements.length}`}>
                <ul className="plain-list">
                  {data.copilot.searchRefinements.map((item) => (
                    <li key={item} className="list-row" style={{ alignItems: "flex-start" }}>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </RailSection>
            ) : null}

            {data.copilot.batchSuggestions.length > 0 ? (
              <RailSection title={t("Batch önerileri")} badge={`${data.copilot.batchSuggestions.length}`}>
                <ul className="plain-list">
                  {data.copilot.batchSuggestions.map((item) => (
                    <li key={item} className="list-row" style={{ alignItems: "flex-start" }}>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </RailSection>
            ) : null}

            <RailSection title={t("Rediscovery")} defaultOpen badge={`${data.rediscovery.internalMatches + data.rediscovery.externalMatches}`}>
              <ul className="plain-list">
                <li className="list-row">
                  <span>İç havuz eşleşmesi</span>
                  <strong>{data.rediscovery.internalMatches}</strong>
                </li>
                <li className="list-row">
                  <span>Dış/profesyonel profil</span>
                  <strong>{data.rediscovery.externalMatches}</strong>
                </li>
                <li className="list-row">
                  <span>Akışa bağlanan</span>
                  <strong>{data.rediscovery.existingCandidateLinked}</strong>
                </li>
              </ul>
            </RailSection>
          </aside>

          <ProspectDrawer
            prospect={selectedProspect}
            onClose={() => setSelectedProspect(null)}
            onStageChange={async (stage, note) => {
              if (!selectedProspect) return;
              await handleStageChange(selectedProspect.id, stage, note);
            }}
            onAttach={async () => {
              if (!selectedProspect) return;
              await handleAttach(selectedProspect.id);
            }}
            onComposeOutreach={() => {
              if (!selectedProspect) return;
              setSelectedIds(new Set([selectedProspect.id]));
              setOutreachOpen(true);
            }}
            onSuppressionChange={async (status, reason) => {
              if (!selectedProspect) return;
              await handleSuppression(selectedProspect.profileId, status, reason);
            }}
          />

          <OutreachComposerModal
            open={outreachOpen}
            prospects={selectedProspects}
            templates={data.outreachTemplates}
            onClose={() => setOutreachOpen(false)}
            onSend={handleSendOutreach}
          />
        </>
      ) : null}
    </section>
  );
}
