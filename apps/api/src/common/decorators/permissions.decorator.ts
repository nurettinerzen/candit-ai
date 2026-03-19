import type { Permission } from "@ai-interviewer/domain";
import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSIONS = "requiredPermissions";

export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
