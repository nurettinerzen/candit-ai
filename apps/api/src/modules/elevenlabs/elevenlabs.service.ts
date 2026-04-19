import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { InterviewsService } from "../interviews/interviews.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { ChatCompletionMessage, SessionMeta } from "./dto/chat-completion.dto";
import { deriveInterviewInvitationState } from "../interviews/interview-invitation-state.util";
import { buildInterviewOpeningPrompt } from "../interviews/interview-opening.util";

/**
 * Bridge between ElevenLabs Conversational AI and the existing InterviewsService.
 *
 * ElevenLabs sends OpenAI-compatible chat completion requests.
 * This service extracts session context, delegates to the interview engine,
 * and returns the next prompt text for ElevenLabs to synthesize as speech.
 */
@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);

  constructor(
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService,
    @Inject(InterviewsService) private readonly interviewsService: InterviewsService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  /**
   * Parse [SESSION_META:sessionId=...,token=...] from the system message.
   */
  parseSessionMeta(messages: ChatCompletionMessage[]): SessionMeta | null {
    const systemMessage = messages.find((m) => m.role === "system");
    if (!systemMessage) return null;

    const match = systemMessage.content.match(
      /\[SESSION_META:sessionId=([^,\]]+),token=([^\]]+)\]/
    );
    if (!match) return null;

    return { sessionId: match[1] ?? "", token: match[2] ?? "" };
  }

  /**
   * Extract the candidate's latest answer from the messages array.
   * The last "user" message is the candidate's most recent transcribed speech.
   */
  extractCandidateAnswer(messages: ChatCompletionMessage[]): string | null {
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) return null;

    const lastUserMessage = userMessages[userMessages.length - 1] as ChatCompletionMessage | undefined;
    const text = lastUserMessage?.content?.trim();
    return text && text.length > 0 ? text : null;
  }

  /**
   * Count how many user messages have been processed.
   * Used for idempotency — avoid reprocessing the same answer.
   */
  countUserMessages(messages: ChatCompletionMessage[]): number {
    return messages.filter((m) => m.role === "user").length;
  }

  /**
   * Process a conversation turn from ElevenLabs.
   *
   * Flow:
   * 1. Parse session metadata from system message
   * 2. Extract candidate's latest answer
   * 3. If first call (no user messages): start session, return first question
   * 4. If has answer: submit via InterviewsService, get next prompt
   * 5. If session completed: return closing message
   *
   * Returns the text that ElevenLabs should speak next.
   */
  async processConversationTurn(messages: ChatCompletionMessage[]): Promise<{
    text: string;
    sessionComplete: boolean;
    progress?: { answered: number; total: number };
  }> {
    const meta = this.parseSessionMeta(messages);
    if (!meta) {
      this.logger.error("ElevenLabs request missing SESSION_META in system message");
      return {
        text: "Bir teknik sorun olustu. Lutfen sayfayi yenileyip tekrar deneyin.",
        sessionComplete: false
      };
    }

    const traceId = `elevenlabs_${Date.now()}`;
    const candidateAnswer = this.extractCandidateAnswer(messages);

    try {
      // If no user messages yet, this is the initial call — start the session
      if (!candidateAnswer) {
        const view = await this.interviewsService.startPublicSession({
          sessionId: meta.sessionId,
          accessToken: meta.token,
          capabilities: { speechRecognition: true, speechSynthesis: true },
          traceId
        });

        // Update session with ElevenLabs metadata
        await this.prisma.interviewSession.update({
          where: { id: meta.sessionId },
          data: {
            runtimeProviderMode: "elevenlabs_conversational_ai",
            voiceInputProvider: "elevenlabs_stt",
            voiceOutputProvider: "elevenlabs_tts"
          }
        });

        const promptText =
          view.activePrompt?.kind === "READINESS"
            ? ""
            : view.activePrompt?.text ?? buildInterviewOpeningPrompt();
        return {
          text: promptText,
          sessionComplete: false,
          progress: view.progress
            ? { answered: view.progress.answeredBlocks, total: view.progress.totalBlocks }
            : undefined
        };
      }

      // Submit the candidate's answer and get next prompt
      const view = await this.interviewsService.submitPublicAnswer({
        sessionId: meta.sessionId,
        accessToken: meta.token,
        transcriptText: candidateAnswer,
        answerSource: "voice_provider",
        traceId
      });

      if (view.status === "COMPLETED" || view.status === "FAILED" || view.status === "CANCELLED") {
        const closingText =
          view.activePrompt?.text ??
          "Tesekkur ederim. Gorusme kaydınız recruiter ekibine iletilecek. Iyi gunler.";
        return {
          text: closingText + " [SESSION_COMPLETE]",
          sessionComplete: true,
          progress: view.progress
            ? { answered: view.progress.answeredBlocks, total: view.progress.totalBlocks }
            : undefined
        };
      }

      const nextPrompt = view.activePrompt?.text ?? "Devam edelim.";
      return {
        text: nextPrompt,
        sessionComplete: false,
        progress: view.progress
          ? { answered: view.progress.answeredBlocks, total: view.progress.totalBlocks }
          : undefined
      };
    } catch (error) {
      this.logger.error(
        `ElevenLabs conversation turn failed: session=${meta.sessionId}`,
        error instanceof Error ? error.stack : error
      );

      if (error instanceof NotFoundException) {
        return {
          text: "Gorusme oturumu bulunamadi. Lutfen linkinizi kontrol edin.",
          sessionComplete: true
        };
      }

      return {
        text: "Bir teknik sorun olustu. Lutfen bekleyin, kisa surede devam edecegiz.",
        sessionComplete: false
      };
    }
  }

  /**
   * Generate a signed conversation URL from ElevenLabs API.
   * This URL allows the frontend to connect via WebRTC without exposing the API key.
   */
  async createSignedConversationUrl(input: {
    sessionId: string;
    accessToken: string;
    consentAccepted?: boolean;
    traceId?: string;
  }): Promise<{
    signedUrl: string;
    agentId: string;
    systemPrompt: string;
    firstMessage: string;
    dynamicVariables: Record<string, string | number | boolean>;
    contextualUpdate: string;
  }> {
    const config = this.runtimeConfig.elevenLabsConfig;

    if (!config.apiKey || !config.agentId) {
      throw new NotFoundException(
        "ElevenLabs yapılandırılmamış. ELEVENLABS_API_KEY ve ELEVENLABS_AGENT_ID gerekli."
      );
    }

    // Verify session is valid before creating conversation
    const session = await this.prisma.interviewSession.findFirst({
      where: { id: input.sessionId, candidateAccessToken: input.accessToken },
      include: {
        template: true,
        turns: {
          orderBy: {
            sequenceNo: "asc"
          },
          take: 10
        },
        application: {
          include: {
            candidate: { select: { fullName: true } },
            job: { select: { title: true, roleFamily: true } }
          }
        }
      }
    });

    if (!session) {
      throw new NotFoundException("Görüşme oturumu bulunamadı.");
    }

    const invitation = deriveInterviewInvitationState(session);
    if (
      session.status === "COMPLETED" ||
      session.status === "FAILED" ||
      session.status === "CANCELLED" ||
      session.status === "NO_SHOW" ||
      invitation?.expired
    ) {
      throw new NotFoundException("Görüşme bağlantısı artık aktif değil.");
    }

    // Build session metadata for the system prompt
    const sessionMeta = `[SESSION_META:sessionId=${session.id},token=${input.accessToken}]`;

    // Parse template for context
    let templateInfo = "";
    let questionPack = "";
    try {
      const tmpl = session.template.templateJson as Record<string, unknown>;
      const blocks = Array.isArray(tmpl.blocks) ? tmpl.blocks : [];
      templateInfo = `Bu gorusmede ${blocks.length} ana soru var.`;
      questionPack = blocks
        .map((block, index) => {
          const row = block && typeof block === "object" ? (block as Record<string, unknown>) : {};
          const prompt =
            typeof row.prompt === "string"
              ? row.prompt
              : typeof row.text === "string"
                ? row.text
                : "";

          return prompt.trim().length > 0 ? `${index + 1}. ${prompt.trim()}` : "";
        })
        .filter(Boolean)
        .join("\n");
    } catch {
      templateInfo = "";
      questionPack = "";
    }

    const startedView = await this.interviewsService.startPublicSession({
      sessionId: input.sessionId,
      accessToken: input.accessToken,
      consentAccepted: input.consentAccepted,
      capabilities: {
        speechRecognition: true,
        speechSynthesis: true,
        locale: session.candidateLocale
      },
      traceId: input.traceId
    });

    const firstMessage =
      session.status === "SCHEDULED" && startedView.activePrompt?.kind === "READINESS"
        ? startedView.activePrompt.text
        : "";

    const systemPrompt = [
      "Sen sirketimizin yapay zeka destekli ilk mulakat asistanisin. Turkce konus.",
      "Asla kendini insan ismiyle tanitma.",
      "Adaya olumlu sonuc, ilerleme veya ise alinma garantisi verme.",
      "Ilk acilista adayin hazir oldugunu teyit etmeden ilk mulakat sorusuna gecme.",
      "Aday hazir oldugunu soylediginde gorusmeye tek bir soruyla basla ve her adimda yalnizca bir soru sor.",
      `Aday: ${session.application.candidate.fullName}`,
      `Pozisyon: ${session.application.job.title}`,
      templateInfo,
      "Sorulari arka uctan alacaksin. Adayin yanitlarini degerlendirmek icin arka uca ileteceksin.",
      "Sorulari aynen sor, kendi yorumlarini ekleme.",
      "Arka uctan gelmeyen yeni soru veya gereksiz yorum uretme.",
      "Adayin yanitini tam dinle, araya girme ve gereksiz bekleme yaratma.",
      "Cevaplardan sonra 'anliyorum', 'evet', 'hmm', 'tamam' gibi dolgu kelimeleriyle baslama. Ya tam ve akici bir gecis kur ya da dogrudan sonraki soruya gec.",
      "ONEMLI: Parantez icindeki yonergeleri (ornegin '(sicak bir sekilde)', '(merakla)' gibi) ASLA sesli okuma.",
      "Gorusme tamamlandiginda kisa ve net bir kapanis yap: Bu gorusmenin sirket ekibi tarafindan incelenecegini, olumlu olursa insan yonetimli bir sonraki mulakat icin iletisime gecilecegini belirt.",
      sessionMeta
    ]
      .filter(Boolean)
      .join("\n");

    const dynamicVariables = {
      candidate_name: session.application.candidate.fullName,
      job_title: session.application.job.title,
      interview_question_pack: questionPack || "Varsayilan soru akisini uygula.",
      interview_question_count: questionPack ? questionPack.split("\n").length : 0
    } satisfies Record<string, string | number | boolean>;

    const contextualUpdate = questionPack
      ? `Bu görüşmede öncelik verilecek ana soru başlıkları şunlardır:\n${questionPack}\nBu sırayı görüşmenin ana iskeleti olarak kullan. Gerekirse kısa takip soruları sor ama listedeki kapsamı koru.`
      : "Varsayılan soru akışını kullan ve görüşmeyi tek tek sorularla doğal biçimde ilerlet.";

    // Request signed URL from ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${config.agentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": config.apiKey
        }
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `ElevenLabs signed URL request failed: ${response.status} ${errorBody.slice(0, 300)}`
      );
      throw new Error("ElevenLabs baglanti URL'si alinamadi.");
    }

    const data = (await response.json()) as Record<string, unknown>;
    const signedUrl = typeof data.signed_url === "string" ? data.signed_url : undefined;

    if (!signedUrl) {
      throw new Error("ElevenLabs signed_url bos dondu.");
    }

    await this.prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        elevenLabsAgentId: config.agentId,
        runtimeProviderMode: "elevenlabs_conversational_ai",
        voiceInputProvider: "elevenlabs_stt",
        voiceOutputProvider: "elevenlabs_tts",
        lastCandidateActivityAt: new Date()
      }
    });

    this.logger.log(
      `ElevenLabs signed URL created: session=${session.id}, agent=${config.agentId}`
    );

    return {
      signedUrl,
      agentId: config.agentId,
      systemPrompt,
      firstMessage,
      dynamicVariables,
      contextualUpdate
    };
  }
}
