import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject
} from "@nestjs/common";
import {
  ApplicationStage,
  AuditActorType,
  PlatformIncidentCategory,
  PlatformIncidentSeverity,
  IntegrationProvider,
  IntegrationConnectionStatus,
  JobStatus,
  Prisma
} from "@prisma/client";
import { AuditWriterService } from "../audit/audit-writer.service";
import { SecurityEventsService } from "../security-events/security-events.service";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import type {
  IntegrationDomainEventInput,
  IntegrationInterviewProvisionResult,
  IntegrationProviderAdapter,
  IntegrationSyncResult,
  IntegrationWebhookInput
} from "./contracts/integration-provider.interface";
import { IntegrationIdentityMapperService } from "./integration-identity-mapper.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AtsGenericHttpAdapter } from "./providers/ats-generic-http.adapter";
import { GoogleCalendarAdapter } from "./providers/google-calendar.adapter";

class StubIntegrationAdapter implements IntegrationProviderAdapter {
  constructor(readonly provider: IntegrationProvider) {}

  async sync(input: {
    tenantId: string;
    objectType: string;
    cursor?: string | null;
    traceId?: string;
    connection: {
      id: string;
      config: Record<string, unknown>;
      credentials: Record<string, unknown>;
    };
  }): Promise<IntegrationSyncResult> {
    return {
      provider: this.provider,
      objectType: input.objectType,
      fetchedCount: 0,
      nextCursor: input.cursor ?? null,
      status: "noop",
      details: {
        message: "Provider adapter implementation bu provider icin henuz acik degil.",
        connectionId: input.connection.id
      }
    };
  }

  async handleWebhook(input: IntegrationWebhookInput) {
    return {
      status: "ignored" as const,
      details: {
        message: "Webhook contract kaydedildi. Provider webhook processor daha sonra eklenecek.",
        eventKey: input.eventKey,
        keys: Object.keys(input.payload)
      }
    };
  }

  async forwardDomainEvent(_input: IntegrationDomainEventInput) {
    return {
      forwarded: false,
      details: {
        message: "domain_event_forwarding_not_supported"
      }
    };
  }
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function hasAnyCredentialValue(credentials: Record<string, unknown>) {
  return Object.values(credentials).some((value) => {
    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return value !== null && value !== undefined;
  });
}

function asDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isLaunchUnsupportedProvider(provider: IntegrationProvider) {
  return (
    provider === IntegrationProvider.MICROSOFT_CALENDAR ||
    provider === IntegrationProvider.ZOOM
  );
}

const MEETING_PROVIDERS = [
  IntegrationProvider.GOOGLE_MEET,
  IntegrationProvider.ZOOM,
  IntegrationProvider.GOOGLE_CALENDAR,
  IntegrationProvider.MICROSOFT_CALENDAR
] as const;

function buildMeetingProviderSelectionReason(input: {
  provider: IntegrationProvider;
  status: string;
  requiresConnection: boolean;
  connected: boolean;
  oauthConfigured: boolean;
}) {
  if (input.status === "unsupported") {
    return `${input.provider} V1 kapsaminda desteklenmiyor.`;
  }

  if (input.status === "setup_required" && !input.oauthConfigured) {
    return `${input.provider} için provider kurulumu henüz tamamlanmadi.`;
  }

  if (input.requiresConnection && !input.connected) {
    return `${input.provider} için aktif tenant baglantisi bulunmuyor.`;
  }

  return null;
}

function buildInternalFallbackMeetingContext(sessionId: string) {
  return {
    provider: null,
    connectionId: null,
    providerSource: "internal_fallback",
    joinUrl: `https://interview.local/session/${encodeURIComponent(sessionId)}`,
    externalRef: `internal-${sessionId}`,
    calendarEventRef: null,
    details: {
      message: "Harici provider secilemedigi icin internal fallback kullanildi."
    }
  };
}

function mapExternalStage(stageRaw: string | null) {
  const normalized = stageRaw?.trim().toUpperCase();

  switch (normalized) {
    case "SCREENING":
      return ApplicationStage.SCREENING;
    case "INTERVIEW_SCHEDULED":
      return ApplicationStage.INTERVIEW_SCHEDULED;
    case "INTERVIEW_COMPLETED":
      return ApplicationStage.INTERVIEW_COMPLETED;
    case "RECRUITER_REVIEW":
      return ApplicationStage.RECRUITER_REVIEW;
    case "HIRING_MANAGER_REVIEW":
      return ApplicationStage.HIRING_MANAGER_REVIEW;
    case "OFFER":
      return ApplicationStage.OFFER;
    case "REJECTED":
      return ApplicationStage.REJECTED;
    case "HIRED":
      return ApplicationStage.HIRED;
    default:
      return ApplicationStage.APPLIED;
  }
}

function mapExternalJobStatus(raw: string | null) {
  const normalized = raw?.trim().toUpperCase();

  switch (normalized) {
    case "PUBLISHED":
      return JobStatus.PUBLISHED;
    case "ARCHIVED":
      return JobStatus.ARCHIVED;
    default:
      return JobStatus.DRAFT;
  }
}

@Injectable()
export class IntegrationsService {
  private readonly adapters: Record<IntegrationProvider, IntegrationProviderAdapter> = {
    GOOGLE_CALENDAR: new GoogleCalendarAdapter(IntegrationProvider.GOOGLE_CALENDAR),
    MICROSOFT_CALENDAR: new StubIntegrationAdapter(IntegrationProvider.MICROSOFT_CALENDAR),
    ZOOM: new StubIntegrationAdapter(IntegrationProvider.ZOOM),
    GOOGLE_MEET: new GoogleCalendarAdapter(IntegrationProvider.GOOGLE_MEET),
    ATS_GENERIC: new AtsGenericHttpAdapter()
  };

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(IntegrationIdentityMapperService) private readonly identityMapper: IntegrationIdentityMapperService,
    @Inject(SecurityEventsService)
    private readonly securityEventsService: SecurityEventsService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService
  ) {}

