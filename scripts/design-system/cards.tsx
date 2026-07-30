/**
 * The card registry — the design system as Claude Design will see it.
 *
 * Each entry becomes one standalone preview HTML under `design-system/`, carrying
 * a `@dsCard` marker that Design reads to build its Design System pane.
 *
 * The rule that shapes every card here: Design's own self-check counts previews
 * that render blank, render thin, or whose variants are byte-identical. A card
 * showing one grey rectangle passes silently and teaches Design nothing. So each
 * card must show variants that genuinely differ — states, sizes, tones.
 */

import type { ReactNode } from 'react';
import { BoardCell } from '../../apps/web/src/components/game/BoardCell.tsx';
import { DiceFace } from '../../apps/web/src/components/game/DiceFace.tsx';
import { HudFrame } from '../../apps/web/src/components/game/HudFrame.tsx';
import { PackCard } from '../../apps/web/src/components/game/PackCard.tsx';
import { PicturePreview } from '../../apps/web/src/components/game/PicturePreview.tsx';
import { PlayerChip } from '../../apps/web/src/components/game/PlayerChip.tsx';
import { RollControl } from '../../apps/web/src/components/game/RollControl.tsx';
import { Button } from '../../apps/web/src/components/ui/Button.tsx';
import { Dialog } from '../../apps/web/src/components/ui/Dialog.tsx';
import { IconButton } from '../../apps/web/src/components/ui/IconButton.tsx';
import { Panel } from '../../apps/web/src/components/ui/Panel.tsx';
import { RoomCodeInput } from '../../apps/web/src/components/ui/RoomCodeInput.tsx';
import { patternStyle } from '../../apps/web/src/design/patterns.ts';
import {
  fontSize,
  fontWeight,
  palette,
  playerColors,
  radius,
  semanticDark,
  semanticLight,
  spacing,
} from '../../apps/web/src/design/tokens.ts';
import { transportation } from '../../packages/packs/src/index.ts';

export interface Card {
  /** Path inside the design-system project. */
  path: string;
  name: string;
  group: string;
  subtitle: string;
  viewport: { width: number; height?: number };
  render: () => ReactNode;
}

/**
 * Wraps one variant with a label and a `data-variant` marker. The marker is what
 * lets the render check tell "six genuinely different states" from "the same box
 * six times" without needing a browser.
 */
