import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { freshSoloConfig, useSoloGameStore } from '../state/soloGame.ts';

export function HomeScreen() {
  const navigate = useNavigate();
  const start = useSoloGameStore((state) => state.start);

  function handleSolo() {
    start(freshSoloConfig());
    navigate('/r/solo');
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
      <header className="text-center">
        <h1 className="font-mono text-3xl font-bold tracking-tight text-ink">Pixwagon</h1>
        {/* "Roll the dice" was the pre-mechanics-correction tagline
            (docs/mechanics-correction.md) — there's no dice anymore, only
            pieces and an independent fallback die. */}
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
          <Link to="/lobby">
            <Button size="lg" variant="secondary" className="w-full">
              Play with friends
            </Button>
          </Link>
        </div>
      </Panel>

      <Panel title="Packs" tone="sunken">
        <Link to="/packs" className="text-accent underline">
          Choose a shape pack
        </Link>
      </Panel>
    </main>
  );
}
