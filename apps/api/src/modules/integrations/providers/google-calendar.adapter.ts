import { IntegrationProvider } from "@prisma/client";
import type {
  IntegrationDomainEventInput,
  IntegrationInterviewCancelInput,
  IntegrationInterviewProvisionInput,
  IntegrationInterviewProvisionResult,
  IntegrationProviderAdapter,
  IntegrationSyncInput,
  IntegrationSyncResult,
  IntegrationWebhookInput
} from "../contracts/integration-provider.interface";

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeHeader(headers: Record<string, string | string[] | undefined>, key: string) {
  const value = headers[key.toLowerCase()] ?? headers[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

type GoogleEvent = {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      uri?: string;
      entryPointType?: string;
    }>;
  };
};

export class GoogleCalendarAdapter implements IntegrationProviderAdapter {
  constructor(readonly provider: IntegrationProvider) {}

  async sync(input: IntegrationSyncInput): Promise<IntegrationSyncResult> {
    const calendarId = asString(input.connection.config.calendarId) ?? "primary";
    const token = this.resolveAccessToken(input.connection.auth, input.connection.credentials);

    if (!token) {
      return {
        provider: this.provider,
        objectType: input.objectType,
        fetchedCount: 0,
        nextCursor: input.cursor ?? null,
        status: "error",
        details: {
          message: "Google access token eksik; oauth refresh gerekli.",
          connectionId: input.connection.id
        }
      };
    }

    if (input.objectType.toLowerCase() === "free_busy") {
      return this.syncFreeBusy(input, calendarId, token);
    }

    return this.syncEvents(input, calendarId, token);
  }

  async handleWebhook(input: IntegrationWebhookInput) {
    const headers = input.headers ?? {};
    const expectedChannelToken = asString(input.connection?.config?.webhookChannelToken);
    const incomingToken = safeHeader(headers, "x-goog-channel-token");

    if (expectedChannelToken && incomingToken !== expectedChannelToken) {
      return {
        status: "ignored" as const,
        details: {
          message: "google_webhook_channel_token_mismatch"
        }
      };
    }

    return {
      status: "processed" as const,
      details: {
        resourceState: safeHeader(headers, "x-goog-resource-state"),
        resourceId: safeHeader(headers, "x-goog-resource-id"),
        channelId: safeHeader(headers, "x-goog-channel-id"),
        eventKey: input.eventKey
      }
    };
  }

  async forwardDomainEvent(input: IntegrationDomainEventInput) {
    const token = this.resolveAccessToken(input.connection.auth, input.connection.credentials);
    if (!token) {
      return {
        forwarded: false,
        details: {
          message: "google_domain_event_skipped_no_access_token"
        }
      };
    }

    return {
      forwarded: true,
      details: {
        message: "google_domain_event_forwarding_recorded",
        eventType: input.eventType,
        aggregateType: input.aggregateType
      }
    };
  }

  async provisionInterview(
    input: IntegrationInterviewProvisionInput
  ): Promise<IntegrationInterviewProvisionResult> {
    const token = this.resolveAccessToken(input.connection.auth, input.connection.credentials);
    if (!token) {
      return {
        status: "requires_action",
        providerSource: "google_oauth_missing",
        details: {
          message: "Google oauth access token missing."
        }
      };
    }

    const calendarId = asString(input.connection.config.calendarId) ?? "primary";
    const scheduledAt = input.payload.scheduledAt ?? null;
    const durationMinutes = input.payload.durationMinutes ?? 45;
    const endAt = scheduledAt
      ? new Date(scheduledAt.getTime() + Math.max(15, durationMinutes) * 60 * 1000)
      : null;
    const timezone = input.payload.timezone ?? "UTC";
    const title =
      input.payload.title ??
      `Interview Session ${input.sessionId.slice(0, 8)} (${this.provider})`;

    const body: Record<string, unknown> = {
      summary: title,
      description: input.payload.description ?? "Scheduled by AI Interviewer assistant flow.",
      attendees: this.toAttendees(input),
      start: scheduledAt
        ? {
            dateTime: scheduledAt.toISOString(),
            timeZone: timezone
          }
        : undefined,
      end: endAt
        ? {
            dateTime: endAt.toISOString(),
            timeZone: timezone
          }
        : undefined
    };

    if (this.provider === IntegrationProvider.GOOGLE_MEET) {
      body.conferenceData = {
        createRequest: {
          requestId: `meet-${input.sessionId}`,
          conferenceSolutionKey: {
            type: "hangoutsMeet"
          }
        }
      };
    }

    const response = await this.callGoogleApi<GoogleEvent>({
      token,
      path: `/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=none`,
      method: "POST",
      body
    });

    if (!response.ok) {
      return {
        status: "failed",
        providerSource: "google_calendar_api_error",
        details: {
          status: response.statusCode,
          body: response.errorBody
        }
      };
    }

    const event = response.payload ?? {};
    const joinUrl = this.resolveJoinUrl(event);
    const externalRef = asString(event.id);

    return {
      status: "booked",
      providerSource: this.provider === IntegrationProvider.GOOGLE_MEET ? "google_meet_event" : "google_calendar_event",
      joinUrl,
      externalRef,
      calendarEventRef: externalRef,
      details: {
        htmlLink: asString(event.htmlLink),
        provider: this.provider
      }
    };
  }

