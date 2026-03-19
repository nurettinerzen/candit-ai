import { IntegrationProvider } from "@prisma/client";
import type {
  IntegrationDomainEventInput,
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

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export class AtsGenericHttpAdapter implements IntegrationProviderAdapter {
  readonly provider = IntegrationProvider.ATS_GENERIC;

  async sync(input: IntegrationSyncInput): Promise<IntegrationSyncResult> {
    const baseUrl = asString(input.connection.config.baseUrl);

    if (!baseUrl) {
      return {
        provider: this.provider,
        objectType: input.objectType,
        fetchedCount: 0,
        nextCursor: input.cursor ?? null,
        status: "error",
        details: {
          message: "ATS baseUrl konfiguru eksik.",
          connectionId: input.connection.id
        }
      };
    }

    const url = new URL(`sync/${encodeURIComponent(input.objectType)}`, `${baseUrl.replace(/\/$/, "")}/`);

    if (input.cursor) {
      url.searchParams.set("cursor", input.cursor);
    }

    url.searchParams.set("tenantId", input.tenantId);

    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    const apiKey = asString(input.connection.credentials.apiKey);
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }

    let response: Response;

    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers
      });
    } catch (error) {
      return {
        provider: this.provider,
        objectType: input.objectType,
        fetchedCount: 0,
        nextCursor: input.cursor ?? null,
        status: "error",
        details: {
          message: error instanceof Error ? error.message : "ats_sync_network_error",
          endpoint: url.toString()
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
          message: `ATS sync HTTP ${response.status}`,
          endpoint: url.toString()
        }
      };
    }

    const payload = asRecord(await response.json());
    const items = asArray(payload.items)
      .map((item) => asRecord(item))
      .filter((item) => Object.keys(item).length > 0);

    return {
      provider: this.provider,
      objectType: input.objectType,
      fetchedCount: items.length,
      nextCursor: asString(payload.nextCursor),
      status: "ok",
      details: {
        items,
        endpoint: url.toString(),
        remoteSyncAt: asString(payload.syncedAt)
      }
    };
  }

  async handleWebhook(input: IntegrationWebhookInput) {
    return {
      status: "processed" as const,
      details: {
        eventKey: input.eventKey,
        payloadKeys: Object.keys(input.payload),
        connectionId: input.connection?.id ?? null
      }
    };
  }

  async forwardDomainEvent(input: IntegrationDomainEventInput) {
    const baseUrl = asString(input.connection.config.baseUrl);

    if (!baseUrl) {
      return {
        forwarded: false,
        details: {
          message: "ATS baseUrl konfiguru eksik.",
          connectionId: input.connection.id
        }
      };
    }

    const url = new URL("events", `${baseUrl.replace(/\/$/, "")}/`);

    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    const apiKey = asString(input.connection.credentials.apiKey);
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        tenantId: input.tenantId,
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        traceId: input.traceId ?? null,
        payload: input.payload
      })
    });

    if (!response.ok) {
      return {
        forwarded: false,
        details: {
          message: `ATS event forward HTTP ${response.status}`,
          endpoint: url.toString()
        }
      };
    }

    return {
      forwarded: true,
      details: {
        endpoint: url.toString(),
        traceId: input.traceId ?? null
      }
    };
  }
}
