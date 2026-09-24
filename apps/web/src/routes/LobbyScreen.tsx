import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { isIssuableRoomCode } from '@pixwagon/protocol';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { RoomCodeInput } from '../components/ui/RoomCodeInput.tsx';
import { createRoomUrl } from '../net/roomOrigin.ts';
import { loadDisplayName, normaliseName, saveDisplayName } from '../state/displayName.ts';
import { NameField } from './NameField.tsx';

/**
 * The Lobby's front door (design pass 02 `02a`/`02b`, provisional): join by
 * code or create a room. The waiting room itself (`02c`–`02e`) lives at the
 * room's own URL, `/r/CODE`, so a copied link lands everyone in the same place.
 */
export function LobbyScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState(() => loadDisplayName() ?? '');
  const [code, setCode] = useState('');
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);

  function enter(roomCode: string) {
    saveDisplayName(normaliseName(name));
    navigate(`/r/${roomCode}`);
  }

  function handleJoin(event?: FormEvent) {
    event?.preventDefault();
    // Only a typo check: a room code is a Durable Object name with no
    // registry, so a well-formed code nobody created opens a fresh empty room
    // rather than failing — `02b`'s "no room" case is a malformed code here.
    if (!isIssuableRoomCode(code)) {
      setCodeInvalid(true);
      return;
    }
    enter(code);
  }

  async function handleCreate() {
    setCreating(true);
    setCreateFailed(false);
    try {
      const response = await fetch(createRoomUrl(), { method: 'POST' });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const body = (await response.json()) as { code: string };
      enter(body.code);
    } catch {
      setCreateFailed(true);
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 bg-bg p-6">
      <h1 className="text-center text-2xl font-semibold text-ink">Play with friends</h1>

      <Panel>
        <NameField value={name} onChange={setName} />
      </Panel>

      <Panel title="Join a room">
        <form className="grid gap-4" onSubmit={handleJoin}>
          <p className="text-sm text-ink-muted">Ask whoever set it up for the four letters.</p>
          <RoomCodeInput
            value={code}
            invalid={codeInvalid}
            errorMessage="That isn't a room code — check the letters again."
            onChange={(next) => {
              setCode(next);
              setCodeInvalid(false);
            }}
            onSubmit={() => handleJoin()}
          />
          <Button type="submit" className="w-full" disabled={code.length === 0}>
            Join room
          </Button>
        </form>
      </Panel>

      <Panel title="Or start one" tone="sunken">
        <Button variant="secondary" className="w-full" loading={creating} onClick={handleCreate}>
          Create a room
        </Button>
        {createFailed ? (
          <p role="alert" className="mt-2 text-sm text-ink-muted">
            Couldn&rsquo;t reach the room server. Check your connection and try again.
          </p>
        ) : null}
      </Panel>
    </main>
  );
}
