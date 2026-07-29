import { PlayerIdentityError } from './player-identity-errors';

export interface NormalizedPlatformHandle {
  readonly display: string;
  readonly normalized: string;
}
export interface PlatformHandleNormalizer {
  normalize(input: string): NormalizedPlatformHandle;
}
const forbidden = /[\p{Cc}\p{Cf}\u202A-\u202E\u2066-\u2069]/u;
export class GenericPlatformHandleNormalizer implements PlatformHandleNormalizer {
  public normalize(input: string): NormalizedPlatformHandle {
    const display = input.trim().normalize('NFC');
    const graphemes = [
      ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(display),
    ].length;
    if (
      graphemes < 2 ||
      graphemes > 64 ||
      forbidden.test(display) ||
      display.includes('\0') ||
      display.trim().length === 0
    )
      throw new PlayerIdentityError('INVALID_PLATFORM_HANDLE');
    return Object.freeze({ display, normalized: display.toLocaleLowerCase('und') });
  }
}
export class PlatformHandleNormalizerRegistry {
  private readonly generic = new GenericPlatformHandleNormalizer();
  public forPlatform(platformKey: string): PlatformHandleNormalizer {
    void platformKey;
    return this.generic;
  }
}
