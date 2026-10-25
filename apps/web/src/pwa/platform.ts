/**
 * Where "Add to home screen" has to be done by hand (ROADMAP.md Phase 9).
 *
 * Chrome and Edge on Android fire `beforeinstallprompt`, which the install card
 * hooks. iOS never does: installing there is the Share sheet's "Add to Home
 * Screen", with nothing for a page to call. So the card has to say how, in
 * words, on exactly those devices — and nowhere else, or it would be advice for
 * a button that doesn't exist. Pure so the user-agent rules are tested without a
 * browser.
 */
export interface PlatformFacts {
  userAgent: string;
  /** `navigator.maxTouchPoints` — iPadOS reports itself as a Mac, touch aside. */
  maxTouchPoints: number;
  /** `navigator.standalone` — iOS only, true once launched from the home screen. */
  standalone: boolean | undefined;
}

export function needsManualInstall({
  userAgent,
  maxTouchPoints,
  standalone,
}: PlatformFacts): boolean {
  if (standalone === true) return false; // already installed
  const iPhoneOrPod = /iPhone|iPod/.test(userAgent);
  const iPad = /iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return iPhoneOrPod || iPad;
}

/** The live facts, or `null` where there is no `navigator` (a server render). */
export function readPlatform(): PlatformFacts | null {
  if (typeof navigator === 'undefined') return null;
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: (navigator as { standalone?: boolean }).standalone,
  };
}
