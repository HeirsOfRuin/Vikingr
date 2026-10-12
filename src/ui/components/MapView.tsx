import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContentBundle } from '../../content/schema';
import type { GameState } from '../../engine/state';
import { lonLatToTile, type MapData } from '../../engine/mapgrid';
import { routes } from '../../engine/voyage';
import { formatDate } from '../../engine/calendar';
import { tierAt, TIER_NAMES, TIER_HINTS, type Tier } from '../../engine/standing';

const TIER_STROKE: Record<Tier, string> = { hostile: '#b3352a', unfriendly: '#c8913a', wary: '#6f8792', friendly: '#8a9860', allied: '#c7d3a0' };
import { PX, worldCanvas } from '../worldart';

interface Props {
  content: ContentBundle;
  map: MapData;
  state: GameState;
  mini?: boolean;
}

/** Where the fleet is, in tile coordinates (between two places while at sea). */
function fleetAt(state: GameState, content: ContentBundle): [number, number] {
  const p = (id: string) => {
    const pl = content.places[id]!;
    return lonLatToTile(pl.lon, pl.lat);
  };
  if (state.at) return p(state.at);
  const v = state.voyage;
  if (!v) return p('home_fjord');
  const a = p(v.from);
  const b = p(v.to);
  const f = Math.min(1, v.progress / v.total);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export function MapView({ content, map, state, mini }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 300 });
  const [zoom, setZoom] = useState(mini ? 3 : 2.2);
  const [center, setCenter] = useState<[number, number]>(() => fleetAt(state, content));
  const [picked, setPicked] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; c: [number, number]; moved: boolean } | null>(null);

  useEffect(() => {
    const c = worldCanvas(map);
    if (host.current && !host.current.contains(c)) host.current.prepend(c);
  }, [map]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setCenter(fleetAt(state, content)), [state.at, state.voyage?.progress]);

  const fit = size.w / (map.cols * PX);
  const scale = fit * zoom;
  const tx = size.w / 2 - center[0] * PX * scale;
  const ty = size.h / 2 - center[1] * PX * scale;
  const label = 11 / scale; // canvas pixels, so labels stay ~11px on screen

  const known = new Set(state.known);
  const places = Object.values(content.places).filter((p) => known.has(p.id));
  const legs = content.legs.filter((l) => known.has(l.a) && known.has(l.b));
  const fleet = fleetAt(state, content);
  const reachable = state.at ? routes(state, content, state.at).map((r) => r.to) : [];
  const visits = (id: string) => state.journal.filter((j) => j.text.includes(content.places[id]!.name)).map((j) => formatDate(j.day));

  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, c: center, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    setCenter([d.c[0] - dx / (PX * scale), d.c[1] - dy / (PX * scale)]);
  };
  const onUp = () => { drag.current = null; };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(1, Math.min(8, z * (e.deltaY < 0 ? 1.2 : 1 / 1.2))));
  };

  const pickedPlace = picked ? content.places[picked] : null;
  return (
    <div>
      <div class={`mapbox${mini ? ' mini' : ''}`} ref={box} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        <div class="mapinner" style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
          <div ref={host} />
          <svg width={map.cols * PX} height={map.rows * PX}>
            {legs.map((l) => {
              const a = content.places[l.a]!, b = content.places[l.b]!;
              const [x1, y1] = lonLatToTile(a.lon, a.lat), [x2, y2] = lonLatToTile(b.lon, b.lat);
              return <line key={l.a + l.b} x1={x1 * PX} y1={y1 * PX} x2={x2 * PX} y2={y2 * PX} stroke="#b5ac97" stroke-opacity="0.5" stroke-width={1.2 / scale} stroke-dasharray={`${4 / scale} ${4 / scale}`} />;
            })}
            {places.map((p) => {
              const [x, y] = lonLatToTile(p.lon, p.lat);
              const here = state.at === p.id;
              const r = (here ? 5 : 3.5) / scale;
              const fill = p.kind === 'monastery' ? '#b3352a' : p.kind === 'home' ? '#8a9860' : '#e6ddc8';
              return (
                <g key={p.id} onClick={() => !drag.current?.moved && setPicked(p.id)} style={{ cursor: 'pointer' }}>
                  <circle cx={x * PX} cy={y * PX} r={r * 2.5} fill="transparent" />
                  <circle cx={x * PX} cy={y * PX} r={r} fill={fill} stroke={p.active && p.kind !== 'home' ? TIER_STROKE[tierAt(state, content, p.id)] : '#111213'} stroke-width={(p.active && p.kind !== 'home' ? 2.2 : 1) / scale} opacity={p.active ? 1 : 0.5} />
                  {reachable.includes(p.id) && <circle cx={x * PX} cy={y * PX} r={r * 1.9} fill="none" stroke="#c8913a" stroke-width={1 / scale} />}
                  <text x={x * PX + r * 1.6} y={y * PX + label * 0.35} font-size={label} fill="#e6ddc8" stroke="#111213" stroke-width={label * 0.25} paint-order="stroke" font-family="Georgia, serif">{p.name}</text>
                </g>
              );
            })}
            <path d={`M ${fleet[0] * PX - 6 / scale} ${fleet[1] * PX + 3 / scale} h ${12 / scale} l ${-2 / scale} ${3 / scale} h ${-8 / scale} z M ${fleet[0] * PX} ${fleet[1] * PX + 3 / scale} v ${-9 / scale} l ${5 / scale} ${6 / scale} h ${-5 / scale}`} fill="#b3352a" stroke="#e6ddc8" stroke-width={0.8 / scale} />
          </svg>
        </div>
        <div class="mapzoom">
          <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(8, z * 1.4))}>+</button>
          <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z / 1.4))}>−</button>
          <button aria-label="Centre on your ships" onClick={() => setCenter(fleetAt(state, content))}>⌖</button>
        </div>
      </div>
      {!mini && (
        <div class="placeinfo card">
          {pickedPlace ? (
            <>
              <h2>{pickedPlace.name}</h2>
              <p class="muted small sans">{pickedPlace.region}{pickedPlace.raid ? ' · a place to raid' : ''}{pickedPlace.market ? ' · a market' : ''}</p>
              <p>{pickedPlace.desc}</p>
              {pickedPlace.active && pickedPlace.kind !== 'home' && <p class="small sans"><span class={`pill standing-${tierAt(state, content, pickedPlace.id)}`}>{TIER_NAMES[tierAt(state, content, pickedPlace.id)]}</span> {TIER_HINTS[tierAt(state, content, pickedPlace.id)]}</p>}
              {!pickedPlace.active && <p class="muted small sans">Beyond your reach for now. (Later phases.)</p>}
              {visits(pickedPlace.id).length > 0 && <p class="muted small sans">You were here: {visits(pickedPlace.id).join(', ')}</p>}
            </>
          ) : (
            <p class="muted small sans">Tap a place for its story. Drag to move, + and − to zoom. Places you have not heard of are not on your map.</p>
          )}
        </div>
      )}
    </div>
  );
}
