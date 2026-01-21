import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: 123, description: 'Email of the user' })
  @IsString()
  email: string;

  @ApiProperty({ example: '123456', description: 'OTP code sent to the user' })
  @IsString()
  @MinLength(6, { message: 'OTP must be 6 digits' })
  otp: string;

  @ApiProperty({ example: '2fa, register', description: 'Purpose of the OTP' })
  @IsString()
  purpose: string;
}
