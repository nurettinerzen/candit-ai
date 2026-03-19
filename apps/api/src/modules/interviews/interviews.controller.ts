import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query
, Inject} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";
import type { IntegrationProvider } from "@prisma/client";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { InterviewsService } from "./interviews.service";

const INTERVIEW_MODES = ["MEETING_LINK", "PHONE", "ONSITE", "VOICE", "VIDEO"] as const;
const TRANSCRIPT_SPEAKERS = ["AI", "CANDIDATE", "RECRUITER"] as const;
const INTERVIEW_STATUSES = [
  "SCHEDULED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "NO_SHOW",
  "CANCELLED"
] as const;
const MEETING_PROVIDERS = [
  "CALENDLY",
  "GOOGLE_CALENDAR",
  "MICROSOFT_CALENDAR",
  "ZOOM",
  "GOOGLE_MEET"
] as const;

class ScheduleInterviewSessionBody {
  @IsString()
  applicationId!: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsIn(INTERVIEW_MODES)
  mode!: (typeof INTERVIEW_MODES)[number];

  @IsISO8601()
  scheduledAt!: string;

  @IsString()
  @IsOptional()
  interviewerName?: string;

  @IsString()
  @IsOptional()
  interviewerUserId?: string;

  @IsString()
  @IsOptional()
  interviewType?: string;

  @IsString()
  @IsOptional()
  scheduleNote?: string;

  @IsObject()
  @IsOptional()
  modeContext?: Record<string, unknown>;

  @IsIn(MEETING_PROVIDERS)
  @IsOptional()
  preferredProvider?: IntegrationProvider;
}

class RescheduleInterviewSessionBody {
  @IsISO8601()
  scheduledAt!: string;

  @IsString()
  @IsOptional()
  reasonCode?: string;

  @IsString()
  @IsOptional()
  scheduleNote?: string;

  @IsObject()
  @IsOptional()
  modeContext?: Record<string, unknown>;

  @IsIn(MEETING_PROVIDERS)
  @IsOptional()
  preferredProvider?: IntegrationProvider;
}

class TranscriptSegmentBody {
  @IsIn(TRANSCRIPT_SPEAKERS)
  speaker!: (typeof TRANSCRIPT_SPEAKERS)[number];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  startMs!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  endMs!: number;

  @IsString()
  text!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  confidence?: number;

  @IsString()
  @IsOptional()
  sttModel?: string;

  @IsString()
  @IsOptional()
  language?: string;
}

class TranscriptImportBody {
  @IsString()
  transcriptText!: string;

  @IsIn(TRANSCRIPT_SPEAKERS)
  @IsOptional()
  defaultSpeaker?: (typeof TRANSCRIPT_SPEAKERS)[number];

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  sttModel?: string;

  @IsBoolean()
  @IsOptional()
  replaceExisting?: boolean;
}

class CompleteSessionBody {
  @IsBoolean()
  @IsOptional()
  triggerAiReviewPack?: boolean;
}

class ReviewPackBody {
  @IsString()
  @IsOptional()
  providerKey?: string;
}

class CancelSessionBody {
  @IsString()
  @IsOptional()
  reasonCode?: string;
}

class TranscriptQualityReviewBody {
  @IsIn(["REVIEW_REQUIRED", "VERIFIED"])
  qualityStatus!: "REVIEW_REQUIRED" | "VERIFIED";

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  qualityScore?: number;

  @IsString()
  @IsOptional()
  reviewNotes?: string;
}

class InterviewListQuery {
  @IsString()
  @IsOptional()
  applicationId?: string;

  @IsIn(INTERVIEW_STATUSES)
  @IsOptional()
  status?: (typeof INTERVIEW_STATUSES)[number];
}

class InterviewTemplateListQuery {
  @IsString()
  @IsOptional()
  roleFamily?: string;
}

class PublicInterviewSessionQuery {
  @IsString()
  token!: string;
}

class PublicSessionCapabilitiesBody {
  @IsBoolean()
  @IsOptional()
  speechRecognition?: boolean;

  @IsBoolean()
  @IsOptional()
  speechSynthesis?: boolean;

  @IsString()
  @IsOptional()
  locale?: string;
}

class PublicStartBody {
  @IsString()
  token!: string;

  @IsObject()
  @IsOptional()
  capabilities?: PublicSessionCapabilitiesBody;
}

class PublicAnswerBody {
  @IsString()
  token!: string;

  @IsString()
  transcriptText!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  confidence?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  speechLatencyMs?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  speechDurationMs?: number;

  @IsIn(["voice_browser", "manual_text", "voice_provider"])
  @IsOptional()
  answerSource?: "voice_browser" | "manual_text" | "voice_provider";

