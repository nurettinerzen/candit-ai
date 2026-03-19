import { Injectable, Inject} from "@nestjs/common";
import { randomUUID } from "crypto";
import { AuditActorType, NotificationDeliveryStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import type {
  NotificationMessageInput,
  NotificationProvider,
  NotificationSendResult
} from "./contracts/notification-provider.interface";

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

class ConsoleNotificationProvider implements NotificationProvider {
  constructor(readonly channel: "email" | "sms" | "in_app") {}

  async send(input: NotificationMessageInput): Promise<NotificationSendResult> {
    const messageId = randomUUID();

    console.log(
      JSON.stringify({
        level: "info",
        message: "notification.dispatched",
        ts: new Date().toISOString(),
        channel: this.channel,
        tenantId: input.tenantId,
        to: input.to,
        subject: input.subject ?? null,
        traceId: input.traceId,
        metadataKeys: Object.keys(input.metadata ?? {})
      })
    );

    return {
      provider: `console-${this.channel}`,
      channel: this.channel,
      messageId,
      status: "queued"
    };
  }
}

class ResendEmailNotificationProvider implements NotificationProvider {
  readonly channel = "email" as const;

  private readonly apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  private readonly from = process.env.EMAIL_FROM?.trim() ?? "noreply@ai-interviewer.local";
  private readonly endpoint = process.env.RESEND_API_BASE_URL?.trim() ?? "https://api.resend.com/emails";

  async send(input: NotificationMessageInput): Promise<NotificationSendResult> {
    if (!this.apiKey) {
      return {
        provider: "resend",
        channel: "email",
        messageId: randomUUID(),
        status: "failed",
        errorMessage: "RESEND_API_KEY ayari eksik"
      };
    }

    const htmlBody = buildHtmlEmail({
      subject: input.subject ?? "AI Interviewer bildirimi",
      body: input.body,
      metadata: input.metadata
    });

    let response: Response;

    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.to],
          subject: input.subject ?? "AI Interviewer bildirimi",
          text: input.body,
          html: htmlBody
        })
      });
    } catch (error) {
      return {
        provider: "resend",
        channel: "email",
        messageId: randomUUID(),
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "email_network_error"
      };
    }

    if (!response.ok) {
      return {
        provider: "resend",
        channel: "email",
        messageId: randomUUID(),
        status: "failed",
        errorMessage: `Resend HTTP ${response.status}`
      };
    }

    const payload = (await response.json()) as { id?: string };

    return {
      provider: "resend",
      channel: "email",
      messageId: payload.id ?? randomUUID(),
      status: "queued"
    };
  }
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlEmail(input: {
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const bodyLines = input.body.split("\n").map((line) => `<p style="margin:0 0 8px;line-height:1.5">${escapeHtml(line)}</p>`).join("");

  const primaryLink = asString(input.metadata?.interviewLink);
  const primaryCtaLabel = asString(input.metadata?.primaryCtaLabel) ?? "Gorusmeye Katil";
  const primaryCta = primaryLink
    ? `<p style="margin:16px 0 12px"><a href="${escapeHtml(primaryLink)}" style="display:inline-block;padding:12px 24px;background:#5046e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">${escapeHtml(primaryCtaLabel)}</a></p>`
    : "";

  const secondaryLink = asString(input.metadata?.secondaryLink);
  const secondaryCtaLabel = asString(input.metadata?.secondaryCtaLabel) ?? "Daha Sonra Planla";
  const secondaryCta = secondaryLink
    ? `<p style="margin:0 0 16px"><a href="${escapeHtml(secondaryLink)}" style="display:inline-block;padding:12px 24px;background:#eef2ff;color:#3730a3;text-decoration:none;border-radius:8px;font-weight:600;border:1px solid #c7d2fe">${escapeHtml(secondaryCtaLabel)}</a></p>`
    : "";

  const hideScheduledAt = input.metadata?.hideScheduledAt === true;
  const scheduledAt = input.metadata?.scheduledAt
    ? hideScheduledAt
      ? ""
      : `<p style="margin:8px 0;color:#6b7280;font-size:13px">Tarih: ${escapeHtml(String(input.metadata.scheduledAt))}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <tr><td style="background:linear-gradient(135deg,#5046e5 0%,#7c3aed 100%);padding:24px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600">AI Interviewer</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;font-size:16px;color:#111827">${escapeHtml(input.subject)}</h2>
          ${bodyLines}
          ${scheduledAt}
          ${primaryCta}
          ${secondaryCta}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
            Bu e-posta AI Interviewer platformu tarafindan otomatik olarak gonderilmistir.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

@Injectable()
export class NotificationsService {
  private readonly providers: Record<"email" | "sms" | "in_app", NotificationProvider> = {
    email:
      process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend"
        ? new ResendEmailNotificationProvider()
        : new ConsoleNotificationProvider("email"),
    sms: new ConsoleNotificationProvider("sms"),
    in_app: new ConsoleNotificationProvider("in_app")
  };

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService
  ) {}

  async send(
    input: NotificationMessageInput & {
      requestedBy?: string;
      domainEventId?: string;
      templateKey?: string;
      eventType?: string;
    }
  ) {
    const provider = this.providers[input.channel];

    const delivery = await this.prisma.notificationDelivery.create({
      data: {
        tenantId: input.tenantId,
        channel: input.channel,
        toAddress: input.to,
        subject: input.subject,
        body: input.body,
        templateKey: input.templateKey,
        eventType: input.eventType,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        requestedBy: input.requestedBy,
        traceId: input.traceId,
        status: NotificationDeliveryStatus.QUEUED,
        domainEventId: input.domainEventId
      }
    });

    // Retry logic: up to 3 attempts with exponential backoff
    let result: NotificationSendResult | null = null;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt++;
      result = await provider.send({
        ...input,
        deliveryId: delivery.id
      });

      if (result.status !== "failed" || attempt >= maxAttempts) {
        break;
      }

      // Exponential backoff: 500ms, 1500ms
      const delayMs = Math.min(500 * Math.pow(2, attempt - 1), 5000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (!result) {
      result = {
        provider: `${input.channel}-unknown`,
        channel: input.channel,
        messageId: randomUUID(),
        status: "failed",
        errorMessage: "No send result after retries"
      };
    }

    const now = new Date();

    await this.prisma.notificationDelivery.update({
      where: {
        id: delivery.id
      },
      data: {
        providerKey: result.provider,
        providerMessageId: result.messageId,
        status:
          result.status === "failed"
            ? NotificationDeliveryStatus.FAILED
            : result.status === "sent"
              ? NotificationDeliveryStatus.SENT
              : NotificationDeliveryStatus.QUEUED,
        sentAt: result.status === "sent" ? now : null,
        failedAt: result.status === "failed" ? now : null,
        errorMessage: result.errorMessage ?? null
      }
    });

    await this.auditWriterService.write({
      tenantId: input.tenantId,
      actorType: AuditActorType.SYSTEM,
      actorUserId: input.requestedBy,
      action: "notification.sent",
      entityType: "NotificationDelivery",
      entityId: delivery.id,
      traceId: input.traceId,
      metadata: {
        provider: result.provider,
        providerMessageId: result.messageId,
        channel: result.channel,
        status: result.status,
        attempts: attempt,
        to: input.to,
        subject: input.subject ?? null,
        errorMessage: result.errorMessage ?? null
      } as Prisma.InputJsonValue
    });

    return {
      deliveryId: delivery.id,
      ...result
    };
  }

  async handleDomainEvent(input: {
    tenantId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    traceId?: string;
    payload: Record<string, unknown>;
  }) {
    if (input.eventType === "scheduling.slot.booked") {
      return this.notifyInterviewLifecycleEvent({
        ...input,
        aggregateType: "InterviewSession",
        aggregateId: typeof input.payload.sessionId === "string" ? input.payload.sessionId : input.aggregateId,
        templateKey: "interview_scheduled_v1"
      });
    }

    if (input.eventType === "interview.session.scheduled") {
      return this.notifyInterviewLifecycleEvent({
        ...input,
        templateKey: "interview_scheduled_v1"
      });
    }

    if (input.eventType === "interview.session.rescheduled") {
      return this.notifyInterviewLifecycleEvent({
        ...input,
        templateKey: "interview_rescheduled_v1"
      });
    }

    if (input.eventType === "interview.session.cancelled") {
      return this.notifyInterviewLifecycleEvent({
        ...input,
        templateKey: "interview_cancelled_v1"
      });
    }

    if (
      input.eventType !== "application.stage_transitioned" &&
      input.eventType !== "interview.session.completed"
    ) {
      return { notified: false };
    }

    const recipient =
      asString(input.payload.notificationEmail) ??
      process.env.NOTIFICATION_DEFAULT_EMAIL_TO?.trim() ??
      null;

    if (!recipient) {
      return {
        notified: false,
        reason: "recipient_missing"
      };
    }

    const result = await this.send({
      tenantId: input.tenantId,
      channel: "email",
      to: recipient,
      subject: `[AI Interviewer] ${input.eventType}`,
      body: `${input.eventType} olayi olustu. Aggregate: ${input.aggregateType}/${input.aggregateId}`,
      metadata: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payloadKeys: Object.keys(input.payload),
        eventType: input.eventType
      },
      traceId: input.traceId,
      domainEventId: asString(input.payload.domainEventId) ?? undefined,
      eventType: input.eventType,
      templateKey: "domain_event_default_v1"
    });

    return {
      notified: true,
      channel: "email",
      deliveryId: result.deliveryId,
      provider: result.provider,
      status: result.status
    };
  }

  private async notifyInterviewLifecycleEvent(input: {
    tenantId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    traceId?: string;
    payload: Record<string, unknown>;
    templateKey: "interview_scheduled_v1" | "interview_rescheduled_v1" | "interview_cancelled_v1";
  }) {
    const session = await this.prisma.interviewSession.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.aggregateId
      },
      include: {
        application: {
          include: {
            candidate: {
              select: {
                fullName: true,
                email: true
              }
            },
            job: {
              select: {
                title: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      return {
        notified: false,
        reason: "session_not_found"
      };
    }

    const recipient =
      session.application.candidate.email ??
      asString(input.payload.notificationEmail) ??
      process.env.NOTIFICATION_DEFAULT_EMAIL_TO?.trim() ??
      null;

    if (!recipient) {
      return {
        notified: false,
        reason: "recipient_missing"
      };
    }

    const candidateName = session.application.candidate.fullName;
    const interviewLink =
      session.mode === "VOICE" && session.candidateAccessToken
        ? `${(process.env.PUBLIC_WEB_BASE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "")}/gorusme/${session.id}?token=${session.candidateAccessToken}`
        : session.meetingJoinUrl ?? "-";
    const notificationMetadata = asRecord(input.payload.notificationMetadata);
    const emailVariant = asString(notificationMetadata.emailVariant);
    const secondaryLink = asString(notificationMetadata.secondaryLink);

    const scheduleAtText = session.scheduledAt?.toISOString() ?? "TBD";
    const title = session.application.job.title;

    const messageByTemplate = (() => {
      if (input.templateKey === "interview_cancelled_v1") {
        return {
          subject: `[AI Interviewer] Interview iptal edildi`,
          body: [
            `Merhaba ${candidateName},`,
            `${title} pozisyonu icin gorusmeniz iptal edildi.`,
            `Guncel bilgi icin recruiter ekibi sizinle iletisime gececektir.`,
            `Session ID: ${session.id}`
          ].join("\n")
        };
      }

      if (input.templateKey === "interview_rescheduled_v1") {
        return {
          subject: `[AI Interviewer] Interview yeniden planlandi`,
          body: [
            `Merhaba ${candidateName},`,
            `${title} pozisyonu icin gorusmeniz yeniden planlandi.`,
            `Yeni zaman: ${scheduleAtText}`,
            `Gorusme linki: ${interviewLink}`
          ].join("\n")
        };
      }

      if (emailVariant === "direct_ai_interview_invite") {
        return {
          subject: `[AI Interviewer] AI gorusme davetiniz hazir`,
          body: [
            `Merhaba ${candidateName},`,
            `${title} pozisyonu icin AI on gorusme baglantiniz hazir.`,
            `Asagidaki "Simdi Basla" butonuyla gorusmeye hemen katilabilirsiniz.`,
            secondaryLink
              ? `Uygun degilseniz "Daha Sonra Planla" baglantisindan size uygun zamani secebilirsiniz.`
              : `Uygun degilseniz ayni baglantiyi daha sonra da kullanabilirsiniz.`,
            `Gorusme suresi yaklasik 15-20 dakika olacaktir.`,
            `Gorusme linki: ${interviewLink}`,
            ...(secondaryLink ? [`Daha sonra planla: ${secondaryLink}`] : [])
          ].join("\n")
        };
      }

      return {
        subject: `[AI Interviewer] Interview planlandi`,
        body: [
          `Merhaba ${candidateName},`,
          `${title} pozisyonu icin gorusmeniz planlandi.`,
          `Zaman: ${scheduleAtText}`,
          `Gorusme linki: ${interviewLink}`
        ].join("\n")
      };
    })();

    const result = await this.send({
      tenantId: input.tenantId,
      channel: "email",
      to: recipient,
      subject: messageByTemplate.subject,
      body: messageByTemplate.body,
      metadata: {
        ...notificationMetadata,
        sessionId: session.id,
        applicationId: session.applicationId,
        eventType: input.eventType,
        templateKey: input.templateKey,
        interviewLink,
        scheduledAt: session.scheduledAt?.toISOString() ?? null
      },
      traceId: input.traceId,
      domainEventId: asString(input.payload.domainEventId) ?? undefined,
      eventType: input.eventType,
      templateKey: input.templateKey
    });

    return {
      notified: true,
      channel: "email",
      deliveryId: result.deliveryId,
      provider: result.provider,
      status: result.status
    };
  }
}
