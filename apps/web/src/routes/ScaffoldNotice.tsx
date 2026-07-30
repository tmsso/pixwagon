export interface ScaffoldNoticeProps {
  phase: string;
}

/**
 * Marks a screen as a Phase 0 placeholder, in the UI rather than only in a
 * comment. A scaffold that looks finished is worse than one that says so.
 */
export function ScaffoldNotice({ phase }: ScaffoldNoticeProps) {
  return (
    <p className="mt-6 rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-ink-muted">
      Placeholder screen — built in {phase}. See <span className="font-mono">ROADMAP.md</span>.
    </p>
  );
}
