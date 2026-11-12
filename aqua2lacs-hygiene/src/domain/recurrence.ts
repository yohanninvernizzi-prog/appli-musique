import { addDays, daysInMonth, diffDays, fromDay, weekdayOf, WEEKDAY_NAMES } from "./dates";
import type { Recurrence, Settings, Task } from "./types";

/** La récurrence tombe-t-elle ce jour-là ? (sans tenir compte de la tâche ni des fermetures) */
export function isScheduled(rec: Recurrence, day: string): boolean {
  switch (rec.type) {
    case "daily":
      return true;
    case "weekdays":
      return rec.days.includes(weekdayOf(day));
    case "monthly_day": {
      const d = fromDay(day);
      const last = daysInMonth(d.getFullYear(), d.getMonth() + 1);
      return d.getDate() === Math.min(Math.max(rec.day, 1), last);
    }
    case "monthly_nth": {
      if (weekdayOf(day) !== rec.weekday) return false;
      const d = fromDay(day);
      const dom = d.getDate();
      if (rec.nth === -1) return dom + 7 > daysInMonth(d.getFullYear(), d.getMonth() + 1);
      return Math.ceil(dom / 7) === rec.nth;
    }
    case "every_x_days": {
      const n = diffDays(day, rec.startDate);
      return n >= 0 && n % Math.max(1, rec.interval) === 0;
    }
    case "once":
      return day === rec.date;
  }
}

/**
 * Une tâche non faite est-elle reportée les jours suivants ?
 * Oui pour les tâches périodiques ; non pour celles qui reviennent (presque) tous les jours.
 */
export function carriesOver(rec: Recurrence): boolean {
  switch (rec.type) {
    case "daily":
      return false;
    case "weekdays":
      return rec.days.length === 1;
    case "every_x_days":
      return rec.interval >= 2;
    default:
      return true;
  }
}

/** La tâche est-elle prévue ce jour-là (active, bonne période, pas avant sa création) ? */
export function isDue(task: Task, day: string, settings: Pick<Settings, "activePeriod">): boolean {
  if (!task.active) return false;
  if (task.period !== "all" && task.period !== settings.activePeriod) return false;
  if (day < task.createdOn) return false;
  return isScheduled(task.recurrence, day);
}

/** Dernière échéance strictement avant `day`, en remontant au plus `lookback` jours. */
export function previousDue(
  task: Task,
  day: string,
  settings: Pick<Settings, "activePeriod">,
  lookback = 62,
): string | null {
  for (let i = 1; i <= lookback; i++) {
    const d = addDays(day, -i);
    if (d < task.createdOn) return null;
    if (isDue(task, d, settings)) return d;
  }
  return null;
}

/** Libellé lisible d'une récurrence, pour l'admin. */
export function describeRecurrence(rec: Recurrence): string {
  switch (rec.type) {
    case "daily":
      return "Tous les jours";
    case "weekdays":
      if (rec.days.length === 7) return "Tous les jours";
      if (rec.days.length === 1) return `Chaque ${WEEKDAY_NAMES[rec.days[0] - 1].toLowerCase()}`;
      return [...rec.days]
        .sort()
        .map((d) => WEEKDAY_NAMES[d - 1].slice(0, 3))
        .join(", ");
    case "monthly_day":
      return `Le ${rec.day} de chaque mois`;
    case "monthly_nth": {
      const rank = rec.nth === -1 ? "Dernier" : ["1er", "2e", "3e", "4e"][rec.nth - 1];
      return `${rank} ${WEEKDAY_NAMES[rec.weekday - 1].toLowerCase()} du mois`;
    }
    case "every_x_days":
      return `Tous les ${rec.interval} jours`;
    case "once": {
      const [y, m, d] = rec.date.split("-");
      return `Ponctuelle : ${d}/${m}/${y}`;
    }
  }
}