  @IsString()
  @IsOptional()
  locale?: string;
}

class PublicRepeatBody {
  @IsString()
  token!: string;
}

class PublicAudioAnswerBody {
  @IsString()
  token!: string;

  @IsString()
  audioBase64!: string;

  @IsString()
  mimeType!: string;

  @IsString()
  @IsOptional()
  locale?: string;
}

class PublicAbandonBody {
  @IsString()
  token!: string;

  @IsString()
  @IsOptional()
  reasonCode?: string;
}

@Controller("interviews")
export class InterviewsController {
  constructor(@Inject(InterviewsService) private readonly interviewsService: InterviewsService) {}

  @Get("templates")
  @Permissions("interview.read")
  listTemplates(
    @CurrentTenant() tenantId: string,
    @Query() query: InterviewTemplateListQuery
  ) {
    return this.interviewsService.listTemplates(tenantId, query.roleFamily);
  }

  @Get("scheduling/providers")
  @Permissions("interview.schedule")
  listSchedulingProviders(@CurrentTenant() tenantId: string) {
    return this.interviewsService.listSchedulingProviders(tenantId);
  }

  @Get("sessions")
  @Permissions("interview.read")
  list(@CurrentTenant() tenantId: string, @Query() query: InterviewListQuery) {
    return this.interviewsService.listSessions(tenantId, {
      applicationId: query.applicationId,
      status: query.status
    });
  }

  @Get("sessions/:id")
  @Permissions("interview.read")
  getById(@CurrentTenant() tenantId: string, @Param("id") sessionId: string) {
    return this.interviewsService.getById(tenantId, sessionId);
  }

  @Get("sessions/:id/timeline")
  @Permissions("interview.read")
  getTimeline(@CurrentTenant() tenantId: string, @Param("id") sessionId: string) {
    return this.interviewsService.timeline(tenantId, sessionId);
  }

