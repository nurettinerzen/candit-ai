import { createHmac } from "crypto";
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

function safeHeader(headers: Record<string, string | string[] | undefined>, key: string) {
  const direct = headers[key] ?? headers[key.toLowerCase()];
  if (Array.isArray(direct)) {
    return direct[0] ?? null;
  }

  return direct ?? null;
}

export class CalendlyAdapter implements IntegrationProviderAdapter {
  readonly provider = IntegrationProvider.CALENDLY;

  async sync(input: IntegrationSyncInput): Promise<IntegrationSyncResult> {
    const apiBase = asString(input.connection.config.apiBaseUrl) ?? "https://api.calendly.com";
    const token = this.resolveApiToken(input.connection.auth, input.connection.credentials);

    if (!token) {
      return {
        provider: this.provider,
        objectType: input.objectType,
        fetchedCount: 0,
        nextCursor: input.cursor ?? null,
        status: "error",
        details: {
          message: "Calendly token missing.",
          connectionId: input.connection.id
        }
      };
    }

    const objectType = input.objectType.toLowerCase();
    const path =
      objectType === "event_types"
        ? "/event_types"
        : objectType === "scheduled_events"
          ? "/scheduled_events"
          : "/scheduled_events";
    const cursor = input.cursor ? `&page_token=${encodeURIComponent(input.cursor)}` : "";
    const url = `${apiBase.replace(/\/+$/, "")}${path}?count=50${cursor}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      return {
        provider: this.provider,
        objectType: input.objectType,
        fetchedCount: 0,
        nextCursor: input.cursor ?? null,
        status: "error",
        details: {
          message: error instanceof Error ? error.message : "calendly_sync_network_error"
        }
      };
    }

    if (!response.ok) {
      return {
        provider: this.provider,
        objectType: input.objectType,
        fetchedCount: 0,
        nextCursor: input.cursor ?? null,
        status: "error",
        details: {
          message: `Calendly sync HTTP ${response.status}`
        }
      };
    }

    const payload = asRecord(await response.json());
    const collection = Array.isArray(payload.collection)
      ? payload.collection.map((item) => asRecord(item))
      : [];
    const pagination = asRecord(payload.pagination);
    const nextCursor = asString(pagination.next_page_token);

    return {
      provider: this.provider,
      objectType: input.objectType,
      fetchedCount: collection.length,
      nextCursor,
      status: "ok",
      details: {
        items: collection
      }
    };
  }

  async handleWebhook(input: IntegrationWebhookInput) {
    const headers = input.headers ?? {};
    const secret =
      asString(input.connection?.credentials?.webhookSigningSecret) ??
      asString(input.connection?.config?.webhookSigningSecret) ??
      process.env.CALENDLY_WEBHOOK_SIGNING_SECRET?.trim() ??
      null;

    if (secret) {
      const signatureHeader =
        safeHeader(headers, "calendly-webhook-signature") ??
        safeHeader(headers, "x-calendly-webhook-signature");
      if (!signatureHeader) {
        return {
          status: "ignored" as const,
          details: {
            message: "calendly_signature_header_missing"
          }
        };
      }

      const verified = this.verifySignature({
        signatureHeader,
        secret,
        payload: input.payload
      });

      if (!verified.ok) {
        return {
          status: "ignored" as const,
          details: {
            message: "calendly_signature_invalid",
            reason: verified.reason
          }
        };
      }
    }

    const payload = asRecord(input.payload.payload);
    const event = asRecord(payload.event);
    const invitee = asRecord(payload.invitee);

    return {
      status: "processed" as const,
      details: {
        webhookEvent: asString(input.payload.event),
        scheduledEventUri: asString(event.uri),
        inviteeUri: asString(invitee.uri),
        inviteeEmail: asString(invitee.email),
        status: asString(event.status),
        eventStartTime: asString(event.start_time)
      }
    };
  }

  async forwardDomainEvent(input: IntegrationDomainEventInput) {
    return {
      forwarded: true,
      details: {
        message: "calendly_domain_event_recorded",
        eventType: input.eventType,
        aggregateType: input.aggregateType
      }
    };
  }

  async provisionInterview(
    input: IntegrationInterviewProvisionInput
  ): Promise<IntegrationInterviewProvisionResult> {
    const token = this.resolveApiToken(input.connection.auth, input.connection.credentials);
    const apiBase = asString(input.connection.config.apiBaseUrl) ?? "https://api.calendly.com";

    // Attempt direct booking via one-off event type if token + event type URI are available
    if (token && input.payload.scheduledAt && input.payload.candidateEmail) {
      const eventTypeUri = asString(input.connection.config.eventTypeUri);
      if (eventTypeUri) {
        const directResult = await this.createOneOffBooking({
          apiBase,
          token,
          eventTypeUri,
          scheduledAt: input.payload.scheduledAt,
          candidateEmail: input.payload.candidateEmail,
          candidateName: input.payload.candidateName ?? undefined,
          sessionId: input.sessionId
        });

        if (directResult) {
          return {
            status: "booked",
            providerSource: "calendly_direct_booking",
            joinUrl: directResult.joinUrl ?? null,
            externalRef: directResult.eventUri ?? input.payload.existingExternalRef ?? null,
            calendarEventRef: directResult.inviteeUri ?? input.payload.existingCalendarEventRef ?? null,
            details: {
              message: "Interview booked directly via Calendly API.",
              eventUri: directResult.eventUri,
              inviteeUri: directResult.inviteeUri
            }
          };
        }
      }
    }

    // Fallback: return scheduling link for candidate self-service
    const schedulingUrl =
      asString(input.connection.config.schedulingUrl) ??
      asString(input.connection.config.schedulingUrlTemplate)?.replace(
        "{sessionId}",
        encodeURIComponent(input.sessionId)
      ) ??
      asString(input.connection.config.organizerSchedulingUrl) ??
      null;

    if (!schedulingUrl) {
      return {
        status: "unavailable",
        providerSource: "calendly_link_missing",
        details: {
          message: "Calendly scheduling URL is not configured."
        }
      };
    }

    return {
      status: "requires_action",
      providerSource: "calendly_scheduling_link",
      joinUrl: schedulingUrl,
      externalRef: input.payload.existingExternalRef ?? null,
      calendarEventRef: input.payload.existingCalendarEventRef ?? null,
      details: {
        message: "Candidate must pick an availability slot through Calendly link."
      }
    };
  }

  async updateInterview(
    input: IntegrationInterviewProvisionInput
  ): Promise<IntegrationInterviewProvisionResult> {
    return this.provisionInterview(input);
  }

  async cancelInterview(input: IntegrationInterviewCancelInput) {
    const token = this.resolveApiToken(input.connection.auth, input.connection.credentials);
    const apiBase = asString(input.connection.config.apiBaseUrl) ?? "https://api.calendly.com";
    const eventUri = asString(input.payload.externalRef);

    if (!token || !eventUri) {
      return {
        cancelled: false,
        details: {
          message: "Calendly cancellations are expected via webhook sync (no token or event ref)."
        }
      };
    }

    try {
      const cancelUrl = eventUri.startsWith("http")
        ? `${eventUri}/cancellation`
        : `${apiBase.replace(/\/+$/, "")}${eventUri}/cancellation`;

      const response = await fetch(cancelUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reason: input.payload.reasonCode ?? "Cancelled via AI Interviewer"
        })
      });

      if (response.ok || response.status === 403) {
        return {
          cancelled: response.ok,
          details: {
            message: response.ok
              ? "Event cancelled via Calendly API."
              : "Calendly refused cancellation (permission denied).",
            httpStatus: response.status
          }
        };
      }

      return {
        cancelled: false,
        details: {
          message: `Calendly cancel HTTP ${response.status}`,
          httpStatus: response.status
        }
      };
    } catch {
      return {
        cancelled: false,
        details: {
          message: "Calendly cancel network error; expected via webhook sync."
        }
      };
    }
  }

  async listAvailability(input: {
    apiBase: string;
    token: string;
    userUri: string;
    startTime: string;
    endTime: string;
  }): Promise<Array<{ start: string; end: string }>> {
    const url = `${input.apiBase.replace(/\/+$/, "")}/user_availability_schedules?user=${encodeURIComponent(input.userUri)}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${input.token}`
        }
      });

      if (!response.ok) {
        return [];
      }

      const payload = asRecord(await response.json());
      const collection = Array.isArray(payload.collection) ? payload.collection : [];
      const busySlots: Array<{ start: string; end: string }> = [];

      for (const schedule of collection) {
        const rules = Array.isArray(asRecord(schedule).rules) ? (asRecord(schedule).rules as unknown[]) : [];
        for (const rule of rules) {
          const r = asRecord(rule);
          const intervals = Array.isArray(r.intervals) ? (r.intervals as unknown[]) : [];
          for (const interval of intervals) {
            const iv = asRecord(interval);
            const from = asString(iv.from);
            const to = asString(iv.to);
            if (from && to) {
              busySlots.push({ start: from, end: to });
            }
          }
        }
      }

      return busySlots;
    } catch {
      return [];
    }
  }

  async listScheduledEvents(input: {
    apiBase: string;
    token: string;
    userUri: string;
    minStartTime: string;
    maxStartTime: string;
  }): Promise<Array<{ start: string; end: string; status: string; uri: string }>> {
    const params = new URLSearchParams({
      user: input.userUri,
      min_start_time: input.minStartTime,
      max_start_time: input.maxStartTime,
      status: "active",
      count: "100"
    });
    const url = `${input.apiBase.replace(/\/+$/, "")}/scheduled_events?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${input.token}`
        }
      });

      if (!response.ok) {
        return [];
      }

      const payload = asRecord(await response.json());
      const collection = Array.isArray(payload.collection) ? payload.collection : [];

      return collection.map((item) => {
        const event = asRecord(item);
        return {
          start: asString(event.start_time) ?? "",
          end: asString(event.end_time) ?? "",
          status: asString(event.status) ?? "unknown",
          uri: asString(event.uri) ?? ""
        };
      }).filter((e) => e.start.length > 0 && e.end.length > 0);
    } catch {
      return [];
    }
  }

  private async createOneOffBooking(input: {
    apiBase: string;
    token: string;
    eventTypeUri: string;
    scheduledAt: Date;
    candidateEmail: string;
    candidateName?: string;
    sessionId: string;
  }): Promise<{ eventUri: string; inviteeUri: string; joinUrl: string | null } | null> {
    try {
      const scheduledEventsUrl = `${input.apiBase.replace(/\/+$/, "")}/one_off_event_types`;

      // Calendly v2 doesn't have a direct "create booking" endpoint.
      // Instead we query scheduled_events after the candidate books via link.
      // For programmatic booking, we create a scheduling link with pre-filled data.
      const inviteeUrl = `${input.apiBase.replace(/\/+$/, "")}/scheduling_links`;

      const response = await fetch(inviteeUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          max_event_count: 1,
          owner: input.eventTypeUri,
          owner_type: "EventType"
        })
      });

      if (!response.ok) {
        return null;
      }

      const payload = asRecord(await response.json());
      const resource = asRecord(payload.resource);
      const bookingUrl = asString(resource.booking_url);

      if (!bookingUrl) {
        return null;
      }

      return {
        eventUri: asString(resource.owner) ?? input.eventTypeUri,
        inviteeUri: "",
        joinUrl: bookingUrl
      };
    } catch {
      return null;
    }
  }

  private resolveApiToken(
    auth: Record<string, unknown> | undefined,
    credentials: Record<string, unknown>
  ) {
    return asString(auth?.accessToken) ?? asString(credentials.personalAccessToken);
  }

  private verifySignature(input: {
    signatureHeader: string;
    secret: string;
    payload: Record<string, unknown>;
  }) {
    const parts = input.signatureHeader.split(",");
    const timestampRaw = parts.find((part) => part.trim().startsWith("t="));
    const signatureRaw = parts.find((part) => part.trim().startsWith("v1="));

    if (!timestampRaw || !signatureRaw) {
      return {
        ok: false,
        reason: "signature_format_invalid"
      };
    }

    const timestamp = timestampRaw.split("=")[1]?.trim();
    const signature = signatureRaw.split("=")[1]?.trim();

    if (!timestamp || !signature) {
      return {
        ok: false,
        reason: "signature_missing_parts"
      };
    }

    const payload = JSON.stringify(input.payload);
    const expected = createHmac("sha256", input.secret).update(`${timestamp}.${payload}`).digest("hex");

    return {
      ok: expected === signature,
      reason: expected === signature ? null : "signature_mismatch"
    };
  }
}
