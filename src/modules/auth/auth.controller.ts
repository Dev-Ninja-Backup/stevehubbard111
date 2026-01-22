import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from 'src/guards/jwt.guard';
import { Public } from 'src/decorators/public.decorator';
import { Auth } from 'src/decorators/auth.decorator';
import { ApiResponses } from 'src/common/api-responses';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { Enable2FADto } from './dto/enable-2fa.dto';
import { CurrentUser } from 'src/decorators/currentuser.decorator';
import { IUser } from 'src/types';
import { RefreshTokenDto } from './dto/refreshtoken.dto';
import { ResendVerificationDto, VerifyEmailDto, VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { PrismaService } from 'src/config/datasource/prisma.service';
import { Request }  from "express" 

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService

  ) {}

  // REGISTER (Public)
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 400, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto) {
    try {
      const result = await this.authService.register(dto);
      return ApiResponses.success(result, 'Registration successful');
    } catch (err: any) {
      return ApiResponses.error(err.message || 'Registration failed', {
        code: err.code || 'REGISTRATION_FAILED',
        statusCode: err.status || 400,
      });
    }
  }
  // 
  
  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    try {
      const res = await this.authService.verifyOtp(dto.email, dto.otp, dto.purpose);
      return ApiResponses.success(
         res,
        'OTP verified successfully'
      );
    } catch (err: any) {
      console.error('OTP verification error:', err);

      return ApiResponses.error(err.message || 'OTP verification failed', {
        code: err.code || 'OTP_INVALID',
        statusCode: err.status || 401,
        details: err.details || null,
        traceId: String(dto.email),
      });
    }
  }

  // LOGIN (Public)
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Two-factor authentication required' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'];
      // 
      const result = await this.authService.login(dto.email, dto.password, ipAddress, userAgent);

      if ('requires2FA' in result && result.requires2FA) {
        return ApiResponses.error('Two-factor authentication required', {
          code: 'TWO_FACTOR_REQUIRED',
          statusCode: 403,
          details: {
            tempToken: result.tempToken,
            message: 'Please provide your 6-digit authentication code',
          },
        });
      }

      return ApiResponses.success(result, 'Login successful');
    } catch (err: any) {
      return ApiResponses.error(err.message || 'Login failed', {
        code: err.code || 'AUTH_FAILED',
        statusCode: err.status || 401,
      });
    }
  }

  // VERIFY 2FA (Public)
  @Public()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Two-Factor Authentication code' })
  @ApiBody({ type: Verify2FADto })
  @ApiResponse({ status: 200, description: '2FA verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA code' })
  async verify2FA(@Body() dto: Verify2FADto) {
    try {
      const tokens = await this.authService.verify2FA(dto.tempToken, dto.code);
      return ApiResponses.success(tokens, 'Two-factor authentication verified');
    } catch (err: any) {
      return ApiResponses.error(err.message || 'Invalid 2FA code', {
        code: err.code || 'TWO_FACTOR_INVALID',
        statusCode: err.status || 401,
      });
    }
  }

  // ENABLE 2FA (Protected)
  @Post('2fa/enable')
  @Auth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable Two-Factor Authentication' })
  @ApiBody({ type: Enable2FADto })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  @ApiResponse({ status: 400, description: 'Failed to enable 2FA' })
  async enable2FA(@CurrentUser() user: IUser, @Body() dto: Enable2FADto) {
    try {
      const result = await this.authService.enable2FA(user.id, dto.password);
      return ApiResponses.success(result, '2FA enabled successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message || 'Failed to enable 2FA', {
        code: err.code || 'TWO_FACTOR_ENABLE_FAILED',
        statusCode: err.status || 400,
        traceId: String(user.id),
      });
    }
  }

  // DISABLE 2FA (Protected)
  @Post('2fa/disable')
  @Auth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable Two-Factor Authentication' })
  @ApiBody({ type: Verify2FADto })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @ApiResponse({ status: 400, description: 'Failed to disable 2FA' })
  async disable2FA(@CurrentUser() user: IUser, @Body() dto: Verify2FADto) {
    try {
      await this.authService.disable2FA(user.id, dto.code);
      return ApiResponses.success(null, '2FA disabled successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message || 'Failed to disable 2FA', {
        code: err.code || 'TWO_FACTOR_DISABLE_FAILED',
        statusCode: err.status || 400,
        traceId: String(user.id),
      });
    }
  }

  // GET CURRENT USER (Protected)
  @Get('me')
  @Auth()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get currently authenticated user' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getMe(@CurrentUser() user: IUser) {
    try {
      const userData = await this.authService.getUserById(user.id);
      return ApiResponses.success(userData, 'User retrieved successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message || 'Failed to get user', {
        code: err.code || 'USER_FETCH_FAILED',
        statusCode: err.status || 404,
        traceId: String(user.id),
      });
    }
  }
  //  
   // -------------------------
  // EMAIL VERIFICATION
  // -------------------------

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email address using verification token' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    try {
      const result = await this.authService.verifyEmail(dto.token);
      return ApiResponses.success(result, 'Email verified successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'EMAIL_VERIFICATION_FAILED',
        statusCode: 400,
      });
    }
  }

  @Public()
  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (user) {
        await this.authService.sendVerificationEmail(user.id);
      }
      return ApiResponses.success(null, 'Verification email sent');
    } catch {
      // Prevent email enumeration
      return ApiResponses.success(null, 'Verification email sent');
    }
  }

  // -------------------------
  // PASSWORD RESET
  // -------------------------

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiBody({ type: RequestPasswordResetDto })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  async forgotPassword(@Body() dto: RequestPasswordResetDto) {
    try {
      const result = await this.authService.requestPasswordReset(dto.email);
      return ApiResponses.success(result, 'Password reset email sent');
    } catch {
      // Prevent email enumeration
      return ApiResponses.success(
        { message: 'If the email exists, a reset link has been sent' },
        'Password reset email sent',
      );
    }
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      const result = await this.authService.resetPassword(
        dto.token,
        dto.newPassword,
      );
      return ApiResponses.success(result, 'Password reset successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'PASSWORD_RESET_FAILED',
        statusCode: 400,
      });
    }
  }

  
  // -------------------------
  // SESSION MANAGEMENT
  // -------------------------

  @Get('sessions')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active sessions for current user' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  async getMySessions(@CurrentUser() user: IUser) {
    try {
      const sessions = await this.authService.getUserSessions(user.id);
      return ApiResponses.success(sessions, 'Sessions retrieved');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'FETCH_SESSIONS_FAILED',
        statusCode: 500,
      });
    }
  }

  @Post('logout')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from current device' })
  @ApiBody({
    schema: {
      properties: {
        refreshToken: { type: 'string', example: 'refresh_token_here' },
      },
    },
  })
  async logout(
    @CurrentUser() user: IUser,
    @Body('refreshToken') refreshToken: string,
  ) {
    try {
      const result = await this.authService.logout(user.id, refreshToken);
      return ApiResponses.success(result, 'Logged out successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'LOGOUT_FAILED',
        statusCode: 400,
      });
    }
  }

  @Post('logout-all')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(@CurrentUser() user: IUser) {
    try {
      const result = await this.authService.logoutAllDevices(user.id);
      return ApiResponses.success(result, 'Logged out from all devices');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'LOGOUT_ALL_FAILED',
        statusCode: 400,
      });
    }
  }
  // 
  @Post('logout-others')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from other devices except current' })
  @ApiBody({
    schema: {
      properties: {
        refreshToken: { type: 'string', example: 'current_refresh_token' },
      },
    },
  })
  async logoutOthers(
    @CurrentUser() user: IUser,
    @Body('refreshToken') refreshToken: string,
  ) {
    try {
      const result = await this.authService.logoutOtherDevices(
        user.id,
        refreshToken,
      );
      return ApiResponses.success(result, 'Logged out from other devices');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'LOGOUT_OTHERS_FAILED',
        statusCode: 400,
      });
    }
  }

  @Delete('sessions/:sessionId')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a specific session' })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID to revoke',
    example: 'ckxyz123abc',
  })
  async deleteSession(
    @CurrentUser() user: IUser,
    @Param('sessionId') sessionId: string,
  ) {
    try {
      const result = await this.authService.deleteSession(user.id, sessionId);
      return ApiResponses.success(result, 'Session deleted');
    } catch (err: any) {
      return ApiResponses.error(err.message, {
        code: 'DELETE_SESSION_FAILED',
        statusCode: 400,
      });
    }
  }
  // REFRESH TOKEN (Public)
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT tokens' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto:RefreshTokenDto) {
    try {
      const tokens = await this.authService.refreshTokens(dto.refreshToken);
      return ApiResponses.success(tokens, 'Tokens refreshed successfully');
    } catch (err: any) {
      return ApiResponses.error(err.message || 'Failed to refresh token', {
        code: err.code || 'REFRESH_FAILED',
        statusCode: err.status || 401,
      });
    }
  }
}
