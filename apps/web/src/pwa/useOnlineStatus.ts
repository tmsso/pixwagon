import { useEffect, useState } from 'react';

/**
 * `navigator.onLine` as reactive state. Defaults to online when there is no
 * `navigator` (server render in scripts/check-screens.tsx) and when the browser
 * can't tell — a false "offline" is more disruptive than a false "online",
 * since offline only ever *adds* one quiet pill and disables "Play with
 * friends" (Annotation 16).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
