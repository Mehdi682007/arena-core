import { z } from 'zod';

export const updateProfileSchema = z
  .strictObject({
    displayName: z.string().min(1).max(160).optional(),
    locale: z.enum(['fa', 'en']).optional(),
    timezone: z.string().min(1).max(64).optional(),
    countryCode: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .nullable()
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { path: ['body'] });

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