  private describeMeetingProviderState(
    provider: IntegrationProvider,
    activeConnections: Array<{ id: string; provider: IntegrationProvider }>
  ) {
    const catalogEntry = this.runtimeConfig.meetingProviderCatalog.find((entry) => entry.provider === provider);
    const connection = activeConnections.find((item) => item.provider === provider) ?? null;
    const connected = Boolean(connection);
    const selectionReason = buildMeetingProviderSelectionReason({
      provider,
      status: catalogEntry?.status ?? "unsupported",
      requiresConnection: catalogEntry?.requiresConnection ?? true,
      connected,
      oauthConfigured: catalogEntry?.oauthConfigured ?? false
    });

    return {
      provider,
      status: catalogEntry?.status ?? "unsupported",
      ready: catalogEntry?.ready ?? false,
      requiresConnection: catalogEntry?.requiresConnection ?? true,
      oauthConfigured: catalogEntry?.oauthConfigured ?? false,
      connected,
      connectionId: connection?.id ?? null,
      selectable: !selectionReason,
      selectionReason
    };
  }

  async assertMeetingProviderSelectable(input: {
    tenantId: string;
    provider: IntegrationProvider;
    activeConnections?: Array<{ id: string; provider: IntegrationProvider }>;
  }) {
    const activeConnections =
      input.activeConnections ??
      (await this.prisma.integrationConnection.findMany({
        where: {
          tenantId: input.tenantId,
          status: IntegrationConnectionStatus.ACTIVE,
          provider: {
            in: [...MEETING_PROVIDERS]
          }
        },
        select: {
          id: true,
          provider: true
        }
      }));

    const state = this.describeMeetingProviderState(input.provider, activeConnections);

    if (!state.selectable) {
      throw new BadRequestException(
        state.selectionReason ?? `${input.provider} şu anda secilebilir degil.`
      );
    }

    return state;
  }

