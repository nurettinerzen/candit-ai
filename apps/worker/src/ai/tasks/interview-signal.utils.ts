import type { TranscriptSegment } from "@prisma/client";

type Severity = "low" | "medium" | "high";

export type InterviewQualityFlag = {
  code: string;
  severity: Severity;
  note: string;
};

export type InterviewTranscriptSignals = {
  candidateSegmentCount: number;
  candidateWordCount: number;
  averageWordsPerAnswer: number;
  shortAnswerCount: number;
  evasiveAnswerCount: number;
  lowSignalRatio: number;
  severity: Severity;
  shouldBlockAdvance: boolean;
  maxRecommendation: "ADVANCE" | "HOLD" | "REVIEW";
  maxConfidence: number;
  interviewSummary: string;
  strengths: string[];
  weaknesses: string[];
  missingInformation: string[];
  flags: InterviewQualityFlag[];
  evidenceSegmentIds: string[];
};

const EVASIVE_PATTERNS = [
  /\bbilmiyorum\b/i,
  /\bhat[ıi]rlam[ıi]yorum\b/i,
  /\btak[ıi]ld[ıi]m\b/i,
  /\bsorumlulu[gğ]um yoktu\b/i,
  /\bherhangi bir sorumlulu[gğ]um yoktu\b/i,
  /\bgenel tak[ıi]l[ıi]yordum\b/i,
  /\bba[sş]ka bir [sş]ey yapmad[ıi]m\b/i,
  /\b[oö]yle\b/i,
  /\byoktu ya\b/i,
  /\bpek bilmiyorum\b/i,
  /\bfark etmez\b/i
] as const;

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return 0;
  }

  return normalized.split(" ").filter(Boolean).length;
}

function isEvasive(text: string) {
  return EVASIVE_PATTERNS.some((pattern) => pattern.test(text));
}

export function analyzeInterviewTranscript(
  transcriptSegments: TranscriptSegment[]
): InterviewTranscriptSignals {
  const candidateSegments = transcriptSegments.filter(
    (segment) => segment.speaker === "CANDIDATE" && segment.text.trim().length > 0
  );
  const candidateWordCounts = candidateSegments.map((segment) => countWords(segment.text));
  const candidateWordCount = candidateWordCounts.reduce((total, value) => total + value, 0);
  const shortAnswerCount = candidateWordCounts.filter((count) => count > 0 && count <= 6).length;
  const evasiveSegments = candidateSegments.filter((segment) => isEvasive(segment.text));
  const evasiveAnswerCount = evasiveSegments.length;
  const candidateSegmentCount = candidateSegments.length;
  const lowSignalRatio =
    candidateSegmentCount > 0 ? (shortAnswerCount + evasiveAnswerCount) / candidateSegmentCount : 1;
  const averageWordsPerAnswer =
    candidateSegmentCount > 0 ? candidateWordCount / candidateSegmentCount : 0;

  const severity: Severity =
    candidateSegmentCount === 0
      ? "high"
      : lowSignalRatio >= 0.8 || averageWordsPerAnswer < 7
        ? "high"
        : lowSignalRatio >= 0.45 || averageWordsPerAnswer < 14
          ? "medium"
          : "low";

  const shouldBlockAdvance = severity === "high";
  const maxRecommendation = severity === "high" ? "REVIEW" : severity === "medium" ? "HOLD" : "ADVANCE";
  const maxConfidence = severity === "high" ? 0.42 : severity === "medium" ? 0.64 : 0.9;

  const strengths =
    severity === "low"
      ? [
          "Aday sorulara yeterli detay vererek deneyimini anlaşılır biçimde aktardı.",
          "Yanıtlar mülakat akışına uyumlu kaldı ve görev bağlamıyla ilişki kurdu."
        ]
      : [];

  const weaknesses =
    severity === "high"
      ? [
          "Yanıtlar oldukça genel kaldığı için adayın gerçek sorumluluk alanı netleşmedi.",
          "Somut örnekler, sahiplik ve iş sonuçları yeterince desteklenmedi."
        ]
      : severity === "medium"
        ? [
            "Bazı yanıtlar yüzeysel kaldığı için deneyim derinliği için ek teyit gerekiyor."
          ]
        : [];

  const missingInformation =
    severity === "high"
      ? [
          "Son roldeki somut sorumluluklar",
          "Günlük operasyon sahipliği",
          "Ölçülebilir sonuç veya katkılar"
        ]
      : severity === "medium"
        ? ["Rol sahipliği ve sonuç odaklı örnekler"]
        : [];

  const flags: InterviewQualityFlag[] = [];

  if (candidateSegmentCount === 0) {
    flags.push({
      code: "INTERVIEW_NO_CANDIDATE_ANSWER",
      severity: "high",
      note: "Bu oturumda karar vermeye yetecek aday cevabı oluşmadı."
    });
  }

  if (evasiveAnswerCount > 0) {
    flags.push({
      code: "INTERVIEW_EVASIVE_ANSWERS",
      severity: severity === "high" ? "high" : "medium",
      note: "Aday sorulara net ve sahiplenici yanıtlar veremedi; deneyim derinliği bu oturumda doğrulanamadı."
    });
  }

  if (shortAnswerCount >= 2) {
    flags.push({
      code: "INTERVIEW_LOW_DETAIL",
      severity: severity === "high" ? "high" : "medium",
      note: "Yanıtların büyük bölümü genel kaldı; görev kapsamı ve somut katkılar netleşmedi."
    });
  }

  const interviewSummary =
    candidateSegmentCount === 0
      ? "Mülakatta adaya ait anlamlı cevap kaydı oluşmadığı için bu oturum tek başına karar vermek için yeterli değil."
      : severity === "high"
        ? "Mülakat performansı zayıf. Aday verdiği cevaplarda görev sahipliği, sorumluluk ve somut örnekleri netleştiremedi; bu oturum tek başına ilerletme desteği vermiyor."
        : severity === "medium"
          ? "Mülakat kısmi bilgi verdi ancak cevapların bir bölümü yüzeysel kaldı. İlerleme kararı öncesinde hedefli follow-up veya insan görüşmesi gerekli."
          : "Mülakat cevapları genel olarak yeterli ayrıntıyı sundu ve role uygunluğu destekleyen kanıtlar üretti.";

  return {
    candidateSegmentCount,
    candidateWordCount,
    averageWordsPerAnswer,
    shortAnswerCount,
    evasiveAnswerCount,
    lowSignalRatio,
    severity,
    shouldBlockAdvance,
    maxRecommendation,
    maxConfidence,
    interviewSummary,
    strengths,
    weaknesses,
    missingInformation,
    flags,
    evidenceSegmentIds: evasiveSegments.map((segment) => segment.id).slice(0, 3)
  };
}
