import assert from "node:assert/strict";
import test from "node:test";
import { ReportGenerationTaskService } from "./report-generation-task.service.js";
import type { EvidenceLink, StructuredTaskSections } from "./task-output.utils.js";

function createSections(evidenceLinks: EvidenceLink[]): StructuredTaskSections {
  return {
    facts: ["Aday müşteri iletişim deneyiminden bahsetti."],
    interpretation: ["Yanıtlar genel olarak anlaşılırdı."],
    interviewSummary: "Ön görüşme kısa ama akıcı ilerledi.",
    strengths: ["İletişim dili net."],
    weaknesses: ["Detay seviyesi sınırlı."],
    recommendationSummary: "Recruiter değerlendirmesi gerekir.",
    recommendationAction: "Follow-up soruları ile teyit et.",
    recommendedOutcome: "HOLD",
    flags: [],
    missingInformation: [],
    evidenceLinks,
    confidence: 0.61,
    uncertaintyReasons: []
  };
}

test("enforceMinimumEvidenceLinks supplements report evidence up to the minimum threshold", () => {
  const service = new ReportGenerationTaskService({} as never, {} as never, {} as never);

  const sections = createSections([
    {
      sourceType: "transcript_segment",
      sourceRef: "seg_1",
      claim: "Aday yoğun çağrı hacmi yönettiğini söyledi."
    }
  ]);

  const fallbackEvidence: EvidenceLink[] = [
    {
      sourceType: "application",
      sourceRef: "app_1",
      claim: "Rapor application bağlamında üretildi."
    },
    {
      sourceType: "interview_session",
      sourceRef: "sess_1",
      claim: "Rapor interview session transcriptine dayandırıldı."
    }
  ];

  const result = (service as any).enforceMinimumEvidenceLinks(sections, fallbackEvidence);

  assert.equal(result.evidenceLinks.length >= 2, true);
  assert.equal(
    result.flags.some((flag: { code: string }) => flag.code === "EVIDENCE_MINIMUM_ENFORCED"),
    true
  );
});

test("enforceMinimumEvidenceLinks marks the report when minimum evidence still cannot be met", () => {
  const service = new ReportGenerationTaskService({} as never, {} as never, {} as never);
  const result = (service as any).enforceMinimumEvidenceLinks(createSections([]), []);

  assert.equal(result.evidenceLinks.length, 0);
  assert.equal(
    result.flags.some((flag: { code: string }) => flag.code === "EVIDENCE_INSUFFICIENT"),
    true
  );
  assert.equal(result.missingInformation.includes("minimum_evidence_validation"), true);
});

test("sanitizeReportSections strips context leakage and rewrites low-signal summaries", () => {
  const service = new ReportGenerationTaskService({} as never, {} as never, {} as never);

  const result = (service as any).sanitizeReportSections({
    facts: [
      "CV ozeti: adayin 6 yil deneyimi var.",
      "Mevcut fit score baglami: 88/100",
      "Aday musteri itirazlarini sakin sekilde yonettigini anlatti."
    ],
    interpretation: [
      "Aday musteri itirazlarini sakin sekilde yonettigini anlatti.",
      "Profil ozeti guclu."
    ],
    interviewSummary: "Aday musteri itirazlarini sakin sekilde yonettigini anlatti.",
    strengths: [
      "Ozgecmise gore liderlik gecmisi var.",
      "Sakin ve cozum odakli ornekler verdi."
    ],
    weaknesses: ["Rol sahipligi ornekleri yuzeysel kaldi."],
    recommendationSummary: "Aday musteri itirazlarini sakin sekilde yonettigini anlatti.",
    recommendationAction: "Follow-up sorulari sor.",
    recommendedOutcome: "HOLD",
    flags: [
      {
        code: "RISK",
        severity: "medium",
        note: "Rol sahipligi ornekleri yuzeysel kaldi."
      }
    ],
    missingInformation: [
      "Rol sahipligi ornekleri yuzeysel kaldi.",
      "Karar oncesi daha net execution ornegi alin."
    ],
    evidenceLinks: [],
    confidence: 0.62,
    uncertaintyReasons: []
  });

  assert.equal(
    result.facts.some((line: string) => /cv ozeti|fit score/i.test(line)),
    false
  );
  assert.equal(
    result.interpretation.some((line: string) => /profil ozeti/i.test(line)),
    false
  );
  assert.equal(
    result.strengths.some((line: string) => /ozgecmis|liderlik gecmisi/i.test(line)),
    false
  );
  assert.equal(result.missingInformation.includes("Rol sahipligi ornekleri yuzeysel kaldi."), false);
  assert.notEqual(
    result.recommendationSummary,
    "Aday musteri itirazlarini sakin sekilde yonettigini anlatti."
  );
  assert.match(result.recommendationSummary, /(follow-up|teyit|inceleme)/i);
});
