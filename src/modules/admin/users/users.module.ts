import { Module } from '@nestjs/common';
import { AdminService } from './users.service';
import { AdminController } from './users.controller';
import { PrismaService } from 'src/config/datasource/prisma.service';


@Module({
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
})
export class UsersModule {}
