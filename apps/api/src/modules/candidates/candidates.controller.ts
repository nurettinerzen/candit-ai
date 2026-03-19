import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
, Inject} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested
} from "class-validator";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { CandidatesService } from "./candidates.service";

class CandidateRecordDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  source?: string;
}

class CandidateImportRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CandidateRecordDto)
  records!: CandidateRecordDto[];
}

class TriggerCvParsingRequest {
  @IsString()
  @IsOptional()
  cvFileId?: string;

  @IsString()
  @IsOptional()
  providerKey?: string;
}

@Controller("candidates")
export class CandidatesController {
  constructor(@Inject(CandidatesService) private readonly candidatesService: CandidatesService) {}

  @Get()
  @Permissions("candidate.read")
  list(@CurrentTenant() tenantId: string, @Query("query") query?: string) {
    return this.candidatesService.list(tenantId, query);
  }

  @Get(":id")
  @Permissions("candidate.read")
  getById(@CurrentTenant() tenantId: string, @Param("id") id: string) {
    return this.candidatesService.getById(tenantId, id);
  }

  @Post()
  @Permissions("candidate.create")
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CandidateRecordDto
  ) {
    return this.candidatesService.create({
      tenantId,
      createdBy: user.userId,
      fullName: body.fullName,
      phone: body.phone,
      email: body.email,
      source: body.source
    });
  }

  @Post("import")
  @Permissions("candidate.create")
  import(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CandidateImportRequest
  ) {
    return this.candidatesService.import({
      tenantId,
      createdBy: user.userId,
      records: body.records
    });
  }

  @Get(":id/cv-files")
  @Permissions("candidate.read")
  listCvFiles(@CurrentTenant() tenantId: string, @Param("id") candidateId: string) {
    return this.candidatesService.listCvFiles(tenantId, candidateId);
  }

  @Get(":id/cv-files/:cvFileId")
  @Permissions("candidate.read")
  getCvFileById(
    @CurrentTenant() tenantId: string,
    @Param("id") candidateId: string,
    @Param("cvFileId") cvFileId: string
  ) {
    return this.candidatesService.getCvFileById(tenantId, candidateId, cvFileId);
  }

  @Post(":id/cv-files")
  @Permissions("candidate.create")
  @UseInterceptors(FileInterceptor("file"))
  uploadCvFile(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() context: RequestContext | undefined,
    @Param("id") candidateId: string,
    @UploadedFile()
    file?: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }
  ) {
    if (!file) {
      throw new BadRequestException("CV dosyasi bulunamadi. `file` alanini gonderin.");
    }

    return this.candidatesService.uploadCvFile({
      tenantId,
      candidateId,
      uploadedBy: user.userId,
      traceId: context?.traceId,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        content: file.buffer
      }
    });
  }

  @Post(":id/cv-parsing/trigger")
  @Permissions("ai.task.request")
  triggerCvParsing(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() context: RequestContext | undefined,
    @Param("id") candidateId: string,
    @Body() body: TriggerCvParsingRequest
  ) {
    return this.candidatesService.triggerCvParsing({
      tenantId,
      candidateId,
      requestedBy: user.userId,
      traceId: context?.traceId,
      cvFileId: body.cvFileId,
      providerKey: body.providerKey
    });
  }

  @Get(":id/cv-parsing/latest")
  @Permissions("candidate.read")
  latestCvParsing(
    @CurrentTenant() tenantId: string,
    @Param("id") candidateId: string,
    @Query("cvFileId") cvFileId?: string
  ) {
    return this.candidatesService.latestCvParsing(tenantId, candidateId, cvFileId);
  }
}
