import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix (removed trailing slash)
  app.setGlobalPrefix('api/v1'); 

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Use cookie parser
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip non-whitelisted properties
      forbidNonWhitelisted: true, // Throw error if non-whitelisted
      transform: true, // Auto-transform payloads to DTO types
      transformOptions: {
        enableImplicitConversion: true, 
      },
    }),
  );

  const port = process.env.PORT || 6969;
  await app.listen(port);

  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Rabbt Platform API Server                        ║
║                                                       ║
║   📡 Running on: http://localhost:${port}/api/v1      ║
║   📚 Swagger: http://localhost:${port}/api/v1/docs    ║
║                                                       ║
║   Environment: ${process.env.NODE_ENV || 'development'}║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
}

bootstrap();