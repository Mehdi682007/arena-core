import { z } from 'zod';

const key = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(2)
  .max(80);
const id = z.uuid();
export const catalogIdSchema = id;
const sortOrder = z.number().int().nonnegative().optional();
const rulesetConfiguration = z.strictObject({
  schemaVersion: z.number().int().positive(),
  settings: z.record(z.string(), z.unknown()),
});
export const createGameSchema = z.strictObject({
  key,
  slug,
  name: z.string().min(1).max(120),
  shortName: z.string().min(1).max(60).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  isVisible: z.boolean().optional(),
  sortOrder,
});
export const updateGameSchema = z
  .strictObject({
    name: z.string().min(1).max(120).optional(),
    shortName: z.string().min(1).max(60).optional(),
    description: z.string().max(2000).nullable().optional(),
    isVisible: z.boolean().optional(),
    sortOrder,
    status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
export const createPlatformSchema = z.strictObject({
  key,
  slug,
  name: z.string().min(1).max(100),
  family: z.enum(['PLAYSTATION', 'XBOX', 'PC', 'NINTENDO', 'MOBILE', 'OTHER']),
  sortOrder,
});
export const attachPlatformSchema = z.strictObject({
  platformId: id,
  isDefault: z.boolean().optional(),
  externalLabel: z.string().min(1).max(120).nullable().optional(),
  sortOrder,
});
export const createModeSchema = z.strictObject({
  key,
  slug,
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  teamSizeMin: z.number().int().positive(),
  teamSizeMax: z.number().int().positive(),
  participantCountMin: z.number().int().positive(),
  participantCountMax: z.number().int().positive(),
  sortOrder,
});
export const createCrossplayGroupSchema = z.strictObject({
  key,
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  sortOrder,
});
export const setCrossplayPlatformsSchema = z.strictObject({
  gamePlatformIds: z.array(id).max(32),
});
export const createRulesetSchema = z.strictObject({
  gameId: id,
  gameModeId: id,
  key,
  version: z.number().int().positive(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  configuration: rulesetConfiguration,
});
export const updateRulesetSchema = z.strictObject({
  name: z.string().min(1).max(120),
  configuration: rulesetConfiguration,
});
