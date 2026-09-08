import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { InstallPrompt } from '../pwa/InstallPrompt.tsx';
import { OfflineExplainer, OfflinePill } from '../pwa/OfflineNotice.tsx';
import { useOnlineStatus } from '../pwa/useOnlineStatus.ts';
import { freshSoloConfig, useSoloGameStore } from '../state/soloGame.ts';

export function HomeScreen() {
  const navigate = useNavigate();
  const start = useSoloGameStore((state) => state.start);
  const online = useOnlineStatus();

  function handleSolo() {
    start(freshSoloConfig());
    navigate('/r/solo');
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
      <header className="text-center">
        <div className="flex items-center justify-center gap-3">
          <h1 className="font-mono text-3xl font-bold tracking-tight text-ink">Pixwagon</h1>
          {/* Offline is a state, not an incident (Annotation 16) — one neutral
              pill, nothing red, nothing blocking. */}
          {!online ? <OfflinePill /> : null}
        </div>
        {/* "Roll the dice" was the pre-mechanics-correction tagline
            (docs/mechanics-correction.md) — there's no dice anymore, only
            pieces and an independent single die (the "fallback" offer in
            wire terms; "the single" to players — design pass 02, Annotation 10). */}
        <p className="mt-2 text-ink-muted">Place pieces. Fill the picture.</p>
      </header>

      <Panel title="Play">
        <div className="grid gap-2">
          <Button size="lg" onClick={handleSolo}>
            Solo
          </Button>
          {/* Daily puzzle needs a shared deterministic seed distribution —
              Phase 7, not built yet. */}
          <Button size="lg" variant="secondary" disabled>
            Daily puzzle
          </Button>
          {online ? (
            <Link to="/lobby">
              <Button size="lg" variant="secondary" className="w-full">
                Play with friends
              </Button>
            </Link>
          ) : (
            <Button size="lg" variant="secondary" className="w-full" disabled>
              Play with friends
            </Button>
          )}
        </div>
        {!online ? (
          <div className="mt-3">
            <OfflineExplainer />
          </div>
        ) : null}
      </Panel>

      <InstallPrompt />

      <Panel title="Packs" tone="sunken">
        <Link to="/packs" className="text-accent underline">
          Choose a shape pack
        </Link>
      </Panel>
    </main>
  );
}
