import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query
} from "@nestjs/common";
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
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
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

@Controller("candidates")
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

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
}
