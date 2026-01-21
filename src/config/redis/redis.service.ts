import { Inject, Injectable } from '@nestjs/common';
import type { RedisClientType } from 'redis';


@Injectable()
export class RedisService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly client: RedisClientType,
  ) {}

  /** Get raw Redis client */
  getClient() {
    return this.client;
  }

  /** Set a value */
  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds)
      return this.client.set(key, value, { EX: ttlSeconds });

    return this.client.set(key, value);
  }

  /** Get value */
  async get(key: string) {
    return this.client.get(key);
  }

  /** Delete key */
  async del(key: string) {
    return this.client.del(key);
  }
  

  // aquirelock for order timing 
  async acquireLock(key: string, ttlMs = 5000): Promise<boolean> {
    const result = await this.client.set(key, '1', {
      PX: ttlMs,
      NX: true,
    });

    return result === 'OK';
  }
  
  // release lock
  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }
  
  // keys pattern
  async keys(pattern: string) {
    return this.client.keys(pattern);
  }



}