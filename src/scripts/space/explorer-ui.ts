import { EXPLORATIONS, clampStop, type ExploreStop, type QualityMode } from './exploration';

export function bindExplorer(root: HTMLElement, handlers: {
  onStop: (stop: ExploreStop) => void;
  onHome: () => void;
  onReset: () => void;
  onZoom: (factor: number) => void;
  onQuality: (quality: QualityMode) => void;
  onMotion: (reduced: boolean) => void;
}, reducedMotion: boolean) {
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const q = <T extends HTMLElement>(id: string) => root.querySelector<T>(id);
  const panel = q<HTMLDetailsElement>('#sp-explorer');
  if (window.matchMedia('(max-width: 640px)').matches && panel) panel.open = false;
  let routeId = 'moon';
  let stopIndex = 0;
  const render = () => {
    const route = EXPLORATIONS[routeId];
    const stop = route.stops[stopIndex];
    const title = q('#sp-guide-title');
    const text = q('#sp-guide-text');
    const source = q<HTMLAnchorElement>('#sp-guide-source');
    const prev = q<HTMLButtonElement>('#sp-guide-prev');
    const next = q<HTMLButtonElement>('#sp-guide-next');
    if (title) title.textContent = `${route.title} · ${stopIndex + 1}/${route.stops.length} · ${stop.title}`;
    if (text) text.textContent = stop.text;
    if (source) source.href = route.source;
    if (prev) prev.disabled = stopIndex === 0;
    if (next) next.disabled = stopIndex === route.stops.length - 1;
    root.querySelectorAll<HTMLButtonElement>('[data-explore]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.explore === routeId)));
  };
  root.querySelectorAll<HTMLButtonElement>('[data-explore]').forEach(button => {
    button.addEventListener('click', () => {
      if (!button.dataset.explore || !EXPLORATIONS[button.dataset.explore]) return;
      routeId = button.dataset.explore;
      stopIndex = 0;
      render();
      handlers.onStop(EXPLORATIONS[routeId].stops[stopIndex]);
    }, options);
  });
  for (const [id, increment] of [['#sp-guide-prev', -1], ['#sp-guide-next', 1]] as const) {
    q(id)?.addEventListener('click', () => {
      const route = EXPLORATIONS[routeId];
      stopIndex = clampStop(stopIndex + increment, route.stops.length);
      render();
      handlers.onStop(route.stops[stopIndex]);
    }, options);
  }
  q('#sp-guide-start')?.addEventListener('click', () => handlers.onStop(EXPLORATIONS[routeId].stops[stopIndex]), options);
  q('#sp-home-earth')?.addEventListener('click', handlers.onHome, options);
  q('#sp-reset-view')?.addEventListener('click', handlers.onReset, options);
  q('#sp-zoom-in')?.addEventListener('click', () => handlers.onZoom(.72), options);
  q('#sp-zoom-out')?.addEventListener('click', () => handlers.onZoom(1.4), options);
  q<HTMLSelectElement>('#sp-quality')?.addEventListener('change', event => handlers.onQuality((event.target as HTMLSelectElement).value as QualityMode), options);
  const motion = q<HTMLInputElement>('#sp-reduced-motion');
  if (motion) {
    motion.checked = reducedMotion;
    motion.addEventListener('change', () => handlers.onMotion(motion.checked), options);
  }
  render();
  return () => abort.abort();
}
