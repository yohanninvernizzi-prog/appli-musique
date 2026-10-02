/** Volume à l'instant `elapsedMs` d'un fondu linéaire de `from` vers `to`. */
export function fadeValue(from: number, to: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return clamp01(to);
  if (elapsedMs <= 0) return clamp01(from);
  return clamp01(from + (to - from) * (elapsedMs / durationMs));
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Exécute un fondu en appelant `setVolume` à intervalles réguliers.
 * Résout quand le fondu est terminé ; `cancel` l'arrête sans atteindre la cible.
 */
export function runFade(opts: {
  from: number;
  to: number;
  durationMs: number;
  setVolume: (v: number) => void;
  stepMs?: number;
  now?: () => number;
}): { done: Promise<void>; cancel: () => void } {
  const { from, to, durationMs, setVolume } = opts;
  const stepMs = opts.stepMs ?? 50;
  const now = opts.now ?? Date.now;
  let timer: ReturnType<typeof setInterval> | null = null;
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  if (durationMs <= 0) {
    setVolume(clamp01(to));
    finish();
    return { done, cancel: () => {} };
  }

  const start = now();
  setVolume(clamp01(from));
  timer = setInterval(() => {
    const elapsed = now() - start;
    setVolume(fadeValue(from, to, elapsed, durationMs));
    if (elapsed >= durationMs) {
      stop();
      finish();
    }
  }, stepMs);

  return {
    done,
    cancel: () => {
      stop();
      finish();
    },
  };
}
