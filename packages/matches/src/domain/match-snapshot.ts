import { MatchError } from './match-errors';
import type {
  AcceptedProposalContext,
  CrossplaySnapshot,
  GameSnapshot,
  ModeSnapshot,
  ParticipantSnapshot,
  RulesetSnapshot,
  SnapshotEnvelope,
} from './match-types';

const forbidden =
  /(?:password|credential|token|secret|email|ipAddress|session|normalizedHandle|verificationMetadata)/i;
function inspect(value: unknown, depth = 0): void {
  if (depth > 8) throw new MatchError('MATCH_SNAPSHOT_INVALID');
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return;
  if (Array.isArray(value)) {
    for (const item of value) inspect(item, depth + 1);
    return;
  }
  if (typeof value !== 'object') throw new MatchError('MATCH_SNAPSHOT_INVALID');
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.test(key) || ['__proto__', 'prototype', 'constructor'].includes(key))
      throw new MatchError('MATCH_SNAPSHOT_INVALID');
    inspect(child, depth + 1);
  }
}
export function envelope<T>(data: T): SnapshotEnvelope<T> {
  const value = { schemaVersion: 1 as const, data };
  inspect(value);
  if (JSON.stringify(value).length > 16_384) throw new MatchError('MATCH_SNAPSHOT_INVALID');
  return Object.freeze({ schemaVersion: 1, data: Object.freeze(data) });
}
export function validateMatchSnapshot(value: unknown): void {
  if (
    value === null ||
    typeof value !== 'object' ||
    (value as { schemaVersion?: unknown }).schemaVersion !== 1
  )
    throw new MatchError('MATCH_SNAPSHOT_INVALID');
  inspect(value);
  if (JSON.stringify(value).length > 16_384) throw new MatchError('MATCH_SNAPSHOT_INVALID');
}
export function buildSnapshots(context: AcceptedProposalContext): {
  game: SnapshotEnvelope<GameSnapshot>;
  mode: SnapshotEnvelope<ModeSnapshot>;
  ruleset: SnapshotEnvelope<RulesetSnapshot>;
  crossplay: SnapshotEnvelope<CrossplaySnapshot>;
  participants: readonly [
    SnapshotEnvelope<ParticipantSnapshot>,
    SnapshotEnvelope<ParticipantSnapshot>,
  ];
} {
  const [left, right] = context.participants;
  if (
    left.userId === right.userId ||
    !left.accountVerified ||
    !right.accountVerified ||
    !left.requestMatched ||
    !right.requestMatched ||
    !['ACTIVE', 'SUPERSEDED'].includes(context.ruleset.status)
  )
    throw new MatchError('MATCH_SNAPSHOT_INVALID');
  const participant = (source: typeof left): ParticipantSnapshot => ({
    userId: source.userId,
    userGameAccountId: source.userGameAccountId,
    gamePlatformId: source.gamePlatformId,
    platformKey: source.platformKey,
    platformName: source.platformName,
    displayHandle: source.displayHandle,
  });
  return {
    game: envelope(context.game),
    mode: envelope(context.mode),
    ruleset: envelope({
      gameRulesetId: context.ruleset.gameRulesetId,
      key: context.ruleset.key,
      name: context.ruleset.name,
      version: context.ruleset.version,
      configuration: context.ruleset.configuration,
      publishedAt: context.ruleset.publishedAt,
    }),
    crossplay: envelope(context.crossplay),
    participants: [envelope(participant(left)), envelope(participant(right))],
  };
}
