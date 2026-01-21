import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/config/datasource/prisma.service';
import { hashPassword, verifyPassword } from 'src/utils/password.util';
import { generateTOTPSecret, verifyTOTP, getTOTPAuthUrl } from 'src/utils/totp.util';
import { RegisterDto } from './dto/register.dto';
import { Roles, UserStatus } from 'prisma/generated/prisma/enums';
import { OtpUtil } from 'src/utils/otp.util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private readonly otpUtil: OtpUtil,
  ) {}

  // REGISTER
  async register(dto: RegisterDto) {
      return this.prisma.$transaction(async (tx) => {
        // Check if user already exists
        const existingUser = await tx.user.findUnique({
          where: { email: dto.email },
        });

        if (existingUser) {
          throw new ConflictException('Email already registered');
        }

        // Fetch security settings (required relation)
        const securitySetting = await tx.securitySetting.findFirst();

        if (!securitySetting) {
          throw new NotFoundException('Security settings not found');
        }

        // Fetch USER role
        const role = await tx.role.findFirst({
          where: { name: Roles.USER },
        });

        if (!role) {
          throw new NotFoundException('User role not found');
        }

        // Hash password
        const passwordHash = await hashPassword(dto.password);

        // Create user
        const user = await tx.user.create({
          data: {
            email: dto.email,
            name: dto.name,
            passwordHash,
            status: UserStatus.ACTIVE,
            emailVerified: false,

            role: {
              connect: { id: role.id },
            },

            securitySetting: {
              connect: { id: securitySetting.id },
            },
          },
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
            createdAt: true,
          },
        });

        // Generate OTP (outside DB, but tied to user)
        const otp = await this.otpUtil.generate(user.id, 'register');

        // Return result
        return {
          user,
          otp, // send via email/SMS later
        };
      });
    }

 //  verify otp
 async verifyOtp(email:string , otp:string, purpose:string){
    const user = await this.singleUser(email);
    const isValid = await this.otpUtil.verify(user.id, purpose, otp);
    if(!isValid){
        throw new BadRequestException("Otp is not valid")
    }
    await this.prisma.user.update({
        where:{
           id:user.id
        },
        data:{
          emailVerified :true,
          emailVerifiedAt: new Date()
        }
    })
    // Issue tokens
    const tokens = await this.issueTokens(user.id);
    // 
    return {
        massage:"Your email verified successfully",
        tokens
    }
 }


  // LOGIN
 async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
     
    // Check rate limiting
    await this.checkLoginAttempts(email, ipAddress!);

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
          select: { twoFactorAuth: true },
        },
      },
    });

      // Verify credentials
      const isValidPassword = user && (await verifyPassword(password, user.passwordHash));

      // Record attempt
      await this.recordLoginAttempt(email, ipAddress!, isValidPassword!, userAgent);

      if (!isValidPassword) {
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
      return this.issueTokens(user.id, ipAddress, userAgent);
  }


  // VERIFY 2FA
  async verify2FA(tempToken: string, code: string, ipAddress?: string, userAgent?: string) {
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
    return  this.issueTokens(user.id, ipAddress, userAgent);
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

  // // REFRESH TOKENS
  // async refreshTokens(refreshToken: string) {
  //   let payload: any;

  //   try {
  //     payload = this.jwt.verify(refreshToken);
  //   } catch (err) {
  //     throw new UnauthorizedException('Invalid or expired refresh token');
  //   }

  //   // Verify user exists and is active
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: payload.sub },
  //     select: { id: true, status: true },
  //   });

  //   if (!user || user.status !== UserStatus.ACTIVE) {
  //     throw new UnauthorizedException('User not found or inactive');
  //   }

  //   // Issue new tokens
  //   return this.issueTokens(user.id);
  // }
  // 
  async getUserSessions(userId: number) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gte: new Date() }, // Only active sessions
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions;
  }
   
  // logout
  async logout(userId: number, refreshToken: string) {
    // Delete specific session
    const deleted = await this.prisma.session.deleteMany({
      where: {
        userId,
        token: refreshToken,
      },
    });

    if (deleted.count === 0) {
      throw new UnauthorizedException('Invalid session');
    }

    return { message: 'Logged out successfully' };
  }
   
  // logout from all devices
  async logoutAllDevices(userId: number) {
    // Delete all sessions for user
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    return { message: 'Logged out from all devices' };
  }
 
  // logout all sessions except current
  async logoutOtherDevices(userId: number, currentRefreshToken: string) {
    // Delete all sessions except current
    await this.prisma.session.deleteMany({
      where: {
        userId,
        token: { not: currentRefreshToken },
      },
    });

    return { message: 'Logged out from other devices' };
  }
  
  // delete session
  async deleteSession(userId: number, sessionId: string) {
    const deleted = await this.prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId, // Security: ensure user owns the session
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Session not found');
    }

    return { message: 'Session deleted successfully' };
  }


  // refreshTokens to validate session
  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string) {
    let payload: any;

    try {
      payload = this.jwt.verify(refreshToken);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Verify session exists and is valid
    const session = await this.prisma.session.findUnique({
      where: { token: refreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    // Verify user exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Delete old session
    await this.prisma.session.delete({
      where: { token: refreshToken },
    });

    // Issue new tokens with new session
    return this.issueTokens(user.id, ipAddress, userAgent);
  }



    // 4. RATE LIMITING FOR LOGIN ATTEMPTS
    async checkLoginAttempts(email: string, ipAddress: string) {
      // 
      const securitySettings = await this.prisma.securitySetting.findFirst();
      const maxAttempts = securitySettings?.maxLoginAttempts || 5;
      const lockoutDuration = securitySettings?.accountLockoutDuration || 30; // minutes

      // Check login attempts in last 15 minutes
      const fifteenMinutesAgo = new Date();
      fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

      const recentAttempts = await this.prisma.loginAttempt.count({
        where: {
          email,
          ipAddress,
          createdAt: { gte: fifteenMinutesAgo },
          success: false,
        },
      });

      if (recentAttempts >= maxAttempts) {
        throw new UnauthorizedException(
          `Too many failed login attempts. Please try again in ${lockoutDuration} minutes.`
        );
      }
    }
    
    // 
    async recordLoginAttempt(email: string, ipAddress: string, success: boolean, userAgent?: string) {
      await this.prisma.loginAttempt.create({
        data: {
          email,
          ipAddress,
          userAgent,
          success,
        },
      });
    }



  // ISSUE TOKENS (Private helper) TODO:need to seed on cookies
  private async issueTokens(userId: number, ipAddress?: string, userAgent?: string) {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
      }
    // const payload = { sub: userId };

    // 
    const accessToken = await this.jwt.sign(
      { sub: userId },
      { expiresIn: '15m' }, // Short-lived access token
    );

    const refreshToken = await this.jwt.sign(
      { sub: userId },
      { expiresIn: '7d' }, // Long-lived refresh token
    );
  
    
    // Create session record
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        await this.prisma.session.create({
          data: {
            userId,
            token: refreshToken,
            ipAddress,
            userAgent,
            expiresAt,
          },
        });

        return {
          accessToken,
          refreshToken,
          expiresIn: 900, // in sec
        };
  }
   
  // find single user
  private async singleUser(email?:string, userId?:number){
         if(!email && !userId){
            throw new NotFoundException("Email or user id required")
         }
        //  
        const user = await this.prisma.user.findFirst({
            where:{
                OR:[
                    {email},
                    {id:userId}
                ]
            }
        })
        if(!user){
            throw new NotFoundException("User Not found")
        }
       return user;

  } 



}
