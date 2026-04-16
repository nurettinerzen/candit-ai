import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  Inject
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { JobsService } from "./jobs.service";
import { ApplicantInboxService } from "./applicant-inbox.service";

const JOB_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type JobStatusValue = (typeof JOB_STATUSES)[number];
const SCREENING_MODES = ["WIDE_POOL", "BALANCED", "STRICT"] as const;
type ScreeningModeValue = (typeof SCREENING_MODES)[number];

class RequirementDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

class CreateJobRequest {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @IsOptional()
  roleFamily?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsIn(JOB_STATUSES)
  @Transform(({ value }) => (value === undefined ? undefined : String(value).toUpperCase()))
  status!: JobStatusValue;

  @IsString()
  @IsOptional()
  workspaceId?: string;

  @IsString()
  @IsOptional()
  locationText?: string;

  @IsString()
  @IsOptional()
  shiftType?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryMin?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryMax?: number;

  @IsString()
  @IsOptional()
  jdText?: string;

  @IsString()
  @IsOptional()
  aiDraftText?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequirementDto)
  @IsOptional()
  requirements?: RequirementDto[];
}

class UpdateJobRequest {
  @IsString()
  @MinLength(3)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  roleFamily?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsIn(JOB_STATUSES)
  @Transform(({ value }) => (value === undefined ? undefined : String(value).toUpperCase()))
  @IsOptional()
  status?: JobStatusValue;

  @IsString()
  @IsOptional()
  locationText?: string;

  @IsString()
  @IsOptional()
  shiftType?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryMin?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryMax?: number;

  @IsString()
  @IsOptional()
  jdText?: string;

  @IsString()
  @IsOptional()
  aiDraftText?: string;

  @IsIn(SCREENING_MODES)
  @Transform(({ value }) => (value === undefined ? undefined : String(value).toUpperCase()))
  @IsOptional()
  screeningMode?: ScreeningModeValue;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequirementDto)
  @IsOptional()
  requirements?: RequirementDto[];
}

class GenerateJobDraftRequest {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @IsOptional()
  roleFamily?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  locationText?: string;

  @IsString()
  @IsOptional()
  shiftType?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryMin?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryMax?: number;

  @IsString()
  @IsOptional()
  jdText?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequirementDto)
  @IsOptional()
  requirements?: RequirementDto[];

  @IsString()
  @IsOptional()
  existingDraft?: string;

  @IsString()
  @IsOptional()
  rewriteInstruction?: string;
}

class BulkImportBody {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportCandidateDto)
  candidates!: BulkImportCandidateDto[];

  @IsString()
  source!: string;

  @IsString()
  @IsOptional()
  externalSource?: string;
}

class BulkCvUploadBody {
  @IsString()
  source!: string;

  @IsString()
  @IsOptional()
  externalSource?: string;

  @IsIn(SCREENING_MODES)
  @Transform(({ value }) => (value === undefined ? undefined : String(value).toUpperCase()))
  @IsOptional()
  screeningMode?: ScreeningModeValue;
}

class BulkDeleteJobsRequest {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  jobIds!: string[];
}

class BulkImportCandidateDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  locationText?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  yearsOfExperience?: number;

  @IsString()
  @IsOptional()
  externalRef?: string;
}

@Controller("jobs")
export class JobsController {
  constructor(
    @Inject(JobsService) private readonly jobsService: JobsService,
    @Inject(ApplicantInboxService) private readonly inboxService: ApplicantInboxService
  ) {}

  private resolveDepartment(input: { department?: string; roleFamily?: string }) {
    const value = (input.department ?? input.roleFamily)?.trim();
    return value && value.length > 0 ? value : undefined;
  }

  @Get()
  @Permissions("job.read")
  list(@CurrentTenant() tenantId: string) {
    return this.jobsService.list(tenantId);
  }

  @Post("bulk-delete")
  @Permissions("job.update")
  bulkDelete(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: BulkDeleteJobsRequest
  ) {
    return this.jobsService.deleteMany({
      tenantId,
      deletedBy: user.userId,
      jobIds: body.jobIds
    });
  }

  @Get(":id")
  @Permissions("job.read")
  getById(@CurrentTenant() tenantId: string, @Param("id") id: string) {
    return this.jobsService.getById(tenantId, id);
  }

