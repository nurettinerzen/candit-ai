import { Injectable, Inject} from "@nestjs/common";
import type { IntegrationProvider, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type ExternalIdentityRef = {
  provider: IntegrationProvider;
  objectType: string;
  externalId: string;
};

export type PersistExternalIdentityInput = {
  tenantId: string;
  provider: IntegrationProvider;
  internalEntityType: string;
  internalEntityId: string;
  externalEntityType: string;
  externalEntityId: string;
  externalTenantId?: string;
  externalParentId?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class IntegrationIdentityMapperService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Canonical key lets logs/events carry stable provider object references.
  toCanonicalKey(input: ExternalIdentityRef) {
    return `${input.provider}:${input.objectType}:${input.externalId}`;
  }

  parseCanonicalKey(key: string): ExternalIdentityRef | null {
    const [provider, objectType, ...rest] = key.split(":");

    if (!provider || !objectType || rest.length === 0) {
      return null;
    }

    return {
      provider: provider as IntegrationProvider,
      objectType,
      externalId: rest.join(":")
    };
  }

  async upsert(input: PersistExternalIdentityInput) {
    const now = new Date();

    return this.prisma.externalIdentityMapping.upsert({
      where: {
        tenantId_provider_externalEntityType_externalEntityId: {
          tenantId: input.tenantId,
          provider: input.provider,
          externalEntityType: input.externalEntityType,
          externalEntityId: input.externalEntityId
        }
      },
      update: {
        internalEntityType: input.internalEntityType,
        internalEntityId: input.internalEntityId,
        externalTenantId: input.externalTenantId,
        externalParentId: input.externalParentId,
        metadata: input.metadata,
        lastSyncedAt: now
      },
      create: {
        tenantId: input.tenantId,
        provider: input.provider,
        internalEntityType: input.internalEntityType,
        internalEntityId: input.internalEntityId,
        externalEntityType: input.externalEntityType,
        externalEntityId: input.externalEntityId,
        externalTenantId: input.externalTenantId,
        externalParentId: input.externalParentId,
        metadata: input.metadata,
        firstMappedAt: now,
        lastSyncedAt: now
      }
    });
  }

  findByExternal(input: {
    tenantId: string;
    provider: IntegrationProvider;
    externalEntityType: string;
    externalEntityId: string;
  }) {
    return this.prisma.externalIdentityMapping.findUnique({
      where: {
        tenantId_provider_externalEntityType_externalEntityId: {
          tenantId: input.tenantId,
          provider: input.provider,
          externalEntityType: input.externalEntityType,
          externalEntityId: input.externalEntityId
        }
      }
    });
  }

  findByInternal(input: {
    tenantId: string;
    provider: IntegrationProvider;
    internalEntityType: string;
    internalEntityId: string;
  }) {
    return this.prisma.externalIdentityMapping.findMany({
      where: {
        tenantId: input.tenantId,
        provider: input.provider,
        internalEntityType: input.internalEntityType,
        internalEntityId: input.internalEntityId
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
  }
}
