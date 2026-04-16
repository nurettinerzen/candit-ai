import { Body, Controller, Delete, Get, Param, Patch, Post, Inject } from "@nestjs/common";
import { IsEmail, IsIn, IsString, MinLength } from "class-validator";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { MembersService } from "./members.service";

const MEMBER_ROLES = ["manager", "staff"] as const;
const EDITABLE_MEMBER_ROLES = ["owner", "manager", "staff"] as const;
const MEMBER_STATUSES = ["ACTIVE", "DISABLED"] as const;

class InviteMemberBody {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsIn(MEMBER_ROLES)
  role!: (typeof MEMBER_ROLES)[number];
}

class UpdateMemberRoleBody {
  @IsIn(EDITABLE_MEMBER_ROLES)
  role!: (typeof EDITABLE_MEMBER_ROLES)[number];
}

class UpdateMemberStatusBody {
  @IsIn(MEMBER_STATUSES)
  status!: (typeof MEMBER_STATUSES)[number];
}

@Controller("members")
export class MembersController {
  constructor(@Inject(MembersService) private readonly membersService: MembersService) {}

  @Get()
  @Permissions("user.manage")
  list(@CurrentTenant() tenantId: string) {
    return this.membersService.list(tenantId);
  }

  @Post("invitations")
  @Permissions("user.manage")
  invite(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: InviteMemberBody
  ) {
    return this.membersService.inviteMember({
      tenantId,
      actorUserId: user.userId,
      email: body.email,
      fullName: body.fullName,
      role: body.role,
      traceId: requestContext?.traceId
    });
  }

  @Post(":userId/resend-invitation")
  @Permissions("user.manage")
  resendInvitation(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("userId") userId: string
  ) {
    return this.membersService.resendInvitation({
      tenantId,
      actorUserId: user.userId,
      userId,
      traceId: requestContext?.traceId
    });
  }

  @Patch(":userId/role")
  @Permissions("user.manage")
  updateRole(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("userId") userId: string,
    @Body() body: UpdateMemberRoleBody
  ) {
    return this.membersService.updateRole({
      tenantId,
      actorUserId: user.userId,
      userId,
      role: body.role,
      traceId: requestContext?.traceId
    });
  }

  @Delete(":userId")
  @Permissions("user.manage")
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("userId") userId: string
  ) {
    return this.membersService.removeMember({
      tenantId,
      actorUserId: user.userId,
      userId,
      traceId: requestContext?.traceId
    });
  }

  @Patch(":userId/status")
  @Permissions("user.manage")
  updateStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("userId") userId: string,
    @Body() body: UpdateMemberStatusBody
  ) {
    return this.membersService.updateStatus({
      tenantId,
      actorUserId: user.userId,
      userId,
      status: body.status,
      traceId: requestContext?.traceId
    });
  }

  @Post(":userId/transfer-ownership")
  @Permissions("user.manage")
  transferOwnership(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("userId") userId: string
  ) {
    return this.membersService.transferOwnership({
      tenantId,
      actorUserId: user.userId,
      userId,
      traceId: requestContext?.traceId
    });
  }
}