  async resolveMeetingContext(input: {
    tenantId: string;
    sessionId: string;
    mode: string;
    scheduledAt?: Date | null;
    preferredProvider?: IntegrationProvider;
    operation?: "create" | "update";
    existingExternalRef?: string | null;
    existingCalendarEventRef?: string | null;
    candidateEmail?: string | null;
    candidateName?: string | null;
    interviewerName?: string | null;
    title?: string | null;
    description?: string | null;
    durationMinutes?: number | null;
    timezone?: string | null;
    traceId?: string;
  }) {
    if (input.mode !== "MEETING_LINK") {
      return {
        provider: null,
        connectionId: null,
        providerSource: "mode_without_provider",
        joinUrl: null,
        externalRef: null,
        calendarEventRef: null,
        details: {
          mode: input.mode
        }
      };
    }

    const supportedProviders: IntegrationProvider[] = [...MEETING_PROVIDERS];

    const providerPriority = input.preferredProvider
      ? [input.preferredProvider, ...supportedProviders.filter((item) => item !== input.preferredProvider)]
      : supportedProviders;

    const activeConnections = await this.prisma.integrationConnection.findMany({
      where: {
        tenantId: input.tenantId,
        status: IntegrationConnectionStatus.ACTIVE,
        provider: {
          in: supportedProviders
        }
      },
      select: {
        id: true,
        provider: true,
        displayName: true,
        configJson: true,
        credentialsJson: true,
        credential: {
          select: {
            status: true,
            accessToken: true,
            refreshToken: true,
            expiresAt: true,
            metadata: true,
            lastError: true
          }
        }
      }
    });

    const lightweightConnections = activeConnections.map((connection) => ({
      id: connection.id,
      provider: connection.provider
    }));

    if (input.preferredProvider) {
      await this.assertMeetingProviderSelectable({
        tenantId: input.tenantId,
        provider: input.preferredProvider,
        activeConnections: lightweightConnections
      });
    }

    const selectableProviders = providerPriority.filter((provider) =>
      this.describeMeetingProviderState(provider, lightweightConnections).selectable
    );

    const selectedConnection =
      selectableProviders
        .map((provider) => activeConnections.find((connection) => connection.provider === provider))
        .find(Boolean) ?? null;

    if (selectedConnection) {
      const config = asRecord(selectedConnection.configJson);
      const baseMeetingUrl = asString(config.baseMeetingUrl);
      const meetingPathPrefix = asString(config.meetingPathPrefix) ?? "interviews";
      const meetingPrefix = asString(config.meetingIdPrefix) ?? selectedConnection.provider.toLowerCase();
      const externalRef = `${meetingPrefix}-${input.sessionId}`;
      const calendarPrefix = asString(config.calendarEventPrefix);
      const calendarEventRef = calendarPrefix ? `${calendarPrefix}-${input.sessionId}` : null;
      const adapter = this.adapters[selectedConnection.provider];
      const authPayload = {
        accessToken: selectedConnection.credential?.accessToken ?? null,
        refreshToken: selectedConnection.credential?.refreshToken ?? null,
        expiresAt: selectedConnection.credential?.expiresAt?.toISOString() ?? null,
        status: selectedConnection.credential?.status ?? null,
        metadata: selectedConnection.credential?.metadata ?? null,
        lastError: selectedConnection.credential?.lastError ?? null
      };

      if (isLaunchUnsupportedProvider(selectedConnection.provider)) {
        await this.reportOpsIncident({
          tenantId: input.tenantId,
          severity: PlatformIncidentSeverity.WARNING,
          source: "integration.meeting",
          code: "integration.meeting.unsupported_provider",
          message: `${selectedConnection.provider} provider launch icin henuz desteklenmiyor.`,
          metadata: {
            sessionId: input.sessionId,
            provider: selectedConnection.provider,
            connectionId: selectedConnection.id,
            traceId: input.traceId ?? null
          }
        });
      }

      if (adapter && (adapter.provisionInterview || adapter.updateInterview)) {
        const operation = input.operation ?? "create";
        const provisionResponse: IntegrationInterviewProvisionResult =
          operation === "update" && adapter.updateInterview
            ? await adapter.updateInterview({
                tenantId: input.tenantId,
                sessionId: input.sessionId,
                traceId: input.traceId,
                connection: {
                  id: selectedConnection.id,
                  provider: selectedConnection.provider,
                  config,
                  credentials: asRecord(selectedConnection.credentialsJson),
                  auth: authPayload
                },
                payload: {
                  scheduledAt: input.scheduledAt ?? null,
                  durationMinutes: input.durationMinutes ?? null,
                  timezone: input.timezone ?? null,
                  title: input.title ?? null,
                  description: input.description ?? null,
                  candidateEmail: input.candidateEmail ?? null,
                  candidateName: input.candidateName ?? null,
                  interviewerName: input.interviewerName ?? null,
                  existingExternalRef: input.existingExternalRef ?? null,
                  existingCalendarEventRef: input.existingCalendarEventRef ?? null
                }
              })
            : adapter.provisionInterview
              ? await adapter.provisionInterview({
                  tenantId: input.tenantId,
                  sessionId: input.sessionId,
                  traceId: input.traceId,
                  connection: {
                    id: selectedConnection.id,
                    provider: selectedConnection.provider,
                    config,
                    credentials: asRecord(selectedConnection.credentialsJson),
                    auth: authPayload
                  },
                  payload: {
                    scheduledAt: input.scheduledAt ?? null,
                    durationMinutes: input.durationMinutes ?? null,
                    timezone: input.timezone ?? null,
                    title: input.title ?? null,
                    description: input.description ?? null,
                    candidateEmail: input.candidateEmail ?? null,
                    candidateName: input.candidateName ?? null,
                    interviewerName: input.interviewerName ?? null,
                    existingExternalRef: input.existingExternalRef ?? null,
                    existingCalendarEventRef: input.existingCalendarEventRef ?? null
                  }
                })
              : {
                  status: "unavailable",
                  providerSource: "adapter_provision_not_supported"
                };

        if (provisionResponse.status !== "failed" && provisionResponse.status !== "unavailable") {
          const resolvedExternalRef =
            provisionResponse.externalRef ?? input.existingExternalRef ?? externalRef;
          const resolvedCalendarRef =
            provisionResponse.calendarEventRef ??
            input.existingCalendarEventRef ??
            calendarEventRef;

          if (resolvedExternalRef) {
            await this.identityMapper.upsert({
              tenantId: input.tenantId,
              provider: selectedConnection.provider,
              internalEntityType: "InterviewSession",
              internalEntityId: input.sessionId,
              externalEntityType: "meeting",
              externalEntityId: resolvedExternalRef,
              metadata: {
                source: provisionResponse.providerSource,
                connectionId: selectedConnection.id,
                joinUrl: provisionResponse.joinUrl ?? null,
                details: (provisionResponse.details ?? null) as Prisma.InputJsonValue | null,
                scheduledAt: input.scheduledAt?.toISOString() ?? null,
                traceId: input.traceId ?? null
              } as Prisma.InputJsonValue
            });
          }

          if (resolvedCalendarRef) {
            await this.identityMapper.upsert({
              tenantId: input.tenantId,
              provider: selectedConnection.provider,
              internalEntityType: "InterviewSession",
              internalEntityId: input.sessionId,
              externalEntityType: "calendar_event",
              externalEntityId: resolvedCalendarRef,
              metadata: {
                source: provisionResponse.providerSource,
                connectionId: selectedConnection.id,
                details: (provisionResponse.details ?? null) as Prisma.InputJsonValue | null,
                scheduledAt: input.scheduledAt?.toISOString() ?? null,
                traceId: input.traceId ?? null
              } as Prisma.InputJsonValue
            });
          }

          return {
            provider: selectedConnection.provider,
            connectionId: selectedConnection.id,
            providerSource: provisionResponse.providerSource,
            joinUrl: provisionResponse.joinUrl ?? null,
            externalRef: resolvedExternalRef ?? null,
            calendarEventRef: resolvedCalendarRef ?? null,
            details: {
              displayName: selectedConnection.displayName,
              configuredProvider: selectedConnection.provider,
              provisioningStatus: provisionResponse.status,
              provisioningDetails: provisionResponse.details ?? null
            }
          };
        }

        await this.reportOpsIncident({
          tenantId: input.tenantId,
          severity:
            provisionResponse.status === "failed"
              ? PlatformIncidentSeverity.CRITICAL
              : PlatformIncidentSeverity.WARNING,
          source: "integration.meeting",
          code:
            provisionResponse.status === "failed"
              ? "integration.meeting.provision_failed"
              : "integration.meeting.provision_unavailable",
          message:
            provisionResponse.status === "failed"
              ? "Harici mulakat provider provisioning adimi basarisiz oldu."
              : "Harici mulakat provider provisioning adimi kullanilabilir degil.",
          metadata: {
            sessionId: input.sessionId,
            provider: selectedConnection.provider,
            connectionId: selectedConnection.id,
            providerSource: provisionResponse.providerSource,
            details: (provisionResponse.details ?? null) as Prisma.InputJsonValue | null,
            traceId: input.traceId ?? null
          }
        });

        if (input.preferredProvider === selectedConnection.provider) {
          throw new BadRequestException(
            `${selectedConnection.provider} şu anda booking üretemiyor. Baglantiyi kontrol edin veya farkli bir provider secin.`
          );
        }

        return buildInternalFallbackMeetingContext(input.sessionId);
      }

      if (!baseMeetingUrl) {
        await this.reportOpsIncident({
          tenantId: input.tenantId,
          severity: PlatformIncidentSeverity.WARNING,
          source: "integration.meeting",
          code: "integration.meeting.base_url_missing",
          message: "Aktif meeting provider baglantisinda booking/baseMeetingUrl konfiguru eksik.",
          metadata: {
            sessionId: input.sessionId,
            provider: selectedConnection.provider,
            connectionId: selectedConnection.id,
            credentialStatus: selectedConnection.credential?.status ?? "MISSING",
            traceId: input.traceId ?? null
          }
        });

        if (input.preferredProvider === selectedConnection.provider) {
          throw new BadRequestException(
            `${selectedConnection.provider} baglantisinda booking/baseMeetingUrl konfiguru eksik.`
          );
        }

        return buildInternalFallbackMeetingContext(input.sessionId);
      }

      const joinUrl = `${trimTrailingSlash(baseMeetingUrl)}/${meetingPathPrefix}/${encodeURIComponent(externalRef)}`;

      await this.identityMapper.upsert({
        tenantId: input.tenantId,
        provider: selectedConnection.provider,
        internalEntityType: "InterviewSession",
        internalEntityId: input.sessionId,
        externalEntityType: "meeting",
        externalEntityId: externalRef,
        metadata: {
          source: "provider_connection_template",
          connectionId: selectedConnection.id,
          joinUrl,
          scheduledAt: input.scheduledAt?.toISOString() ?? null,
          traceId: input.traceId ?? null
        }
      });

      if (calendarEventRef) {
        await this.identityMapper.upsert({
          tenantId: input.tenantId,
          provider: selectedConnection.provider,
          internalEntityType: "InterviewSession",
          internalEntityId: input.sessionId,
          externalEntityType: "calendar_event",
          externalEntityId: calendarEventRef,
          metadata: {
            source: "provider_connection_template",
            connectionId: selectedConnection.id,
            scheduledAt: input.scheduledAt?.toISOString() ?? null,
            traceId: input.traceId ?? null
          }
        });
      }

      return {
        provider: selectedConnection.provider,
        connectionId: selectedConnection.id,
        providerSource: "provider_connection_template",
        joinUrl,
        externalRef,
        calendarEventRef,
        details: {
          displayName: selectedConnection.displayName,
          configuredProvider: selectedConnection.provider
        }
      };
    }

    return buildInternalFallbackMeetingContext(input.sessionId);
  }

