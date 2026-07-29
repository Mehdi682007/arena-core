export interface MatchEntryEligibilityPort {
  assertParticipantEntrySatisfied(matchId: string, participantId: string): Promise<void>;
  assertMatchEntrySatisfied(matchId: string): Promise<void>;
  releaseMatchEntries(matchId: string): Promise<void>;
}

export const allowMatchEntry: MatchEntryEligibilityPort = {
  assertParticipantEntrySatisfied: () => Promise.resolve(),
  assertMatchEntrySatisfied: () => Promise.resolve(),
  releaseMatchEntries: () => Promise.resolve(),
};
