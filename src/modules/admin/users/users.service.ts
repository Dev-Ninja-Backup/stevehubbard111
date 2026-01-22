import { Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from 'prisma/generated/prisma/enums';
import { PrismaService } from 'src/config/datasource/prisma.service';
import { hashPassword } from 'src/utils/password.util';



@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}
  
  // get all users
  async getAllUsers(page: number, limit: number, search?: string, status?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          emailVerified: true,
          lastLogin: true,
          createdAt: true,
          role: {
            select: { name: true },
          },
          _count: {
            select: {
              // sandboxes: true,
              sessions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  
  // get single data
  async getUserById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        securitySetting: true,
        _count: {
          select: {
            // sandboxes: true,
            sessions: true,
            // observations: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
  
  // suspend user
  async suspendUser(userId: number) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });

    // Revoke all sessions
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    return user;
  }
  
  // active user
  async activateUser(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });
  }
  
  // delete users
  async deleteUser(userId: number) {
    // Soft delete by setting status to DELETED
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.DELETED },
    });

    // Revoke all sessions
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }
  
  // get a user session
  async getUserSessions(userId: number) {
    return this.prisma.session.findMany({
      where: { userId },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  
  // revoke session
  async revokeSession(userId: number, sessionId: string) {
    await this.prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });
  }

  // get a user login attempt
  async getLoginAttempts(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.loginAttempt.findMany({
      where: { email: user.email },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
  // admin reset pass
  async adminResetPassword(userId: number, newPassword: string) {
    const passwordHash = await hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all sessions
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

}