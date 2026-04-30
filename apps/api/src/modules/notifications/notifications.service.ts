import { Injectable, Inject } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AuditActorType, NotificationDeliveryStatus, Prisma } from "@prisma/client";
import { RuntimeConfigService } from "../../config/runtime-config.service";
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

function interpolateTemplate(value: string, variables: Record<string, string>) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? "");
}

function readTenantMessageTemplate(
  settings: Prisma.JsonValue | null | undefined,
  templateKey: string,
  variables: Record<string, string>
) {
  const root = asRecord(settings);
  const templates = asRecord(root.messageTemplates);
  const template = asRecord(templates[templateKey]);
  const subject = asString(template.subject);
  const body = asString(template.body);

  if (!subject || !body) {
    return null;
  }

  return {
    subject: interpolateTemplate(subject, variables),
    body: interpolateTemplate(body, variables),
    ctaLabel: asString(template.ctaLabel)
  };
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
      subject: input.subject ?? "Candit bildirimi",
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
          subject: input.subject ?? "Candit bildirimi",
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
  const bodyLines = input.body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      return `<p style="margin:0 0 12px;line-height:1.6;color:#374151;font-size:15px">${escapeHtml(trimmed)}</p>`;
    })
    .join("");

  const showPrimaryCta = input.metadata?.showPrimaryCta !== false;
  const primaryLink = showPrimaryCta ? asString(input.metadata?.primaryLink) : null;
  const primaryCtaLabel = asString(input.metadata?.primaryCtaLabel) ?? "G\u00F6r\u00FC\u015Fmeyi Ba\u015Flat";
  const primaryCta = primaryLink
    ? `<table cellpadding="0" cellspacing="0" style="margin:24px 0 16px"><tr><td style="border-radius:8px;background:#5046e5" align="center">
        <a href="${escapeHtml(primaryLink)}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.2px">${escapeHtml(primaryCtaLabel)}</a>
      </td></tr></table>`
    : "";

  const showSecondaryCta = input.metadata?.showSecondaryCta === true;
  const secondaryLink = showSecondaryCta ? asString(input.metadata?.secondaryLink) : null;
  const secondaryCtaLabel = asString(input.metadata?.secondaryCtaLabel) ?? "Daha Sonra Planla";
  const secondaryCta = secondaryLink
    ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td style="border-radius:8px;border:1px solid #c7d2fe" align="center">
        <a href="${escapeHtml(secondaryLink)}" target="_blank" style="display:inline-block;padding:12px 28px;color:#4338ca;text-decoration:none;font-weight:600;font-size:14px">${escapeHtml(secondaryCtaLabel)}</a>
      </td></tr></table>`
    : "";

  const hideScheduledAt = input.metadata?.hideScheduledAt === true;
  const scheduledAt = input.metadata?.scheduledAt
    ? hideScheduledAt
      ? ""
      : `<p style="margin:8px 0;color:#6b7280;font-size:13px">Tarih: ${escapeHtml(String(input.metadata.scheduledAt))}</p>`
    : "";

  // Info boxes from metadata
  const infoItems: string[] = [];
  const meta = input.metadata ?? {};
  if (meta.infoDuration) infoItems.push(`<td style="padding:12px 16px;border-bottom:1px solid #f3f4f6"><span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">S\u00FCre</span><br><span style="color:#111827;font-weight:600;font-size:14px">${escapeHtml(String(meta.infoDuration))}</span></td>`);
  if (meta.infoDeadline) infoItems.push(`<td style="padding:12px 16px;border-bottom:1px solid #f3f4f6"><span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Son Ge\u00E7erlilik</span><br><span style="color:#111827;font-weight:600;font-size:14px">${escapeHtml(String(meta.infoDeadline))}</span></td>`);
  if (meta.infoPosition) infoItems.push(`<td style="padding:12px 16px;border-bottom:1px solid #f3f4f6"><span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Pozisyon</span><br><span style="color:#111827;font-weight:600;font-size:14px">${escapeHtml(String(meta.infoPosition))}</span></td>`);

  const infoBox = infoItems.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#fafafa"><tr>${infoItems.join("</tr><tr>")}</tr></table>`
    : "";

  // Tips section
  const tips = meta.tips as string[] | undefined;
  const tipsHtml = tips && tips.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px"><tr><td style="padding:16px 20px">
        <p style="margin:0 0 8px;font-weight:600;color:#166534;font-size:13px">\u00D6neriler</p>
        ${tips.map((t) => `<p style="margin:0 0 4px;color:#15803d;font-size:13px;line-height:1.5">\u2022 ${escapeHtml(t)}</p>`).join("")}
      </td></tr></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

        <!-- Header -->
        <tr><td style="padding:28px 36px;border-bottom:1px solid #f1f5f9">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <span style="display:inline-block;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#5046e5,#7c3aed);text-align:center;line-height:36px;color:#fff;font-weight:700;font-size:14px;vertical-align:middle">C</span>
              <span style="margin-left:10px;font-size:17px;font-weight:700;color:#0f172a;vertical-align:middle;letter-spacing:-0.3px">Candit.ai</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px">
          ${bodyLines}
          ${infoBox}
          ${scheduledAt}
          ${primaryCta}
          ${secondaryCta}
          ${tipsHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 36px;background:#f8fafc;border-top:1px solid #f1f5f9">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5">
            Bu e-posta Candit.ai platformu taraf\u0131ndan otomatik olarak g\u00F6nderilmi\u015Ftir.
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
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService
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

    if (input.eventType === "interview.invitation.sent") {
      return this.notifyInterviewLifecycleEvent({
        ...input,
        templateKey: "interview_invitation_on_demand_v1"
      });
    }

    if (input.eventType === "interview.invitation.reminder_sent") {
      return this.notifyInterviewLifecycleEvent({
        ...input,
        templateKey: "interview_invitation_reminder_v1"
      });
    }

    if (input.eventType === "application.decision_recorded") {
      return this.notifyApplicationDecisionEvent(input);
    }

    if (input.eventType === "application.created") {
      return this.notifyApplicationStageEvent({
        ...input,
        stageKind: "application_created"
      });
    }

    if (input.eventType === "application.stage_transitioned") {
      return this.notifyApplicationStageEvent({
        ...input,
        stageKind: "stage_transitioned"
      });
    }

    if (input.eventType !== "interview.session.completed") {
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
      subject: `[Candit.ai] ${input.eventType}`,
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
    templateKey:
      | "interview_scheduled_v1"
      | "interview_rescheduled_v1"
      | "interview_cancelled_v1"
      | "interview_invitation_on_demand_v1"
      | "interview_invitation_reminder_v1";
  }) {
    const [session, tenant] = await Promise.all([
      this.prisma.interviewSession.findFirst({
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
      }),
      this.prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: { name: true, hiringSettingsJson: true }
      })
    ]);
    const companyName = tenant?.name ?? "Candit.ai";

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
        ? session.meetingJoinUrl ??
          `${this.runtimeConfig.publicWebBaseUrl}/interview/${session.id}?token=${session.candidateAccessToken}`
        : session.meetingJoinUrl ?? "-";
    const notificationMetadata = asRecord(input.payload.notificationMetadata);

    const scheduleAtText = session.scheduledAt?.toISOString() ?? "TBD";
    const deadlineText = session.candidateAccessExpiresAt
      ? session.candidateAccessExpiresAt.toLocaleString("tr-TR")
      : "Belirtilmedi";
    const title = session.application.job.title;

    const messageByTemplate = (() => {
      if (input.templateKey === "interview_cancelled_v1") {
        return {
          subject: `${companyName} \u2013 G\u00F6r\u00FC\u015Fme daveti iptal edildi`,
          body: [
            `Merhaba ${candidateName},`,
            ``,
            `${companyName} b\u00FCnyesindeki ${title} pozisyonu i\u00E7in \u00F6nceki g\u00F6r\u00FC\u015Fme davetiniz iptal edilmi\u015Ftir.`,
            ``,
            `G\u00FCncel ve ge\u00E7erli bir ba\u011Flant\u0131 ayr\u0131 bir e-posta ile size g\u00F6nderilecektir.`,
            ``,
            `Herhangi bir sorunuz varsa i\u015Fe al\u0131m ekibimizle ileti\u015Fime ge\u00E7ebilirsiniz.`
          ].join("\n"),
          extraMetadata: {
            showPrimaryCta: false,
            infoPosition: title
          }
        };
      }

      if (input.templateKey === "interview_rescheduled_v1") {
        return {
          subject: `${companyName} \u2013 G\u00F6r\u00FC\u015Fmeniz yeniden planland\u0131`,
          body: [
            `Merhaba ${candidateName},`,
            ``,
            `${companyName} b\u00FCnyesindeki ${title} pozisyonu i\u00E7in g\u00F6r\u00FC\u015Fmeniz yeniden planlanm\u0131\u015Ft\u0131r.`,
            ``,
            `A\u015Fa\u011F\u0131daki butonu kullanarak g\u00F6r\u00FC\u015Fmenize kat\u0131labilirsiniz.`
          ].join("\n"),
          extraMetadata: {
            infoPosition: title
          }
        };
      }

      if (input.templateKey === "interview_invitation_on_demand_v1") {
        return {
          subject: `${companyName} \u2013 \u0130lk g\u00F6r\u00FC\u015Fme davetiniz`,
          body: [
            `Merhaba ${candidateName},`,
            ``,
            `${companyName} b\u00FCnyesindeki ${title} pozisyonuna yapt\u0131\u011F\u0131n\u0131z ba\u015Fvuru olumlu de\u011Ferlendirilmi\u015Ftir. Sizi ilk g\u00F6r\u00FC\u015Fmeye davet etmekten memnuniyet duyar\u0131z.`,
            ``,
            `G\u00F6r\u00FC\u015Fme, yapay zek\u00E2 destekli sesli bir \u00F6n de\u011Ferlendirme \u015Feklinde ger\u00E7ekle\u015Fecektir. Takvim se\u00E7imi gerektirmez; a\u015Fa\u011F\u0131daki butona t\u0131klayarak size uygun bir zamanda ba\u015Flatabilirsiniz.`
          ].join("\n"),
          extraMetadata: {
            primaryCtaLabel: "G\u00F6r\u00FC\u015Fmeyi Ba\u015Flat",
            infoDuration: "15\u201320 dakika",
            infoDeadline: deadlineText,
            infoPosition: title,
            tips: [
              "Sessiz bir ortam tercih edin",
              "Mikrofonunuzun a\u00E7\u0131k oldu\u011Fundan emin olun",
              "G\u00F6r\u00FC\u015Fmeyi tek seferde tamamlamay\u0131 planlay\u0131n"
            ]
          }
        };
      }

      if (input.templateKey === "interview_invitation_reminder_v1") {
        return {
          subject: `${companyName} \u2013 G\u00F6r\u00FC\u015Fme hat\u0131rlatmas\u0131`,
          body: [
            `Merhaba ${candidateName},`,
            ``,
            `${companyName} b\u00FCnyesindeki ${title} pozisyonu i\u00E7in g\u00F6r\u00FC\u015Fme davetiniz hâlâ ge\u00E7erlidir.`,
            ``,
            `S\u00FCre dolmadan a\u015Fa\u011F\u0131daki butona t\u0131klayarak g\u00F6r\u00FC\u015Fmenizi ba\u015Flatabilirsiniz.`
          ].join("\n"),
          extraMetadata: {
            primaryCtaLabel: "G\u00F6r\u00FC\u015Fmeyi Ba\u015Flat",
            infoDuration: "15\u201320 dakika",
            infoDeadline: deadlineText,
            infoPosition: title
          }
        };
      }

      return {
        subject: `${companyName} \u2013 G\u00F6r\u00FC\u015Fmeniz planland\u0131`,
        body: [
          `Merhaba ${candidateName},`,
          ``,
          `${companyName} b\u00FCnyesindeki ${title} pozisyonu i\u00E7in g\u00F6r\u00FC\u015Fmeniz planlanm\u0131\u015Ft\u0131r.`,
          ``,
          `A\u015Fa\u011F\u0131daki butonu kullanarak g\u00F6r\u00FC\u015Fmenize kat\u0131labilirsiniz.`
        ].join("\n"),
        extraMetadata: {
          infoPosition: title
        }
      };
    })();

    const templateOverride = readTenantMessageTemplate(tenant?.hiringSettingsJson, input.templateKey, {
      candidateName,
      companyName,
      jobTitle: title,
      interviewLink,
      deadline: deadlineText
    });
    const extra = (messageByTemplate as { extraMetadata?: Record<string, unknown> }).extraMetadata ?? {};
    const resolvedMessage = {
      ...messageByTemplate,
      subject: templateOverride?.subject ?? messageByTemplate.subject,
      body: templateOverride?.body ?? messageByTemplate.body,
      extraMetadata: {
        ...extra,
        ...(templateOverride?.ctaLabel ? { primaryCtaLabel: templateOverride.ctaLabel } : {})
      }
    };
    const resolvedExtra = resolvedMessage.extraMetadata as Record<string, unknown>;

    const result = await this.send({
      tenantId: input.tenantId,
      channel: "email",
      to: recipient,
      subject: resolvedMessage.subject,
      body: resolvedMessage.body,
      metadata: {
        ...notificationMetadata,
        ...resolvedExtra,
        sessionId: session.id,
        applicationId: session.applicationId,
        eventType: input.eventType,
        templateKey: input.templateKey,
        interviewLink,
        primaryLink:
          asString(resolvedExtra.primaryLink as string | undefined) ??
          asString(notificationMetadata.primaryLink) ??
          (input.templateKey === "interview_invitation_on_demand_v1" ||
          input.templateKey === "interview_invitation_reminder_v1"
            ? interviewLink
            : input.templateKey !== "interview_cancelled_v1"
              ? interviewLink
              : null),
        primaryCtaLabel:
          asString(resolvedExtra.primaryCtaLabel as string | undefined) ??
          asString(notificationMetadata.primaryCtaLabel) ??
          "G\u00F6r\u00FC\u015Fmeyi Ba\u015Flat",
        showPrimaryCta: resolvedExtra.showPrimaryCta !== undefined ? resolvedExtra.showPrimaryCta : input.templateKey !== "interview_cancelled_v1",
        showSecondaryCta: false,
        scheduledAt: session.scheduledAt?.toISOString() ?? null,
        deadlineAt: session.candidateAccessExpiresAt?.toISOString() ?? null
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

  private async notifyApplicationDecisionEvent(input: {
    tenantId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    traceId?: string;
    payload: Record<string, unknown>;
  }) {
    const decision = asString(input.payload.decision)?.toLowerCase();

    if (decision !== "advance" && decision !== "hold" && decision !== "reject") {
      return {
        notified: false,
        reason: "decision_notification_not_supported"
      };
    }

    const [application, tenant] = await Promise.all([
      this.prisma.candidateApplication.findFirst({
        where: {
          tenantId: input.tenantId,
          id: input.aggregateId
        },
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
      }),
      this.prisma.tenant.findUnique({
        where: {
          id: input.tenantId
        },
        select: {
          name: true,
          hiringSettingsJson: true
        }
      })
    ]);

    if (!application) {
      return {
        notified: false,
        reason: "application_not_found"
      };
    }

    const recipient = application.candidate.email?.trim() || null;

    if (!recipient) {
      return {
        notified: false,
        reason: "recipient_missing"
      };
    }

    const companyName = tenant?.name ?? "Candit.ai";
    const candidateName = application.candidate.fullName;
    const jobTitle = application.job.title;
    const email = this.buildApplicationDecisionEmail({
      decision,
      companyName,
      candidateName,
      jobTitle
    });
    const templateOverride = readTenantMessageTemplate(tenant?.hiringSettingsJson, email.templateKey, {
      candidateName,
      companyName,
      jobTitle,
      interviewLink: "",
      deadline: ""
    });

    const result = await this.send({
      tenantId: input.tenantId,
      channel: "email",
      to: recipient,
      subject: templateOverride?.subject ?? email.subject,
      body: templateOverride?.body ?? email.body,
      metadata: {
        eventType: input.eventType,
        applicationId: application.id,
        decision,
        infoPosition: jobTitle,
        decisionLabel: email.decisionLabel,
        showPrimaryCta: false,
        showSecondaryCta: false
      },
      traceId: input.traceId,
      domainEventId: asString(input.payload.domainEventId) ?? undefined,
      eventType: input.eventType,
      templateKey: email.templateKey
    });

    return {
      notified: true,
      channel: "email",
      deliveryId: result.deliveryId,
      provider: result.provider,
      status: result.status
    };
  }

  private buildApplicationDecisionEmail(input: {
    decision: "advance" | "hold" | "reject";
    companyName: string;
    candidateName: string;
    jobTitle: string;
  }) {
    switch (input.decision) {
      case "advance":
        return {
          templateKey: "application_advanced_v1",
          decisionLabel: "İlerletildi",
          subject: `${input.companyName} – Başvurunuz bir sonraki aşamaya alındı`,
          body: [
            `Merhaba ${input.candidateName},`,
            ``,
            `${input.companyName} bünyesindeki ${input.jobTitle} pozisyonu için başvurunuzu değerlendirdik.`,
            ``,
            `Başvurunuz bir sonraki aşamaya alındı.`,
            ``,
            `Sonraki adımlarla ilgili ekibimiz sizinle ayrı bir iletişim paylaşacaktır.`
          ].join("\n")
        } as const;
      case "hold":
        return {
          templateKey: "application_on_hold_v1",
          decisionLabel: "Bekletildi",
          subject: `${input.companyName} – Başvurunuz değerlendirmede`,
          body: [
            `Merhaba ${input.candidateName},`,
            ``,
            `${input.companyName} bünyesindeki ${input.jobTitle} pozisyonu için başvurunuz halen değerlendirme sürecindedir.`,
            ``,
            `Şu an için nihai karar verilmedi; değerlendirme tamamlandığında sizinle tekrar paylaşacağız.`,
            ``,
            `İlginiz ve sabrınız için teşekkür ederiz.`
          ].join("\n")
        } as const;
      case "reject":
      default:
        return {
          templateKey: "application_rejected_v1",
          decisionLabel: "Reddedildi",
          subject: `${input.companyName} – Başvuru güncellemesi`,
          body: [
            `Merhaba ${input.candidateName},`,
            ``,
            `${input.companyName} bünyesindeki ${input.jobTitle} pozisyonu için başvurunuzu değerlendirdik.`,
            ``,
            `Bu aşamada sürece seninle devam edemeyeceğiz.`,
            ``,
            `Başvurun ve zamanın için teşekkür eder, kariyer yolculuğunda başarılar dileriz.`
          ].join("\n")
        } as const;
    }
  }

  private async notifyApplicationStageEvent(input: {
    tenantId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    traceId?: string;
    payload: Record<string, unknown>;
    stageKind: "application_created" | "stage_transitioned";
  }) {
    const [application, tenant] = await Promise.all([
      this.prisma.candidateApplication.findFirst({
        where: {
          tenantId: input.tenantId,
          id: input.aggregateId
        },
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
      }),
      this.prisma.tenant.findUnique({
        where: {
          id: input.tenantId
        },
        select: {
          name: true,
          hiringSettingsJson: true
        }
      })
    ]);

    if (!application) {
      return {
        notified: false,
        reason: "application_not_found"
      };
    }

    const recipient = application.candidate.email?.trim() || null;

    if (!recipient) {
      return {
        notified: false,
        reason: "recipient_missing"
      };
    }

    const companyName = tenant?.name ?? "Candit.ai";
    const candidateName = application.candidate.fullName;
    const jobTitle = application.job.title;
    const toStage =
      typeof input.payload.toStage === "string" ? input.payload.toStage.trim().toUpperCase() : null;

    const email =
      input.stageKind === "application_created"
        ? {
            templateKey: "application_received_v1",
            subject: `${companyName} – Başvurunuz alındı`,
            body: [
              `Merhaba ${candidateName},`,
              ``,
              `${companyName} bünyesindeki ${jobTitle} pozisyonu için başvurunuz tarafımıza ulaştı.`,
              ``,
              `Ekibimiz başvurunuzu değerlendirmeye aldı. Süreçte yeni bir adım olduğunda sizinle tekrar paylaşacağız.`
            ].join("\n")
          }
        : toStage === "TALENT_POOL"
          ? {
              templateKey: "application_talent_pool_v1",
              subject: `${companyName} – Başvurunuz aday havuzunda`,
              body: [
                `Merhaba ${candidateName},`,
                ``,
                `${companyName} bünyesindeki ${jobTitle} pozisyonu için CV'niz tarafımıza ulaşmıştır ve aday havuzumuzda değerlendirilmektedir.`,
                ``,
                `Pozisyona uygun bir eşleşme oluşması halinde ekibimiz sizinle tekrar iletişime geçecektir.`
              ].join("\n")
            }
          : toStage === "SHORTLISTED" || toStage === "RECRUITER_REVIEW"
            ? {
                templateKey: "application_shortlisted_v1",
                subject: `${companyName} – Başvurunuz değerlendirmeye alındı`,
                body: [
                  `Merhaba ${candidateName},`,
                  ``,
                  `${companyName} bünyesindeki ${jobTitle} pozisyonu için başvurunuz değerlendirme sürecine alınmıştır.`,
                  ``,
                  `Pozisyona uygun bulunmanız halinde bir sonraki adım için sizinle iletişime geçeceğiz.`
                ].join("\n")
              }
            : null;

    if (!email) {
      return {
        notified: false,
        reason: "stage_notification_not_supported"
      };
    }

    const templateOverride = readTenantMessageTemplate(tenant?.hiringSettingsJson, email.templateKey, {
      candidateName,
      companyName,
      jobTitle,
      interviewLink: "",
      deadline: ""
    });

    const result = await this.send({
      tenantId: input.tenantId,
      channel: "email",
      to: recipient,
      subject: templateOverride?.subject ?? email.subject,
      body: templateOverride?.body ?? email.body,
      metadata: {
        eventType: input.eventType,
        applicationId: application.id,
        stage: toStage,
        infoPosition: jobTitle,
        showPrimaryCta: false,
        showSecondaryCta: false
      },
      traceId: input.traceId,
      domainEventId: asString(input.payload.domainEventId) ?? undefined,
      eventType: input.eventType,
      templateKey: email.templateKey
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
