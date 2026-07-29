import { createHash } from 'node:crypto';

export function reservationFingerprint(input: {
  matchId: string;
  participantId: string;
  userId: string;
  assetCode: 'ARENA_POINT';
  amount: bigint;
  operation: 'RESERVE' | 'REFUND';
}): string {
  return createHash('sha256')
    .update(
      [
        input.operation,
        input.matchId,
        input.participantId,
        input.userId,
        input.assetCode,
        input.amount.toString(),
      ].join('|'),
    )
    .digest('hex');
}
