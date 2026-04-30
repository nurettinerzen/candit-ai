import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { InterviewSessionStatus } from "@prisma/client";
import { InterviewsService } from "./interviews.service";

function createPublicSession() {
  const now = Date.now();
  return {
    id: "sess_1",
    tenantId: "ten_1",
    applicationId: "app_1",
    status: InterviewSessionStatus.SCHEDULED,
    mode: "VOICE",
    schedulingSource: "manual_recruiter",
    invitationStatus: null,
    invitationIssuedAt: null,
    invitationReminderCount: 0,
    invitationReminder1SentAt: null,
    invitationReminder2SentAt: null,
    candidateAccessExpiresAt: new Date(now + 48 * 60 * 60 * 1000),
    candidateLocale: "tr-TR",
    runtimeMode: "guided_voice_turn_v1",
    runtimeProviderMode: "browser_native",
    voiceInputProvider: null,
    voiceOutputProvider: null,
    currentQuestionIndex: 0,
    currentQuestionKey: null,
    engineStateJson: {
      readinessRequired: true,
      readinessConfirmedAt: null
    },
    consentRecordId: null,
    startedAt: null,
    endedAt: null,
    abandonedAt: null,
    completedReasonCode: null,
    lastCandidateActivityAt: null,
    scheduledAt: new Date(now + 24 * 60 * 60 * 1000),
    template: {
      id: "tmpl_1",
      name: "Template",
      roleFamily: "sales",
      version: 1,
      templateJson: {
        introPrompt: "",
        closingPrompt: "",
        blocks: []
      }
    },
    application: {
      candidate: {
        id: "cand_1",
        fullName: "Ayse Kaya"
      },
      job: {
        id: "job_1",
        title: "Sales Manager",
        roleFamily: "sales"
      }
    },
    transcript: null,
    turns: []
  };
}

function createService() {
  const domainEvents: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const sessions: Array<Record<string, unknown>> = [];
  const consentCreates: Array<Record<string, unknown>> = [];
  let integrationConnections: Array<Record<string, unknown>> = [];
  let consentLookupResult: Record<string, unknown> | null = null;

  const prisma = {
    consentRecord: {
      findFirst: async () => consentLookupResult,
      create: async (input: { data: Record<string, unknown> }) => {
        consentCreates.push(input.data);
        return {
          id: "con_1",
          capturedAt: new Date("2026-04-16T10:00:00.000Z"),
          ...input.data
        };
      }
    },
    interviewSession: {
      update: async (input: { data: Record<string, unknown> }) => {
        sessions.push(input.data);
        return {
          ...createPublicSession(),
          status: InterviewSessionStatus.RUNNING,
          consentRecordId: (input.data.consentRecordId as string | null | undefined) ?? null,
          startedAt: new Date("2026-04-16T10:00:00.000Z"),
          lastCandidateActivityAt: new Date("2026-04-16T10:00:00.000Z"),
          voiceInputProvider: "browser_speech_recognition",
          voiceOutputProvider: "browser_speech_synthesis",
          runtimeProviderMode: "browser_native"
        };
      }
    },
    tenant: {
      findUnique: async () => ({
        hiringSettingsJson: null
      })
    },
    integrationConnection: {
      findMany: async () => integrationConnections
    }
  };

  const service = new InterviewsService(
    prisma as never,
    {
      append: async (input: Record<string, unknown>) => {
        domainEvents.push(input);
        return { id: `evt_${domainEvents.length}` };
      }
    } as never,
    {
      write: async (input: Record<string, unknown>) => {
        audits.push(input);
        return { id: `audit_${audits.length}` };
      }
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      resolveRuntimeSelection: () => ({
        voiceInputProvider: "browser_speech_recognition",
        voiceOutputProvider: "browser_speech_synthesis",
        runtimeProviderMode: "browser_native"
      })
    } as never,
    {
      meetingProviderCatalog: [
        {
          provider: "GOOGLE_CALENDAR",
          status: "pilot",
          ready: true,
          requiresConnection: true,
          oauthConfigured: true
        },
        {
          provider: "GOOGLE_MEET",
          status: "pilot",
          ready: true,
          requiresConnection: true,
          oauthConfigured: true
        },
        {
          provider: "ZOOM",
          status: "unsupported",
          ready: false,
          requiresConnection: true,
          oauthConfigured: false
        },
        {
          provider: "MICROSOFT_CALENDAR",
          status: "unsupported",
          ready: false,
          requiresConnection: true,
          oauthConfigured: false
        }
      ]
    } as never,
    {} as never,
    {} as never
  );

  const serviceAsAny = service as any;
  serviceAsAny.resolvePublicSession = async () => createPublicSession();
  serviceAsAny.ensurePromptForRunningSession = async (session: Record<string, unknown>) => session;
  serviceAsAny.toPublicSessionView = async (session: Record<string, unknown>) => ({
    sessionId: session.id,
    status: session.status,
    consent: {
      required: true,
      status: session.consentRecordId ? "GRANTED" : "PENDING"
    }
  });

  return {
    service,
    domainEvents,
    audits,
    sessions,
    consentCreates,
    setIntegrationConnections(value: Array<Record<string, unknown>>) {
      integrationConnections = value;
    },
    setConsentLookupResult(value: Record<string, unknown> | null) {
      consentLookupResult = value;
    }
  };
}

