/** Manual inspection always pauses automatic changes. UI labels derive from this state. */
export function createTour(initial: string, order: readonly string[], onChange: () => void, timers = {
  set: (callback: () => void) => setInterval(callback, 9000),
  clear: (timer: ReturnType<typeof setInterval>) => clearInterval(timer),
}) {
  let current = initial;
  let running = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const pause = () => {
    if (timer !== undefined) timers.clear(timer);
    timer = undefined;
    running = false;
    onChange();
  };
  return {
    get current() { return current; },
    get running() { return running; },
    select(id: string) {
      if (!order.includes(id)) return;
      current = id;
      pause();
    },
    pause,
    start() {
      if (running) return;
      running = true;
      timer = timers.set(() => {
        current = order[(order.indexOf(current) + 1) % order.length];
        onChange();
      });
      onChange();
    },
  };
}
