import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AuditActorType,
  SchedulingWorkflowState,
  SchedulingWorkflowStatus,
  type IntegrationProvider,
  type Prisma
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { IntegrationsService } from "../integrations/integrations.service";
import { InterviewsService } from "../interviews/interviews.service";

type AvailabilityWindow = {
  start: string;
  end: string;
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function asWindowArray(value: unknown): AvailabilityWindow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asRecord(item))
    .map((item) => ({
      start: typeof item.start === "string" ? item.start : "",
      end: typeof item.end === "string" ? item.end : ""
    }))
    .filter((window) => window.start.length > 0 && window.end.length > 0);
}

function asDate(raw: string) {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Gecersiz tarih formatı: ${raw}`);
  }

  return parsed;
}

function intersectRanges(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  const start = new Date(Math.max(a.start.getTime(), b.start.getTime()));
  const end = new Date(Math.min(a.end.getTime(), b.end.getTime()));
  if (end.getTime() <= start.getTime()) {
    return null;
  }

  return { start, end };
}

@Injectable()
export class SchedulingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InterviewsService) private readonly interviewsService: InterviewsService,
    @Inject(IntegrationsService) private readonly integrationsService: IntegrationsService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(DomainEventsService) private readonly domainEventsService: DomainEventsService
  ) {}

  async listWorkflows(tenantId: string, applicationId?: string) {
    return this.prisma.schedulingWorkflow.findMany({
      where: {
        tenantId,
        ...(applicationId ? { applicationId } : {})
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 100
    });
  }

  async createWorkflow(input: {
    tenantId: string;
    applicationId: string;
    initiatedBy: string;
    provider?: IntegrationProvider;
    traceId?: string;
  }) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.applicationId
      },
      select: {
        id: true
      }
    });

    if (!application) {
      throw new NotFoundException("Basvuru bulunamadi.");
    }

    if (input.provider) {
      await this.integrationsService.assertMeetingProviderSelectable({
        tenantId: input.tenantId,
        provider: input.provider
      });
    }

    const workflow = await this.prisma.schedulingWorkflow.create({
      data: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        initiatedBy: input.initiatedBy,
        updatedBy: input.initiatedBy,
        source: "assistant",
        provider: input.provider,
        state: SchedulingWorkflowState.COLLECTING_RECRUITER_AVAILABILITY,
        status: SchedulingWorkflowStatus.ACTIVE
      }
    });

    await this.writeAuditAndEvent({
      tenantId: input.tenantId,
      workflowId: workflow.id,
      action: "scheduling.workflow.created",
      state: workflow.state,
      requestedBy: input.initiatedBy,
      traceId: input.traceId
    });

    return workflow;
  }

  async setRecruiterConstraints(input: {
    tenantId: string;
    workflowId: string;
    recruiterConstraints: Record<string, unknown>;
    requestedBy: string;
    traceId?: string;
  }) {
    const workflow = await this.requireWorkflow(input.tenantId, input.workflowId);
    this.assertState(workflow.state, [
      SchedulingWorkflowState.COLLECTING_RECRUITER_AVAILABILITY,
      SchedulingWorkflowState.COLLECTING_CANDIDATE_AVAILABILITY,
      SchedulingWorkflowState.SLOT_PROPOSAL_READY
    ]);

    const updated = await this.prisma.schedulingWorkflow.update({
      where: {
        id: workflow.id
      },
      data: {
        recruiterConstraintsJson: input.recruiterConstraints as Prisma.InputJsonValue,
        state: SchedulingWorkflowState.COLLECTING_CANDIDATE_AVAILABILITY,
        updatedBy: input.requestedBy
      }
    });

    await this.writeAuditAndEvent({
      tenantId: input.tenantId,
      workflowId: updated.id,
      action: "scheduling.recruiter_constraints.updated",
      state: updated.state,
      requestedBy: input.requestedBy,
      traceId: input.traceId
    });

    return updated;
  }

  async setCandidateAvailability(input: {
    tenantId: string;
    workflowId: string;
    candidateAvailability: Record<string, unknown>;
    requestedBy: string;
    traceId?: string;
  }) {
    const workflow = await this.requireWorkflow(input.tenantId, input.workflowId);
    this.assertState(workflow.state, [
      SchedulingWorkflowState.COLLECTING_CANDIDATE_AVAILABILITY,
      SchedulingWorkflowState.SLOT_PROPOSAL_READY
    ]);

    const updated = await this.prisma.schedulingWorkflow.update({
      where: {
        id: workflow.id
      },
      data: {
        candidateAvailabilityJson: input.candidateAvailability as Prisma.InputJsonValue,
        state: SchedulingWorkflowState.SLOT_PROPOSAL_READY,
        updatedBy: input.requestedBy
      }
    });

    await this.writeAuditAndEvent({
      tenantId: input.tenantId,
      workflowId: updated.id,
      action: "scheduling.candidate_availability.updated",
      state: updated.state,
      requestedBy: input.requestedBy,
      traceId: input.traceId
    });

    return updated;
  }

  async proposeSlots(input: {
    tenantId: string;
    workflowId: string;
    requestedBy: string;
    traceId?: string;
  }) {
    const workflow = await this.requireWorkflow(input.tenantId, input.workflowId);
    this.assertState(workflow.state, [SchedulingWorkflowState.SLOT_PROPOSAL_READY]);

    const recruiterWindows = asWindowArray(asRecord(workflow.recruiterConstraintsJson).windows);
    const candidateWindows = asWindowArray(asRecord(workflow.candidateAvailabilityJson).windows);
    const slotDurationMinutesRaw = Number(asRecord(workflow.recruiterConstraintsJson).slotDurationMinutes ?? 45);
    const slotDurationMinutes =
      Number.isFinite(slotDurationMinutesRaw) && slotDurationMinutesRaw > 0
        ? Math.floor(slotDurationMinutesRaw)
        : 45;

    if (recruiterWindows.length === 0 || candidateWindows.length === 0) {
      throw new BadRequestException("Slot onerisi icin recruiter ve candidate availability gereklidir.");
    }

    // Fetch busy periods from connected calendar provider (if any)
    const busyPeriods = await this.fetchCalendarBusyPeriods(
      input.tenantId,
      workflow.provider ?? undefined,
      recruiterWindows
    );

    const proposed: Array<{
      slotId: string;
      start: string;
      end: string;
      source: string;
    }> = [];

    for (const recruiterWindow of recruiterWindows) {
      const recruiterRange = {
        start: asDate(recruiterWindow.start),
        end: asDate(recruiterWindow.end)
      };

      for (const candidateWindow of candidateWindows) {
        const candidateRange = {
          start: asDate(candidateWindow.start),
          end: asDate(candidateWindow.end)
        };

        const intersection = intersectRanges(recruiterRange, candidateRange);
        if (!intersection) {
          continue;
        }

        let cursor = new Date(intersection.start.getTime());
        while (cursor.getTime() + slotDurationMinutes * 60 * 1000 <= intersection.end.getTime()) {
          const slotEnd = new Date(cursor.getTime() + slotDurationMinutes * 60 * 1000);

          // Check if slot conflicts with any busy period
          const conflictsWithBusy = busyPeriods.some((busy) => {
            const busyStart = new Date(busy.start).getTime();
            const busyEnd = new Date(busy.end).getTime();
            return cursor.getTime() < busyEnd && slotEnd.getTime() > busyStart;
          });

          if (!conflictsWithBusy) {
            proposed.push({
              slotId: `slot_${cursor.toISOString()}`,
              start: cursor.toISOString(),
              end: slotEnd.toISOString(),
              source: busyPeriods.length > 0 ? "intersection_calendar_checked" : "intersection"
            });
          }

          cursor = new Date(cursor.getTime() + 15 * 60 * 1000);
          if (proposed.length >= 12) {
            break;
          }
        }

        if (proposed.length >= 12) {
          break;
        }
      }

      if (proposed.length >= 12) {
        break;
      }
    }

    if (proposed.length === 0) {
      throw new BadRequestException("Müsaitlik kesisiminde uygun slot bulunamadi.");
    }

    const updated = await this.prisma.schedulingWorkflow.update({
      where: {
        id: workflow.id
      },
      data: {
        proposedSlotsJson: proposed as Prisma.InputJsonValue,
        state: SchedulingWorkflowState.SLOT_PROPOSAL_READY,
        updatedBy: input.requestedBy
      }
    });

    await this.writeAuditAndEvent({
      tenantId: input.tenantId,
      workflowId: updated.id,
      action: "scheduling.slots.proposed",
      state: updated.state,
      requestedBy: input.requestedBy,
      traceId: input.traceId,
      metadata: {
        count: proposed.length,
        calendarBusyPeriodsCount: busyPeriods.length
      }
    });

    return {
      workflow: updated,
      proposedSlots: proposed
    };
  }

  async selectSlot(input: {
    tenantId: string;
    workflowId: string;
    slotId: string;
    requestedBy: string;
    traceId?: string;
  }) {
    const workflow = await this.requireWorkflow(input.tenantId, input.workflowId);
    this.assertState(workflow.state, [SchedulingWorkflowState.SLOT_PROPOSAL_READY]);

    const proposedSlots = Array.isArray(workflow.proposedSlotsJson)
      ? workflow.proposedSlotsJson.map((item) => asRecord(item))
      : [];
    const selected = proposedSlots.find((item) => item.slotId === input.slotId);

    if (!selected) {
      throw new NotFoundException("Secilen slot bulunamadi.");
    }

    const updated = await this.prisma.schedulingWorkflow.update({
      where: {
        id: workflow.id
      },
      data: {
        selectedSlotJson: selected as Prisma.InputJsonValue,
        state: SchedulingWorkflowState.SLOT_SELECTED,
        updatedBy: input.requestedBy
      }
    });

    await this.writeAuditAndEvent({
      tenantId: input.tenantId,
      workflowId: updated.id,
      action: "scheduling.slot.selected",
      state: updated.state,
      requestedBy: input.requestedBy,
      traceId: input.traceId,
      metadata: {
        slotId: input.slotId
      }
    });

    return updated;
  }

  async bookSelectedSlot(input: {
    tenantId: string;
    workflowId: string;
    requestedBy: string;
    provider?: IntegrationProvider;
    traceId?: string;
  }) {
    const workflow = await this.requireWorkflow(input.tenantId, input.workflowId);
    this.assertState(workflow.state, [
      SchedulingWorkflowState.SLOT_SELECTED,
      SchedulingWorkflowState.RESCHEDULE_PENDING
    ]);

    const selected = asRecord(workflow.selectedSlotJson);
    const scheduledAtRaw = typeof selected.start === "string" ? selected.start : null;
    if (!scheduledAtRaw) {
      throw new BadRequestException("Booking icin selected slot eksik.");
    }

    const application = await this.prisma.candidateApplication.findFirst({
      where: {
        tenantId: input.tenantId,
        id: workflow.applicationId
      },
      include: {
        candidate: {
          select: {
            fullName: true,
            email: true
          }
        },
        job: {
          select: {
            title: true
          }
        }
      }
    });

    if (!application) {
      throw new NotFoundException("Booking icin basvuru bulunamadi.");
    }

    let sessionId = workflow.sessionId;
    const preferredProvider = input.provider ?? workflow.provider ?? undefined;

    if (!sessionId) {
      const scheduled = await this.interviewsService.schedule({
        tenantId: input.tenantId,
        applicationId: workflow.applicationId,
        mode: "MEETING_LINK",
        scheduledAt: scheduledAtRaw,
        schedulingSource: "assistant_scheduler",
        scheduleNote: "assistant_led_scheduling",
        requestedBy: input.requestedBy,
        preferredProvider,
        traceId: input.traceId
      });

      sessionId = scheduled.id;
    } else {
      await this.interviewsService.reschedule({
        tenantId: input.tenantId,
        sessionId,
        scheduledAt: scheduledAtRaw,
        schedulingSource: "assistant_scheduler",
        reasonCode: "assistant_reschedule",
        scheduleNote: "assistant_led_scheduling",
        requestedBy: input.requestedBy,
        preferredProvider,
        traceId: input.traceId
      });
    }

    const session = await this.prisma.interviewSession.findFirst({
      where: {
        id: sessionId,
        tenantId: input.tenantId
      },
      select: {
        id: true,
        meetingProvider: true,
        meetingProviderSource: true,
        meetingJoinUrl: true,
        scheduledAt: true
      }
    });

    const bookingResult = {
      sessionId: session?.id ?? null,
      provider: session?.meetingProvider ?? preferredProvider ?? null,
      providerSource: session?.meetingProviderSource ?? null,
      joinUrl: session?.meetingJoinUrl ?? null,
      scheduledAt: session?.scheduledAt?.toISOString() ?? null
    };

    const updated = await this.prisma.schedulingWorkflow.update({
      where: {
        id: workflow.id
      },
      data: {
        sessionId: sessionId ?? undefined,
        provider: (bookingResult.provider as IntegrationProvider | null) ?? workflow.provider,
        state: SchedulingWorkflowState.BOOKED,
        status: SchedulingWorkflowStatus.COMPLETED,
        bookingResultJson: bookingResult as Prisma.InputJsonValue,
        updatedBy: input.requestedBy
      }
    });

    await this.writeAuditAndEvent({
      tenantId: input.tenantId,
      workflowId: updated.id,
      action: "scheduling.slot.booked",
      state: updated.state,
      requestedBy: input.requestedBy,
      traceId: input.traceId,
      metadata: bookingResult
    });

    return {
      workflow: updated,
      bookingResult
    };
  }

  async cancelWorkflow(input: {
    tenantId: string;
    workflowId: string;
    requestedBy: string;
    reasonCode?: string;
    traceId?: string;
  }) {
    const workflow = await this.requireWorkflow(input.tenantId, input.workflowId);
    if (workflow.status !== SchedulingWorkflowStatus.ACTIVE) {
      return workflow;
    }

    const updated = await this.prisma.schedulingWorkflow.update({
      where: {
        id: workflow.id
      },
      data: {
        state: SchedulingWorkflowState.CANCELLED,
        status: SchedulingWorkflowStatus.CANCELLED,
        lastError: input.reasonCode ?? null,
        updatedBy: input.requestedBy
      }
    });

    await this.writeAuditAndEvent({
      tenantId: input.tenantId,
      workflowId: updated.id,
      action: "scheduling.workflow.cancelled",
      state: updated.state,
      requestedBy: input.requestedBy,
      traceId: input.traceId,
      metadata: {
        reasonCode: input.reasonCode ?? null
      }
    });

    return updated;
  }

  async requestReschedule(input: {
    tenantId: string;
    workflowId: string;
    requestedBy: string;
    reasonCode?: string;
    traceId?: string;
  }) {
    const workflow = await this.requireWorkflow(input.tenantId, input.workflowId);
    this.assertState(workflow.state, [SchedulingWorkflowState.BOOKED, SchedulingWorkflowState.SLOT_SELECTED]);

    const updated = await this.prisma.schedulingWorkflow.update({
      where: {
        id: workflow.id
      },
      data: {
        state: SchedulingWorkflowState.RESCHEDULE_PENDING,
        status: SchedulingWorkflowStatus.ACTIVE,
        lastError: input.reasonCode ?? null,
        updatedBy: input.requestedBy
      }
    });

    await this.writeAuditAndEvent({
      tenantId: input.tenantId,
      workflowId: updated.id,
      action: "scheduling.workflow.reschedule_requested",
      state: updated.state,
      requestedBy: input.requestedBy,
      traceId: input.traceId,
      metadata: {
        reasonCode: input.reasonCode ?? null
      }
    });

    return updated;
  }

  async getPublicWorkflow(workflowId: string, candidateToken: string) {
    const workflow = await this.prisma.schedulingWorkflow.findFirst({
      where: { id: workflowId }
    });

    if (!workflow) {
      throw new NotFoundException("Scheduling workflow bulunamadi.");
    }

    const context = asRecord(workflow.conversationContextJson);
    if (context.candidateAccessToken !== candidateToken) {
      throw new NotFoundException("Gecersiz erisim tokeni.");
    }

    if (workflow.status !== SchedulingWorkflowStatus.ACTIVE) {
      return {
        workflowId: workflow.id,
        state: workflow.state,
        status: workflow.status,
        proposedSlots: [],
        selectedSlot: workflow.selectedSlotJson ? asRecord(workflow.selectedSlotJson) : null,
        bookingResult: workflow.bookingResultJson ? asRecord(workflow.bookingResultJson) : null,
        application: await this.getWorkflowApplication(workflow.tenantId, workflow.applicationId)
      };
    }

    const proposedSlots = Array.isArray(workflow.proposedSlotsJson)
      ? workflow.proposedSlotsJson.map((item) => asRecord(item))
      : [];

    return {
      workflowId: workflow.id,
      state: workflow.state,
      status: workflow.status,
      proposedSlots,
      selectedSlot: workflow.selectedSlotJson ? asRecord(workflow.selectedSlotJson) : null,
      bookingResult: workflow.bookingResultJson ? asRecord(workflow.bookingResultJson) : null,
      application: await this.getWorkflowApplication(workflow.tenantId, workflow.applicationId)
    };
  }

  async publicSelectSlotAndBook(workflowId: string, candidateToken: string, slotId: string) {
    const workflow = await this.prisma.schedulingWorkflow.findFirst({
      where: { id: workflowId }
    });

    if (!workflow) {
      throw new NotFoundException("Scheduling workflow bulunamadi.");
    }

    const context = asRecord(workflow.conversationContextJson);
    if (context.candidateAccessToken !== candidateToken) {
      throw new NotFoundException("Gecersiz erisim tokeni.");
    }

    // Select the slot
    const afterSelect = await this.selectSlot({
      tenantId: workflow.tenantId,
      workflowId: workflow.id,
      slotId,
      requestedBy: "candidate",
      traceId: `public_scheduling_${Date.now()}`
    });

    // Auto-book the slot
    const bookResult = await this.bookSelectedSlot({
      tenantId: workflow.tenantId,
      workflowId: workflow.id,
      requestedBy: "candidate",
      provider: workflow.provider ?? undefined,
      traceId: `public_scheduling_${Date.now()}`
    });

    return {
      workflowId: workflow.id,
      state: bookResult.workflow.state,
      status: bookResult.workflow.status,
      bookingResult: bookResult.bookingResult,
      selectedSlot: asRecord(afterSelect.selectedSlotJson)
    };
  }

  async getPublicConfirmation(workflowId: string, candidateToken: string) {
    const workflow = await this.prisma.schedulingWorkflow.findFirst({
      where: { id: workflowId }
    });

    if (!workflow) {
      throw new NotFoundException("Scheduling workflow bulunamadi.");
    }

    const context = asRecord(workflow.conversationContextJson);
    if (context.candidateAccessToken !== candidateToken) {
      throw new NotFoundException("Gecersiz erisim tokeni.");
    }

    const booking = workflow.bookingResultJson ? asRecord(workflow.bookingResultJson) : null;
    const selected = workflow.selectedSlotJson ? asRecord(workflow.selectedSlotJson) : null;
    const application = await this.getWorkflowApplication(workflow.tenantId, workflow.applicationId);

    return {
      workflowId: workflow.id,
      state: workflow.state,
      status: workflow.status,
      selectedSlot: selected,
      bookingResult: booking,
      application
    };
  }

  private async getWorkflowApplication(tenantId: string, applicationId: string) {
    const app = await this.prisma.candidateApplication.findFirst({
      where: { id: applicationId, tenantId },
      include: {
        candidate: { select: { fullName: true } },
        job: { select: { title: true } }
      }
    });
    if (!app) return null;
    return {
      candidateName: app.candidate.fullName,
      jobTitle: app.job.title
    };
  }

  private async fetchCalendarBusyPeriods(
    tenantId: string,
    provider?: string,
    windows?: AvailabilityWindow[]
  ): Promise<Array<{ start: string; end: string }>> {
    if (!windows || windows.length === 0) {
      return [];
    }

    try {
      // Find the earliest start and latest end across all windows
      const allStarts = windows.map((w) => new Date(w.start).getTime()).filter(Number.isFinite);
      const allEnds = windows.map((w) => new Date(w.end).getTime()).filter(Number.isFinite);
      if (allStarts.length === 0 || allEnds.length === 0) {
        return [];
      }

      const rangeStart = new Date(Math.min(...allStarts)).toISOString();
      const rangeEnd = new Date(Math.max(...allEnds)).toISOString();

      // Try to get busy periods from the active integration connection
      const connections = await this.integrationsService.listConnections(tenantId);
      const activeConnection = connections.find((conn) => {
        if (provider && conn.provider !== provider) {
          return false;
        }
        return conn.status === "ACTIVE";
      });

      if (!activeConnection) {
        return [];
      }

      // Use integrations service runSync with objectType "scheduled_events"
      const syncResult = await this.integrationsService.runSync({
        tenantId,
        provider: activeConnection.provider,
        objectType: "scheduled_events",
        traceId: undefined
      });

      if (syncResult.status !== "ok" || !syncResult.details) {
        return [];
      }

      const items: unknown[] = Array.isArray(syncResult.details.items) ? (syncResult.details.items as unknown[]) : [];
      return items
        .map((rawItem: unknown) => {
          const record = typeof rawItem === "object" && rawItem ? (rawItem as Record<string, unknown>) : {};
          const start = typeof record.start_time === "string" ? record.start_time :
            typeof record.start === "string" ? record.start : null;
          const end = typeof record.end_time === "string" ? record.end_time :
            typeof record.end === "string" ? record.end : null;
          return start && end ? { start, end } : null;
        })
        .filter((item: { start: string; end: string } | null): item is { start: string; end: string } => item !== null)
        .filter((item: { start: string; end: string }) => {
          // Only include events within our range
          const itemStart = new Date(item.start).getTime();
          const itemEnd = new Date(item.end).getTime();
          const rStart = new Date(rangeStart).getTime();
          const rEnd = new Date(rangeEnd).getTime();
          return itemEnd > rStart && itemStart < rEnd;
        });
    } catch {
      // Calendar busy check is best-effort; don't block slot proposal
      return [];
    }
  }

  private async requireWorkflow(tenantId: string, workflowId: string) {
    const workflow = await this.prisma.schedulingWorkflow.findFirst({
      where: {
        id: workflowId,
        tenantId
      }
    });

    if (!workflow) {
      throw new NotFoundException("Scheduling workflow bulunamadi.");
    }

    return workflow;
  }

  private assertState(current: SchedulingWorkflowState, allowed: SchedulingWorkflowState[]) {
    if (!allowed.includes(current)) {
      throw new BadRequestException(`Bu adim icin workflow state gecersiz: ${current}`);
    }
  }

  private async writeAuditAndEvent(input: {
    tenantId: string;
    workflowId: string;
    action: string;
    state: SchedulingWorkflowState;
    requestedBy: string;
    traceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    await Promise.all([
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorType: AuditActorType.USER,
        actorUserId: input.requestedBy,
        action: input.action,
        entityType: "SchedulingWorkflow",
        entityId: input.workflowId,
        traceId: input.traceId,
        metadata: {
          state: input.state,
          ...(input.metadata ?? {})
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "SchedulingWorkflow",
        aggregateId: input.workflowId,
        eventType: input.action,
        traceId: input.traceId,
        payload: {
          state: input.state,
          requestedBy: input.requestedBy,
          ...(input.metadata ?? {})
        }
      })
    ]);
  }
}
