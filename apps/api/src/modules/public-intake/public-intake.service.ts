import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable
} from "@nestjs/common";
import { createHash } from "crypto";
import { NotificationDeliveryStatus, Prisma, PublicLeadStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type SubmitContactInput = {
  fullName: string;
  email: string;
  company?: string;
  role?: string;
  phone?: string;
  message: string;
  sourcePage?: string;
  landingUrl?: string;
  referrerUrl?: string;
  locale?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  website?: string;
  ipAddress?: string;
  userAgent?: string;
  traceId?: string;
};

type OpsDispatchResult = {
  status: NotificationDeliveryStatus;
  provider: string;
  errorMessage?: string;
};

function asOptionalString(value: unknown, maxLength = 255) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOpsHtmlEmail(subject: string, body: string) {
  return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:24px;background:#0f172a;color:#e2e8f0;font-family:Inter,Arial,sans-serif">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#111c30;border-radius:18px;border:1px solid rgba(148,163,184,0.18)">
      <tr>
        <td style="padding:24px 24px 8px">
          <p style="margin:0 0 8px;color:#7dd3fc;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">Candit Public Contact</p>
          <h1 style="margin:0;color:#f8fafc;font-size:24px;line-height:1.2">${escapeHtml(subject)}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px">
          ${body
            .split("\n")
            .map((line) =>
              line.trim()
                ? `<p style="margin:0 0 12px;color:#cbd5e1;font-size:14px;line-height:1.7">${escapeHtml(line)}</p>`
                : ""
            )
            .join("")}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function rateLimitException(message: string) {
  return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}

@Injectable()
export class PublicIntakeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async submitContact(input: SubmitContactInput) {
    if (input.website && input.website.trim().length > 0) {
      return {
        success: true as const,
        deduplicated: false,
        ignored: true,
        message: "Mesajınızı aldık. Ekibimiz kısa süre içinde sizinle dönüş yapacak."
      };
    }

    const fullName = input.fullName.trim();
    const normalizedEmail = normalizeEmail(input.email);
    const message = input.message.trim();

    if (!fullName || !normalizedEmail || !message) {
      throw new BadRequestException("Ad soyad, e-posta ve mesaj alanlari zorunludur.");
    }

    const ipAddressHash = asOptionalString(input.ipAddress) ? hashValue(String(input.ipAddress)) : undefined;

    await this.assertRateLimit({
      normalizedEmail,
      ipAddressHash
    });

    const now = new Date();
    const existingLead = await this.prisma.publicLeadSubmission.findUnique({
      where: {
        normalizedEmail
      }
    });

    const payload = {
      fullName,
      email: input.email.trim(),
      normalizedEmail,
      company: asOptionalString(input.company, 160),
      role: asOptionalString(input.role, 120),
      phone: asOptionalString(input.phone, 40),
      message,
      sourcePage: asOptionalString(input.sourcePage, 120) ?? "contact",
      landingUrl: asOptionalString(input.landingUrl, 500),
      referrerUrl: asOptionalString(input.referrerUrl, 500),
      locale: asOptionalString(input.locale, 32),
      utmSource: asOptionalString(input.utmSource, 120),
      utmMedium: asOptionalString(input.utmMedium, 120),
      utmCampaign: asOptionalString(input.utmCampaign, 120),
      utmTerm: asOptionalString(input.utmTerm, 120),
      utmContent: asOptionalString(input.utmContent, 120),
      ipAddressHash,
      userAgent: asOptionalString(input.userAgent, 500),
      lastSubmittedAt: now,
      metadata: {
        traceId: input.traceId ?? null
      } satisfies Prisma.InputJsonValue
    };

    const lead = existingLead
      ? await this.prisma.publicLeadSubmission.update({
          where: {
            id: existingLead.id
          },
          data: {
            ...payload,
            submissionCount: {
              increment: 1
            },
            status:
              existingLead.status === PublicLeadStatus.ARCHIVED
                ? PublicLeadStatus.NEW
                : existingLead.status
          }
        })
      : await this.prisma.publicLeadSubmission.create({
          data: {
            ...payload
          }
        });

    const notification = await this.dispatchOpsNotification(lead, input.traceId);

    await this.prisma.publicLeadSubmission.update({
      where: {
        id: lead.id
      },
      data: {
        opsNotificationStatus: notification.status,
        opsNotificationProvider: notification.provider,
        opsNotificationError: notification.errorMessage ?? null,
        opsNotificationLastTriedAt: now,
        opsNotificationSentAt:
          notification.status === NotificationDeliveryStatus.SENT ? now : null
      }
    });

    return {
      success: true as const,
      id: lead.id,
      deduplicated: Boolean(existingLead),
      message: existingLead
        ? "Mesajinizi zaten almistik. Kaydinizi guncelledik ve ekibimize tekrar ilettik."
        : "Mesajinizi aldik. Ekibimiz kisa sure icinde sizinle iletisime gececek."
    };
  }

  private async assertRateLimit(input: { normalizedEmail: string; ipAddressHash?: string }) {
    const now = Date.now();
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    const [recentEmailHit, recentIpCount] = await Promise.all([
      this.prisma.publicLeadSubmission.findUnique({
        where: {
          normalizedEmail: input.normalizedEmail
        },
        select: {
          lastSubmittedAt: true
        }
      }),
      input.ipAddressHash
        ? this.prisma.publicLeadSubmission.count({
            where: {
              ipAddressHash: input.ipAddressHash,
              lastSubmittedAt: {
                gte: oneHourAgo
              }
            }
          })
        : Promise.resolve(0)
    ]);

    if (recentEmailHit?.lastSubmittedAt && recentEmailHit.lastSubmittedAt >= tenMinutesAgo) {
      throw rateLimitException("Ayni e-posta adresi icin cok sik mesaj gonderildi.");
    }

    if (recentIpCount >= 8) {
      throw rateLimitException("Kisa surede cok fazla talep alindi. Lutfen daha sonra tekrar deneyin.");
    }
  }

  private async dispatchOpsNotification(
    lead: {
      id: string;
      fullName: string;
      email: string;
      company: string | null;
      role: string | null;
      phone: string | null;
      message: string | null;
      sourcePage: string | null;
      landingUrl: string | null;
      referrerUrl: string | null;
      submissionCount: number;
      locale: string | null;
    },
    traceId?: string
  ): Promise<OpsDispatchResult> {
    const recipients = (process.env.NOTIFICATION_DEFAULT_EMAIL_TO ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      return {
        status: NotificationDeliveryStatus.FAILED,
        provider: "missing-recipient",
        errorMessage: "NOTIFICATION_DEFAULT_EMAIL_TO ayari eksik."
      };
    }

    const provider = (process.env.EMAIL_PROVIDER ?? "console").trim().toLowerCase();
    const subject = `[Candit] Yeni public contact mesaji - ${lead.fullName}`;
    const body = [
      `Kayit ID: ${lead.id}`,
      `Ad Soyad: ${lead.fullName}`,
      `E-posta: ${lead.email}`,
      `Sirket: ${lead.company ?? "-"}`,
      `Rol: ${lead.role ?? "-"}`,
      `Telefon: ${lead.phone ?? "-"}`,
      `Kaynak sayfa: ${lead.sourcePage ?? "-"}`,
      `Landing URL: ${lead.landingUrl ?? "-"}`,
      `Referrer: ${lead.referrerUrl ?? "-"}`,
      `Locale: ${lead.locale ?? "-"}`,
      `Gonderim sayisi: ${lead.submissionCount}`,
      traceId ? `Trace ID: ${traceId}` : "",
      "",
      "Mesaj:",
      lead.message ?? "-"
    ]
      .filter(Boolean)
      .join("\n");

    if (provider !== "resend") {
      console.log(
        JSON.stringify({
          level: "info",
          message: "public_contact.ops_notification.console",
          to: recipients,
          subject,
          leadId: lead.id,
          traceId: traceId ?? null
        })
      );

      return {
        status: NotificationDeliveryStatus.QUEUED,
        provider: "console-email"
      };
    }

    const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
    const from = (process.env.EMAIL_FROM ?? "noreply@ai-interviewer.local").trim();
    const endpoint = (process.env.RESEND_API_BASE_URL ?? "https://api.resend.com/emails").trim();

    if (!apiKey) {
      return {
        status: NotificationDeliveryStatus.FAILED,
        provider: "resend",
        errorMessage: "RESEND_API_KEY ayari eksik."
      };
    }

    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject,
          text: body,
          html: buildOpsHtmlEmail(subject, body)
        })
      });
    } catch (error) {
      return {
        status: NotificationDeliveryStatus.FAILED,
        provider: "resend",
        errorMessage: error instanceof Error ? error.message : "email_network_error"
      };
    }

    if (!response.ok) {
      return {
        status: NotificationDeliveryStatus.FAILED,
        provider: "resend",
        errorMessage: `Resend HTTP ${response.status}`
      };
    }

    return {
      status: NotificationDeliveryStatus.SENT,
      provider: "resend"
    };
  }
}
