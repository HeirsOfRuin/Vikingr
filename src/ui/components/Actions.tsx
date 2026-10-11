import type { ActionOption, Action } from '../../engine/index';

const BANDS: Record<string, string> = { Risky: 'risky', Even: 'even', Favourable: 'favourable' };

/** A list of action buttons, grouped. A disabled action says why. */
export function Actions({ options, onAct, danger }: { options: ActionOption[]; onAct: (a: Action) => void; danger?: (a: Action) => boolean }) {
  const groups: string[] = [];
  for (const o of options) if (!groups.includes(o.group)) groups.push(o.group);
  return (
    <div>
      {groups.map((g) => (
        <div key={g} class="group">
          {g && <h3>{g}</h3>}
          <div class="choices">
            {options.filter((o) => o.group === g).map((o) => {
              const band = o.hint && BANDS[o.hint];
              const lethal = danger?.(o.action);
              return (
                <button key={JSON.stringify(o.action)} class={`choice${lethal ? ' danger' : ''}`} disabled={!o.enabled} onClick={() => onAct(o.action)}>
                  {o.label}
                  {lethal && <span class="tag lethal">Lethal</span>}
                  {band && <span class={`tag ${band}`}>{o.hint}</span>}
                  {o.hint && !band && <span class="hint">{o.hint}</span>}
                  {!o.enabled && o.reason && <span class="reason">{o.reason}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Bar({ value, max, kind = '' }: { value: number; max: number; kind?: string }) {
  const pct = Math.max(0, Math.min(100, (100 * value) / Math.max(1, max)));
  return <div class={`bar ${kind}`}><i style={{ width: `${pct}%` }} /></div>;
}