  @Post("sessions")
  @Permissions("interview.schedule")
  schedule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: ScheduleInterviewSessionBody
  ) {
    return this.interviewsService.schedule({
      tenantId,
      applicationId: body.applicationId,
      templateId: body.templateId,
      mode: body.mode,
      scheduledAt: body.scheduledAt,
      interviewerName: body.interviewerName,
      interviewerUserId: body.interviewerUserId,
      interviewType: body.interviewType,
      scheduleNote: body.scheduleNote,
      modeContext: body.modeContext,
      preferredProvider: body.preferredProvider,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("sessions/:id/reschedule")
  @Permissions("interview.schedule")
  reschedule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") sessionId: string,
    @Body() body: RescheduleInterviewSessionBody
  ) {
    return this.interviewsService.reschedule({
      tenantId,
      sessionId,
      scheduledAt: body.scheduledAt,
      reasonCode: body.reasonCode,
      scheduleNote: body.scheduleNote,
      modeContext: body.modeContext,
      preferredProvider: body.preferredProvider,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("sessions/:id/start")
  @Permissions("interview.session.manage")
  start(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") sessionId: string
  ) {
    return this.interviewsService.start({
      tenantId,
      sessionId,
      startedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("sessions/:id/complete")
  @Permissions("interview.session.manage")
  complete(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") sessionId: string,
    @Body() body: CompleteSessionBody
  ) {
    return this.interviewsService.complete({
      tenantId,
      sessionId,
      completedBy: user.userId,
      triggerAiReviewPack: body.triggerAiReviewPack,
      traceId: requestContext?.traceId
    });
  }

  @Post("sessions/:id/review-pack")
  @Permissions("interview.session.manage")
  requestReviewPack(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") sessionId: string,
    @Body() body: ReviewPackBody
  ) {
    return this.interviewsService.requestReviewPack({
      tenantId,
      sessionId,
      requestedBy: user.userId,
      traceId: requestContext?.traceId,
      providerKey: body.providerKey
    });
  }

  @Post("sessions/:id/cancel")
  @Permissions("interview.session.manage")
  cancel(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") sessionId: string,
    @Body() body: CancelSessionBody
  ) {
    return this.interviewsService.cancel({
      tenantId,
      sessionId,
      cancelledBy: user.userId,
      reasonCode: body.reasonCode ?? "manual_cancel",
      traceId: requestContext?.traceId
    });
  }

  @Post("sessions/:id/transcript/import")
  @Permissions("interview.session.manage")
  importTranscript(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") sessionId: string,
    @Body() body: TranscriptImportBody
  ) {
    return this.interviewsService.importTranscript({
      tenantId,
      sessionId,
      transcriptText: body.transcriptText,
      importedBy: user.userId,
      defaultSpeaker: body.defaultSpeaker,
      language: body.language,
      sttModel: body.sttModel,
      replaceExisting: body.replaceExisting,
      traceId: requestContext?.traceId
    });
  }

  @Post("sessions/:id/transcript/segments")
  @Permissions("interview.session.manage")
  appendSegment(
    @CurrentTenant() tenantId: string,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") sessionId: string,
    @Body() body: TranscriptSegmentBody
  ) {
    return this.interviewsService.appendTranscriptSegment({
      tenantId,
      sessionId,
      speaker: body.speaker,
      startMs: body.startMs,
      endMs: body.endMs,
      text: body.text,
      confidence: body.confidence,
      sttModel: body.sttModel,
      language: body.language,
      traceId: requestContext?.traceId
    });
  }

  @Post("sessions/:id/transcript/quality-review")
  @Permissions("interview.session.manage")
  reviewTranscriptQuality(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") sessionId: string,
    @Body() body: TranscriptQualityReviewBody
  ) {
    return this.interviewsService.reviewTranscriptQuality({
      tenantId,
      sessionId,
      reviewedBy: user.userId,
      qualityStatus: body.qualityStatus,
      qualityScore: body.qualityScore,
      reviewNotes: body.reviewNotes,
      traceId: requestContext?.traceId
    });
  }

  @Public()
  @Get("public/sessions/:id")
  getPublicSession(
    @Param("id") sessionId: string,
    @Query() query: PublicInterviewSessionQuery,
    @CurrentContext() requestContext: RequestContext | undefined
  ) {
    return this.interviewsService.getPublicSession({
      sessionId,
      accessToken: query.token,
      traceId: requestContext?.traceId
    });
  }

  @Public()
  @Post("public/sessions/:id/start")
  startPublicSession(
    @Param("id") sessionId: string,
    @Body() body: PublicStartBody,
    @CurrentContext() requestContext: RequestContext | undefined
  ) {
    return this.interviewsService.startPublicSession({
      sessionId,
      accessToken: body.token,
      capabilities: body.capabilities
        ? {
            speechRecognition: body.capabilities.speechRecognition === true,
            speechSynthesis: body.capabilities.speechSynthesis === true,
            locale: body.capabilities.locale
          }
        : undefined,
      traceId: requestContext?.traceId
    });
  }

  @Public()
  @Post("public/sessions/:id/answer")
  submitPublicAnswer(
    @Param("id") sessionId: string,
    @Body() body: PublicAnswerBody,
    @CurrentContext() requestContext: RequestContext | undefined
  ) {
    return this.interviewsService.submitPublicAnswer({
      sessionId,
      accessToken: body.token,
      transcriptText: body.transcriptText,
      confidence: body.confidence,
      speechLatencyMs: body.speechLatencyMs,
      speechDurationMs: body.speechDurationMs,
      answerSource: body.answerSource,
      locale: body.locale,
      traceId: requestContext?.traceId
    });
  }

  @Public()
  @Post("public/sessions/:id/answer-audio")
  submitPublicAudioAnswer(
    @Param("id") sessionId: string,
    @Body() body: PublicAudioAnswerBody,
    @CurrentContext() requestContext: RequestContext | undefined
  ) {
    return this.interviewsService.submitPublicAudioAnswer({
      sessionId,
      accessToken: body.token,
      audioBase64: body.audioBase64,
      mimeType: body.mimeType,
      locale: body.locale,
      traceId: requestContext?.traceId
    });
  }

  @Public()
  @Post("public/sessions/:id/prompt-audio")
  promptAudio(
    @Param("id") sessionId: string,
    @Body() body: PublicRepeatBody,
    @CurrentContext() requestContext: RequestContext | undefined
  ) {
    return this.interviewsService.getPublicPromptAudio({
      sessionId,
      accessToken: body.token,
      traceId: requestContext?.traceId
    });
  }

  @Public()
  @Post("public/sessions/:id/repeat")
  repeatPublicQuestion(
    @Param("id") sessionId: string,
    @Body() body: PublicRepeatBody,
    @CurrentContext() requestContext: RequestContext | undefined
  ) {
    return this.interviewsService.repeatPublicQuestion({
      sessionId,
      accessToken: body.token,
      traceId: requestContext?.traceId
    });
  }

  @Public()
  @Post("public/sessions/:id/abandon")
  abandonPublicSession(
    @Param("id") sessionId: string,
    @Body() body: PublicAbandonBody,
    @CurrentContext() requestContext: RequestContext | undefined
  ) {
    return this.interviewsService.abandonPublicSession({
      sessionId,
      accessToken: body.token,
      reasonCode: body.reasonCode,
      traceId: requestContext?.traceId
    });
  }
}
