import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post
} from "@nestjs/common";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength
} from "class-validator";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { SourcingService } from "./sourcing.service";

const PROSPECT_STAGES = [
  "NEW",
  "NEEDS_REVIEW",
  "GOOD_FIT",
  "SAVED",
  "CONTACTED",
  "REPLIED",
  "CONVERTED",
  "REJECTED",
  "ARCHIVED"
] as const;

const SUPPRESSION_STATUSES = [
  "ALLOWED",
  "DO_NOT_CONTACT",
  "OPTED_OUT",
  "NEEDS_REVIEW"
] as const;

const RECRUITER_IMPORT_SOURCE_TYPES = [
  "recruiter_import",
  "public_profile_url",
  "agency_upload",
  "referral",
  "job_board_export"
] as const;

class CreateSourcingProjectBody {
  @IsString()
  @MinLength(2)
  jobId!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  personaSummary?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

class UpdateProspectStageBody {
  @IsIn(PROSPECT_STAGES)
  stage!: (typeof PROSPECT_STAGES)[number];

  @IsString()
  @IsOptional()
  recruiterNote?: string;
}

class OutreachSendBody {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  prospectIds!: string[];

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  reviewNote?: string;

  @IsBoolean()
  @IsOptional()
  sendNow?: boolean;
}

class UpdateSuppressionBody {
  @IsIn(SUPPRESSION_STATUSES)
  status!: (typeof SUPPRESSION_STATUSES)[number];

  @IsString()
  @IsOptional()
  reason?: string;
}

class DiscoverExternalProspectsBody {
  @IsString()
  @IsOptional()
  roleTitle?: string;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsString()
  @IsOptional()
  locationText?: string;

  @IsNumber()
  @IsOptional()
  minYearsExperience?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skillTags?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  companyBackground?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @IsString()
  @IsOptional()
  workModel?: string;

  @IsNumber()
  @IsOptional()
  compensationMin?: number;

  @IsNumber()
  @IsOptional()
  compensationMax?: number;

  @IsString()
  @IsOptional()
  idealCandidateNotes?: string;
}

class ImportRecruiterLeadsBody {
  @IsIn(RECRUITER_IMPORT_SOURCE_TYPES)
  sourceType!: (typeof RECRUITER_IMPORT_SOURCE_TYPES)[number];

  @IsString()
  @IsOptional()
  sourceLabel?: string;

  @IsArray()
  leads!: Array<Record<string, unknown>>;
}

class ImportProfileUrlsBody {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  urls!: string[];

  @IsString()
  @IsOptional()
  note?: string;
}

@Controller("sourcing")
export class SourcingController {
  constructor(
    @Inject(SourcingService) private readonly sourcingService: SourcingService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService
  ) {}

  private assertInternalSourcingAccess(user: RequestUser) {
    if (this.runtimeConfig.isInternalBillingAdmin(user.email)) {
      return;
    }

    throw new ForbiddenException(
      "Kaynak bulma modülü şu anda beta erişiminde. Yalnızca iç yönetim ekibi kullanabilir."
    );
  }

  @Get("overview")
  @Permissions("job.read")
  overview(@CurrentTenant() tenantId: string, @CurrentUser() user: RequestUser) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.getOverview(tenantId);
  }

  @Post("projects")
  @Permissions("job.update")
  createProject(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateSourcingProjectBody
  ) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.createProject({
      tenantId,
      createdBy: user.userId,
      jobId: body.jobId,
      name: body.name,
      personaSummary: body.personaSummary,
      notes: body.notes
    });
  }

  @Get("projects/:id")
  @Permissions("job.read")
  getProjectDetail(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string
  ) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.getProjectDetail(tenantId, id);
  }

  @Post("projects/:id/refresh")
  @Permissions("job.update")
  refreshProject(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string
  ) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.refreshProject(tenantId, id);
  }

  @Post("projects/:id/discover")
  @Permissions("job.update")
  discoverExternalProspects(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: DiscoverExternalProspectsBody
  ) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.discoverExternalProspects({
      tenantId,
      projectId: id,
      requestedBy: user.userId,
      criteria: {
        roleTitle: body.roleTitle,
        keyword: body.keyword,
        locationText: body.locationText,
        minYearsExperience: body.minYearsExperience,
        skillTags: body.skillTags,
        companyBackground: body.companyBackground,
        languages: body.languages,
        workModel: body.workModel,
        compensationMin: body.compensationMin,
        compensationMax: body.compensationMax,
        idealCandidateNotes: body.idealCandidateNotes
      }
    });
  }

  @Post("projects/:id/import/leads")
  @Permissions("candidate.create")
  importRecruiterLeads(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: ImportRecruiterLeadsBody
  ) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.importRecruiterLeads({
      tenantId,
      projectId: id,
      requestedBy: user.userId,
      sourceType: body.sourceType,
      sourceLabel: body.sourceLabel,
      leads: (Array.isArray(body.leads) ? body.leads : []) as any
    });
  }

  @Post("projects/:id/import/urls")
  @Permissions("candidate.create")
  importProfileUrls(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: ImportProfileUrlsBody
  ) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.importPublicProfileUrls({
      tenantId,
      projectId: id,
      requestedBy: user.userId,
      urls: body.urls,
      note: body.note
    });
  }

  @Post("projects/:projectId/prospects/:prospectId/stage")
  @Permissions("candidate.move_stage")
  updateProspectStage(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("prospectId") prospectId: string,
    @Body() body: UpdateProspectStageBody
  ) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.updateProspectStage({
      tenantId,
      projectId,
      prospectId,
      stage: body.stage,
      recruiterNote: body.recruiterNote
    });
  }

  @Post("projects/:projectId/prospects/:prospectId/attach")
  @Permissions("candidate.create")
  attachProspect(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("projectId") projectId: string,
    @Param("prospectId") prospectId: string
  ) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.attachProspectToHiringFlow({
      tenantId,
      projectId,
      prospectId,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("projects/:projectId/outreach/send")
  @Permissions("candidate.move_stage")
  sendOutreach(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Body() body: OutreachSendBody
  ) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.sendOutreach({
      tenantId,
      projectId,
      requestedBy: user.userId,
      prospectIds: body.prospectIds,
      templateId: body.templateId,
      subject: body.subject,
      body: body.body,
      reviewNote: body.reviewNote,
      sendNow: body.sendNow
    });
  }

  @Get("outreach/templates")
  @Permissions("job.read")
  listTemplates(@CurrentTenant() tenantId: string, @CurrentUser() user: RequestUser) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.listOutreachTemplates(tenantId, user.userId);
  }

  @Post("profiles/:profileId/suppression")
  @Permissions("candidate.move_stage")
  updateSuppression(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("profileId") profileId: string,
    @Body() body: UpdateSuppressionBody
  ) {
    this.assertInternalSourcingAccess(user);
    return this.sourcingService.updateSuppression({
      tenantId,
      profileId,
      status: body.status,
      reason: body.reason
    });
  }
}
