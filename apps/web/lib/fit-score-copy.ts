import type { SiteLocale } from "./i18n";

export function getFitScoreCopy(locale: SiteLocale) {
  return locale === "en"
    ? {
        informational: "Informational",
        noCategoryReason: "No additional explanation for this category.",
        informationalReason:
          "This sub-score is not included in the overall fit score; it provides extra context for the recruiter decision.",
        confidenceHigh: "AI is confident in this assessment",
        confidenceMedium: "AI has medium confidence",
        confidenceLow: "AI is not confident in this assessment; review carefully",
        overallScore: "Overall Fit Score",
        confidenceLabel: "Assessment Confidence",
        informationalNote:
          "Some sub-scores are informational. Fields such as location and work model are not added directly to the overall fit score; they are shown separately to support recruiter judgment.",
        detailedScores: "Detailed Scores",
        strengths: "Strengths",
        risks: "Warnings",
        missingInfo: "Missing Information",
        reasoning: "AI Explanation",
        whyScore: "Why this score?",
        scoreIntro: "This candidate scored",
        scoreSuffix: "points.",
        strengthsDetected: "strengths were detected for this candidate.",
        risksDetected: "warnings need attention.",
        missingDetected: "missing information items can be completed with follow-up questions.",
        reviewDetails: "Review the sections above for details."
      }
    : {
        informational: "Bilgilendirici",
        noCategoryReason: "Bu kategori için ek açıklama yok.",
        informationalReason:
          "Bu alt skor genel uyum skoruna dahil edilmez; recruiter kararı için ek bağlam sağlar.",
        confidenceHigh: "AI bu değerlendirmeden emin",
        confidenceMedium: "AI orta düzeyde emin",
        confidenceLow: "AI bu değerlendirmeden emin değil; dikkatli inceleyin",
        overallScore: "Genel Uyum Skoru",
        confidenceLabel: "Değerlendirme Güvenilirliği",
        informationalNote:
          "Bazı alt skorlar bilgilendiricidir. Özellikle lokasyon ve çalışma modeli gibi alanlar genel uyum skoruna doğrudan eklenmez; recruiter kararına bağlam sağlamak için ayrı gösterilir.",
        detailedScores: "Detaylı Skorlar",
        strengths: "Güçlü Yönler",
        risks: "Uyarılar",
        missingInfo: "Eksik Bilgiler",
        reasoning: "AI Açıklaması",
        whyScore: "Neden bu skor?",
        scoreIntro: "Bu aday",
        scoreSuffix: "puan aldı.",
        strengthsDetected: "güçlü yönü tespit edildi.",
        risksDetected: "dikkat edilmesi gereken uyarı bulunuyor.",
        missingDetected: "eksik bilgi mevcut; bunlar takip sorularıyla tamamlanabilir.",
        reviewDetails: "Detaylar için yukarıdaki bölümleri inceleyin."
      };
}

export type FitScoreCopy = ReturnType<typeof getFitScoreCopy>;
