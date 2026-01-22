import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { ApiResponses } from 'src/common/api-responses';
import { AdminService } from './users.service';

@ApiTags('Admin Users')
@Controller('admin/users')
// @UseGuards(Auth())
@Roles('ADMIN', 'SUPER_ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Get all users with pagination
  @Get()
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Failed to fetch users' })
  async getAllUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    try {
      const result = await this.adminService.getAllUsers(
        Number(page),
        Number(limit),
        search,
        status,
      );
      return ApiResponses.success(result, 'Users retrieved successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'FETCH_USERS_FAILED',
        statusCode: 500,
      });
    }
  }

  // Get user by ID
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string) {
    try {
      const user = await this.adminService.getUserById(Number(id));
      return ApiResponses.success(user, 'User retrieved successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    }
  }

  // Suspend user
  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspend user' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User suspended successfully' })
  @ApiResponse({ status: 400, description: 'Failed to suspend user' })
  async suspendUser(@Param('id') id: string) {
    try {
      const user = await this.adminService.suspendUser(Number(id));
      return ApiResponses.success(user, 'User suspended successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'SUSPEND_FAILED',
        statusCode: 400,
      });
    }
  }

  // Activate user
  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate user' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 400, description: 'Failed to activate user' })
  async activateUser(@Param('id') id: string) {
    try {
      const user = await this.adminService.activateUser(Number(id));
      return ApiResponses.success(user, 'User activated successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'ACTIVATE_FAILED',
        statusCode: 400,
      });
    }
  }

  // Delete user
  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 400, description: 'Failed to delete user' })
  async deleteUser(@Param('id') id: string) {
    try {
      await this.adminService.deleteUser(Number(id));
      return ApiResponses.success(null, 'User deleted successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'DELETE_FAILED',
        statusCode: 400,
      });
    }
  }

  // Get user sessions
  @Get(':id/sessions')
  @ApiOperation({ summary: 'Get user sessions' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Failed to fetch sessions' })
  async getUserSessions(@Param('id') id: string) {
    try {
      const sessions = await this.adminService.getUserSessions(Number(id));
      return ApiResponses.success(sessions, 'Sessions retrieved successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'FETCH_SESSIONS_FAILED',
        statusCode: 500,
      });
    }
  }

  // Revoke user session
  @Delete(':id/sessions/:sessionId')
  @ApiOperation({ summary: 'Revoke user session' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiParam({ name: 'sessionId', type: String, description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ApiResponse({ status: 400, description: 'Failed to revoke session' })
  async revokeSession(
    @Param('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    try {
      await this.adminService.revokeSession(Number(userId), sessionId);
      return ApiResponses.success(null, 'Session revoked successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'REVOKE_SESSION_FAILED',
        statusCode: 400,
      });
    }
  }

  // Get login attempts
  @Get(':id/login-attempts')
  @ApiOperation({ summary: 'Get user login attempts' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Login attempts retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Failed to fetch login attempts' })
  async getLoginAttempts(@Param('id') id: string) {
    try {
      const attempts = await this.adminService.getLoginAttempts(Number(id));
      return ApiResponses.success(attempts, 'Login attempts retrieved');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'FETCH_ATTEMPTS_FAILED',
        statusCode: 500,
      });
    }
  }

  // Reset user password (admin action)
  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset user password (Admin)' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiBody({ schema: { type: 'object', properties: { newPassword: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Failed to reset password' })
  async adminResetPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
  ) {
    try {
      await this.adminService.adminResetPassword(Number(id), newPassword);
      return ApiResponses.success(null, 'Password reset successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'RESET_PASSWORD_FAILED',
        statusCode: 400,
      });
    }
  }
}
