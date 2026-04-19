import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationsController } from "./applications.controller";

function createController() {
  const applicationAutomationService = {
    onRecruiterApprovedForInterview: async (_input: Record<string, unknown>) => ({
      status: "ok",
      applicationId: "app_1",
      sessionId: "session_1",
      interviewLink: "https://example.com/interview/session_1",
      expiresAt: "2026-04-21T00:00:00.000Z"
    })
  };

  const applicationsService = {
    assertJobActionable: async () => undefined,
    getById: async () => ({
      candidateId: "cand_1",
      jobId: "job_1"
    }),
    decision: async (input: Record<string, unknown>) => ({
      status: "rejected",
      ...input
    }),
    stageTransition: async (_input: Record<string, unknown>) => {
      throw new Error("stageTransition should not be called for quick reject");
    }
  };

  const recruiterNotesService = {
    create: async () => undefined
  };

  const interviewsService = {
    sendInvitationReminder: async (_input: Record<string, unknown>) => ({
      status: "queued"
    })
  };

  const controller = new ApplicationsController(
    applicationsService as never,
    applicationAutomationService as never,
    {} as never,
    recruiterNotesService as never,
    {} as never,
    interviewsService as never
  );

  return {
    controller,
    applicationAutomationService,
    applicationsService,
    recruiterNotesService,
    interviewsService
  };
}

test("quickAction reject uses the human-approved decision flow", async () => {
  const { controller, applicationsService } = createController();
  let capturedDecisionInput: Record<string, unknown> | null = null;
  let assertJobActionableCalls = 0;

  applicationsService.assertJobActionable = async () => {
    assertJobActionableCalls += 1;
  };

  applicationsService.decision = async (input: Record<string, unknown>) => {
    capturedDecisionInput = input;
    return {
      applicationId: input.applicationId,
      status: "rejected"
    };
  };

  const result = await controller.quickAction(
    "app_1",
    "ten_1",
    { userId: "usr_1" } as never,
    { traceId: "trace_1" } as never,
    { action: "reject" } as never
  );

  assert.equal(assertJobActionableCalls, 1);
  assert.deepEqual(capturedDecisionInput, {
    tenantId: "ten_1",
    applicationId: "app_1",
    aiReportId: "manual_quick_action_reject",
    reasonCode: "rejected_by_recruiter",
    decision: "reject",
    changedBy: "usr_1",
    humanApprovedBy: "usr_1",
    traceId: "trace_1"
  });
  assert.deepEqual(result, {
    applicationId: "app_1",
    status: "rejected"
  });
});

test("quickAction send_reminder queues an interview invitation reminder", async () => {
  const { controller, interviewsService } = createController();
  let capturedInput: Record<string, unknown> | null = null;

  interviewsService.sendInvitationReminder = async (input: Record<string, unknown>) => {
    capturedInput = input;
    return {
      status: "queued",
      applicationId: "app_1",
      sessionId: "session_1",
      reminderNumber: 1
    };
  };

  const result = await controller.quickAction(
    "app_1",
    "ten_1",
    { userId: "usr_9" } as never,
    { traceId: "trace_reminder" } as never,
    { action: "send_reminder" } as never
  );

  assert.deepEqual(capturedInput, {
    tenantId: "ten_1",
    applicationId: "app_1",
    requestedBy: "usr_9",
    traceId: "trace_reminder"
  });
  assert.deepEqual(result, {
    status: "queued",
    applicationId: "app_1",
    sessionId: "session_1",
    reminderNumber: 1
  });
});

test("quickAction reinvite_interview uses the interview approval flow", async () => {
  const { controller, applicationAutomationService } = createController();
  let capturedInput: Record<string, unknown> | null = null;

  applicationAutomationService.onRecruiterApprovedForInterview = async (input: Record<string, unknown>) => {
    capturedInput = input;
    return {
      status: "ok",
      applicationId: "app_1",
      sessionId: "session_reinvite_1",
      interviewLink: "https://example.com/interview/session_reinvite_1",
      expiresAt: "2026-04-25T00:00:00.000Z"
    };
  };

  const result = await controller.quickAction(
    "app_1",
    "ten_1",
    { userId: "usr_recruiter" } as never,
    { traceId: "trace_reinvite" } as never,
    { action: "reinvite_interview" } as never
  );

  assert.deepEqual(capturedInput, {
    tenantId: "ten_1",
    applicationId: "app_1",
    candidateId: "cand_1",
    jobId: "job_1",
    templateId: undefined,
    questionnaire: undefined,
    requestedBy: "usr_recruiter",
    traceId: "trace_reinvite"
  });
  assert.deepEqual(result, {
    action: "reinvite_interview",
    status: "ok",
    applicationId: "app_1",
    sessionId: "session_reinvite_1",
    interviewLink: "https://example.com/interview/session_reinvite_1",
    expiresAt: "2026-04-25T00:00:00.000Z"
  });
});
