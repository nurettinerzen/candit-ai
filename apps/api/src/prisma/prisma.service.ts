import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "./database-url";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      datasources: process.env.DATABASE_URL
        ? {
            db: {
              url: normalizeDatabaseUrl(process.env.DATABASE_URL, {
                defaultConnectionLimit: 3,
                defaultPoolTimeoutSeconds: 20
              })
            }
          }
        : undefined
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
