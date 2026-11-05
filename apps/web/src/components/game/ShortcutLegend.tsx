/** The mouse and keyboard bindings (BRIEF-04 gesture table), shown at the
 *  foot of the wide layout's side panel on devices with a fine pointer. */
export function ShortcutLegend() {
  const rows: [string, string][] = [
    ['Click / drag', 'pick up and drop'],
    ['Right-click · R · wheel', 'turn'],
    ['Shift + right-click · F', 'flip'],
    ['Backspace', 'undo'],
    ['Enter · double-click', 'place'],
    ['Esc', 'put everything back'],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-ink-muted">
      {rows.map(([keys, what]) => (
        <div key={keys} className="contents">
          <dt className="font-mono text-ink">{keys}</dt>
          <dd>{what}</dd>
        </div>
      ))}
    </dl>
  );
}
