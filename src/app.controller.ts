import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Platform')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRootPage(): string {
    const info = this.appService.getPlatformInfo();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${info.name}</title>
        <style>
          body { font-family: Arial; background:#0f172a; color:#e5e7eb; }
          .wrap { max-width:700px; margin:80px auto; text-align:center; }
          a { color:#38bdf8; text-decoration:none; font-weight:bold; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>🚀 ${info.name}</h1>
          <p>Insights Engine for <strong>${info.product}</strong></p>
          <p><a href="/api/v1/services">View Services</a></p>
          <p><a href="/api/v1/docs">Swagger Documentation</a></p>
        </div>
      </body>
      </html>
`;
  }

  @Get('services')
  @ApiOperation({ summary: 'List all platform services' })
  getServices() {
    return {
      platform: this.appService.getPlatformInfo(),
      services: this.appService.getServices(),
    };
  }
}
