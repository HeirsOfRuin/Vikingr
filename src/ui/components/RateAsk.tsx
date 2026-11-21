// The rating ask (Game-Workshop game-release references/store-page.md, F39): one line and a link, at the first
// natural stopping point (the first winter in the hall) and at the end (the first death of the saga), each once.
// The markers data-rate="first-stop" / data-rate="end" are what tools/check-store.mjs looks for.
import { FULL_GAME_URL } from '../demo';

const LINES = {
  'first-stop': 'If you are enjoying Vikingr, a rating on itch.io helps other people find it.',
  end: 'If this life stayed with you, a rating on itch.io helps other people find Vikingr.',
  // the end of the free demo (DemoEnd.tsx), where there is no "Not now": it is the last page (Josh, 2026-11-21)
  'demo-end': 'If these two years were worth your time, a rating on itch.io helps other people find Vikingr.',
} as const;

export function RateAsk({ at, onClose }: { at: keyof typeof LINES; onClose?: () => void }) {
  return (
    <p class="card small sans rate-ask" data-rate={at}>
      {LINES[at]} <a href={FULL_GAME_URL} target="_blank" rel="noopener">Rate it on itch.io</a>
      {onClose && <>{' '}<button class="linkbtn" onClick={onClose}>Not now</button></>}
    </p>
  );
}
