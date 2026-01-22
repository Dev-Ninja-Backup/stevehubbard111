import { IsEmail, IsString, MinLength } from 'class-validator';
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



export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token sent to the user email',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  token: string;
}

export class ResendVerificationDto {
  @ApiProperty({
    description: 'Registered email address to resend verification link',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
