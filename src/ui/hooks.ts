import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { engine } from '../audio/engine';

export function useEngine() {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}

/** Charge des données depuis la base à chaque fois que l'écran reprend le focus. */
export function useLoad<T>(loader: () => Promise<T>, initial: T): [T, () => Promise<void>] {
  const [value, setValue] = useState<T>(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => setValue(await loader()), []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return [value, reload];
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "HH:MM" -> minutes depuis minuit (ou null si invalide). */
export function parseHm(text: string): number | null {
  const m = /^(\d{1,2})[:h](\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

export function formatHm(totalMin: number): string {
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}
