import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { JobStatus, Prisma } from "@prisma/client";
import { AuditWriterService } from "../audit/audit-writer.service";
import { BillingService } from "../billing/billing.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { AiProviderRegistryService } from "../ai-orchestration/providers/ai-provider-registry.service";
import { PrismaService } from "../../prisma/prisma.service";

export type JobRequirementInput = {
  key: string;
  value: string;
  required?: boolean;
};

type JobDraftOutline = {
  headline: string;
  openingParagraph: string;
  jobSummary: string;
  responsibilities: string[];
  requiredQualifications: string[];
  preferredQualifications: string[];
  closingParagraph: string;
};

export type CreateJobInput = {
  tenantId: string;
  userId: string;
  workspaceId?: string;
  title: string;
  roleFamily: string;
  locationText?: string;
  shiftType?: string;
  salaryMin?: number;
  salaryMax?: number;
  status: JobStatus;
  jdText?: string;
  aiDraftText?: string;
  requirements?: JobRequirementInput[];
};

export type UpdateJobInput = {
  tenantId: string;
  id: string;
  updatedBy: string;
  title?: string;
  roleFamily?: string;
  locationText?: string;
  shiftType?: string;
  salaryMin?: number;
  salaryMax?: number;
  status?: JobStatus;
  jdText?: string;
  aiDraftText?: string;
  requirements?: JobRequirementInput[];
};

export type GenerateJobDraftInput = {
  tenantId: string;
  title: string;
  roleFamily?: string;
  locationText?: string;
  shiftType?: string;
  salaryMin?: number;
  salaryMax?: number;
  jdText?: string;
  requirements?: JobRequirementInput[];
  existingDraft?: string;
  rewriteInstruction?: string;
};

export type GeneratedJobDraft = {
  draftText: string;
  generationMode: "fresh" | "rewrite";
  source: "llm" | "fallback";
  providerKey: string;
  modelKey: string;
  notice: string | null;
};

