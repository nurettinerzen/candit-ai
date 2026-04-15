export type InterviewReadinessReply = "confirmed" | "not_ready" | "unclear";

const INTERVIEW_OPENING_PROMPT =
  "Merhaba, ben şirketimizin yapay zeka destekli mülakat asistanıyım. Bu görüşmede başvurunuz ve deneyiminizle ilgili kısa sorular soracağım. Görüşmemiz kalite standartları gereği kayıt altına alınmaktadır ve kişisel verileriniz KVKK kapsamındaki süreçler doğrultusunda işlenmektedir. Görüşme tamamlandıktan sonra şirket ekibimiz değerlendirmeyi yaparak sizinle sonraki adımlar hakkında iletişime geçecektir. Hazırsanız başlayabiliriz. Başlamak için lütfen 'hazırım' ya da 'devam edebiliriz' diyebilirsiniz.";

const INTERVIEW_READYNESS_CLARIFY_PROMPT =
  "Hazırsanız başlayabiliriz. Başlamak için lütfen 'hazırım' ya da 'devam edebiliriz' diyebilirsiniz.";

const INTERVIEW_NOT_READY_PROMPT =
  "Elbette. Hazır olduğunuzda aynı görüşme bağlantısından tekrar girip 'hazırım' ya da 'devam edebiliriz' diyebilirsiniz.";

const INTERVIEW_FIRST_QUESTION_PREFIX = "Teşekkür ederim. İlk sorum şu:";

export function buildInterviewOpeningPrompt() {
  return INTERVIEW_OPENING_PROMPT;
}

export function buildInterviewReadinessReprompt(
  reason: Exclude<InterviewReadinessReply, "confirmed">
) {
  return reason === "not_ready"
    ? INTERVIEW_NOT_READY_PROMPT
    : INTERVIEW_READYNESS_CLARIFY_PROMPT;
}

export function buildInterviewFirstQuestionPrompt(question: string) {
  const trimmedQuestion = question.trim();
  return trimmedQuestion
    ? `${INTERVIEW_FIRST_QUESTION_PREFIX} ${trimmedQuestion}`.trim()
    : INTERVIEW_FIRST_QUESTION_PREFIX;
}

export function classifyInterviewReadinessReply(input: string): InterviewReadinessReply {
  const normalized = input
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "unclear";
  }

  const negativeMatchers = [
    "hazir degilim",
    "hazır değilim",
    "simdi degil",
    "şimdi değil",
    "daha sonra",
    "bekleyin",
    "istemiyorum",
    "hayir",
    "hayır",
    "olmaz"
  ];

  if (negativeMatchers.some((phrase) => normalized.includes(phrase))) {
    return "not_ready";
  }

  const positiveMatchers = [
    "hazirim",
    "hazırım",
    "evet",
    "tamam",
    "olur",
    "baslayabiliriz",
    "başlayabiliriz",
    "devam edebiliriz",
    "uygunum",
    "haziriz",
    "hazırız"
  ];

  if (positiveMatchers.some((phrase) => normalized.includes(phrase))) {
    return "confirmed";
  }

  return "unclear";
}
