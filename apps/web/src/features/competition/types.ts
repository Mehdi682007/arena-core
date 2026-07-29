export interface CatalogGame {
  id: string;
  slug: string;
  name: string;
  platforms: { id: string; name: string; key: string }[];
  modes: { id: string; key: string; name: string }[];
}
export interface GameAccount {
  id: string;
  displayHandle: string;
  status: string;
  game: { id: string; name: string };
  platform: { id: string; name: string };
}
export interface MatchmakingRequestView {
  id: string;
  status: string;
  searchScope: string;
  createdAt: string;
  expiresAt: string;
}
export interface ProposalView {
  id: string;
  status: string;
  expiresAt: string;
  myAcceptance: boolean;
  opponentAcceptance: boolean;
}
export interface MatchView {
  id: string;
  status: string;
  game: { key: string; name: string };
  mode: { key: string; name: string };
  ruleset: { key: string; name: string; version: number; configuration: unknown };
  crossplay: { key: string; name: string };
  participants: {
    side: 'SIDE_A' | 'SIDE_B';
    displayHandle: string;
    platform: { key: string; name: string };
    ready: boolean;
    isCurrentUser: boolean;
  }[];
  readyDeadlineAt: string;
  startedAt: string | null;
  resultSubmissionDeadlineAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
export interface ResultView {
  status: string;
  submission: { submitted: boolean; submittedAt: string | null; status: string };
  scores?: { side: string; score: number }[];
  winnerSide?: string;
  isDraw?: boolean;
  confirmedAt?: string;
}
export interface EvidenceView {
  id: string;
  type: string;
  status: string;
  description?: string;
  capturedAt?: string;
  submittedAt: string;
}
export interface DisputeView {
  id: string;
  status: string;
  reasonCode: string;
  requestedOutcome: string;
  statement: string;
  hasResponse: boolean;
  responseDeadlineAt: string;
  resolutionType: string | null;
  resolvedAt: string | null;
  createdAt: string;
}
export interface RatingHistoryView {
  items: {
    matchId: string;
    outcome: string;
    ratingBefore: number;
    ratingAfter: number;
    ratingDelta: number;
    appliedAt: string;
  }[];
  nextCursor: string | null;
}
export interface EntryView {
  status: string;
  asset: { code: 'ARENA_POINT'; monetary: false; withdrawable: false };
  amount: string;
}
export interface SettlementView {
  status: string;
  type: string | null;
  asset: { code: 'ARENA_POINT'; monetary: false };
  totalAmount: string;
  receivedAmount: string;
  settledAt: string | null;
}
