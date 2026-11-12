import type { Weekday } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Jour local au format AAAA-MM-JJ. */
export function toDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toDay(new Date());
}

/** Convertit un jour AAAA-MM-JJ en Date locale (midi, pour éviter les effets de changement d'heure). */
export function fromDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(day: string, n: number): string {
  const d = fromDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromDay(a).getTime() - fromDay(b).getTime()) / 86_400_000);
}

export function weekdayOf(day: string): Weekday {
  const js = fromDay(day).getDay(); // 0 = dimanche
  return (js === 0 ? 7 : js) as Weekday;
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

export const WEEKDAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function formatDayLong(day: string): string {
  return fromDay(day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function formatDayShort(day: string): string {
  return fromDay(day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function formatDayNumeric(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}h${pad(d.getMinutes())}`;
}
