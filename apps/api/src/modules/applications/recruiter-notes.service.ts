import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditWriterService } from "../audit/audit-writer.service";

@Injectable()
export class RecruiterNotesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService
  ) {}

  async create(tenantId: string, applicationId: string, authorUserId: string, noteText: string) {
    const note = await this.prisma.recruiterNote.create({
      data: { tenantId, applicationId, authorUserId, noteText }
    });

    await this.auditWriterService.write({
      tenantId,
      actorUserId: authorUserId,
      action: "recruiter_note.created",
      entityType: "RecruiterNote",
      entityId: note.id,
      metadata: { applicationId }
    });

    return note;
  }

  list(tenantId: string, applicationId: string) {
    return this.prisma.recruiterNote.findMany({
      where: { tenantId, applicationId },
      orderBy: { createdAt: "desc" }
    });
  }
}