  async updateInterview(
    input: IntegrationInterviewProvisionInput
  ): Promise<IntegrationInterviewProvisionResult> {
    const token = this.resolveAccessToken(input.connection.auth, input.connection.credentials);
    if (!token) {
      return {
        status: "requires_action",
        providerSource: "google_oauth_missing",
        details: {
          message: "Google oauth access token missing."
        }
      };
    }

    const calendarId = asString(input.connection.config.calendarId) ?? "primary";
    const existingEventId = input.payload.existingCalendarEventRef ?? input.payload.existingExternalRef;

    if (!existingEventId) {
      return this.provisionInterview(input);
    }

    const scheduledAt = input.payload.scheduledAt ?? null;
    const durationMinutes = input.payload.durationMinutes ?? 45;
    const endAt = scheduledAt
      ? new Date(scheduledAt.getTime() + Math.max(15, durationMinutes) * 60 * 1000)
      : null;
    const timezone = input.payload.timezone ?? "UTC";
    const title =
      input.payload.title ??
      `Interview Session ${input.sessionId.slice(0, 8)} (${this.provider})`;

    const body: Record<string, unknown> = {
      summary: title,
      description: input.payload.description ?? "Updated by AI Interviewer assistant flow.",
      attendees: this.toAttendees(input),
      start: scheduledAt
        ? {
            dateTime: scheduledAt.toISOString(),
            timeZone: timezone
          }
        : undefined,
      end: endAt
        ? {
            dateTime: endAt.toISOString(),
            timeZone: timezone
          }
        : undefined
    };

    const response = await this.callGoogleApi<GoogleEvent>({
      token,
      path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existingEventId)}?conferenceDataVersion=1&sendUpdates=none`,
      method: "PATCH",
      body
    });

    if (!response.ok) {
      return {
        status: "failed",
        providerSource: "google_calendar_update_error",
        details: {
          status: response.statusCode,
          body: response.errorBody
        }
      };
    }

    const event = response.payload ?? {};
    const joinUrl = this.resolveJoinUrl(event);
    const eventRef = asString(event.id) ?? existingEventId;

    return {
      status: "booked",
      providerSource: "google_calendar_updated",
      joinUrl,
      externalRef: eventRef,
      calendarEventRef: eventRef,
      details: {
        htmlLink: asString(event.htmlLink)
      }
    };
  }

  async cancelInterview(input: IntegrationInterviewCancelInput) {
    const token = this.resolveAccessToken(input.connection.auth, input.connection.credentials);
    if (!token) {
      return {
        cancelled: false,
        details: {
          message: "google_oauth_missing"
        }
      };
    }

    const calendarId = asString(input.connection.config.calendarId) ?? "primary";
    const eventId = input.payload.calendarEventRef ?? input.payload.externalRef;

    if (!eventId) {
      return {
        cancelled: false,
        details: {
          message: "calendar_event_ref_missing"
        }
      };
    }

    const response = await this.callGoogleApi<void>({
      token,
      path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      method: "DELETE"
    });

    return {
      cancelled: response.ok,
      details: response.ok
        ? { eventId }
        : {
            message: "google_calendar_cancel_error",
            status: response.statusCode,
            body: response.errorBody
          }
    };
  }

  private async syncEvents(
    input: IntegrationSyncInput,
    calendarId: string,
    token: string
  ): Promise<IntegrationSyncResult> {
    const timeMin = input.cursor && input.cursor.startsWith("timeMin=")
      ? input.cursor.replace(/^timeMin=/, "")
      : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
      timeMin
    });

    const response = await this.callGoogleApi<{ items?: unknown[]; nextSyncToken?: string }>({
      token,
      path: `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
      method: "GET"
    });

    if (!response.ok) {
      return {
        provider: this.provider,
        objectType: input.objectType,
        fetchedCount: 0,
        nextCursor: input.cursor ?? null,
        status: "error",
        details: {
          message: "google_events_sync_failed",
          status: response.statusCode,
          body: response.errorBody
        }
      };
    }

    const items = Array.isArray(response.payload?.items)
      ? response.payload?.items.map((item) => asRecord(item))
      : [];
    const nextCursor = asString(response.payload?.nextSyncToken)
      ? `syncToken=${response.payload?.nextSyncToken as string}`
      : `timeMin=${new Date().toISOString()}`;

    return {
      provider: this.provider,
      objectType: input.objectType,
      fetchedCount: items.length,
      nextCursor,
      status: "ok",
      details: {
        items
      }
    };
  }

  private async syncFreeBusy(
    input: IntegrationSyncInput,
    calendarId: string,
    token: string
  ): Promise<IntegrationSyncResult> {
    const start = asDate(input.cursor) ?? new Date();
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    const response = await this.callGoogleApi<{ calendars?: Record<string, unknown> }>({
      token,
      path: "/freeBusy",
      method: "POST",
      body: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: calendarId }]
      }
    });

    if (!response.ok) {
      return {
        provider: this.provider,
        objectType: input.objectType,
        fetchedCount: 0,
        nextCursor: input.cursor ?? null,
        status: "error",
        details: {
          message: "google_free_busy_failed",
          status: response.statusCode,
          body: response.errorBody
        }
      };
    }

    const calendars = asRecord(response.payload?.calendars);
    const calendar = asRecord(calendars[calendarId]);
    const busy = Array.isArray(calendar.busy)
      ? calendar.busy.map((item) => asRecord(item))
      : [];

    return {
      provider: this.provider,
      objectType: input.objectType,
      fetchedCount: busy.length,
      nextCursor: end.toISOString(),
      status: "ok",
      details: {
        calendarId,
        busy
      }
    };
  }

  private resolveAccessToken(auth: Record<string, unknown> | undefined, credentials: Record<string, unknown>) {
    const authToken = asString(auth?.accessToken);
    if (authToken) {
      return authToken;
    }

    return asString(credentials.accessToken);
  }

  private async callGoogleApi<T>(input: {
    token: string;
    path: string;
    method: "GET" | "POST" | "PATCH" | "DELETE";
    body?: Record<string, unknown>;
  }) {
    let response: Response;
    try {
      response = await fetch(`https://www.googleapis.com/calendar/v3${input.path}`, {
        method: input.method,
        headers: {
          authorization: `Bearer ${input.token}`,
          ...(input.body ? { "content-type": "application/json" } : {})
        },
        ...(input.body ? { body: JSON.stringify(input.body) } : {})
      });
    } catch (error) {
      return {
        ok: false,
        statusCode: 0,
        errorBody: error instanceof Error ? error.message : "google_api_network_error"
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        errorBody: (await response.text()).slice(0, 400)
      };
    }

    if (input.method === "DELETE" || response.status === 204) {
      return {
        ok: true,
        statusCode: response.status,
        payload: undefined as T | undefined
      };
    }

    return {
      ok: true,
      statusCode: response.status,
      payload: (await response.json()) as T
    };
  }

  private resolveJoinUrl(event: GoogleEvent) {
    const explicit = asString(event.hangoutLink);
    if (explicit) {
      return explicit;
    }

    const conferenceUrl = event.conferenceData?.entryPoints
      ?.map((entry) => asString(entry.uri))
      .find((value): value is string => Boolean(value));

    if (conferenceUrl) {
      return conferenceUrl;
    }

    return asString(event.htmlLink);
  }

  private toAttendees(input: IntegrationInterviewProvisionInput) {
    const attendees: Array<{ email: string; displayName?: string }> = [];

    if (input.payload.candidateEmail) {
      attendees.push({
        email: input.payload.candidateEmail,
        ...(input.payload.candidateName ? { displayName: input.payload.candidateName } : {})
      });
    }

    return attendees;
  }
}
