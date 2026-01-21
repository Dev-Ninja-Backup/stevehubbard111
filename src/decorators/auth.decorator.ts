import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';


export function Auth() {
  return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard));
}