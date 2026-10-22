import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { InstallPrompt } from '../pwa/InstallPrompt.tsx';
import { OfflineExplainer, OfflinePill } from '../pwa/OfflineNotice.tsx';
import { useOnlineStatus } from '../pwa/useOnlineStatus.ts';
import { getPack } from '@pixwagon/packs';
import { dailyConfig, dailyKey } from '../state/daily.ts';
import { dailyResult, loadHistory } from '../state/history.ts';
import type { ResultEntry } from '../state/history.ts';
import { loadSoloPack } from '../state/packChoice.ts';
import { freshSoloConfig, useSoloGameStore } from '../state/soloGame.ts';

export function HomeScreen() {
  const navigate = useNavigate();
  const start = useSoloGameStore((state) => state.start);
  const online = useOnlineStatus();
  // Read on render, not cached: coming back from /packs remounts Home.
  const soloPack = getPack(loadSoloPack())?.name ?? '';
  // Phase 7b: this device's completed results (state/history.ts). Read on
  // render: Home remounts whenever the player comes back to it.
  const history = loadHistory();
  const todaysDaily = dailyResult(history, dailyKey(new Date()));
  const recent = history.slice(0, 5);

  function handleDaily() {
    start(dailyConfig());
    navigate('/r/daily');
  }

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
          {/* Phase 7a: the same puzzle for everyone today, derived from the
              UTC date alone — so it works offline too. */}
          <Button size="lg" variant="secondary" onClick={handleDaily}>
            Daily puzzle
          </Button>
          {todaysDaily ? (
            <p className="text-center text-sm text-ink-muted" role="status">
              ✓ Today&rsquo;s daily done in {todaysDaily.rounds} rounds
            </p>
          ) : null}
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

      {recent.length > 0 ? (
        <Panel title="Recent results" tone="sunken">
          <ul className="grid gap-1 text-sm">
            {recent.map((entry) => (
              <li key={entry.completedAt} className="flex justify-between gap-3">
                <span className="text-ink">
                  {entry.daily ? `Daily ${entry.daily}` : 'Solo'} · {pictureName(entry)}
                </span>
                <span className="font-mono text-ink-muted">{entry.rounds} rounds</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Packs" tone="sunken">
        {/* Says which pack "Solo" will play, so the choice made on /packs is
            visible where it takes effect (D7). */}
        <p className="text-sm text-ink-muted">
          Solo plays <span className="font-medium text-ink">{soloPack}</span>.{' '}
          <Link to="/packs" className="text-accent underline">
            Choose a shape pack
          </Link>
        </p>
      </Panel>
    </main>
  );
}

function pictureName(entry: ResultEntry): string {
  return (
    getPack(entry.packId)?.pictures.find((p) => p.id === entry.pictureId)?.name ?? entry.pictureId
  );
}
