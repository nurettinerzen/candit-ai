import assert from "node:assert/strict";
import test from "node:test";
import { InterviewInvitationMonitorService } from "./interview-invitation-monitor.service";

function createService() {
  const domainEvents: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  let updateInput: { where: Record<string, unknown>; data: Record<string, unknown> } | null = null;

  const prisma = {
    interviewSession: {
      findFirst: async () => ({
        id: "session_1",
        tenantId: "ten_1",
        applicationId: "app_1",
        candidateAccessExpiresAt: new Date("2026-04-20T10:00:00.000Z"),
        invitationIssuedAt: new Date("2026-04-16T10:00:00.000Z"),
        invitationReminderCount: 0,
        invitationReminder1SentAt: null,
        invitationReminder2SentAt: null,
        meetingJoinUrl: "https://app.candit.ai/interview/session_1?token=abc",
        application: {
          candidate: {
            email: "ayse@example.com"
          }
        }
      }),
      updateMany: async (input: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        updateInput = input;
        return { count: 1 };
      }
    }
  };

  const service = new InterviewInvitationMonitorService(
    prisma as never,
    {
      append: async (input: Record<string, unknown>) => {
        domainEvents.push(input);
        return {
          id: `event_${domainEvents.length}`
        };
      }
    } as never,
    {
      write: async (input: Record<string, unknown>) => {
        audits.push(input);
        return {
          id: `audit_${audits.length}`
        };
      }
    } as never,
    {
      warn: () => undefined
    } as never
  );

  return {
    service,
    domainEvents,
    audits,
    getUpdateInput: () => updateInput
  };
}

test("sendManualReminder queues a manual interview invitation reminder", async () => {
  const { service, domainEvents, audits, getUpdateInput } = createService();

  const result = await service.sendManualReminder({
    tenantId: "ten_1",
    applicationId: "app_1",
    requestedBy: "usr_1",
    traceId: "trace_1"
  });

  assert.equal(result.status, "queued");
  assert.equal(result.applicationId, "app_1");
  assert.equal(result.sessionId, "session_1");
  assert.equal(result.reminderNumber, 1);
  assert.equal(result.interviewLink, "https://app.candit.ai/interview/session_1?token=abc");

  const updateInput = getUpdateInput();
  assert.equal(updateInput?.where.id, "session_1");
  assert.equal(updateInput?.data.invitationStatus, "REMINDER_SENT");
  assert.deepEqual(updateInput?.data.invitationReminderCount, {
    increment: 1
  });
  assert.ok(updateInput?.data.invitationReminder1SentAt instanceof Date);

  assert.equal(domainEvents.length, 1);
  assert.equal(domainEvents[0]?.eventType, "interview.invitation.reminder_sent");
  assert.deepEqual(domainEvents[0]?.payload, {
    applicationId: "app_1",
    reminderNumber: 1,
    reminderSentAt: (domainEvents[0]?.payload as Record<string, unknown>).reminderSentAt,
    notificationMetadata: {
      reminderNumber: 1,
      reminderSource: "manual_recruiter",
      primaryCtaLabel: "Görüşmeyi Başlat",
      hideScheduledAt: true
    }
  });

  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "interview.invitation.reminder_requested");
  assert.equal(audits[0]?.actorUserId, "usr_1");
});