  @Post()
  @Permissions("job.create")
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateJobRequest
  ) {
    if (body.salaryMin !== undefined && body.salaryMax !== undefined && body.salaryMin > body.salaryMax) {
      throw new BadRequestException("Minimum maaş maksimum maaştan büyük olamaz.");
    }

    const department = this.resolveDepartment(body);
    if (!department) {
      throw new BadRequestException("Departman zorunludur.");
    }

    return this.jobsService.create({
      tenantId,
      userId: user.userId,
      workspaceId: body.workspaceId,
      title: body.title,
      roleFamily: department,
      locationText: body.locationText,
      shiftType: body.shiftType,
      salaryMin: body.salaryMin,
      salaryMax: body.salaryMax,
      status: body.status,
      jdText: body.jdText,
      aiDraftText: body.aiDraftText,
      requirements: body.requirements
    });
  }

  @Post("draft")
  @Permissions("job.create")
  generateDraft(@CurrentTenant() tenantId: string, @Body() body: GenerateJobDraftRequest) {
    if (body.salaryMin !== undefined && body.salaryMax !== undefined && body.salaryMin > body.salaryMax) {
      throw new BadRequestException("Minimum maaş maksimum maaştan büyük olamaz.");
    }

    return this.jobsService.generateDraft({
      tenantId,
      title: body.title,
      roleFamily: this.resolveDepartment(body),
      locationText: body.locationText,
      shiftType: body.shiftType,
      salaryMin: body.salaryMin,
      salaryMax: body.salaryMax,
      jdText: body.jdText,
      requirements: body.requirements,
      existingDraft: body.existingDraft,
      rewriteInstruction: body.rewriteInstruction
    });
  }

  @Patch(":id")
  @Permissions("job.update")
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: UpdateJobRequest
  ) {
    if (body.salaryMin !== undefined && body.salaryMax !== undefined && body.salaryMin > body.salaryMax) {
      throw new BadRequestException("Minimum maaş maksimum maaştan büyük olamaz.");
    }

    return this.jobsService.update({
      tenantId,
      id,
      updatedBy: user.userId,
      title: body.title,
      roleFamily: this.resolveDepartment(body),
      locationText: body.locationText,
      shiftType: body.shiftType,
      salaryMin: body.salaryMin,
      salaryMax: body.salaryMax,
      status: body.status,
      jdText: body.jdText,
      aiDraftText: body.aiDraftText,
      requirements: body.requirements
    });
  }

  @Get(":id/applicants")
  @Permissions("candidate.read")
  getApplicantInbox(
    @CurrentTenant() tenantId: string,
    @Param("id") jobId: string,
    @Query("stage") stage?: string,
    @Query("source") source?: string,
    @Query("minFitScore") minFitScore?: string,
    @Query("sortBy") sortBy?: string
  ) {
    return this.inboxService.getJobInbox(tenantId, jobId, {
      stage: stage ? (stage.toUpperCase() as any) : undefined,
      source,
      minFitScore: minFitScore ? Number(minFitScore) : undefined,
      sortBy: sortBy as any
    });
  }

  @Post(":id/applicants/bulk-import")
  @Permissions("candidate.create")
  bulkImport(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("id") jobId: string,
    @Body() body: BulkImportBody
  ) {
    return this.inboxService.bulkImport({
      tenantId,
      jobId,
      candidates: body.candidates,
      source: body.source,
      externalSource: body.externalSource,
      createdBy: user.userId
    });
  }

  @Post(":id/applicants/bulk-cv-upload")
  @Permissions("candidate.create")
  @UseInterceptors(FilesInterceptor("files"))
  bulkCvUpload(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param("id") jobId: string,
    @Body() body: BulkCvUploadBody,
    @UploadedFiles()
    files?: Array<{
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }>
  ) {
    if (!files?.length) {
      throw new BadRequestException("En az bir CV dosyası yüklenmelidir.");
    }

    if (!body.source?.trim()) {
      throw new BadRequestException("Kaynak bilgisi zorunludur.");
    }

    return this.inboxService.bulkUploadCvFiles({
      tenantId,
      jobId,
      source: body.source,
      externalSource: body.externalSource,
      screeningMode: body.screeningMode,
      createdBy: user.userId,
      files: files.map((file) => ({
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        content: file.buffer
      }))
    });
  }
}
