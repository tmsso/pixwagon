import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from './components/ui/Button.tsx';

/**
 * The last-resort screen when a render throws. Without it React unmounts the
 * whole tree and a player — often someone who just opened a shared `/r/CODE`
 * link — sees a blank white page with no way forward.
 *
 * A class component because React still has no hook for this: only
 * `getDerivedStateFromError` / `componentDidCatch` can catch a child's render
 * error. Both ways out are full page loads (a reload, a plain `<a href>`), not
 * router navigation, on purpose: whatever broke may be the router's own
 * state, and a fresh load is the reliable way out.
 */
export class CrashBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  override state = { crashed: false };

  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Kept in the console for diagnosis; the screen itself stays plain.
    console.error('Pixwagon crashed while rendering', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.crashed) return this.props.children;
    return (
      <main
        role="alert"
        className="mx-auto grid min-h-dvh max-w-md content-center gap-4 bg-bg p-6 text-center"
      >
        <h1 className="text-2xl font-semibold text-ink">Something went wrong</h1>
        <p className="text-ink-muted">
          Pixwagon hit a problem it couldn&rsquo;t recover from. Reloading usually fixes it — if you
          were in a room, you&rsquo;ll rejoin the same seat.
        </p>
        <Button size="lg" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <a href="/" className="text-accent underline">
          Back to the start
        </a>
      </main>
    );
  }
}

/** Dev-only route target (`/__crash`) that throws, so the boundary above can
 *  be checked in a real browser. Never routed in a production build. */
export function CrashForDev(): never {
  throw new Error('Deliberate crash for checking the crash screen (dev only)');
}
