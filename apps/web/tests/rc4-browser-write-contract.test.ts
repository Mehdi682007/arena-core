import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

// Bodyless writes still need JSON content type because the same-origin proxy enforces it.
describe('RC4 browser write proxy contract', () => {
  it('normalizes bodyless writes to JSON bodies', () => {
    const source = readFileSync(path.join(root, 'src/lib/api/browser-api-client.ts'), 'utf8');

    expect(source).toContain("const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])");
    expect(source).toContain('options.body === undefined');
    expect(source).toContain('body: {}');
  });
});
