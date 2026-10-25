import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, buttonClasses } from '../../components/ui/Button.tsx';
import { InstallIcon, SeatsIcon, WindowsIcon } from '../../components/ui/icons.tsx';
import { UpdateBannerContent } from '../../pwa/UpdateBannerContent.tsx';

/**
 * The three "you can't be in this room right now" screens (pass 03 `02g1`–`02g3`,
 * notes 14 and 26). One layout — icon, room code, headline, the copy, one
 * button at the bottom — so they read as one family, and none of them says
 * "error": each tells the player what happened and what to do next.
 */

export type CantJoinReason = 'room-full' | 'protocol-version-mismatch' | 'replaced';

function Layout({
  icon,
  code,
  title,
  children,
  footer,
}: {
  icon: ReactNode;
  code: string;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-app max-w-md flex-col bg-bg p-4">
      <div className="flex-1" />
      <div className="grid justify-items-start gap-3">
        <span className="grid size-14 place-items-center rounded-full bg-surface-sunken text-ink-muted">
          {icon}
        </span>
        <span className="font-mono text-xs tracking-widest text-ink-muted uppercase">
          Room {code}
        </span>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {children}
      </div>
      <div className="flex-[1.5]" />
      <div className="grid gap-2 text-center">{footer}</div>
    </main>
  );
}

export function CantJoin({
  code,
  reason,
  onPlayHere,
}: {
  code: string;
  reason: CantJoinReason;
  /** `replaced` only: joining again takes the seat back from the other tab. */
  onPlayHere?: () => void;
}) {
  if (reason === 'room-full') {
    return (
      <Layout
        icon={<SeatsIcon />}
        code={code}
        title="This room is full"
        footer={
          <Link to="/lobby" className={buttonClasses({ size: 'lg', className: 'w-full' })}>
            Back to the lobby
          </Link>
        }
      >
        <p className="text-ink-muted">
          Room is full — six is the most we can tell apart on a board.
        </p>
        <p className="text-sm text-ink-muted">You can start a room of your own from the lobby.</p>
      </Layout>
    );
  }

  if (reason === 'protocol-version-mismatch') {
    return (
      <Layout
        icon={<InstallIcon />}
        code={code}
        title="This room needs an update"
        footer={
          <Link to="/" className={buttonClasses({ size: 'lg', className: 'w-full' })}>
            Back to the start
          </Link>
        }
      >
        {/* No "reload": `registerType: 'prompt'` (vite.config.ts) keeps serving
            the old build after a reload until the update banner is accepted,
            so "reload" would send the player round in a circle (note 26). */}
        <p className="text-ink-muted">
          This room runs a newer version of Pixwagon. Go back to the start and accept the update
          when it&rsquo;s offered.
        </p>
        <div className="grid w-full gap-2 rounded-xl border border-border bg-surface-sunken p-3">
          <span className="text-xs text-ink-muted">On the start screen, look for this:</span>
          {/* A picture of the banner, not the banner: hidden from assistive
              tech and not focusable, so there is nothing here to press. */}
          <div
            aria-hidden
            className="flex items-center gap-3 rounded-xl border border-accent bg-accent/10 px-3 py-2"
          >
            <UpdateBannerContent
              action={<span className={buttonClasses({ size: 'sm' })}>Update</span>}
            />
          </div>
        </div>
      </Layout>
    );
  }

  // D6: this tab lost its seat to another tab (or device) with the same
  // identity. "Play here" simply joins again, which takes the seat back — the
  // other tab then lands on this screen instead.
  return (
    <Layout
      icon={<WindowsIcon />}
      code={code}
      title="Open somewhere else"
      footer={
        <>
          <Button size="lg" className="w-full" onClick={onPlayHere}>
            Play here
          </Button>
          <Link to="/" className="min-h-touch content-center text-accent underline">
            Back to the start
          </Link>
        </>
      }
    >
      <p className="text-ink-muted">
        You opened this room in another tab or window, so it moved there.
      </p>
      <p className="text-sm text-ink-muted">
        Your seat and your board went with it. Nothing is lost either way.
      </p>
    </Layout>
  );
}
