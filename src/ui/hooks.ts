import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
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

export function formatHm(totalMin: number): string {
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** « aujourd'hui à 17:00 », « demain à 12:00 », « lundi à 17:00 ». */
export function formatWhen(ts: number, now: Date = new Date()): string {
  const d = new Date(ts);
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
  const day = days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : DAY_NAMES[d.getDay()];
  return `${day} à ${formatClock(ts)}`;
}

/** Heure courante, rafraîchie régulièrement (pour les affichages qui dépendent de l'heure). */
export function useNow(everyMs = 20_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
