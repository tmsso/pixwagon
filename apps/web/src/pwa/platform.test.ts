import { describe, expect, it } from 'vitest';
import { needsManualInstall } from './platform.ts';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

describe('needsManualInstall', () => {
  it('is true on an iPhone in the browser', () => {
    expect(needsManualInstall({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false })).toBe(
      true,
    );
    expect(
      needsManualInstall({ userAgent: IPHONE, maxTouchPoints: 5, standalone: undefined }),
    ).toBe(true);
  });

  it('is true on an iPad that calls itself a Mac, but not on a real Mac', () => {
    expect(
      needsManualInstall({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5, standalone: false }),
    ).toBe(true);
    expect(
      needsManualInstall({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0, standalone: undefined }),
    ).toBe(false);
  });

  it('is false once launched from the home screen', () => {
    expect(needsManualInstall({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true })).toBe(
      false,
    );
  });

  it('is false on Android, where the browser offers a real install prompt', () => {
    expect(
      needsManualInstall({ userAgent: ANDROID, maxTouchPoints: 5, standalone: undefined }),
    ).toBe(false);
  });
});
