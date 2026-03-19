import { Injectable, Inject, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { InterviewsService } from "./interviews.service";

/**
 * Scans for SCHEDULED interview sessions whose scheduledAt has arrived
 * and transitions them to ACTIVE so the candidate can begin the AI interview.
 *
 * Designed to be called periodically (e.g. every 60s via cron or BullMQ repeatable job).
 * In V1, the front-end candidate page also checks session status on load,
 * so this service acts as a belt-and-suspenders safety net.
 */
@Injectable()
export class InterviewLauncherService {
  private readonly logger = new Logger(InterviewLauncherService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InterviewsService) private readonly interviewsService: InterviewsService
  ) {}

  /**
   * Find all SCHEDULED sessions whose scheduledAt <= now and activate them.
   * Called from a controller endpoint or a scheduled job.
   */
  async activateDueSessions(): Promise<{ activated: string[]; errors: string[] }> {
    const now = new Date();

    const dueSessions = await this.prisma.interviewSession.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now }
      },
      select: {
        id: true,
        tenantId: true,
        applicationId: true,
        scheduledAt: true
      },
      take: 50
    });

    if (dueSessions.length === 0) {
      return { activated: [], errors: [] };
    }

    this.logger.log(`Found ${dueSessions.length} due interview sessions to activate.`);

    const activated: string[] = [];
    const errors: string[] = [];

    for (const session of dueSessions) {
      try {
        await this.interviewsService.start({
          tenantId: session.tenantId,
          sessionId: session.id,
          startedBy: "system_launcher",
          traceId: `launcher_${Date.now()}`
        });
        activated.push(session.id);
        this.logger.log(`Activated session ${session.id}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "unknown";
        errors.push(`${session.id}: ${msg}`);
        this.logger.warn(`Failed to activate session ${session.id}: ${msg}`);
      }
    }

    return { activated, errors };
  }

  /**
   * Activate a single session if it's due or within the launch window (5 min early).
   * Used by the candidate interview page to ensure the session is ready.
   */
  async ensureSessionActive(sessionId: string, tenantId: string): Promise<{ status: string; sessionId: string }> {
    const session = await this.prisma.interviewSession.findFirst({
      where: { id: sessionId, tenantId },
      select: { id: true, status: true, scheduledAt: true }
    });

    if (!session) {
      return { status: "not_found", sessionId };
    }

    if (session.status === "RUNNING") {
      return { status: "already_active", sessionId };
    }

    if (session.status !== "SCHEDULED") {
      return { status: session.status.toLowerCase(), sessionId };
    }

    // Allow activation up to 5 minutes before scheduled time
    const launchWindow = 5 * 60 * 1000;
    const scheduledTime = session.scheduledAt ? new Date(session.scheduledAt).getTime() : 0;
    const now = Date.now();

    if (scheduledTime > 0 && scheduledTime - now > launchWindow) {
      return { status: "too_early", sessionId };
    }

    try {
      await this.interviewsService.start({
        tenantId,
        sessionId: session.id,
        startedBy: "candidate_launch",
        traceId: `candidate_launch_${Date.now()}`
      });
      return { status: "activated", sessionId };
    } catch (error) {
      return { status: "activation_failed", sessionId };
    }
  }
}