test("startPublicSession blocks session start until consent is accepted", async () => {
  const { service, sessions, consentCreates } = createService();

  await assert.rejects(
    () =>
      service.startPublicSession({
        sessionId: "sess_1",
        accessToken: "token_1"
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message.includes("onayını vermeniz gerekiyor")
  );

  assert.equal(consentCreates.length, 0);
  assert.equal(sessions.length, 0);
});

test("startPublicSession captures consent and promotes the session when consent is accepted", async () => {
  const { service, domainEvents, audits, sessions, consentCreates } = createService();

  const result = await service.startPublicSession({
    sessionId: "sess_1",
    accessToken: "token_1",
    consentAccepted: true,
    capabilities: {
      speechRecognition: true,
      speechSynthesis: true,
      locale: "tr-TR"
    },
    traceId: "trace_1"
  });

  assert.equal(consentCreates.length, 1);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.consentRecordId, "con_1");
  assert.equal(sessions[0]?.status, InterviewSessionStatus.RUNNING);

  assert.equal(domainEvents.length, 2);
  assert.equal(domainEvents[0]?.eventType, "interview.consent.captured");
  assert.equal(domainEvents[1]?.eventType, "interview.session.started");

  assert.equal(audits.length, 2);
  assert.equal(audits[0]?.action, "interview.consent.captured");
  assert.equal(audits[1]?.action, "interview.session.started");

  assert.equal((result as { consent: { status: string } }).consent.status, "GRANTED");
});

test("listSchedulingProviders exposes launch boundary catalog alongside active connections", async () => {
  const { service, setIntegrationConnections } = createService();

  setIntegrationConnections([
    {
      id: "conn_1",
      provider: "GOOGLE_MEET",
      displayName: "Google Meet Team",
      configJson: {
        baseMeetingUrl: "https://meet.google.com"
      },
      updatedAt: new Date("2026-04-17T10:00:00.000Z")
    }
  ]);

  const result = await service.listSchedulingProviders("ten_1");

  assert.equal(result.providers.length, 1);
  assert.equal(result.providers[0]?.provider, "GOOGLE_MEET");
  assert.equal(result.providers[0]?.hasMeetingUrlTemplate, true);

  const googleMeet = result.catalog.find((item: { provider: string }) => item.provider === "GOOGLE_MEET");
  const zoom = result.catalog.find((item: { provider: string }) => item.provider === "ZOOM");

  assert.deepEqual(googleMeet, {
    provider: "GOOGLE_MEET",
    status: "pilot",
    ready: true,
    requiresConnection: true,
    oauthConfigured: true,
    connected: true,
    connectionId: "conn_1",
    displayName: "Google Meet Team",
    hasMeetingUrlTemplate: true,
    updatedAt: new Date("2026-04-17T10:00:00.000Z"),
    selectable: true,
    selectionReason: null
  });
  assert.equal(zoom?.status, "unsupported");
  assert.equal(zoom?.connected, false);
  assert.equal(zoom?.selectable, false);
  assert.equal(zoom?.selectionReason, "ZOOM V1 kapsaminda desteklenmiyor.");
  assert.equal(result.fallback.label, "Dahili Meeting Link Fallback");
});
