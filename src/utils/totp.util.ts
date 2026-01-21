import * as speakeasy from 'speakeasy';

export function generateTOTPSecret(): string {
  const secret = speakeasy.generateSecret({
    length: 32,
    name: 'Rabbt',
  });
  return secret.base32;
}

export function verifyTOTP(secret: string, token: string): boolean {
  console.log("insode totp--", secret, token);
  
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 2 time steps before/after (60 seconds tolerance)
  });
}

export function getTOTPAuthUrl(
  secret: string,
  email: string,
  issuer: string = 'Rabbt',
): string {
  return speakeasy.otpauthURL({
    secret,
    label: email,
    issuer,
    encoding: 'base32',
  });
}