@Injectable()
export class JobsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(DomainEventsService) private readonly domainEventsService: DomainEventsService,
    @Inject(AiProviderRegistryService)
    private readonly aiProviderRegistryService: AiProviderRegistryService
  ) {}

  list(tenantId: string) {
    return this.prisma.job.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        requirements: true,
        _count: {
          select: {
            applications: true
          }
        }
      }
    });
  }

  async getById(tenantId: string, id: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, tenantId },
      include: {
        requirements: true,
        _count: {
          select: {
            applications: true
          }
        }
      }
    });

    if (!job) {
      throw new NotFoundException("Job bulunamadi.");
    }

    return job;
  }

  async generateDraft(input: GenerateJobDraftInput): Promise<GeneratedJobDraft> {
    const generationMode =
      input.existingDraft?.trim() || input.rewriteInstruction?.trim() ? "rewrite" : "fresh";
    const provider = this.aiProviderRegistryService.getProvider();

    if (provider.key === "deterministic-fallback") {
      return this.buildFallbackDraft(
        input,
        generationMode,
        "AI sağlayıcısı hazır değil; kural tabanlı taslak üretildi."
      );
    }

    try {
      const result = await provider.runTask({
        taskRunId: randomUUID(),
        tenantId: input.tenantId,
        taskType: "JOB_REQUIREMENT_INTERPRETATION",
        locale: "tr",
        payload: {
          systemPrompt: this.buildDraftSystemPrompt(),
          userPrompt: this.buildDraftUserPrompt(input, generationMode),
          schemaName: "job_posting_draft",
          outputSchema: this.buildDraftOutputSchema()
        }
      });

      const outline = this.normalizeDraftOutline(result.output);
      if (!outline) {
        return this.buildFallbackDraft(
          input,
          generationMode,
          "AI yanıtı geçerli bir ilan taslağı üretmedi; kural tabanlı taslak gösteriliyor."
        );
      }

      return {
        draftText: this.composeDraftText(input, outline),
        generationMode,
        source: "llm",
        providerKey: provider.key,
        modelKey: result.modelKey ?? "unknown-model",
        notice: null
      };
    } catch (error) {
      return this.buildFallbackDraft(
        input,
        generationMode,
        "AI taslak üretimi başarısız oldu; kural tabanlı taslak gösteriliyor."
      );
    }
  }

  async create(input: CreateJobInput) {
    if (input.status === JobStatus.PUBLISHED) {
      await this.billingService.assertCanPublishJob(input.tenantId);
    }

    const job = await this.prisma.job.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        title: input.title,
        roleFamily: input.roleFamily,
        locationText: input.locationText,
        shiftType: input.shiftType,
        salaryMin: this.toDecimal(input.salaryMin),
        salaryMax: this.toDecimal(input.salaryMax),
        status: input.status,
        jdText: input.jdText,
        aiDraftText: input.aiDraftText,
        createdBy: input.userId,
        requirements: input.requirements?.length
          ? {
              create: input.requirements.map((requirement) => ({
                tenantId: input.tenantId,
                key: requirement.key,
                value: requirement.value,
                required: requirement.required ?? true
              }))
            }
          : undefined
      },
      include: {
        requirements: true,
        _count: {
          select: {
            applications: true
          }
        }
      }
    });

    await Promise.all([
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.userId,
        action: "job.created",
        entityType: "Job",
        entityId: job.id,
        metadata: {
          title: job.title,
          roleFamily: job.roleFamily,
          status: job.status,
          requirementCount: job.requirements.length
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "Job",
        aggregateId: job.id,
        eventType: "job.created",
        payload: {
          title: job.title,
          roleFamily: job.roleFamily,
          status: job.status,
          createdBy: input.userId
        }
      })
    ]);

    if (job.status === JobStatus.PUBLISHED) {
      await this.billingService.recordJobCreditUsage(input.tenantId, job.id);
    }

    return job;
  }

  async update(input: UpdateJobInput) {
    const current = await this.getById(input.tenantId, input.id);

    if (input.status === JobStatus.PUBLISHED && current.status !== JobStatus.PUBLISHED) {
      await this.billingService.assertCanPublishJob(input.tenantId, { jobId: input.id });
    }

    const job = await this.prisma.$transaction(async (tx) => {
      if (input.requirements) {
        await tx.jobRequirement.deleteMany({
          where: {
            tenantId: input.tenantId,
            jobId: input.id
          }
        });
      }

      return tx.job.update({
        where: { id: input.id },
        data: {
          title: input.title,
          roleFamily: input.roleFamily,
          locationText: input.locationText,
          shiftType: input.shiftType,
          salaryMin: this.toDecimal(input.salaryMin),
          salaryMax: this.toDecimal(input.salaryMax),
          status: input.status,
          jdText: input.jdText,
          aiDraftText: input.aiDraftText !== undefined ? (input.aiDraftText?.trim() || null) : undefined,
          requirements: input.requirements?.length
            ? {
                create: input.requirements.map((requirement) => ({
                  tenantId: input.tenantId,
                  key: requirement.key,
                  value: requirement.value,
                  required: requirement.required ?? true
                }))
              }
            : undefined
        },
        include: {
          requirements: true,
          _count: {
            select: {
              applications: true
            }
          }
        }
      });
    });

    await Promise.all([
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.updatedBy,
        action: "job.updated",
        entityType: "Job",
        entityId: job.id,
        metadata: {
          changedFields: {
            title: input.title !== undefined,
            roleFamily: input.roleFamily !== undefined,
            status: input.status !== undefined,
            locationText: input.locationText !== undefined,
            shiftType: input.shiftType !== undefined,
            salaryMin: input.salaryMin !== undefined,
            salaryMax: input.salaryMax !== undefined,
            jdText: input.jdText !== undefined,
            requirements: input.requirements !== undefined
          },
          before: {
            status: current.status,
            title: current.title,
            roleFamily: current.roleFamily
          },
          after: {
            status: job.status,
            title: job.title,
            roleFamily: job.roleFamily
          }
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "Job",
        aggregateId: job.id,
        eventType: "job.updated",
        payload: {
          updatedBy: input.updatedBy,
          status: job.status
        }
      })
    ]);

    if (job.status === JobStatus.PUBLISHED && current.status !== JobStatus.PUBLISHED) {
      await this.billingService.recordJobCreditUsage(input.tenantId, job.id);
    }

    return job;
  }

  async deleteMany(input: { tenantId: string; deletedBy: string; jobIds: string[] }) {
    const jobIds = [...new Set(input.jobIds.map((item) => item.trim()).filter(Boolean))];
    if (jobIds.length === 0) {
      throw new NotFoundException("Silinecek ilan bulunamadi.");
    }

    const jobs = await this.prisma.job.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: jobIds }
      },
      select: {
        id: true,
        title: true,
        status: true,
        roleFamily: true
      }
    });

    if (jobs.length !== jobIds.length) {
      throw new NotFoundException("Secilen ilanlardan biri bulunamadi.");
    }

    await this.prisma.job.deleteMany({
      where: {
        tenantId: input.tenantId,
        id: { in: jobIds }
      }
    });

    await Promise.all(
      jobs.flatMap((job) => [
        this.auditWriterService.write({
          tenantId: input.tenantId,
          actorUserId: input.deletedBy,
          action: "job.deleted",
          entityType: "Job",
          entityId: job.id,
          metadata: {
            title: job.title,
            roleFamily: job.roleFamily,
            status: job.status
          }
        }),
        this.domainEventsService.append({
          tenantId: input.tenantId,
          aggregateType: "Job",
          aggregateId: job.id,
          eventType: "job.deleted",
          payload: {
            deletedBy: input.deletedBy,
            title: job.title,
            status: job.status
          }
        })
      ])
    );

    return {
      deletedCount: jobs.length,
      deletedIds: jobs.map((job) => job.id)
    };
  }

  private toDecimal(value: number | undefined) {
    if (value === undefined || Number.isNaN(value)) {
      return undefined;
    }

    return new Prisma.Decimal(value);
  }

  private buildDraftSystemPrompt() {
    return [
      "Sen deneyimli bir IK ve işe alım metin yazarısın.",
      "Türkçe, profesyonel ve dış kariyer platformlarına kolayca yapıştırılabilir bir ilan taslağı hazırla.",
      "Metin sıradan kurumsal klişelerle dolu olmasın; net, modern, güven veren ve adayın ne yapacağını gerçekten anlatan bir dil kur.",
      "Yalnızca paylaşılan bilgilerden hareket et.",
      "Şirket adı, yan hak, ekip büyüklüğü, başvuru kanalı, marka vaadi veya kesin olmayan diğer detayları uydurma.",
      "Eksik bilgiler varsa bunu genel ve güvenli ifadelerle yönet; gerçekmiş gibi detay ekleme.",
      "Aynı bilgiyi açılış paragrafı, iş özeti ve madde listelerinde tekrar etme.",
      "Zorunlu ve tercih edilen nitelikleri ayrıştır; verilen bilgiyi abartma.",
      "Başlığı ve giriş paragrafını pozisyonun amacını hızlıca anlatacak kadar güçlü tut, ama yapay pazarlama dili kullanma.",
      "Revizyon modunda önceki taslağı daha akıcı ve daha güçlü hale getir ama gerçek dışı yeni bilgi ekleme.",
      "Çıktı yalnızca JSON olmalı."
    ].join(" ");
  }

  private buildDraftUserPrompt(input: GenerateJobDraftInput, generationMode: "fresh" | "rewrite") {
    const payload = {
      goal: "Harici iş ilanı platformlarına kopyalanabilir profesyonel ilan taslağı oluştur.",
      generationMode,
      input: {
        title: input.title.trim(),
        department: input.roleFamily?.trim() || null,
        locationText: input.locationText?.trim() || null,
        shiftType: input.shiftType?.trim() || null,
        salaryMin: input.salaryMin ?? null,
        salaryMax: input.salaryMax ?? null,
        jdText: input.jdText?.trim() || null,
        requirements: this.normalizeRequirementFacts(input.requirements)
      },
      existingDraft: input.existingDraft?.trim() || null,
      rewriteInstruction: input.rewriteInstruction?.trim() || null,
      writingRules: [
        "Başlık dışında emoji kullanma.",
        "Kısa ama güçlü bir giriş paragrafı yaz; rolün neden önemli olduğunu hissettir.",
        "Sorumlulukları ve nitelikleri net, kolay okunur ve yapıştırılmaya hazır şekilde yaz.",
        "Genel geçer ifadeler yerine mümkün olduğunca verilen requirement ve iş tanımına yaslan.",
        "Aynı noktayı farklı başlıklarda tekrar etme.",
        "Metin bir recruiter'ın gerçekten yayınlamak isteyeceği kadar derli toplu ve güvenli olsun.",
        "Nitelikleri verilen bilgilerle uyumlu tut.",
        "Eğer bilgi sınırlıysa, rol başlığı ve verilen detaylardan çıkabilecek makul ama genel ifadeler kullan."
      ]
    };

    return JSON.stringify(payload, null, 2);
  }

  private buildDraftOutputSchema() {
    return {
      type: "object",
      additionalProperties: false,
      required: [
        "headline",
        "openingParagraph",
        "jobSummary",
        "responsibilities",
        "requiredQualifications",
        "preferredQualifications",
        "closingParagraph"
      ],
      properties: {
        headline: { type: "string" },
        openingParagraph: { type: "string" },
        jobSummary: { type: "string" },
        responsibilities: {
          type: "array",
          items: { type: "string" }
        },
        requiredQualifications: {
          type: "array",
          items: { type: "string" }
        },
        preferredQualifications: {
          type: "array",
          items: { type: "string" }
        },
        closingParagraph: { type: "string" }
      }
    };
  }

  private normalizeDraftOutline(output: Record<string, unknown>): JobDraftOutline | null {
    const headline = this.cleanSentence(output.headline);
    const openingParagraph = this.cleanParagraph(output.openingParagraph);
    const jobSummary = this.cleanParagraph(output.jobSummary);
    const responsibilities = this.cleanList(output.responsibilities, 6);
    const requiredQualifications = this.cleanList(output.requiredQualifications, 8);
    const preferredQualifications = this.cleanList(output.preferredQualifications, 6);
    const closingParagraph = this.cleanParagraph(output.closingParagraph);

    if (!headline || !openingParagraph || !jobSummary || !closingParagraph) {
      return null;
    }

    if (responsibilities.length === 0 || requiredQualifications.length === 0) {
      return null;
    }

    return {
      headline,
      openingParagraph,
      jobSummary,
      responsibilities,
      requiredQualifications,
      preferredQualifications,
      closingParagraph
    };
  }

  private composeDraftText(input: GenerateJobDraftInput, outline: JobDraftOutline) {
    const lines: string[] = [];
    const detailLines = this.buildDetailLines(input);

    lines.push(outline.headline || input.title.trim());
    lines.push("");
    lines.push(outline.openingParagraph);

    if (detailLines.length > 0) {
      lines.push("");
      lines.push("Rol Hakkinda Kisa Bilgiler");
      detailLines.forEach((detail) => lines.push(`• ${detail}`));
    }

    lines.push("");
    lines.push("Rolun Ozeti");
    lines.push(outline.jobSummary);

    lines.push("");
    lines.push("Bu Rolda Neler Yapacaksiniz?");
    outline.responsibilities.forEach((item) => lines.push(`• ${item}`));

    lines.push("");
    lines.push("Bu Rol Icin Aradigimiz Temel Noktalar");
    outline.requiredQualifications.forEach((item) => lines.push(`• ${item}`));

    if (outline.preferredQualifications.length > 0) {
      lines.push("");
      lines.push("Sizi One Cikarabilecek Ek Deneyimler");
      outline.preferredQualifications.forEach((item) => lines.push(`• ${item}`));
    }

    lines.push("");
    lines.push(outline.closingParagraph);

    return lines.join("\n");
  }

  private buildFallbackDraft(
    input: GenerateJobDraftInput,
    generationMode: "fresh" | "rewrite",
    notice: string
  ): GeneratedJobDraft {
    const title = input.title.trim();
    const detailLines = this.buildDetailLines(input);
    const lines: string[] = [title, ""];
    const introParts = [
      `${title} pozisyonunda görev alacak ekip arkadaşı arıyoruz.`,
      input.roleFamily?.trim()
        ? `Pozisyon, ${input.roleFamily.trim()} departmanı için hazırlanmıştır.`
        : null,
      input.locationText?.trim()
        ? `${input.locationText.trim()} lokasyonundaki operasyon ihtiyacı için değerlendirilecektir.`
        : null
    ].filter(Boolean) as string[];

    lines.push(introParts.join(" "));

    if (detailLines.length > 0) {
      lines.push("");
      lines.push("Rol Hakkinda Kisa Bilgiler");
      detailLines.forEach((detail) => lines.push(`• ${detail}`));
    }

    lines.push("");
    lines.push("Rolun Ozeti");
    lines.push(this.buildFallbackSummary(input));

    const responsibilities = this.buildFallbackResponsibilities(input);
    if (responsibilities.length > 0) {
      lines.push("");
      lines.push("Bu Rolda Neler Yapacaksiniz?");
      responsibilities.forEach((item) => lines.push(`• ${item}`));
    }

    const required = this.normalizeRequirementFacts(input.requirements).filter((item) => item.required);
    const preferred = this.normalizeRequirementFacts(input.requirements).filter((item) => !item.required);

    if (required.length > 0) {
      lines.push("");
      lines.push("Bu Rol Icin Aradigimiz Temel Noktalar");
      required.forEach((item) => lines.push(`• ${item.value}`));
    }

    if (preferred.length > 0) {
      lines.push("");
      lines.push("Sizi One Cikarabilecek Ek Deneyimler");
      preferred.forEach((item) => lines.push(`• ${item.value}`));
    }

    lines.push("");
    lines.push(
      generationMode === "rewrite"
        ? "Bu taslak paylaştığınız bilgiler temel alınarak yeniden düzenlendi. Yayına almadan önce son kontrolünüzü yapabilirsiniz."
        : "Bu taslak paylaştığınız bilgiler temel alınarak hazırlandı. Yayına almadan önce son kontrolünüzü yapabilirsiniz."
    );

    return {
      draftText: lines.join("\n"),
      generationMode,
      source: "fallback",
      providerKey: "deterministic-fallback",
      modelKey: "deterministic-fallback",
      notice
    };
  }

  private buildDetailLines(input: GenerateJobDraftInput) {
    const details: string[] = [];

    if (input.locationText?.trim()) {
      details.push(`Lokasyon: ${input.locationText.trim()}`);
    }

    if (input.shiftType?.trim()) {
      details.push(`Çalışma düzeni: ${input.shiftType.trim()}`);
    }

    if (input.salaryMin !== undefined || input.salaryMax !== undefined) {
      const min =
        input.salaryMin !== undefined
          ? `${input.salaryMin.toLocaleString("tr-TR")} TL`
          : "Belirtilmedi";
      const max =
        input.salaryMax !== undefined
          ? `${input.salaryMax.toLocaleString("tr-TR")} TL`
          : "Belirtilmedi";
      details.push(`Maaş aralığı: ${min} - ${max}`);
    }

    if (input.roleFamily?.trim()) {
      details.push(`Departman: ${input.roleFamily.trim()}`);
    }

    return details;
  }

  private buildFallbackSummary(input: GenerateJobDraftInput) {
    if (input.jdText?.trim()) {
      return input.jdText.trim();
    }

    const fragments = [
      `${input.title.trim()} rolünde günlük operasyonun kesintisiz ve düzenli ilerlemesine katkıda bulunmanız beklenir.`,
      input.shiftType?.trim()
        ? `Pozisyon, ${input.shiftType.trim()} çalışma düzenine uyum sağlayabilecek bir ekip yaklaşımı gerektirir.`
        : null,
      input.locationText?.trim()
        ? `${input.locationText.trim()} lokasyonundaki iş akışına destek verilmesi hedeflenir.`
        : null
    ].filter(Boolean) as string[];

    return fragments.join(" ");
  }

  private buildFallbackResponsibilities(input: GenerateJobDraftInput) {
    const bullets = this.extractBulletCandidates(input.jdText);

    if (bullets.length > 0) {
      return bullets.slice(0, 4);
    }

    const defaults = [
      "Günlük iş akışının belirlenen operasyon standartlarına uygun şekilde yürütülmesine destek olmak.",
      "Takım içi koordinasyonu koruyarak işlerin zamanında ve düzgün şekilde tamamlanmasına katkıda bulunmak.",
      input.shiftType?.trim()
        ? `${input.shiftType.trim()} düzenine uyumlu şekilde görev takibini sürdürmek.`
        : "Belirlenen mesai ve operasyon düzenine uyumlu şekilde görev takibini sürdürmek.",
      "Kalite, iş güvenliği ve süreç disiplinine uygun çalışmak."
    ];

    return defaults;
  }

  private extractBulletCandidates(text?: string) {
    if (!text?.trim()) {
      return [];
    }

    return text
      .split(/\n+/)
      .flatMap((line) => line.split(/[.!?]+/))
      .map((segment) => this.cleanSentence(segment))
      .filter((segment): segment is string => typeof segment === "string" && segment.length >= 18)
      .slice(0, 4);
  }

  private normalizeRequirementFacts(requirements?: JobRequirementInput[]) {
    return (requirements ?? [])
      .map((item) => {
        const key = item.key.trim();
        const value = item.value.trim();

        if (!key && !value) {
          return null;
        }

        return {
          key: key || value,
          value: value || key,
          required: item.required ?? true
        };
      })
      .filter((item): item is { key: string; value: string; required: boolean } => Boolean(item));
  }

  private cleanList(value: unknown, limit: number) {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalized = value
      .map((item) => this.cleanSentence(item))
      .filter((item): item is string => Boolean(item));

    return normalized.slice(0, limit);
  }

  private cleanSentence(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 0 ? normalized : null;
  }

  private cleanParagraph(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");

    return normalized.length > 0 ? normalized : null;
  }
}
