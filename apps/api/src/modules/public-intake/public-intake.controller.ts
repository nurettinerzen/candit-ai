import {
  Body,
  Controller,
  Inject,
  Post,
  Req
} from "@nestjs/common";
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import type { Request } from "express";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestWithContext } from "../../common/interfaces/request-with-context.interface";
import { PublicIntakeService } from "./public-intake.service";

class SubmitContactBody {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourcePage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  landingUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrerUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmTerm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;
}

@Controller("public/contact")
@Public()
export class PublicIntakeController {
  constructor(@Inject(PublicIntakeService) private readonly publicIntakeService: PublicIntakeService) {}

  @Post()
  submitContact(@Body() body: SubmitContactBody, @Req() request: Request) {
    const requestWithContext = request as RequestWithContext;

    return this.publicIntakeService.submitContact({
      fullName: body.fullName,
      email: body.email,
      company: body.company,
      role: body.role,
      phone: body.phone,
      message: body.message,
      sourcePage: body.sourcePage,
      landingUrl: body.landingUrl,
      referrerUrl: body.referrerUrl,
      locale: body.locale,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
      utmTerm: body.utmTerm,
      utmContent: body.utmContent,
      website: body.website,
      ipAddress: request.ip,
      userAgent: request.header("user-agent") ?? undefined,
      traceId: requestWithContext.requestContext?.traceId
    });
  }
}
