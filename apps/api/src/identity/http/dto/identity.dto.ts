import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z, type ZodType } from 'zod';

const email = z.string().trim().min(3).max(320);
const password = z.string().min(1).max(1024);
const token = z
  .string()
  .min(20)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

export const registerSchema = z.strictObject({
  email,
  password,
  displayName: z.string().trim().min(1).max(120).optional(),
  locale: z.enum(['fa', 'en']).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  countryCode: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
});
export const loginSchema = z.strictObject({ email, password });
export const emailRequestSchema = z.strictObject({ email });
export const tokenSchema = z.strictObject({ token });
export const resetConfirmSchema = z.strictObject({ token, newPassword: password });
export const changePasswordSchema = z.strictObject({
  currentPassword: password,
  newPassword: password,
});

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type EmailRequest = z.infer<typeof emailRequestSchema>;
export type TokenRequest = z.infer<typeof tokenSchema>;
export type ResetConfirmRequest = z.infer<typeof resetConfirmSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

export class ZodBodyPipe<T> implements PipeTransform<unknown, T> {
  public constructor(private readonly schema: ZodType<T>) {}

  public transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = typeof issue.path[0] === 'string' ? issue.path[0] : 'body';
      (details[field] ??= []).push('Invalid value.');
    }
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details,
    });
  }
}
