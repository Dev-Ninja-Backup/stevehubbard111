import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/config/datasource/prisma.service';
import { hashPassword, verifyPassword } from 'src/utils/password.util';
import { generateTOTPSecret, verifyTOTP, getTOTPAuthUrl } from 'src/utils/totp.util';
import { RegisterDto } from './dto/register.dto';
import { Roles, UserStatus } from 'prisma/generated/prisma/enums';
import * as speakeasy from 'speakeasy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // REGISTER
  async register(dto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }
    // security settings 
    const s = await this.prisma.securitySetting.findFirst({})
    if(!s){
        throw new NotFoundException("Security Settings not found")
    }
    // roles
    const r = await this.prisma.role.findFirst({
       where:{
          name:Roles.USER
       }
    })
    if(!r){
        throw new NotFoundException("Role not found")
    }
    // Hash password
    const passwordHash = await hashPassword(dto.password);
      console.log(dto, passwordHash);
    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerified: false,
        role: {
          connect: { id: r.id },
        },
        securitySetting:{
            connect:{
               id : s.id,
               twoFactorAuth:s.twoFactorAuth
            }
        } 
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        securitySetting:true
      },
    });
    console.log(user);
    // Issue tokens
    const tokens = this.issueTokens(user.id);
  
    return {
      user,
      ...tokens,
    };
  }


  // LOGIN
 async login(email: string, password: string) {
  // Find user
  const user = await this.prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      status: true,
      twoFactorSecret: true,
      securitySetting: {
        select: {
          twoFactorAuth: true,
          id: true,
        },
      },
    },
  });

  // Verify credentials
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // Check account status
  if (user.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedException('Account is not active');
  }

  // Update last login
  await this.prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Handle 2FA setup if enabled but secret missing
  let twoFactorSecret = user.twoFactorSecret;
  let otpauthUrl: string | null = null;

  if (user.securitySetting.twoFactorAuth && !twoFactorSecret) {
    twoFactorSecret = generateTOTPSecret();
    otpauthUrl = getTOTPAuthUrl(twoFactorSecret, user.email, 'Rabbt');

    // Save new secret in DB
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret,
        securitySetting: {
          update: { twoFactorAuth: true }, // ensure 2FA flag stays true
        },
      },
    });
  }

  // If 2FA is enabled, return temp token
  if (user.securitySetting.twoFactorAuth) {
    const tempToken = this.jwt.sign(
      { sub: user.id, type: '2fa' },
      { expiresIn: '5m' },
    );

    return {
      requires2FA: true,
      tempToken,
      secret: twoFactorSecret,
      otpauthUrl,
    };
  }

  // No 2FA, issue regular tokens
  return this.issueTokens(user.id);
  }


  // VERIFY 2FA
  async verify2FA(tempToken: string, code: string) {
    let payload: any;

    try {
      payload = this.jwt.verify(tempToken);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Verify token type
    if (payload.type !== '2fa') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        twoFactorSecret: true,
        securitySetting:{
            select:{
               twoFactorAuth:true
            }
        }
      },
    });

    if (!user || !user.twoFactorSecret || !user.securitySetting.twoFactorAuth) {
      throw new UnauthorizedException('2FA not configured');
    }

    // Verify TOTP code
    const isValid = verifyTOTP(user.twoFactorSecret, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Issue regular tokens
    return this.issueTokens(user.id);
  }

  // ENABLE 2FA
  async enable2FA(userId: number, password: string) {
    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        twoFactorSecret:true,
        securitySetting:{
            select:{
               twoFactorAuth:true,
               id:true,
            }
        }
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify password
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid password');
    }

    // Check if already enabled
    if (user.securitySetting.twoFactorAuth && user.twoFactorSecret) {
      throw new BadRequestException('2FA is already enabled');
    }

    // Generate TOTP secret
    const secret = generateTOTPSecret();

    const otpauthUrl = getTOTPAuthUrl(secret, user.email, 'Rabbt');

    // Save secret to database
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        securitySetting: {
        connect: { id: user.securitySetting.id }, 
          update: {
            twoFactorAuth: true,
          },
        },
      },
    });
    //  
    return {
      secret,
      otpauthUrl, // Use this to generate QR code on frontend
      message: 'Scan this QR code with your authenticator app',
    };
  }

  // DISABLE 2FA
  async disable2FA(userId: number, code: string) {
    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        twoFactorSecret: true,
        securitySetting:{
            select:{
               twoFactorAuth:true
            }
        }
      },
    });

    if (!user || !user.securitySetting.twoFactorAuth) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Verify TOTP code
    const isValid = verifyTOTP(user.twoFactorSecret!, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Disable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        securitySetting: {
          update: {
            twoFactorAuth: false,
          },
        },
      },
    });
    // 
    return { message: '2FA disabled successfully' };
  }

  // GET USER BY ID
  async getUserById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        emailVerified: true,
        twoFactorSecret:true,
        securitySetting:{
            select:{
                twoFactorAuth:true
            }
        },
        lastLogin: true,
        createdAt: true,
        // subscriptions: {
        //   where: { status: 'ACTIVE' },
        //   include: {
        //     plan: true,
        //   },
        //   take: 1,
        // },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  // REFRESH TOKENS
  async refreshTokens(refreshToken: string) {
    let payload: any;

    try {
      payload = this.jwt.verify(refreshToken);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Verify user exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Issue new tokens
    return this.issueTokens(user.id);
  }

  // ISSUE TOKENS (Private helper) TODO:need to seed on cookies
  private issueTokens(userId: number) {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
      }
    // const payload = { sub: userId };

    // 
    const accessToken = this.jwt.sign(
      { sub: userId },
      { expiresIn: '15m' }, // Short-lived access token
    );

    const refreshToken = this.jwt.sign(
      { sub: userId },
      { expiresIn: '7d' }, // Long-lived refresh token
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }
}
