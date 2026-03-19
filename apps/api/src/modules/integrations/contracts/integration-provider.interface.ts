import type { IntegrationProvider } from "@prisma/client";

export type IntegrationSyncInput = {
  tenantId: string;
  objectType: string;
  cursor?: string | null;
  traceId?: string;
  connection: {
    id: string;
    config: Record<string, unknown>;
    credentials: Record<string, unknown>;
    auth?: Record<string, unknown>;
  };
};

export type IntegrationSyncResult = {
  provider: IntegrationProvider;
  objectType: string;
  fetchedCount: number;
  nextCursor?: string | null;
  status: "ok" | "noop" | "error";
  details?: Record<string, unknown>;
};

export type IntegrationWebhookInput = {
  tenantId: string;
  eventKey: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  traceId?: string;
  connection?: {
    id: string;
    config: Record<string, unknown>;
    credentials: Record<string, unknown>;
    auth?: Record<string, unknown>;
  };
  headers?: Record<string, string | string[] | undefined>;
};

export type IntegrationDomainEventInput = {
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  traceId?: string;
  connection: {
    id: string;
    config: Record<string, unknown>;
    credentials: Record<string, unknown>;
    auth?: Record<string, unknown>;
  };
};

export type IntegrationInterviewProvisionInput = {
  tenantId: string;
  sessionId: string;
  traceId?: string;
  connection: {
    id: string;
    provider: IntegrationProvider;
    config: Record<string, unknown>;
    credentials: Record<string, unknown>;
    auth?: Record<string, unknown>;
  };
  payload: {
    scheduledAt?: Date | null;
    durationMinutes?: number | null;
    timezone?: string | null;
    title?: string | null;
    description?: string | null;
    candidateEmail?: string | null;
    candidateName?: string | null;
    interviewerName?: string | null;
    existingExternalRef?: string | null;
    existingCalendarEventRef?: string | null;
  };
};

export type IntegrationInterviewProvisionResult = {
  status: "booked" | "requires_action" | "unavailable" | "failed";
  providerSource: string;
  joinUrl?: string | null;
  externalRef?: string | null;
  calendarEventRef?: string | null;
  details?: Record<string, unknown>;
};

export type IntegrationInterviewCancelInput = {
  tenantId: string;
  sessionId: string;
  traceId?: string;
  connection: {
    id: string;
    provider: IntegrationProvider;
    config: Record<string, unknown>;
    credentials: Record<string, unknown>;
    auth?: Record<string, unknown>;
  };
  payload: {
    externalRef?: string | null;
    calendarEventRef?: string | null;
    reasonCode?: string | null;
  };
};

export interface IntegrationProviderAdapter {
  readonly provider: IntegrationProvider;
  sync(input: IntegrationSyncInput): Promise<IntegrationSyncResult>;
  handleWebhook(input: IntegrationWebhookInput): Promise<{ status: "processed" | "ignored"; details?: Record<string, unknown> }>;
  forwardDomainEvent?(input: IntegrationDomainEventInput): Promise<{ forwarded: boolean; details?: Record<string, unknown> }>;
  provisionInterview?(
    input: IntegrationInterviewProvisionInput
  ): Promise<IntegrationInterviewProvisionResult>;
  updateInterview?(
    input: IntegrationInterviewProvisionInput
  ): Promise<IntegrationInterviewProvisionResult>;
  cancelInterview?(input: IntegrationInterviewCancelInput): Promise<{
    cancelled: boolean;
    details?: Record<string, unknown>;
  }>;
}
