import { z } from 'zod';

export const matchmakingIdSchema = z.uuid();
export const createMatchmakingRequestSchema = z.strictObject({
  userGameAccountId: z.uuid(),
  gameModeId: z.uuid(),
  gameRulesetId: z.uuid(),
  searchScope: z.enum(['CROSSPLAY_GROUP', 'SAME_PLATFORM']).optional(),
  criteria: z
    .strictObject({
      language: z.enum(['fa', 'en']).optional(),
      region: z
        .string()
        .max(32)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),
    })
    .optional(),
});
export const emptyMatchmakingActionSchema = z.strictObject({});
export const matchmakingLimitSchema = z.coerce.number().int().min(1).max(100).optional();
