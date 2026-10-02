import { describe, expect, it, vi } from 'vitest';
import { fadeValue, runFade } from './fade';

describe('fadeValue', () => {
  it('interpole linéairement', () => {
    expect(fadeValue(1, 0, 0, 2000)).toBe(1);
    expect(fadeValue(1, 0, 1000, 2000)).toBeCloseTo(0.5);
    expect(fadeValue(1, 0, 2000, 2000)).toBe(0);
    expect(fadeValue(0, 1, 500, 2000)).toBeCloseTo(0.25);
  });
  it('borne entre 0 et 1', () => {
    expect(fadeValue(0.5, 2, 5000, 1000)).toBe(1);
    expect(fadeValue(0.5, -1, 5000, 1000)).toBe(0);
  });
  it('durée nulle : valeur cible immédiate', () => {
    expect(fadeValue(1, 0, 0, 0)).toBe(0);
  });
});

describe('runFade', () => {
  it('atteint la cible et résout', async () => {
    vi.useFakeTimers();
    let t = 0;
    const seen: number[] = [];
    const { done } = runFade({ from: 1, to: 0, durationMs: 200, stepMs: 50, now: () => t, setVolume: (v) => seen.push(v) });
    for (let i = 0; i < 5; i++) {
      t += 50;
      vi.advanceTimersByTime(50);
    }
    await done;
    expect(seen[0]).toBe(1);
    expect(seen[seen.length - 1]).toBe(0);
    vi.useRealTimers();
  });
  it('durée 0 : applique la cible tout de suite', async () => {
    const seen: number[] = [];
    await runFade({ from: 0, to: 1, durationMs: 0, setVolume: (v) => seen.push(v) }).done;
    expect(seen).toEqual([1]);
  });
  it('cancel résout sans atteindre la cible', async () => {
    vi.useFakeTimers();
    const seen: number[] = [];
    const f = runFade({ from: 1, to: 0, durationMs: 1000, setVolume: (v) => seen.push(v) });
    f.cancel();
    await f.done;
    expect(seen).toEqual([1]);
    vi.useRealTimers();
  });
});
