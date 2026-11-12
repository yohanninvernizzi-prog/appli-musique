import { addDays } from "./dates";
import { carriesOver, isDue, previousDue } from "./recurrence";
import type { AppData, Completion, Moment, Task, Zone } from "./types";

export interface ChecklistItem {
  task: Task;
  zone: Zone | undefined;
  moment: Moment | undefined;
  /** Jour où la tâche était prévue (antérieur au jour affiché si elle est en retard). */
  dueDate: string;
  late: boolean;
  bonus: boolean;
  /** Une case par passage attendu : la validation, ou null si pas encore fait. */
  passes: (Completion | null)[];
  doneCount: number;
  complete: boolean;
  /** Dernier « non fait » déclaré le jour affiché, s'il y en a un. */
  notDone: Completion | null;
  cancelled: boolean;
}

function occurrenceCompletions(data: AppData, taskId: string, dueDate: string): Completion[] {
  return data.completions.filter((c) => c.taskId === taskId && c.dueDate === dueDate);
}

function buildItem(data: AppData, task: Task, dueDate: string, day: string): ChecklistItem {
  const comps = occurrenceCompletions(data, task.id, dueDate);
  const passCount = Math.max(1, task.passes);
  const passes: (Completion | null)[] = Array.from({ length: passCount }, () => null);
  let notDone: Completion | null = null;
  let cancelled = false;
  for (const c of comps) {
    if (c.status === "done" && c.passIndex < passCount) passes[c.passIndex] = c;
    else if (c.status === "cancelled") cancelled = true;
    else if (c.status === "not_done" && c.doneDate === day && (!notDone || c.at > notDone.at)) notDone = c;
  }
  const moment = data.moments.find((m) => m.id === task.momentId);
  const doneCount = passes.filter(Boolean).length;
  return {
    task,
    zone: data.zones.find((z) => z.id === task.zoneId),
    moment,
    dueDate,
    late: dueDate < day,
    bonus: moment?.bonus ?? false,
    passes,
    doneCount,
    complete: doneCount >= passCount,
    notDone,
    cancelled,
  };
}

export function isClosed(data: AppData, day: string): boolean {
  return data.settings.closedDays.includes(day);
}

/**
 * Checklist d'un jour : les tâches prévues ce jour-là, plus les tâches périodiques
 * dont la dernière échéance n'a pas été réalisée (affichées « en retard »).
 */
export function buildChecklist(data: AppData, day: string): ChecklistItem[] {
  if (isClosed(data, day)) return [];
  const items: ChecklistItem[] = [];
  for (const task of data.tasks) {
    if (isDue(task, day, data.settings)) {
      const item = buildItem(data, task, day, day);
      if (!item.cancelled) items.push(item);
      continue;
    }
    if (!task.active || !carriesOver(task.recurrence)) continue;
    const prev = previousDue(task, day, data.settings);
    if (!prev) continue;
    const item = buildItem(data, task, prev, day);
    if (item.bonus || item.cancelled) continue;
    // En retard tant que ce n'est pas fait ; reste visible le jour du rattrapage.
    const caughtUpToday = item.passes.some((p) => p && p.doneDate === day);
    const caughtUpBefore = item.complete && !caughtUpToday;
    if (!caughtUpBefore) items.push(item);
  }
  const mo = (i: ChecklistItem) => i.moment?.order ?? 999;
  const zo = (i: ChecklistItem) => i.zone?.order ?? 999;
  return items.sort((a, b) => mo(a) - mo(b) || zo(a) - zo(b) || a.task.order - b.task.order);
}

export interface Progress {
  done: number;
  total: number;
  ratio: number;
}

/** Progression de la journée, en passages, hors tâches bonus. */
export function progressOf(items: ChecklistItem[]): Progress {
  let done = 0;
  let total = 0;
  for (const i of items) {
    if (i.bonus) continue;
    total += i.passes.length;
    done += i.doneCount;
  }
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

/** Nombre de jours ouverts consécutifs entièrement réalisés, en remontant depuis la veille de `day`. */
export function teamStreak(data: AppData, day: string, maxDays = 60): number {
  let streak = 0;
  for (let i = 1; i <= maxDays; i++) {
    const d = addDays(day, -i);
    if (isClosed(data, d)) continue;
    const items = buildChecklist(data, d).filter((x) => !x.bonus && !x.late);
    if (items.length === 0) break;
    if (items.every((x) => x.complete)) streak++;
    else break;
  }
  return streak;
}
