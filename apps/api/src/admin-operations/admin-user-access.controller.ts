import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import {
  AdminOperationsPermissionGuard,
  RequireAdminOperationsPermission,
} from './admin-operations-permission.guard';
import {
  adminEmailVerificationSchema,
  adminRoleAssignmentSchema,
  adminRoleIdSchema,
  adminSessionRevocationSchema,
  adminUserDeletionSchema,
  adminUserIdSchema,
  adminUserListQuerySchema,
  adminUserStatusSchema,
  type AdminEmailVerificationInput,
  type AdminRoleAssignmentInput,
  type AdminSessionRevocationInput,
  type AdminUserDeletionInput,
  type AdminUserListQuery,
  type AdminUserStatusInput,
} from './admin-user-access.dto';
import { AdminUserAccessService } from './admin-user-access.service';

@Controller('admin')
@UseGuards(AdminOperationsPermissionGuard)
export class AdminUserAccessController {
  public constructor(private readonly users: AdminUserAccessService) {}

  @Get('users')
  @RequireAdminOperationsPermission('users.read')
  public listUsers(
    @Query(new ZodBodyPipe(adminUserListQuerySchema))
    query: AdminUserListQuery,
  ) {
    return this.users.listUsers(query);
  }

  @Get('users/:userId')
  @RequireAdminOperationsPermission('users.read')
  public getUser(
    @Param('userId', new ZodBodyPipe(adminUserIdSchema))
    userId: string,
  ) {
    return this.users.getUser(userId);
  }

  @Patch('users/:userId/status')
  @RequireAdminOperationsPermission('users.manage_status')
  public changeStatus(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('userId', new ZodBodyPipe(adminUserIdSchema))
    userId: string,
    @Body(new ZodBodyPipe(adminUserStatusSchema))
    body: AdminUserStatusInput,
  ) {
    return this.users.changeStatus(actor.userId, userId, body);
  }

  @Post('users/:userId/email/verify')
  @RequireAdminOperationsPermission('users.verify_email')
  public verifyEmail(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('userId', new ZodBodyPipe(adminUserIdSchema))
    userId: string,
    @Body(new ZodBodyPipe(adminEmailVerificationSchema))
    body: AdminEmailVerificationInput,
  ) {
    return this.users.verifyEmail(actor.userId, userId, body);
  }

  @Delete('users/:userId')
  @RequireAdminOperationsPermission('users.manage_deletion')
  public deleteUser(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('userId', new ZodBodyPipe(adminUserIdSchema))
    userId: string,
    @Body(new ZodBodyPipe(adminUserDeletionSchema))
    body: AdminUserDeletionInput,
  ) {
    return this.users.deleteUser(actor.userId, userId, body);
  }

  @Post('users/:userId/restore')
  @RequireAdminOperationsPermission('users.manage_deletion')
  public restoreUser(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('userId', new ZodBodyPipe(adminUserIdSchema))
    userId: string,
    @Body(new ZodBodyPipe(adminUserDeletionSchema))
    body: AdminUserDeletionInput,
  ) {
    return this.users.restoreUser(actor.userId, userId, body);
  }

  @Post('users/:userId/sessions/revoke')
  @RequireAdminOperationsPermission('users.manage_sessions')
  public revokeSessions(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('userId', new ZodBodyPipe(adminUserIdSchema))
    userId: string,
    @Body(new ZodBodyPipe(adminSessionRevocationSchema))
    body: AdminSessionRevocationInput,
  ) {
    return this.users.revokeSessions(actor.userId, userId, body);
  }

  @Get('roles')
  @RequireAdminOperationsPermission('roles.read')
  public listRoles() {
    return this.users.listRoles();
  }

  @Post('users/:userId/roles')
  @RequireAdminOperationsPermission('roles.assign')
  public assignRole(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('userId', new ZodBodyPipe(adminUserIdSchema))
    userId: string,
    @Body(new ZodBodyPipe(adminRoleAssignmentSchema))
    body: AdminRoleAssignmentInput,
  ) {
    return this.users.assignRole(actor.userId, userId, body);
  }

  @Delete('users/:userId/roles/:roleId')
  @RequireAdminOperationsPermission('roles.assign')
  public removeRole(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('userId', new ZodBodyPipe(adminUserIdSchema))
    userId: string,
    @Param('roleId', new ZodBodyPipe(adminRoleIdSchema))
    roleId: string,
  ) {
    return this.users.removeRole(actor.userId, userId, roleId);
  }
}
