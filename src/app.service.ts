import { Injectable } from '@nestjs/common';
import pkg from '../package.json';

@Injectable()
export class AppService {
  getPlatformInfo() {
    return {
      name:pkg.name,
      product: 'Insights.rabbt.org',
      version:pkg.version,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  getServices() {
    return [
      {
        key: 'market-insights',
        name: 'Market Insights',
        description: 'Real-time and historical market data analytics.',
      },
      {
        key: 'user-analytics',
        name: 'User Analytics',
        description: 'Behavior tracking, engagement metrics, and reporting.',
      },
      {
        key: 'competition-engine',
        name: 'Competition Engine',
        description: 'Leaderboard, scoring, ranking, and rewards system.',
      },
      {
        key: 'auth-access',
        name: 'Authentication & Access Control',
        description: 'JWT, role-based access, and secure session handling.',
      },
      {
        key: 'notification',
        name: 'Notification Service',
        description: 'Email, SMS, and in-app notifications.',
      },
    ];
  }
}
