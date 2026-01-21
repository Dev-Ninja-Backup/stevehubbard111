import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from 'src/config/redis/redis.module';
import { PrismaService } from 'src/config/datasource/prisma.service';
import { JwtStrategy } from 'src/stretegy/jwt.stretegy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    RedisModule,
  //   JwtModule.registerAsync({
  //     imports: [ConfigModule],
  //     useFactory: async (configService: ConfigService) => ({
  //       secret: configService.get<string>('JWT_SECRET', 'changeme'),
  //       signOptions: {
  //         expiresIn: '15m',
  //       },
  //     }),
  //     inject: [ConfigService],
  //   }),
  ],
  providers: [AuthService, JwtStrategy, PrismaService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}