  async cancelMeetingContext(input: {
    tenantId: string;
    sessionId: string;
    provider: IntegrationProvider | null;
    externalRef?: string | null;
    calendarEventRef?: string | null;
    reasonCode?: string | null;
    traceId?: string;
  }) {
    if (!input.provider) {
      return {
        cancelled: false,
        reason: "provider_missing"
      };
    }

    const adapter = this.adapters[input.provider];
    if (!adapter?.cancelInterview) {
      return {
        cancelled: false,
        reason: "adapter_cancel_not_supported"
      };
    }

    let connection:
      | Awaited<ReturnType<IntegrationsService["requireActiveConnection"]>>
      | null = null;

    try {
      connection = await this.requireActiveConnection(input.tenantId, input.provider);
    } catch {
      return {
        cancelled: false,
        reason: "connection_missing_or_inactive"
      };
    }

    const result = await adapter.cancelInterview({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      traceId: input.traceId,
      connection: {
        id: connection.id,
        provider: connection.provider,
        config: asRecord(connection.configJson),
        credentials: asRecord(connection.credentialsJson),
        auth: {
          accessToken: connection.credential?.accessToken ?? null,
          refreshToken: connection.credential?.refreshToken ?? null,
          expiresAt: connection.credential?.expiresAt?.toISOString() ?? null,
          status: connection.credential?.status ?? null
        }
      },
      payload: {
        externalRef: input.externalRef ?? null,
        calendarEventRef: input.calendarEventRef ?? null,
        reasonCode: input.reasonCode ?? null
      }
    });

    return result;
  }

  listProviders() {
    return Object.keys(this.adapters) as IntegrationProvider[];
  }

