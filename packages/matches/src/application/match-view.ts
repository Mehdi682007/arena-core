import type { MatchRecord, MatchView } from '../domain/match-types';

export function toMatchView(match: MatchRecord, userId: string): MatchView {
  return {
    id: match.id,
    status: match.status,
    game: match.gameSnapshot.data,
    mode: match.modeSnapshot.data,
    ruleset: {
      key: match.rulesetSnapshot.data.key,
      name: match.rulesetSnapshot.data.name,
      version: match.rulesetSnapshot.data.version,
      configuration: match.rulesetSnapshot.data.configuration,
    },
    crossplay: {
      key: match.crossplaySnapshot.data.key,
      name: match.crossplaySnapshot.data.name,
    },
    participants: match.participants.map((participant) => ({
      side: participant.side,
      displayHandle: participant.snapshot.data.displayHandle,
      platform: {
        key: participant.snapshot.data.platformKey,
        name: participant.snapshot.data.platformName,
      },
      ready: participant.status === 'READY',
      isCurrentUser: participant.userId === userId,
    })),
    readyDeadlineAt: match.readyDeadlineAt,
    startedAt: match.startedAt,
    resultSubmissionDeadlineAt: match.resultSubmissionDeadlineAt,
    completedAt: match.completedAt,
    createdAt: match.createdAt,
  };
}
