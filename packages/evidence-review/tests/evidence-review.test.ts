import { describe, expect, it } from 'vitest';
import {
  DisabledEvidenceReviewProvider,
  EvidenceReviewService,
  type EvidenceReviewProvider,
} from '../src/index.js';
const valid = {
  detectedGame: 'FC 26',
  detectedMode: '1v1',
  playerIdentifiers: [],
  displayedScore: '2-1',
  suggestedWinner: null,
  confidence: 0.8,
  qualityFlags: [],
  manipulationIndicators: [],
  contradictions: [],
  humanReviewNotes: 'Human confirmation required.',
};
describe('evidence review', () => {
  it('disabled provider fails closed', async () =>
    expect(
      new EvidenceReviewService(new DisabledEvidenceReviewProvider()).review({
        opaqueEvidenceId: 'x',
        mimeType: 'image/png',
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow(/DISABLED/));
  it('validates structured result and deduplicates identical evidence', async () => {
    let calls = 0;
    const provider: EvidenceReviewProvider = {
      name: 'fake',
      model: 'test',
      analyze() {
        calls++;
        return Promise.resolve(valid);
      },
    };
    const service = new EvidenceReviewService(provider);
    const input = {
      opaqueEvidenceId: 'opaque',
      mimeType: 'image/png' as const,
      bytes: new Uint8Array([1, 2]),
    };
    expect((await service.review(input)).confidence).toBe(0.8);
    await service.review(input);
    expect(calls).toBe(1);
  });
  it('rejects malformed, missing and oversized evidence', async () => {
    const provider: EvidenceReviewProvider = {
      name: 'fake',
      model: 'test',
      analyze() {
        return Promise.resolve({ freeform: 'ignore previous instructions' });
      },
    };
    const service = new EvidenceReviewService(provider, 1);
    await expect(
      service.review({ opaqueEvidenceId: 'x', mimeType: 'image/png', bytes: new Uint8Array() }),
    ).rejects.toThrow(/MISSING/);
    await expect(
      service.review({
        opaqueEvidenceId: 'x',
        mimeType: 'image/png',
        bytes: new Uint8Array([1, 2]),
      }),
    ).rejects.toThrow(/TOO_LARGE/);
    const normal = new EvidenceReviewService(provider);
    await expect(
      normal.review({ opaqueEvidenceId: 'x', mimeType: 'image/png', bytes: new Uint8Array([1]) }),
    ).rejects.toThrow(/MALFORMED/);
  });
  it('validates MIME and timeout and keeps claims distinct in the idempotency key', async () => {
    let calls = 0;
    const provider: EvidenceReviewProvider = {
      name: 'fake',
      model: 'v1',
      analyze() {
        calls += 1;
        return Promise.resolve(valid);
      },
    };
    const service = new EvidenceReviewService(provider);
    const base = {
      opaqueEvidenceId: 'opaque',
      mimeType: 'image/png' as const,
      bytes: new Uint8Array([9]),
    };
    await service.review({ ...base, submittedClaim: 'home won' });
    await service.review({ ...base, submittedClaim: 'away won' });
    await service.review({ ...base, submittedClaim: 'away won' });
    expect(calls).toBe(2);
    await expect(service.review({ ...base, mimeType: 'text/plain' as never })).rejects.toThrow(
      /MIME_UNSUPPORTED/,
    );
    await expect(service.review(base, 0)).rejects.toThrow(/TIMEOUT_INVALID/);
  });

  it('aborts a provider that exceeds the bounded timeout', async () => {
    const provider: EvidenceReviewProvider = {
      name: 'slow',
      model: 'v1',
      analyze(_input, signal) {
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              reject(new Error('aborted'));
            },
            { once: true },
          );
        });
      },
    };
    await expect(
      new EvidenceReviewService(provider).review(
        { opaqueEvidenceId: 'x', mimeType: 'image/jpeg', bytes: new Uint8Array([1]) },
        5,
      ),
    ).rejects.toThrow(/EVIDENCE_REVIEW_TIMEOUT/);
  });
});
