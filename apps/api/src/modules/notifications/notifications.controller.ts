import { Body, Controller, Post , Inject} from "@nestjs/common";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { NotificationsService } from "./notifications.service";

class SendNotificationBody {
  @IsIn(["email", "sms", "in_app"])
  channel!: "email" | "sms" | "in_app";

  @IsString()
  to!: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  body!: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notificationsService: NotificationsService) {}

  @Post("send")
  @Permissions("notification.send")
  send(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: SendNotificationBody
  ) {
    return this.notificationsService.send({
      tenantId,
      channel: body.channel,
      to: body.to,
      subject: body.subject,
      body: body.body,
      metadata: body.metadata,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }
}
