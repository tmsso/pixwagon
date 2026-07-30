import { Link } from 'react-router';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { ScaffoldNotice } from './ScaffoldNotice.tsx';

export function HomeScreen() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
      <header className="text-center">
        <h1 className="font-mono text-3xl font-bold tracking-tight text-ink">Pixwagon</h1>
        <p className="mt-2 text-ink-muted">Roll the dice. Fill the picture.</p>
      </header>

      <Panel title="Play">
        <div className="grid gap-2">
          <Button size="lg">Solo</Button>
          <Button size="lg" variant="secondary">
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

      <ScaffoldNotice phase="Phase 2" />
    </main>
  );
}
