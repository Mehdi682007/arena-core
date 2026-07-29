export type MatchEvidenceType =
  'SCREENSHOT_DECLARATION' | 'VIDEO_DECLARATION' | 'MATCH_SUMMARY_DECLARATION' | 'TEXT_STATEMENT';
export type MatchEvidenceStatus = 'ACTIVE' | 'WITHDRAWN' | 'LOCKED';
export interface MatchEvidencePayload {
  readonly schemaVersion: 1;
  readonly type: MatchEvidenceType;
  readonly description?: string;
  readonly capturedAt?: string;
}
export interface MatchEvidenceRecord {
  readonly id: string;
  readonly matchId: string;
  readonly participantId: string;
  readonly submittedByUserId: string;
  readonly type: MatchEvidenceType;
  readonly status: MatchEvidenceStatus;
  readonly payload: MatchEvidencePayload;
  readonly capturedAt: Date | null;
  readonly submittedAt: Date;
  readonly withdrawnAt: Date | null;
  readonly version: number;
}
export interface MatchEvidenceView {
  readonly id: string;
  readonly type: MatchEvidenceType;
  readonly status: MatchEvidenceStatus;
  readonly description?: string;
  readonly capturedAt?: Date;
  readonly submittedAt: Date;
}
