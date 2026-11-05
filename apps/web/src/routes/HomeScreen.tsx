import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { HowToPlay } from '../components/game/HowToPlay.tsx';
import { PicturePreview } from '../components/game/PicturePreview.tsx';
import { markHowToPlaySeen } from '../state/howToPlay.ts';
import { Button, buttonClasses } from '../components/ui/Button.tsx';
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
  // Home never opens it by itself; the first game does (pass 04).
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = () => setHelpOpen(true);
  const closeHelp = () => {
    markHowToPlaySeen();
    setHelpOpen(false);
  };
  // Read on render, not cached: coming back from /packs remounts Home.
  const soloPack = getPack(loadSoloPack());
  // Phase 7b: this device's completed results (state/history.ts). Read on
  // render: Home remounts whenever the player comes back to it.
  const history = loadHistory();
  const todaysDaily = dailyResult(history, dailyKey(new Date()));
  const recent = history.slice(0, 5);
  const dailyToday = dailyConfig();
  const daily = getPack(dailyToday.packId)?.pictures.find((p) => p.id === dailyToday.pictureId);

  function handleDaily() {
    start(dailyConfig());
    navigate('/r/daily');
  }

  function handleSolo() {
    start(freshSoloConfig());
    navigate('/r/solo');
  }

  return (
    // Pass 04 (BRIEF-04 "Home on wide screens", handoff-04 `Home`): from
    // 768px the page becomes two columns — play and history on the left, the
    // chosen pack and today's daily on the right. The phone column is unchanged.
    <main className="mx-auto grid min-h-app max-w-md content-center gap-6 bg-bg p-6 md:max-w-5xl md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:items-start md:gap-x-10">
      <header className="text-center md:col-span-2">
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
          {/* Solo carries the pack it will play, with Change beside it (pass 03
              `01d`, note 17): one tap to replay the usual pack, two to switch,
              and nothing standing between Solo and the board. */}
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={handleSolo}>
              <span className="grid text-center leading-tight">
                <span>Solo</span>
                {soloPack ? (
                  <span className="text-xs font-normal">
                    {soloPack.name} · {soloPack.pictures.length} pictures
                  </span>
                ) : null}
              </span>
            </Button>
            <Link to="/packs" className={buttonClasses({ size: 'lg', variant: 'secondary' })}>
              Change
            </Link>
          </div>
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

      <button
        type="button"
        onClick={showHelp}
        className="mx-auto min-h-touch rounded px-3 text-sm font-medium text-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
      >
        How to play
      </button>
      <HowToPlay open={helpOpen} onClose={closeHelp} />

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
      <aside className="hidden gap-6 md:col-start-2 md:row-span-4 md:row-start-2 md:grid">
        {daily ? (
          <Panel title="Today's daily">
            <div className="flex items-center gap-4">
              <div className="shrink-0 rounded-md border border-border bg-bg p-1.5">
                <PicturePreview
                  rows={daily.rows}
                  palette={daily.palette}
                  cellSize={7}
                  mode="outline"
                  label={`Today's daily, still to fill`}
                />
              </div>
              <div className="grid gap-2">
                <p className="text-sm text-ink-muted">
                  The same picture and offers for everyone today.
                </p>
                {todaysDaily ? (
                  <p className="font-medium text-ink">✓ Done in {todaysDaily.rounds} rounds</p>
                ) : (
                  <Button onClick={handleDaily}>Play today&rsquo;s daily</Button>
                )}
              </div>
            </div>
          </Panel>
        ) : null}
        {soloPack ? (
          <Panel title={soloPack.name}>
            <ul className="flex flex-wrap items-end gap-4">
              {soloPack.pictures.map((picture) => (
                <li key={picture.id} className="grid justify-items-center gap-1.5">
                  <div className="rounded-md border border-border bg-bg p-1.5">
                    <PicturePreview
                      rows={picture.rows}
                      palette={picture.palette}
                      cellSize={9}
                      label={picture.name}
                    />
                  </div>
                  <span className="text-xs text-ink-muted">{picture.name}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </aside>
    </main>
  );
}

function pictureName(entry: ResultEntry): string {
  return (
    getPack(entry.packId)?.pictures.find((p) => p.id === entry.pictureId)?.name ?? entry.pictureId
  );
}
