import type { FormEvent } from 'react';
import { packs } from '@pixwagon/packs';
import { PicturePreview } from '../../components/game/PicturePreview.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { NameField } from '../NameField.tsx';

/**
 * What a shared `/r/CODE` link opens on a device that has no saved name
 * (pass 03 `02f`, notes 15 and 27). The link is the front door, so before
 * asking for anything it says what this is: a picture, one line about the
 * game, and the promise that nothing is signed up for.
 */
export function JoinGate({
  code,
  name,
  onNameChange,
  onSubmit,
}: {
  code: string;
  name: string;
  onNameChange: (name: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  // The room's own pack is unknown until the player is in, so the gate shows
  // the first pack's first picture — a real one from pack data, never invented.
  const picture = packs[0]?.pictures[0];

  return (
    <main className="mx-auto flex min-h-app max-w-md flex-col gap-4 bg-bg p-4">
      <p className="pt-1.5 text-center font-mono text-[15px] font-semibold tracking-tight text-ink">
        Pixwagon
      </p>
      {picture ? (
        <div className="grid place-items-center rounded-xl border border-border bg-surface p-5 shadow-sm">
          <PicturePreview
            rows={picture.rows}
            palette={picture.palette}
            cellSize={18}
            label={picture.name}
          />
        </div>
      ) : null}
      <div className="grid gap-2">
        <span className="font-mono text-xs tracking-widest text-ink-muted uppercase">
          Room {code}
        </span>
        <h1 className="text-2xl font-semibold text-ink">Join the game</h1>
        <p className="text-ink-muted">
          A quick picture game for up to six. Each round you all get the same pieces &mdash; place
          yours to fill in your own copy of a pixel picture.
        </p>
      </div>
      <div className="flex-1" />
      <form className="grid gap-3" onSubmit={onSubmit}>
        <NameField value={name} onChange={onNameChange} label="What should the others call you?" />
        <Button type="submit" size="lg">
          Join room
        </Button>
        <p className="text-center text-xs text-ink-muted">
          No sign-up. Your name is only used in this room.
        </p>
      </form>
    </main>
  );
}
