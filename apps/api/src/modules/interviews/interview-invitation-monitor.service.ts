import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AuditActorType, InterviewSessionStatus } from "@prisma/client";
import { StructuredLoggerService } from "../../common/logging/structured-logger.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import {
  AI_FIRST_INTERVIEW_INVITE_SOURCE,
  AI_FIRST_INTERVIEW_REMINDER1_DELAY_DAYS,
  AI_FIRST_INTERVIEW_REMINDER2_BEFORE_EXPIRY_DAYS
} from "./interview-invitation-state.util";

@Injectable()
export class InterviewInvitationMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly pollMs = Number(
    process.env.INTERVIEW_INVITATION_MONITOR_POLL_MS ?? 60_000
  );
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DomainEventsService) private readonly domainEventsService: DomainEventsService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(StructuredLoggerService) private readonly logger: StructuredLoggerService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollMs);

    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const now = new Date();
      const reminder1Threshold = new Date(
        now.getTime() - AI_FIRST_INTERVIEW_REMINDER1_DELAY_DAYS * 24 * 60 * 60 * 1000
      );
      const reminder2Threshold = new Date(
        now.getTime() + AI_FIRST_INTERVIEW_REMINDER2_BEFORE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      );

      const sessions = await this.prisma.interviewSession.findMany({
        where: {
          mode: "VOICE",
          schedulingSource: AI_FIRST_INTERVIEW_INVITE_SOURCE,
          status: InterviewSessionStatus.SCHEDULED,
          candidateAccessExpiresAt: {
            not: null
          },
          OR: [
            {
              candidateAccessExpiresAt: {
                lte: now
              }
            },
            {
              invitationReminder2SentAt: null,
              candidateAccessExpiresAt: {
                gt: now,
                lte: reminder2Threshold
              }
            },
            {
              invitationIssuedAt: {
                not: null,
                lte: reminder1Threshold
              },
              invitationReminder1SentAt: null,
              candidateAccessExpiresAt: {
                gt: now
              }
            }
          ]
        },
        select: {
          id: true,
          tenantId: true,
          applicationId: true,
          candidateAccessExpiresAt: true,
          invitationIssuedAt: true,
          invitationReminder1SentAt: true,
          invitationReminder2SentAt: true
        },
        take: 200
      });

      for (const session of sessions) {
        const expiresAt = session.candidateAccessExpiresAt;

        if (!expiresAt) {
          continue;
        }

        if (expiresAt.getTime() <= now.getTime()) {
          await this.expireInvitation(session.id, session.tenantId, session.applicationId, expiresAt, now);
          continue;
        }

        if (!session.invitationReminder2SentAt && expiresAt.getTime() <= reminder2Threshold.getTime()) {
          await this.sendReminder(session.id, session.tenantId, session.applicationId, 2, now);
          continue;
        }

        if (
          !session.invitationReminder1SentAt &&
          session.invitationIssuedAt &&
          session.invitationIssuedAt.getTime() <= reminder1Threshold.getTime()
        ) {
          await this.sendReminder(session.id, session.tenantId, session.applicationId, 1, now);
        }
      }
    } catch (error) {
      this.logger.warn("interview.invitation.monitor.failed", {
        error: error instanceof Error ? error.message : "unknown_error"
      });
    } finally {
      this.running = false;
    }
  }

  private async sendReminder(
    sessionId: string,
    tenantId: string,
    applicationId: string,
    reminderNumber: 1 | 2,
    now: Date
  ) {
    const reminderField =
      reminderNumber === 1 ? "invitationReminder1SentAt" : "invitationReminder2SentAt";

    const updated = await this.prisma.interviewSession.updateMany({
      where: {
        id: sessionId,
        status: InterviewSessionStatus.SCHEDULED,
        [reminderField]: null,
        candidateAccessExpiresAt: {
          gt: now
        }
      },
      data: {
        invitationStatus: "REMINDER_SENT",
        invitationReminderCount: {
          increment: 1
        },
        [reminderField]: now
      }
    });

    if (updated.count === 0) {
      return;
    }

    await Promise.all([
      this.domainEventsService.append({
        tenantId,
        aggregateType: "InterviewSession",
        aggregateId: sessionId,
        eventType: "interview.invitation.reminder_sent",
        payload: {
          applicationId,
          reminderNumber,
          reminderSentAt: now.toISOString(),
          notificationMetadata: {
            reminderNumber,
            primaryCtaLabel: "G\u00F6r\u00FC\u015Fmeyi Ba\u015Flat",
            hideScheduledAt: true
          }
        }
      }),
      this.auditWriterService.write({
        tenantId,
        actorType: AuditActorType.SYSTEM,
        action: "interview.invitation.reminder_sent",
        entityType: "InterviewSession",
        entityId: sessionId,
        metadata: {
          applicationId,
          reminderNumber,
          reminderSentAt: now.toISOString()
        }
      })
    ]);
  }

  private async expireInvitation(
    sessionId: string,
    tenantId: string,
    applicationId: string,
    expiresAt: Date,
    now: Date
  ) {
    const updated = await this.prisma.interviewSession.updateMany({
      where: {
        id: sessionId,
        status: InterviewSessionStatus.SCHEDULED,
        candidateAccessExpiresAt: {
          lte: now
        }
      },
      data: {
        status: InterviewSessionStatus.NO_SHOW,
        invitationStatus: "EXPIRED",
        endedAt: now,
        completedReasonCode: "invitation_expired"
      }
    });

    if (updated.count === 0) {
      return;
    }

    await Promise.all([
      this.domainEventsService.append({
        tenantId,
        aggregateType: "InterviewSession",
        aggregateId: sessionId,
        eventType: "interview.invitation.expired",
        payload: {
          applicationId,
          expiresAt: expiresAt.toISOString()
        }
      }),
      this.auditWriterService.write({
        tenantId,
        actorType: AuditActorType.SYSTEM,
        action: "interview.invitation.expired",
        entityType: "InterviewSession",
        entityId: sessionId,
        metadata: {
          applicationId,
          expiresAt: expiresAt.toISOString()
        }
      })
    ]);
  }
}