  async listConnections(tenantId: string) {
    const connections = await this.prisma.integrationConnection.findMany({
      where: {
        tenantId
      },
      orderBy: {
        updatedAt: "desc"
      },
      select: {
        id: true,
        provider: true,
        status: true,
        displayName: true,
        configJson: true,
        credentialsJson: true,
        credential: {
          select: {
            status: true,
            expiresAt: true,
            lastError: true,
            updatedAt: true
          }
        },
        lastVerifiedAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return connections.map((connection) => {
      const config = asRecord(connection.configJson);
      const credentials = asRecord(connection.credentialsJson);
      const credentialStatus = connection.credential?.status ?? "MISSING";
      const hasConfig = Object.keys(config).length > 0;
      const hasCredentials = hasAnyCredentialValue(credentials);
      const effectiveStatus =
        connection.status !== IntegrationConnectionStatus.ACTIVE
          ? "inactive"
          : isLaunchUnsupportedProvider(connection.provider)
            ? "unsupported_provider"
            : !hasConfig
            ? "missing_config"
            : connection.provider === IntegrationProvider.GOOGLE_CALENDAR ||
                connection.provider === IntegrationProvider.GOOGLE_MEET
              ? credentialStatus === "ACTIVE" || hasCredentials
                ? "configured"
                : "needs_auth"
              : hasCredentials
                ? "configured"
                : "missing_credentials";

      return {
        id: connection.id,
        provider: connection.provider,
        status: connection.status,
        effectiveStatus,
        displayName: connection.displayName,
        configJson: connection.configJson,
        credentialStatus,
        credentialExpiresAt: connection.credential?.expiresAt ?? null,
        credentialLastError: connection.credential?.lastError ?? null,
        lastVerifiedAt: connection.lastVerifiedAt,
        lastError: connection.lastError,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt
      };
    });
  }

  async upsertConnection(input: {
    tenantId: string;
    provider: IntegrationProvider;
    displayName?: string;
    status?: IntegrationConnectionStatus;
    config: Record<string, unknown>;
    credentials: Record<string, unknown>;
    requestedBy?: string;
    traceId?: string;
  }) {
    const normalizedCredentials = asRecord(input.credentials);
    const connection = await this.prisma.integrationConnection.upsert({
      where: {
        tenantId_provider: {
          tenantId: input.tenantId,
          provider: input.provider
        }
      },
      create: {
        tenantId: input.tenantId,
        provider: input.provider,
        displayName: input.displayName,
        status: input.status ?? IntegrationConnectionStatus.ACTIVE,
        configJson: input.config as Prisma.InputJsonValue,
        credentialsJson: normalizedCredentials as Prisma.InputJsonValue
      },
      update: {
        displayName: input.displayName,
        status: input.status,
        configJson: input.config as Prisma.InputJsonValue,
        credentialsJson: normalizedCredentials as Prisma.InputJsonValue,
        lastError: null
      }
    });

    const credential = await this.upsertOAuthCredentialIfNeeded({
      tenantId: input.tenantId,
      provider: input.provider,
      connectionId: connection.id,
      credentials: normalizedCredentials
    });

    await this.auditWriterService.write({
      tenantId: input.tenantId,
      actorType: AuditActorType.USER,
      actorUserId: input.requestedBy,
      action: "integration.connection.upserted",
      entityType: "IntegrationConnection",
      entityId: connection.id,
      traceId: input.traceId,
      metadata: {
        provider: connection.provider,
        status: connection.status,
        displayName: connection.displayName,
        credentialStatus: credential?.status ?? null
      }
    });

    return {
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
      displayName: connection.displayName,
      configJson: connection.configJson,
      credentialStatus: credential?.status ?? null,
      credentialExpiresAt: credential?.expiresAt ?? null,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt
    };
  }

  async upsertConnectionCredential(input: {
    tenantId: string;
    provider: IntegrationProvider;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
    scope?: string;
    requestedBy?: string;
    traceId?: string;
  }) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId: input.tenantId,
          provider: input.provider
        }
      }
    });

    if (!connection) {
      throw new NotFoundException("Credential kaydi icin integration connection bulunamadi.");
    }

    const expiresAt = asDate(input.expiresAt);
    const credential = await this.prisma.integrationCredential.upsert({
      where: {
        connectionId: connection.id
      },
      create: {
        tenantId: input.tenantId,
        connectionId: connection.id,
        provider: input.provider,
        authType: "oauth2",
        status: input.accessToken ? "ACTIVE" : input.refreshToken ? "REFRESH_REQUIRED" : "MISSING",
        accessToken: input.accessToken?.trim() || null,
        refreshToken: input.refreshToken?.trim() || null,
        expiresAt,
        scope: input.scope?.trim() || null,
        metadata: {
          source: "manual_api"
        }
      },
      update: {
        status: input.accessToken ? "ACTIVE" : input.refreshToken ? "REFRESH_REQUIRED" : "MISSING",
        accessToken: input.accessToken?.trim() || null,
        refreshToken: input.refreshToken?.trim() || null,
        expiresAt,
        scope: input.scope?.trim() || null,
        lastError: null,
        metadata: {
          source: "manual_api",
          updatedAt: new Date().toISOString()
        }
      },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        updatedAt: true
      }
    });

    await this.auditWriterService.write({
      tenantId: input.tenantId,
      actorType: AuditActorType.USER,
      actorUserId: input.requestedBy,
      action: "integration.connection.credential.upserted",
      entityType: "IntegrationCredential",
      entityId: credential.id,
      traceId: input.traceId,
      metadata: {
        provider: input.provider,
        connectionId: connection.id,
        status: credential.status,
        expiresAt: credential.expiresAt?.toISOString() ?? null
      }
    });

    return {
      connectionId: connection.id,
      provider: input.provider,
      credential
    };
  }

  async refreshConnectionCredential(input: {
    tenantId: string;
    provider: IntegrationProvider;
    requestedBy?: string;
    traceId?: string;
  }) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId: input.tenantId,
          provider: input.provider
        }
      },
      include: {
        credential: true
      }
    });

    if (!connection || !connection.credential) {
      throw new NotFoundException("Yenileme icin integration credential bulunamadi.");
    }

    const refreshToken = connection.credential.refreshToken?.trim();
    if (!refreshToken) {
      await this.reportOpsIncident({
        tenantId: input.tenantId,
        severity: PlatformIncidentSeverity.WARNING,
        source: "integration.oauth",
        code: "integration.oauth.refresh_token_missing",
        message: `${input.provider} baglantisi icin refresh token bulunamadi.`,
        metadata: {
          provider: input.provider,
          connectionId: connection.id,
          traceId: input.traceId ?? null
        }
      });
      return {
        refreshed: false,
        reason: "refresh_token_missing"
      };
    }

    const tokenPayload =
      input.provider === IntegrationProvider.GOOGLE_CALENDAR ||
      input.provider === IntegrationProvider.GOOGLE_MEET
        ? {
            endpoint: "https://oauth2.googleapis.com/token",
            body: {
              grant_type: "refresh_token",
              refresh_token: refreshToken,
              client_id: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "",
              client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? ""
            }
          }
        : null;

    if (!tokenPayload) {
      await this.reportOpsIncident({
        tenantId: input.tenantId,
        severity: PlatformIncidentSeverity.WARNING,
        source: "integration.oauth",
        code: "integration.oauth.provider_refresh_unsupported",
        message: `${input.provider} baglantisi otomatik token yenilemeyi desteklemiyor.`,
        metadata: {
          provider: input.provider,
          connectionId: connection.id,
          traceId: input.traceId ?? null
        }
      });
      return {
        refreshed: false,
        reason: "provider_refresh_not_supported"
      };
    }

    let response: Response;
    try {
      response = await fetch(tokenPayload.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(tokenPayload.body)
      });
    } catch (error) {
      await this.reportOpsIncident({
        tenantId: input.tenantId,
        severity: PlatformIncidentSeverity.CRITICAL,
        source: "integration.oauth",
        code: "integration.oauth.refresh_network_error",
        message: `${input.provider} token yenileme istegi sirasinda ag hatasi olustu.`,
        metadata: {
          provider: input.provider,
          connectionId: connection.id,
          errorMessage: error instanceof Error ? error.message : "oauth_refresh_network_error",
          traceId: input.traceId ?? null
        }
      });
      await this.prisma.integrationCredential.update({
        where: {
          id: connection.credential.id
        },
        data: {
          status: "ERROR",
          lastError: error instanceof Error ? error.message : "oauth_refresh_network_error"
        }
      });

      return {
        refreshed: false,
        reason: "network_error"
      };
    }

    if (!response.ok) {
      const body = await response.text();
      await this.reportOpsIncident({
        tenantId: input.tenantId,
        severity: PlatformIncidentSeverity.CRITICAL,
        source: "integration.oauth",
        code: "integration.oauth.refresh_http_error",
        message: `${input.provider} token yenileme istegi basarisiz oldu.`,
        metadata: {
          provider: input.provider,
          connectionId: connection.id,
          statusCode: response.status,
          responseBody: body.slice(0, 200),
          traceId: input.traceId ?? null
        }
      });
      await this.prisma.integrationCredential.update({
        where: {
          id: connection.credential.id
        },
        data: {
          status: "ERROR",
          lastError: `oauth_refresh_http_${response.status}:${body.slice(0, 200)}`
        }
      });

      return {
        refreshed: false,
        reason: "oauth_refresh_failed",
        statusCode: response.status
      };
    }

    const payload = asRecord(await response.json());
    const accessToken = asString(payload.access_token);
    const expiresInRaw = Number(payload.expires_in);
    const expiresAt =
      accessToken && Number.isFinite(expiresInRaw)
        ? new Date(Date.now() + Math.floor(expiresInRaw) * 1000)
        : null;

    if (!accessToken) {
      await this.reportOpsIncident({
        tenantId: input.tenantId,
        severity: PlatformIncidentSeverity.CRITICAL,
        source: "integration.oauth",
        code: "integration.oauth.empty_access_token",
        message: `${input.provider} token yenileme cevabinda access token donmedi.`,
        metadata: {
          provider: input.provider,
          connectionId: connection.id,
          traceId: input.traceId ?? null
        }
      });
    }

    await Promise.all([
      this.prisma.integrationCredential.update({
        where: {
          id: connection.credential.id
        },
        data: {
          status: accessToken ? "ACTIVE" : "ERROR",
          accessToken,
          scope: asString(payload.scope),
          tokenType: asString(payload.token_type),
          expiresAt,
          refreshToken: asString(payload.refresh_token) ?? connection.credential.refreshToken,
          lastRefreshedAt: new Date(),
          lastError: accessToken ? null : "oauth_refresh_empty_access_token"
        }
      }),
      this.prisma.integrationConnection.update({
        where: {
          id: connection.id
        },
        data: {
          status: accessToken
            ? IntegrationConnectionStatus.ACTIVE
            : IntegrationConnectionStatus.ERROR,
          lastVerifiedAt: accessToken ? new Date() : connection.lastVerifiedAt,
          lastError: accessToken ? null : "oauth_refresh_empty_access_token"
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorType: AuditActorType.USER,
        actorUserId: input.requestedBy,
        action: "integration.connection.credential.refreshed",
        entityType: "IntegrationCredential",
        entityId: connection.credential.id,
        traceId: input.traceId,
        metadata: {
          provider: input.provider,
          refreshed: Boolean(accessToken),
          expiresAt: expiresAt?.toISOString() ?? null
        }
      })
    ]);

    return {
      refreshed: Boolean(accessToken),
      provider: input.provider,
      expiresAt: expiresAt?.toISOString() ?? null
    };
  }

  async runSync(input: {
    tenantId: string;
    provider: IntegrationProvider;
    objectType: string;
    cursor?: string;
    traceId?: string;
    requestedBy?: string;
  }) {
    const adapter = this.adapters[input.provider];
    if (!adapter) {
      throw new BadRequestException(`Desteklenmeyen integration provider: ${input.provider}`);
    }

    const connection = await this.requireActiveConnection(input.tenantId, input.provider);

    const result = await adapter.sync({
      tenantId: input.tenantId,
      objectType: input.objectType,
      cursor: input.cursor,
      traceId: input.traceId,
      connection: {
        id: connection.id,
        config: asRecord(connection.configJson),
        credentials: asRecord(connection.credentialsJson),
        auth: {
          accessToken: connection.credential?.accessToken ?? null,
          refreshToken: connection.credential?.refreshToken ?? null,
          expiresAt: connection.credential?.expiresAt?.toISOString() ?? null,
          status: connection.credential?.status ?? null
        }
      }
    });

    let persisted: Record<string, number> | undefined;

    if (input.provider === IntegrationProvider.ATS_GENERIC && result.status === "ok") {
      const items = Array.isArray(result.details?.items)
        ? (result.details?.items as unknown[])
        : [];

      persisted = await this.persistAtsSyncItems(input.tenantId, items);
    }

    if (result.status === "error" || result.status === "noop") {
      await this.reportOpsIncident({
        tenantId: input.tenantId,
        severity:
          result.status === "error"
            ? PlatformIncidentSeverity.CRITICAL
            : PlatformIncidentSeverity.WARNING,
        source: "integration.sync",
        code:
          result.status === "error"
            ? "integration.sync.execution_failed"
            : "integration.sync.noop",
        message:
          result.status === "error"
            ? `${input.provider} senkronizasyonu hata ile sonlandi.`
            : `${input.provider} senkronizasyonu calisti ancak gercek bir adapter davranisi uretmedi.`,
        metadata: {
          provider: input.provider,
          objectType: input.objectType,
          connectionId: connection.id,
          fetchedCount: result.fetchedCount,
          nextCursor: result.nextCursor ?? null,
          details: (result.details ?? null) as Prisma.InputJsonValue | null,
          traceId: input.traceId ?? null
        }
      });
    }

    await Promise.all([
      this.prisma.integrationSyncState.upsert({
        where: {
          id: this.toSyncStateId(input.tenantId, input.provider, input.objectType)
        },
        create: {
          id: this.toSyncStateId(input.tenantId, input.provider, input.objectType),
          tenantId: input.tenantId,
          provider: input.provider,
          objectType: input.objectType,
          cursor: result.nextCursor ?? null,
          lastSyncAt: new Date(),
          status: result.status
        },
        update: {
          cursor: result.nextCursor ?? null,
          lastSyncAt: new Date(),
          status: result.status
        }
      }),
      this.prisma.integrationConnection.update({
        where: {
          id: connection.id
        },
        data: {
          lastVerifiedAt: result.status === "ok" ? new Date() : connection.lastVerifiedAt,
          status:
            result.status === "error"
              ? IntegrationConnectionStatus.ERROR
              : connection.status === IntegrationConnectionStatus.ERROR
                ? IntegrationConnectionStatus.ACTIVE
                : connection.status,
          lastError:
            result.status === "error"
              ? asString(result.details?.message) ?? "sync_error"
              : null
        }
      }),
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorType: AuditActorType.INTEGRATION,
        actorUserId: input.requestedBy,
        action: "integration.sync.executed",
        entityType: "IntegrationSyncState",
        entityId: this.toSyncStateId(input.tenantId, input.provider, input.objectType),
        traceId: input.traceId,
        metadata: {
          provider: input.provider,
          objectType: input.objectType,
          status: result.status,
          fetchedCount: result.fetchedCount,
          nextCursor: result.nextCursor ?? null,
          persisted
        }
      })
    ]);

    return {
      ...result,
      persisted
    };
  }

  async ingestWebhook(input: IntegrationWebhookInput & { provider: IntegrationProvider }) {
    const adapter = this.adapters[input.provider];
    if (!adapter) {
      throw new BadRequestException(`Desteklenmeyen integration provider: ${input.provider}`);
    }

    const connection = await this.requireActiveConnection(input.tenantId, input.provider);

    const eventId = `${input.provider}:${input.idempotencyKey}`;

    try {
      await this.prisma.webhookEvent.create({
        data: {
          id: eventId,
          tenantId: input.tenantId,
          provider: input.provider,
          eventKey: input.eventKey,
          payload: input.payload as Prisma.InputJsonValue,
          idempotencyKey: input.idempotencyKey,
          status: "RECEIVED"
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Webhook idempotency key daha once islenmis.");
      }

      throw error;
    }

    const processed = await adapter.handleWebhook({
      ...input,
      connection: {
        id: connection.id,
        config: asRecord(connection.configJson),
        credentials: asRecord(connection.credentialsJson),
        auth: {
          accessToken: connection.credential?.accessToken ?? null,
          refreshToken: connection.credential?.refreshToken ?? null,
          expiresAt: connection.credential?.expiresAt?.toISOString() ?? null,
          status: connection.credential?.status ?? null
        }
      }
    });

    await this.prisma.webhookEvent.update({
      where: {
        id: eventId
      },
      data: {
        processedAt: new Date(),
        status: processed.status.toUpperCase()
      }
    });

    if (processed.status !== "processed") {
      await this.reportOpsIncident({
        tenantId: input.tenantId,
        severity: PlatformIncidentSeverity.WARNING,
        source: "integration.webhook",
        code: "integration.webhook.unprocessed",
        message: `${input.provider} webhook olayi tam olarak islenemedi.`,
        metadata: {
          provider: input.provider,
          eventKey: input.eventKey,
          idempotencyKey: input.idempotencyKey,
          status: processed.status,
          details: (processed.details ?? null) as Prisma.InputJsonValue | null,
          traceId: input.traceId ?? null
        }
      });
    }

    return {
      provider: input.provider,
      eventKey: input.eventKey,
      idempotencyKey: input.idempotencyKey,
      status: processed.status,
      details: processed.details
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
    if (!input.eventType.startsWith("application.") && !input.eventType.startsWith("interview.")) {
      return { forwarded: false };
    }

    const provider = IntegrationProvider.ATS_GENERIC;
    const connection = await this.prisma.integrationConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId: input.tenantId,
          provider
        }
      },
      include: {
        credential: true
      }
    });

    if (!connection || connection.status !== IntegrationConnectionStatus.ACTIVE) {
      return { forwarded: false, reason: "connection_missing" };
    }

    const adapter = this.adapters[provider];
    const mapping = await this.identityMapper.findByInternal({
      tenantId: input.tenantId,
      provider,
      internalEntityType: input.aggregateType,
      internalEntityId: input.aggregateId
    });

    const canonicalIdentity =
      mapping[0]
        ? this.identityMapper.toCanonicalKey({
            provider,
            objectType: mapping[0].externalEntityType,
            externalId: mapping[0].externalEntityId
          })
        : this.identityMapper.toCanonicalKey({
            provider,
            objectType: input.aggregateType,
            externalId: input.aggregateId
          });

    const forwarded =
      (await adapter.forwardDomainEvent?.({
        tenantId: input.tenantId,
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payload: {
          ...input.payload,
          externalMappings: mapping.map((item) => ({
            externalEntityType: item.externalEntityType,
            externalEntityId: item.externalEntityId,
            externalTenantId: item.externalTenantId,
            canonicalIdentity: this.identityMapper.toCanonicalKey({
              provider,
              objectType: item.externalEntityType,
              externalId: item.externalEntityId
            })
          }))
        },
        traceId: input.traceId,
        connection: {
          id: connection.id,
          config: asRecord(connection.configJson),
          credentials: asRecord(connection.credentialsJson),
          auth: {
            accessToken: connection.credential?.accessToken ?? null,
            refreshToken: connection.credential?.refreshToken ?? null,
            expiresAt: connection.credential?.expiresAt?.toISOString() ?? null,
            status: connection.credential?.status ?? null
          }
        }
      })) ?? { forwarded: false, details: { message: "adapter_forwarding_not_supported" } };

    await this.auditWriterService.write({
      tenantId: input.tenantId,
      actorType: AuditActorType.INTEGRATION,
      action: "integration.domain_event.forwarded",
      entityType: input.aggregateType,
      entityId: input.aggregateId,
      traceId: input.traceId,
      metadata: {
        eventType: input.eventType,
        provider,
        canonicalIdentity,
        payloadKeys: Object.keys(input.payload),
        forwarded: forwarded.forwarded,
        details: (forwarded.details ?? null) as Prisma.InputJsonValue | null
      } as Prisma.InputJsonValue
    });

    return {
      forwarded: forwarded.forwarded,
      provider,
      canonicalIdentity,
      details: forwarded.details
    };
  }

  private async upsertOAuthCredentialIfNeeded(input: {
    tenantId: string;
    provider: IntegrationProvider;
    connectionId: string;
    credentials: Record<string, unknown>;
  }) {
    const oauthProviders: IntegrationProvider[] = [
      IntegrationProvider.GOOGLE_CALENDAR,
      IntegrationProvider.GOOGLE_MEET
    ];

    if (!oauthProviders.includes(input.provider)) {
      return null;
    }

    const accessToken =
      asString(input.credentials.accessToken) ?? asString(input.credentials.oauthAccessToken);
    const refreshToken =
      asString(input.credentials.refreshToken) ?? asString(input.credentials.oauthRefreshToken);
    const expiresAt =
      asDate(input.credentials.expiresAt) ?? asDate(input.credentials.oauthExpiresAt);
    const scope = asString(input.credentials.scope);
    const status = accessToken ? "ACTIVE" : refreshToken ? "REFRESH_REQUIRED" : "MISSING";

    return this.prisma.integrationCredential.upsert({
      where: {
        connectionId: input.connectionId
      },
      create: {
        tenantId: input.tenantId,
        connectionId: input.connectionId,
        provider: input.provider,
        authType: "oauth2",
        status,
        accessToken,
        refreshToken,
        tokenType: asString(input.credentials.tokenType),
        scope,
        expiresAt,
        idToken: asString(input.credentials.idToken),
        metadata: {
          configuredVia: "integration_connection_upsert"
        }
      },
      update: {
        status,
        accessToken,
        refreshToken,
        tokenType: asString(input.credentials.tokenType),
        scope,
        expiresAt,
        idToken: asString(input.credentials.idToken),
        lastError: null,
        metadata: {
          configuredVia: "integration_connection_upsert",
          updatedAt: new Date().toISOString()
        }
      },
      select: {
        status: true,
        expiresAt: true
      }
    });
  }

  private async reportOpsIncident(input: {
    tenantId?: string | null;
    severity?: PlatformIncidentSeverity;
    source: string;
    code: string;
    message: string;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    try {
      await this.securityEventsService.recordPlatformIncident({
        tenantId: input.tenantId ?? null,
        category: PlatformIncidentCategory.OPERATIONS,
        severity: input.severity ?? PlatformIncidentSeverity.WARNING,
        source: input.source,
        code: input.code,
        message: input.message,
        metadata: input.metadata
      });
    } catch {
      // Incident tracking should stay best-effort for integration flows.
    }
  }

  private async requireActiveConnection(tenantId: string, provider: IntegrationProvider) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider
        }
      },
      include: {
        credential: true
      }
    });

    if (!connection) {
      throw new NotFoundException(`Integration baglantisi bulunamadi: ${provider}`);
    }

    if (connection.status !== IntegrationConnectionStatus.ACTIVE) {
      throw new BadRequestException(`Integration baglantisi aktif degil: ${provider}`);
    }

    return connection;
  }

  private async persistAtsSyncItems(tenantId: string, items: unknown[]) {
    let candidateCount = 0;
    let jobCount = 0;
    let applicationCount = 0;
    let mappingCount = 0;

    for (const rawItem of items) {
      const item = asRecord(rawItem);
      const candidatePayload = asRecord(item.candidate);
      const jobPayload = asRecord(item.job);

      const externalCandidateId = asString(candidatePayload.externalId) ?? asString(candidatePayload.id);
      const externalJobId = asString(jobPayload.externalId) ?? asString(jobPayload.id);
      const externalApplicationId = asString(item.externalApplicationId) ?? asString(item.applicationId) ?? asString(item.id);

      let candidateId: string | null = null;
      if (externalCandidateId) {
        const existingMap = await this.identityMapper.findByExternal({
          tenantId,
          provider: IntegrationProvider.ATS_GENERIC,
          externalEntityType: "Candidate",
          externalEntityId: externalCandidateId
        });

        if (existingMap) {
          candidateId = existingMap.internalEntityId;
        }
      }

      const candidateName = asString(candidatePayload.fullName) ?? asString(item.candidateName) ?? "ATS Candidate";
      const candidateEmail = asString(candidatePayload.email);
      const candidatePhone = asString(candidatePayload.phone);
      const candidateSource = asString(candidatePayload.source) ?? "ats_generic";

      if (!candidateId && candidateEmail) {
        const existingCandidate = await this.prisma.candidate.findFirst({
          where: {
            tenantId,
            email: candidateEmail,
            deletedAt: null
          },
          select: {
            id: true
          }
        });

        candidateId = existingCandidate?.id ?? null;
      }

      if (!candidateId) {
        const createdCandidate = await this.prisma.candidate.create({
          data: {
            tenantId,
            fullName: candidateName,
            email: candidateEmail,
            phone: candidatePhone,
            source: candidateSource
          }
        });

        candidateId = createdCandidate.id;
        candidateCount += 1;
      } else {
        await this.prisma.candidate.update({
          where: {
            id: candidateId
          },
          data: {
            fullName: candidateName,
            email: candidateEmail,
            phone: candidatePhone,
            source: candidateSource
          }
        });
      }

      if (externalCandidateId) {
        await this.identityMapper.upsert({
          tenantId,
          provider: IntegrationProvider.ATS_GENERIC,
          internalEntityType: "Candidate",
          internalEntityId: candidateId,
          externalEntityType: "Candidate",
          externalEntityId: externalCandidateId,
          externalTenantId: asString(item.externalTenantId) ?? undefined,
          metadata: item as Prisma.InputJsonValue
        });

        mappingCount += 1;
      }

      let jobId: string | null = null;
      if (externalJobId) {
        const existingMap = await this.identityMapper.findByExternal({
          tenantId,
          provider: IntegrationProvider.ATS_GENERIC,
          externalEntityType: "Job",
          externalEntityId: externalJobId
        });

        if (existingMap) {
          jobId = existingMap.internalEntityId;
        }
      }

      const jobTitle = asString(jobPayload.title) ?? asString(item.jobTitle) ?? "ATS Imported Job";
      const roleFamily = asString(jobPayload.roleFamily) ?? "external_import";
      const locationText = asString(jobPayload.locationText);
      const shiftType = asString(jobPayload.shiftType);
      const jobStatus = mapExternalJobStatus(asString(jobPayload.status));

      if (!jobId) {
        const createdJob = await this.prisma.job.create({
          data: {
            tenantId,
            title: jobTitle,
            roleFamily,
            locationText,
            shiftType,
            status: jobStatus,
            createdBy: "integration:ats_generic"
          }
        });

        jobId = createdJob.id;
        jobCount += 1;
      } else {
        await this.prisma.job.update({
          where: {
            id: jobId
          },
          data: {
            title: jobTitle,
            roleFamily,
            locationText,
            shiftType,
            status: jobStatus
          }
        });
      }

      if (externalJobId) {
        await this.identityMapper.upsert({
          tenantId,
          provider: IntegrationProvider.ATS_GENERIC,
          internalEntityType: "Job",
          internalEntityId: jobId,
          externalEntityType: "Job",
          externalEntityId: externalJobId,
          externalTenantId: asString(item.externalTenantId) ?? undefined,
          metadata: item as Prisma.InputJsonValue
        });

        mappingCount += 1;
      }

      if (!candidateId || !jobId) {
        continue;
      }

      const stage = mapExternalStage(asString(item.stage));
      const now = new Date();
      const existingApplication = await this.prisma.candidateApplication.findFirst({
        where: {
          tenantId,
          candidateId,
          jobId
        }
      });

      const application = existingApplication
        ? await this.prisma.candidateApplication.update({
            where: {
              id: existingApplication.id
            },
            data: {
              currentStage: stage,
              stageUpdatedAt: now
            }
          })
        : await this.prisma.candidateApplication.create({
            data: {
              tenantId,
              candidateId,
              jobId,
              currentStage: stage,
              stageUpdatedAt: now,
              humanDecisionRequired: true
            }
          });

      if (!existingApplication) {
        applicationCount += 1;

        await this.prisma.candidateStageHistory.create({
          data: {
            tenantId,
            applicationId: application.id,
            fromStage: null,
            toStage: stage,
            reasonCode: "integration_ats_sync",
            changedBy: "integration:ats_generic"
          }
        });
      } else if (existingApplication.currentStage !== stage) {
        await this.prisma.candidateStageHistory.create({
          data: {
            tenantId,
            applicationId: application.id,
            fromStage: existingApplication.currentStage,
            toStage: stage,
            reasonCode: "integration_ats_sync",
            changedBy: "integration:ats_generic"
          }
        });
      }

      if (externalApplicationId) {
        await this.identityMapper.upsert({
          tenantId,
          provider: IntegrationProvider.ATS_GENERIC,
          internalEntityType: "CandidateApplication",
          internalEntityId: application.id,
          externalEntityType: "Application",
          externalEntityId: externalApplicationId,
          externalTenantId: asString(item.externalTenantId) ?? undefined,
          externalParentId: externalJobId ?? undefined,
          metadata: item as Prisma.InputJsonValue
        });

        mappingCount += 1;
      }
    }

    return {
      candidatesCreated: candidateCount,
      jobsCreated: jobCount,
      applicationsCreated: applicationCount,
      mappingsUpserted: mappingCount
    };
  }

  private toSyncStateId(tenantId: string, provider: IntegrationProvider, objectType: string) {
    return `${tenantId}:${provider}:${objectType}`;
  }
}
