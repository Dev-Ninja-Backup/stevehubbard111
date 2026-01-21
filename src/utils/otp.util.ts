import { Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { RedisService } from 'src/config/redis/redis.service';


@Injectable()
export class OtpUtil {
  constructor(private readonly redis: RedisService) {}

  // Generate OTP
  async generate(
    userId: number,
    purpose: string,
    ttlSeconds = 300, // 5 minutes
  ): Promise<string> {
    const otp = crypto.randomInt(100000, 999999).toString();
    const hash = this.hashOtp(otp);

    const key = this.key(userId, purpose);
   console.log(key, hash, otp);
   console.log('Redis instance:', this.redis);

    await this.redis.set(key, hash, ttlSeconds);

    return otp; // send via email / sms
  }

  // ----------------------------------
  // Verify OTP
  // ----------------------------------
  async verify(
    userId: number,
    purpose: string,
    otp: string,
  ): Promise<boolean> {
    const key = this.key(userId, purpose);
    const storedHash = await this.redis.get(key);

    if (!storedHash) return false;

    const isValid = this.hashOtp(otp) === storedHash;

    if (isValid) {
      // single-use
      await this.redis.del(key);
    }

    return isValid;
  }

  // ----------------------------------
  // Helpers
  // ----------------------------------
  private key(userId: number, purpose: string) {
    return `otp:${purpose}:${userId}`;
  }

  private hashOtp(otp: string) {
    return crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');
  }
}