function Variant({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div data-variant={label} className="flex flex-col items-start gap-2">
      <span className="font-mono text-xs text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-5">{children}</div>;
}

const picture = transportation.pictures[0]!;
const balloon = transportation.pictures[2]!;

export const cards: Card[] = [
  // -------------------------------------------------------------------------
  // Foundations
  // -------------------------------------------------------------------------
  {
    path: 'foundations/colors/index.html',
    name: 'Colours',
    group: 'Colors',
    subtitle: 'Semantic tokens, light and dark, plus the raw ramp',
    viewport: { width: 900, height: 700 },
    render: () => (
      <div className="flex flex-col gap-8">
        {(
          [
            ['Light', semanticLight],
            ['Dark', semanticDark],
          ] as const
        ).map(([label, set]) => (
          <Variant key={label} label={`semantic / ${label.toLowerCase()}`}>
            <div className="flex flex-wrap gap-3">
              {Object.entries(set).map(([name, hex]) => (
                <div key={name} className="w-32">
                  <div
                    className="h-12 rounded-md border border-black/10"
                    style={{ background: hex }}
                  />
                  <div className="mt-1 font-mono text-[11px] text-ink">{name}</div>
                  <div className="font-mono text-[11px] text-ink-muted">{hex}</div>
                </div>
              ))}
            </div>
          </Variant>
        ))}

        <Variant label="palette ramp">
          <div className="flex flex-wrap gap-2">
            {Object.entries(palette).map(([name, hex]) => (
              <div key={name} className="w-24">
                <div
                  className="h-10 rounded border border-black/10"
                  style={{ background: hex }}
                />
                <div className="mt-1 font-mono text-[10px] text-ink-muted">{name}</div>
              </div>
            ))}
          </div>
        </Variant>
      </div>
    ),
  },

  {
    path: 'foundations/player-colors/index.html',
    name: 'Player colours',
    group: 'Colors',
    subtitle: 'Okabe-Ito derived, each paired with a hatch pattern',
    viewport: { width: 900, height: 420 },
    render: () => (
      <div className="flex flex-col gap-6">
        <p className="max-w-2xl text-sm text-ink-muted">
          Chosen to stay distinguishable under protanopia, deuteranopia and tritanopia. Every
          player also carries a hatch pattern, so colour is never the sole signal — two players
          stay tellable apart in greyscale, in a screenshot, or to a viewer who sees no hue
          difference at all. Designs must preserve the pattern, not just the colour.
        </p>
        <Variant label="swatch + hatch">
          <Row>
            {playerColors.map((player, index) => (
              <div key={player.name} className="w-28">
                <div
                  className="h-16 rounded-lg border border-black/10"
                  style={patternStyle(player.pattern, player.hex)}
                />
                <div className="mt-1 text-xs font-medium text-ink">{player.name}</div>
                <div className="font-mono text-[11px] text-ink-muted">{player.hex}</div>
                <div className="font-mono text-[11px] text-ink-muted">{player.pattern}</div>
                <div className="font-mono text-[11px] text-ink-muted">seat {index}</div>
              </div>
            ))}
          </Row>
        </Variant>
        <Variant label="as filled board cells">
          <Row>
            {playerColors.map((_, index) => (
              <BoardCell key={index} state="filled" colorIndex={index} size={40} />
            ))}
          </Row>
        </Variant>
      </div>
    ),
  },

  {
    path: 'foundations/type/index.html',
    name: 'Type',
    group: 'Type',
    subtitle: 'Scale and weights, sans and mono',
    viewport: { width: 900, height: 640 },
    render: () => (
      <div className="flex flex-col gap-6">
        <Variant label="scale">
          <div className="flex flex-col gap-2">
            {Object.entries(fontSize).map(([name, size]) => (
              <div key={name} className="flex items-baseline gap-4">
                <span className="w-20 font-mono text-xs text-ink-muted">{name}</span>
                <span className="w-20 font-mono text-xs text-ink-muted">{size}</span>
                <span className="text-ink" style={{ fontSize: size }}>
                  Roll and fill
                </span>
              </div>
            ))}
          </div>
        </Variant>

        <Variant label="weights">
          <div className="flex flex-col gap-1">
            {Object.entries(fontWeight).map(([name, weight]) => (
              <div key={name} className="flex items-baseline gap-4">
                <span className="w-24 font-mono text-xs text-ink-muted">{name}</span>
                <span className="text-lg text-ink" style={{ fontWeight: weight }}>
                  Pixwagon
                </span>
              </div>
            ))}
          </div>
        </Variant>

        <Variant label="mono — codes, dice, scores">
          <div className="font-mono text-2xl tracking-widest text-ink">PIXW · 4 2 6 · 38</div>
        </Variant>
      </div>
    ),
  },

  {
    path: 'foundations/spacing/index.html',
    name: 'Spacing & radius',
    group: 'Spacing',
    subtitle: '4px base step, radius scale, minimum touch target',
    viewport: { width: 900, height: 560 },
    render: () => (
      <div className="flex flex-col gap-6">
        <Variant label="spacing scale">
          <div className="flex flex-col gap-1">
            {Object.entries(spacing).map(([name, value]) => (
              <div key={name} className="flex items-center gap-4">
                <span className="w-10 font-mono text-xs text-ink-muted">{name}</span>
                <span className="w-20 font-mono text-xs text-ink-muted">{value}</span>
                <span className="h-4 bg-accent" style={{ width: value }} />
              </div>
            ))}
          </div>
        </Variant>

        <Variant label="radius scale">
          <Row>
            {Object.entries(radius).map(([name, value]) => (
              <div key={name} className="text-center">
                <div
                  className="size-16 border-2 border-accent bg-surface-sunken"
                  style={{ borderRadius: value }}
                />
                <div className="mt-1 font-mono text-xs text-ink-muted">{name}</div>
              </div>
            ))}
          </Row>
        </Variant>

        <Variant label="minimum touch target">
          <div className="flex items-center gap-3">
            <div className="size-touch rounded-lg border-2 border-dashed border-accent" />
            <span className="text-sm text-ink-muted">
              2.75rem — every interactive control must meet this. Phone-first, one-handed reach.
            </span>
          </div>
        </Variant>
      </div>
    ),
  },

  // -------------------------------------------------------------------------
  // Components
  // -------------------------------------------------------------------------
  {
    path: 'components/button/index.html',
    name: 'Button',
    group: 'Components',
    subtitle: '4 variants × 3 sizes, plus disabled and loading',
    viewport: { width: 900, height: 460 },
    render: () => (
      <div className="flex flex-col gap-6">
        {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
          <Variant key={variant} label={variant}>
            <Row>
              <Button variant={variant} size="sm">
                Small
              </Button>
              <Button variant={variant} size="md">
                Medium
              </Button>
              <Button variant={variant} size="lg">
                Large
              </Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
              <Button variant={variant} loading>
                Loading
              </Button>
            </Row>
          </Variant>
        ))}
      </div>
    ),
  },

  {
    path: 'components/icon-button/index.html',
    name: 'IconButton',
    group: 'Components',
    subtitle: 'Solid and ghost; an accessible label is required',
    viewport: { width: 700, height: 260 },
    render: () => (
      <div className="flex flex-col gap-6">
        <Variant label="ghost">
          <Row>
            <IconButton label="Settings">⚙</IconButton>
            <IconButton label="Sound">♪</IconButton>
            <IconButton label="Close">✕</IconButton>
            <IconButton label="Disabled" disabled>
              ⚙
            </IconButton>
          </Row>
        </Variant>
        <Variant label="solid">
          <Row>
            <IconButton label="Roll" variant="solid">
              ⚂
            </IconButton>
            <IconButton label="Confirm" variant="solid">
              ✓
            </IconButton>
          </Row>
        </Variant>
      </div>
    ),
  },

  {
    path: 'components/panel/index.html',
    name: 'Panel',
    group: 'Components',
    subtitle: 'Raised and sunken tones, optional title and footer',
    viewport: { width: 800, height: 420 },
    render: () => (
      <div className="flex flex-col gap-6">
        <Variant label="raised, titled">
          <div className="w-80">
            <Panel title="Scores">
              <div className="flex flex-col gap-2">
                <PlayerChip name="Tamas" colorIndex={0} score={38} />
                <PlayerChip name="Guest" colorIndex={1} score={31} />
              </div>
            </Panel>
          </div>
        </Variant>
        <Variant label="sunken, with footer">
          <div className="w-80">
            <Panel
              title="Room"
              tone="sunken"
              footer={
                <Button size="sm" variant="secondary">
                  Copy link
                </Button>
              }
            >
              <p className="text-sm">Share the code with your friends to let them join.</p>
            </Panel>
          </div>
        </Variant>
      </div>
    ),
  },

  {
    path: 'components/dialog/index.html',
    name: 'Dialog',
    group: 'Components',
    subtitle: 'Confirmation surface over a scrim',
    viewport: { width: 700, height: 420 },
    render: () => (
      <Variant label="confirm">
        <div className="w-full">
          <Dialog
            title="Leave this room?"
            description="Your board will not be saved."
            footer={
              <>
                <Button variant="ghost">Stay</Button>
                <Button variant="danger">Leave</Button>
              </>
            }
          />
        </div>
      </Variant>
    ),
  },

  {
    path: 'components/room-code-input/index.html',
    name: 'RoomCodeInput',
    group: 'Components',
    subtitle: 'Empty, partial, complete and invalid',
    viewport: { width: 700, height: 340 },
    render: () => (
      <div className="flex flex-col gap-6">
        <Variant label="empty">
          <RoomCodeInput value="" />
        </Variant>
        <Variant label="partial">
          <RoomCodeInput value="PI" />
        </Variant>
        <Variant label="complete">
          <RoomCodeInput value="PIXW" />
        </Variant>
        <Variant label="invalid">
          <RoomCodeInput value="ZZZZ" invalid />
        </Variant>
      </div>
    ),
  },

  {
    path: 'components/player-chip/index.html',
    name: 'PlayerChip',
    group: 'Components',
    subtitle: 'Active, idle, away, scored — across all six seats',
    viewport: { width: 800, height: 380 },
    render: () => (
      <div className="flex flex-col gap-6">
        <Variant label="states">
          <Row>
            <PlayerChip name="Active" colorIndex={0} active />
            <PlayerChip name="Idle" colorIndex={1} />
            <PlayerChip name="Away" colorIndex={2} connected={false} />
            <PlayerChip name="Scored" colorIndex={3} score={38} />
          </Row>
        </Variant>
        <Variant label="all seats">
          <Row>
            {playerColors.map((player, index) => (
              <PlayerChip key={player.name} name={player.name} colorIndex={index} score={index * 7} />
            ))}
          </Row>
        </Variant>
      </div>
    ),
  },

  {
    path: 'components/dice-face/index.html',
    name: 'DiceFace',
    group: 'Components',
    subtitle: 'Faces 1-6, three sizes, rolling state',
    viewport: { width: 800, height: 340 },
    render: () => (
      <div className="flex flex-col gap-6">
        <Variant label="faces">
          <Row>
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <DiceFace key={value} value={value} />
            ))}
          </Row>
        </Variant>
        <Variant label="sizes">
          <Row>
            <DiceFace value={5} size="sm" />
            <DiceFace value={5} size="md" />
            <DiceFace value={5} size="lg" />
          </Row>
        </Variant>
        <Variant label="rolling and non-d6">
          <Row>
            <DiceFace value={3} rolling />
            <DiceFace value={11} sides={12} />
          </Row>
        </Variant>
      </div>
    ),
  },

  {
    path: 'components/board-cell/index.html',
    name: 'BoardCell',
    group: 'Board',
    subtitle: 'Every cell state the board can show',
    viewport: { width: 800, height: 320 },
    render: () => (
      <div className="flex flex-col gap-6">
        <Variant label="states">
          <Row>
            {(['blank', 'fillable', 'candidate', 'filled', 'locked', 'invalid'] as const).map(
              (state) => (
                <div key={state} className="text-center">
                  <BoardCell state={state} size={44} />
                  <div className="mt-1 font-mono text-[11px] text-ink-muted">{state}</div>
                </div>
              ),
            )}
          </Row>
        </Variant>
        <Variant label="filled, by seat">
          <Row>
            {playerColors.map((_, index) => (
              <BoardCell key={index} state="filled" colorIndex={index} size={32} />
            ))}
          </Row>
        </Variant>
      </div>
    ),
  },

  {
    path: 'components/board-canvas/index.html',
    name: 'BoardCanvas',
    group: 'Board',
    subtitle: 'Static stand-in — the real board is a Canvas',
    viewport: { width: 800, height: 460 },
    render: () => (
      <div className="flex flex-col gap-4">
        <p className="max-w-2xl text-sm text-ink-muted">
          The board renders on a Canvas for crisp integer-scaled pixels and so a large grid is one
          redraw rather than a thousand DOM updates. A canvas cannot be captured in a static
          preview, so this card shows the equivalent built from BoardCell — the states and
          geometry are the contract; the paint surface is an implementation detail.
        </p>
        <Variant label="in progress">
          <div className="inline-block rounded-lg border border-border bg-surface p-2">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 22px)', gap: 1 }}>
              {picture.rows.flatMap((row, y) =>
                Array.from(row).map((char, x) => {
                  const blank = char === '.';
                  const filled = !blank && (x + y) % 3 === 0;
                  return (
                    <BoardCell
                      key={`${x}-${y}`}
                      state={blank ? 'blank' : filled ? 'filled' : 'fillable'}
                      colorIndex={(x + y) % 3}
                      size={22}
                    />
                  );
                }),
              )}
            </div>
          </div>
        </Variant>
      </div>
    ),
  },

  {
    path: 'components/roll-control/index.html',
    name: 'RollControl',
    group: 'Components',
    subtitle: 'Idle, rolling, and awaiting the referee',
    viewport: { width: 800, height: 620 },
    render: () => {
      const dice = [
        { sides: 6, value: 4 },
        { sides: 6, value: 2 },
      ];
      const options = [
        { id: 'a', label: 'Fill', cells: 4 },
        { id: 'b', label: 'Fill', cells: 2 },
        { id: 'c', label: 'Sum', cells: 6 },
      ];
      return (
        <div className="flex flex-col gap-6">
          <Variant label="ready, option selected">
            <div className="w-96">
              <RollControl dice={dice} options={options} selectedOptionId="a" />
            </div>
          </Variant>
          <Variant label="rolling">
            <div className="w-96">
              <RollControl dice={dice} options={options} rolling />
            </div>
          </Variant>
          <Variant label="awaiting server truth">
            <div className="w-96">
              <RollControl
                dice={dice}
                options={options}
                selectedOptionId="c"
                awaitingServer
              />
            </div>
          </Variant>
        </div>
      );
    },
  },

  {
    path: 'components/picture-preview/index.html',
    name: 'PicturePreview',
    group: 'Board',
    subtitle: 'Target and outline modes, from real pack data',
    viewport: { width: 800, height: 420 },
    render: () => (
      <div className="flex flex-col gap-6">
        <Variant label="target">
          <Row>
            {transportation.pictures.map((p) => (
              <figure key={p.id} className="text-center">
                <PicturePreview rows={p.rows} palette={p.palette} cellSize={12} label={p.name} />
                <figcaption className="mt-1 text-xs text-ink-muted">{p.name}</figcaption>
              </figure>
            ))}
          </Row>
        </Variant>
        <Variant label="outline — what the player starts from">
          <PicturePreview
            rows={balloon.rows}
            palette={balloon.palette}
            cellSize={12}
            mode="outline"
            label={balloon.name}
          />
        </Variant>
      </div>
    ),
  },

  {
    path: 'components/pack-card/index.html',
    name: 'PackCard',
    group: 'Components',
    subtitle: 'Selected and unselected, with a thumbnail',
    viewport: { width: 700, height: 340 },
    render: () => (
      <div className="flex w-[28rem] flex-col gap-4">
        <Variant label="selected">
          <PackCard
            name={transportation.name}
            description={transportation.description}
            pictureCount={transportation.pictures.length}
            difficulty="easy"
            selected
            preview={{ rows: picture.rows, palette: picture.palette }}
          />
        </Variant>
        <Variant label="unselected">
          <PackCard
            name="Garden"
            description="A later pack, to prove the seam."
            pictureCount={8}
            difficulty="medium"
            preview={{ rows: balloon.rows, palette: balloon.palette }}
          />
        </Variant>
      </div>
    ),
  },

  {
    path: 'components/hud-frame/index.html',
    name: 'HudFrame',
    group: 'Components',
    subtitle: 'In-game chrome: status, board, thumb-reach controls',
    viewport: { width: 480, height: 800 },
    render: () => (
      <Variant label="in a room">
        <div className="w-[26rem] overflow-hidden rounded-xl border border-border">
          <HudFrame
            roomCode="PIXW"
            round={3}
            connection="connecting"
            players={
              <>
                <PlayerChip name="Tamas" colorIndex={0} score={12} active />
                <PlayerChip name="Guest" colorIndex={1} score={9} />
              </>
            }
            controls={
              <RollControl
                dice={[
                  { sides: 6, value: 6 },
                  { sides: 6, value: 1 },
                ]}
                options={[{ id: 'a', label: 'Fill', cells: 6 }]}
                selectedOptionId="a"
              />
            }
          >
            <PicturePreview
              rows={picture.rows}
              palette={picture.palette}
              cellSize={16}
              mode="outline"
              label={picture.name}
            />
          </HudFrame>
        </div>
      </Variant>
    ),
  },
];
