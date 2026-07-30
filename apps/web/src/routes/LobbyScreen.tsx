import { PlayerChip } from '../components/game/PlayerChip.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { RoomCodeInput } from '../components/ui/RoomCodeInput.tsx';
import { ScaffoldNotice } from './ScaffoldNotice.tsx';

export function LobbyScreen() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
      <h1 className="text-center text-2xl font-semibold text-ink">Play with friends</h1>

      <Panel title="Join a room">
        <RoomCodeInput value="PI" />
        <Button className="mt-4 w-full">Join</Button>
      </Panel>

      <Panel title="Or start one" tone="sunken">
        <Button variant="secondary" className="w-full">
          Create room
        </Button>
      </Panel>

      <Panel title="In this room">
        <div className="flex flex-wrap gap-2">
          <PlayerChip name="Tamas" colorIndex={0} active />
          <PlayerChip name="Guest" colorIndex={1} />
          <PlayerChip name="Kim" colorIndex={2} connected={false} />
        </div>
      </Panel>

      <ScaffoldNotice phase="Phase 4" />
    </main>
  );
}
