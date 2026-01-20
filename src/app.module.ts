import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';


@Module({
  imports: [
      ConfigModule.forRoot({
           isGlobal:true,
           envFilePath:['.env', '.env.local']  
      }),
      HealthModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
