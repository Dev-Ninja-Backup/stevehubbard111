import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
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
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async login(@Body() dto: LoginDto) {
    try {
      const result = await this.authService.login(dto.email, dto.password);

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
