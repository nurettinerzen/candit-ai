import { ProspectFitLabel, TalentSourceKind } from "@prisma/client";

type JobSignalInput = {
  title: string;
  roleFamily: string;
  locationText: string | null;
  shiftType: string | null;
  requirements: Array<{
    key: string;
    value: string;
    required: boolean;
  }>;
};

type TalentSignalInput = {
  fullName: string;
  headline: string | null;
  summary: string | null;
  locationText: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  yearsOfExperience: number | null;
  workModel: string | null;
  sourceKind: TalentSourceKind;
  skills: string[];
  languages: string[];
  experiences: string[];
  education: string[];
  email: string | null;
  phone: string | null;
};

export type SourcingFitEvaluation = {
  score: number;
  confidence: number;
  label: ProspectFitLabel;
  strengths: string[];
  risks: string[];
  missingInfo: string[];
  evidence: Array<{
    title: string;
    text: string;
    kind: "title" | "skills" | "location" | "experience" | "source";
  }>;
};

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9çğıöşü\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()))];
}

function overlaps(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function labelFromScore(score: number): ProspectFitLabel {
  if (score >= 78) {
    return ProspectFitLabel.STRONG_MATCH;
  }

  if (score >= 60) {
    return ProspectFitLabel.GOOD_MATCH;
  }

  if (score >= 40) {
    return ProspectFitLabel.PARTIAL_MATCH;
  }

  return ProspectFitLabel.WEAK_MATCH;
}

export function extractRequirementKeywords(job: JobSignalInput) {
  return unique([
    job.title,
    job.roleFamily,
    ...job.requirements.flatMap((requirement) => [requirement.key, requirement.value])
  ]).flatMap((value) => tokenize(value));
}

export function buildTalentSignals(input: {
  fullName: string;
  headline?: string | null;
  summary?: string | null;
  locationText?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  yearsOfExperience?: number | null;
  workModel?: string | null;
  sourceKind: TalentSourceKind;
  skills?: string[];
  languages?: string[];
  experiences?: string[];
  education?: string[];
  email?: string | null;
  phone?: string | null;
}): TalentSignalInput {
  return {
    fullName: input.fullName,
    headline: input.headline ?? null,
    summary: input.summary ?? null,
    locationText: input.locationText ?? null,
    currentTitle: input.currentTitle ?? null,
    currentCompany: input.currentCompany ?? null,
    yearsOfExperience: input.yearsOfExperience ?? null,
    workModel: input.workModel ?? null,
    sourceKind: input.sourceKind,
    skills: unique(input.skills ?? []),
    languages: unique(input.languages ?? []),
    experiences: unique(input.experiences ?? []),
    education: unique(input.education ?? []),
    email: input.email ?? null,
    phone: input.phone ?? null
  };
}

export function evaluateSourcingFit(job: JobSignalInput, talent: TalentSignalInput): SourcingFitEvaluation {
  const requirementKeywords = extractRequirementKeywords(job);
  const titleTokens = tokenize(`${talent.currentTitle ?? ""} ${talent.headline ?? ""}`);
  const skillTokens = talent.skills.flatMap((skill) => tokenize(skill));
  const summaryTokens = tokenize(talent.summary ?? "");
  const experienceTokens = talent.experiences.flatMap((item) => tokenize(item));
  const educationTokens = talent.education.flatMap((item) => tokenize(item));
  const locationTokens = tokenize(talent.locationText);
  const jobLocationTokens = tokenize(job.locationText);

  const titleMatches = overlaps(titleTokens, requirementKeywords);
  const skillMatches = overlaps(skillTokens, requirementKeywords);
  const summaryMatches = overlaps(summaryTokens, requirementKeywords);
  const experienceMatches = overlaps(experienceTokens, requirementKeywords);
  const educationMatches = overlaps(educationTokens, requirementKeywords);
  const locationMatches = overlaps(locationTokens, jobLocationTokens);

  let score = 0;
  const strengths: string[] = [];
  const risks: string[] = [];
  const missingInfo: string[] = [];
  const evidence: SourcingFitEvaluation["evidence"] = [];

  if (titleMatches.length > 0) {
    score += 28;
    strengths.push("Güncel rol başlığı aranan role yakın.");
    evidence.push({
      title: "Rol sinyali",
      text: `${talent.currentTitle ?? talent.headline ?? talent.fullName} üzerinden rol uyumu bulundu.`,
      kind: "title"
    });
  } else {
    risks.push("Güncel unvanda doğrudan rol eşleşmesi sınırlı.");
  }

  if (skillMatches.length > 0 || summaryMatches.length > 0) {
    const matched = unique([...skillMatches, ...summaryMatches]).slice(0, 5);
    score += Math.min(30, 10 + matched.length * 4);
    strengths.push(`Temel beceri sinyalleri mevcut: ${matched.join(", ")}.`);
    evidence.push({
      title: "Beceri uyumu",
      text: `${matched.join(", ")} gereksinimleri profilde karşılık buldu.`,
      kind: "skills"
    });
  } else {
    risks.push("İlan gereksinimleri ile eşleşen net beceri sinyali düşük.");
  }

  if (experienceMatches.length > 0) {
    score += 18;
    strengths.push("Deneyim satırlarında role yakın operasyon geçmişi bulunuyor.");
    evidence.push({
      title: "Deneyim kanıtı",
      text: talent.experiences.slice(0, 2).join(" • ") || "Yakın deneyim satırları bulundu.",
      kind: "experience"
    });
  }

  if (locationMatches.length > 0) {
    score += 12;
    strengths.push("Lokasyon sinyali requisition ile uyumlu.");
    evidence.push({
      title: "Lokasyon",
      text: `${talent.locationText ?? "Bilinmiyor"} / ${job.locationText ?? "Esnek"} eşleşmesi bulundu.`,
      kind: "location"
    });
  } else if (job.locationText) {
    risks.push("Lokasyon uyumu teyit gerektiriyor.");
  }

  if (talent.yearsOfExperience != null) {
    if (talent.yearsOfExperience >= 4) {
      score += 10;
      strengths.push("Kıdem seviyesi operasyonel sorumluluk alabilecek görünüyor.");
    } else if (talent.yearsOfExperience >= 2) {
      score += 6;
    } else {
      risks.push("Deneyim yılı düşük olabilir; onboarding ihtiyacı artabilir.");
    }
  } else {
    missingInfo.push("Toplam deneyim yılı net değil.");
  }

  if (!talent.email && !talent.phone) {
    missingInfo.push("İletişim bilgisi yok.");
  }

  if (!talent.locationText) {
    missingInfo.push("Lokasyon bilgisi eksik.");
  }

  if (educationMatches.length > 0) {
    score += 4;
  }

  if (talent.sourceKind === TalentSourceKind.INTERNAL_CANDIDATE) {
    evidence.push({
      title: "İç havuz",
      text: "Profil mevcut aday havuzundan rediscovery ile geldi.",
      kind: "source"
    });
  } else if (talent.sourceKind === TalentSourceKind.PUBLIC_PROFESSIONAL) {
    evidence.push({
      title: "Profesyonel kamuya açık profil",
      text: "Profil izinli/kamuya açık profesyonel kaynaklardan sisteme işlendi.",
      kind: "source"
    });
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const confidenceBase =
    (strengths.length >= 3 ? 0.78 : strengths.length === 2 ? 0.68 : 0.56) -
    (missingInfo.length > 0 ? 0.08 : 0) -
    (risks.length > 2 ? 0.05 : 0);
  const confidence = Math.max(0.35, Math.min(0.92, Number(confidenceBase.toFixed(2))));

  return {
    score: boundedScore,
    confidence,
    label: labelFromScore(boundedScore),
    strengths: unique(strengths).slice(0, 4),
    risks: unique(risks).slice(0, 4),
    missingInfo: unique(missingInfo).slice(0, 4),
    evidence: evidence.slice(0, 5)
  };
}

export function fitEvaluationToJson(evaluation: SourcingFitEvaluation) {
  return evaluation.evidence.map((item) => ({
    title: item.title,
    text: item.text,
    kind: item.kind
  }));
}
