import { z } from 'zod';

export const matchIdSchema = z.uuid();
export const emptyMatchActionSchema = z.object({}).strict();
export const matchListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z
      .enum([
        'CREATED',
        'AWAITING_READY',
        'READY',
        'IN_PROGRESS',
        'AWAITING_RESULT',
        'RESULT_CONFLICT',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED',
        'VOIDED',
      ])
      .optional(),
  })
  .strict();
export const voidMatchSchema = z
  .object({
    reasonCode: z.enum([
      'INVALID_PROPOSAL_STATE',
      'ACCOUNT_INVALIDATED',
      'CATALOG_CONFIGURATION_INVALID',
      'DUPLICATE_MATCH',
      'OPERATIONAL_ERROR',
      'OTHER',
    ]),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.reasonCode === 'OTHER' && !value.note)
      context.addIssue({ code: 'custom', path: ['note'], message: 'note is required' });
  });

const scoreSchema = z
  .object({
    side: z.enum(['SIDE_A', 'SIDE_B']),
    score: z.number().int().min(0).max(99),
  })
  .strict();
export const submitMatchResultSchema = z
  .object({
    result: z
      .object({
        schemaVersion: z.literal(1),
        type: z.literal('SCORE'),
        scores: z.tuple([scoreSchema, scoreSchema]),
        outcome: z.enum(['WIN_LOSS', 'DRAW']).optional(),
      })
      .strict(),
  })
  .strict();
const resolutionReasonFields = {
  reasonCode: z.enum(['SUBMISSION_ERROR', 'OPERATIONAL_CORRECTION', 'OTHER']),
  note: z.string().trim().min(1).max(500).optional(),
};
export const resolveMatchResultSchema = z
  .union([
    z.object({ result: submitMatchResultSchema.shape.result, ...resolutionReasonFields }).strict(),
    z.object({ submissionId: z.uuid(), ...resolutionReasonFields }).strict(),
  ])
  .superRefine((value, context) => {
    if (value.reasonCode === 'OTHER' && !value.note)
      context.addIssue({ code: 'custom', path: ['note'], message: 'note is required' });
  });

export const evidenceIdSchema = z.uuid();
export const disputeIdSchema = z.uuid();
const resultPayloadSchema = submitMatchResultSchema.shape.result;
export const submitEvidenceSchema = z
  .object({
    evidence: z
      .object({
        schemaVersion: z.literal(1),
        type: z.enum([
          'SCREENSHOT_DECLARATION',
          'VIDEO_DECLARATION',
          'MATCH_SUMMARY_DECLARATION',
          'TEXT_STATEMENT',
        ]),
        description: z.string().trim().min(1).max(2000).optional(),
        capturedAt: z.iso.datetime().optional(),
      })
      .strict(),
  })
  .strict();
export const openDisputeSchema = z
  .object({
    reasonCode: z.enum([
      'SCORE_MISMATCH',
      'WRONG_WINNER',
      'OPPONENT_NO_SHOW',
      'OPPONENT_DISCONNECTED',
      'INVALID_RESULT_SUBMISSION',
      'RULESET_VIOLATION',
      'ACCOUNT_IDENTITY_ISSUE',
      'OTHER',
    ]),
    claim: z
      .object({
        schemaVersion: z.literal(1),
        statement: z.string().trim().min(1).max(2000),
        requestedOutcome: z.enum([
          'KEEP_CURRENT_RESULT',
          'REVERSE_WINNER',
          'CORRECT_SCORE',
          'VOID_MATCH',
        ]),
        proposedResult: resultPayloadSchema.optional(),
        evidenceIds: z.array(z.uuid()).max(10).default([]),
      })
      .strict(),
  })
  .strict();
export const respondDisputeSchema = z
  .object({
    statement: z.string().trim().min(1).max(2000),
    evidenceIds: z.array(z.uuid()).max(10).default([]),
  })
  .strict();
export const disputeListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z
      .enum([
        'OPEN',
        'AWAITING_RESPONSE',
        'UNDER_REVIEW',
        'RESOLVED',
        'REJECTED',
        'CANCELLED',
        'EXPIRED',
      ])
      .optional(),
    assignedToMe: z.coerce.boolean().optional(),
  })
  .strict();
export const resolveDisputeSchema = z
  .object({
    resolutionType: z.enum(['UPHOLD_RESULT', 'CORRECT_RESULT', 'VOID_MATCH', 'REJECT_DISPUTE']),
    correctedResult: resultPayloadSchema.optional(),
    reasonCode: z.string().trim().min(1).max(64),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.resolutionType === 'CORRECT_RESULT') !== (value.correctedResult !== undefined))
      context.addIssue({
        code: 'custom',
        path: ['correctedResult'],
        message: 'correctedResult is required only for CORRECT_RESULT',
      });
    if (value.reasonCode === 'OTHER' && !value.note)
      context.addIssue({ code: 'custom', path: ['note'], message: 'note is required' });
  });
