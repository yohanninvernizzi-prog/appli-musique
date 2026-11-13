import { describe, expect, it } from "vitest";
import { buildChecklist, progressOf } from "./checklist";
import { carriesOver, isScheduled } from "./recurrence";
import type { AppData, Completion, Recurrence, Task } from "./types";

// Repères : le 2 novembre 2026 est un lundi (1er lundi du mois), le 7 un samedi.
const MON = "2026-11-02";

function task(id: string, recurrence: Recurrence, extra: Partial<Task> = {}): Task {
  return {
    id,
    name: id,
    zoneId: "z",
    momentId: "m",
    description: "",
    material: "",
    product: "",
    durationMin: 0,
    photoRequired: false,
    passes: 1,
    recurrence,
    period: "all",
    active: true,
    draft: false,
    essential: false,
    order: 0,
    createdOn: "2026-01-01",
    ...extra,
  };
}

function data(tasks: Task[], completions: Completion[] = [], closedDays: string[] = []): AppData {
  return {
    version: 1,
    zones: [{ id: "z", name: "Zone", order: 0, post: 0 }],
    moments: [
      { id: "m", name: "Matin", startTime: "06:00", order: 0, bonus: false },
      { id: "b", name: "Temps creux", startTime: "00:00", order: 9, bonus: true },
    ],
    tasks,
    agents: [],
    completions,
    sheets: [],
    settings: {
      productByWeekday: [],
      closedDays,
      activePeriod: "scolaire",
      adminPinHash: "",
      notifyEmail: "",
    },
    team: [],
    deletions: [],
  };
}

function done(taskId: string, dueDate: string, doneDate = dueDate, passIndex = 0): Completion {
  return {
    id: `${taskId}-${dueDate}-${passIndex}`,
    taskId,
    dueDate,
    doneDate,
    passIndex,
    status: "done",
    agentId: "a",
    at: `${doneDate}T08:00:00`,
    reason: "",
    comment: "",
    anomaly: false,
    photos: [],
    sheetId: null,
    test: false,
    snapshot: { taskName: "", zoneName: "", momentName: "" },
  };
}

describe("récurrences", () => {
  it("jours de la semaine", () => {
    const rec: Recurrence = { type: "weekdays", days: [1, 4] };
    expect(isScheduled(rec, MON)).toBe(true);
    expect(isScheduled(rec, "2026-11-03")).toBe(false);
    expect(isScheduled(rec, "2026-11-05")).toBe(true);
  });

  it("1er lundi et dernier samedi du mois", () => {
    const first: Recurrence = { type: "monthly_nth", nth: 1, weekday: 1 };
    expect(isScheduled(first, MON)).toBe(true);
    expect(isScheduled(first, "2026-11-09")).toBe(false);
    const last: Recurrence = { type: "monthly_nth", nth: -1, weekday: 6 };
    expect(isScheduled(last, "2026-11-28")).toBe(true);
    expect(isScheduled(last, "2026-11-21")).toBe(false);
  });

  it("le 31 du mois est ramené au dernier jour des mois courts", () => {
    const rec: Recurrence = { type: "monthly_day", day: 31 };
    expect(isScheduled(rec, "2026-11-30")).toBe(true);
    expect(isScheduled(rec, "2026-12-30")).toBe(false);
    expect(isScheduled(rec, "2026-12-31")).toBe(true);
  });

  it("tous les X jours et ponctuelle", () => {
    const rec: Recurrence = { type: "every_x_days", interval: 3, startDate: MON };
    expect(isScheduled(rec, "2026-11-05")).toBe(true);
    expect(isScheduled(rec, "2026-11-04")).toBe(false);
    expect(isScheduled(rec, "2026-11-01")).toBe(false);
    expect(isScheduled({ type: "once", date: MON }, MON)).toBe(true);
  });

  it("seules les tâches périodiques sont reportées", () => {
    expect(carriesOver({ type: "daily" })).toBe(false);
    expect(carriesOver({ type: "weekdays", days: [1, 2, 3] })).toBe(false);
    expect(carriesOver({ type: "weekdays", days: [1] })).toBe(true);
    expect(carriesOver({ type: "once", date: MON })).toBe(true);
  });
});

describe("checklist du jour", () => {
  const monthly = task("vidange", { type: "monthly_nth", nth: 1, weekday: 1 });
  const daily = task("sols", { type: "daily" });

  it("la tâche mensuelle n'apparaît que le jour prévu", () => {
    expect(buildChecklist(data([monthly]), MON).map((i) => i.task.id)).toEqual(["vidange"]);
    expect(buildChecklist(data([monthly], [done("vidange", MON)]), "2026-11-03")).toEqual([]);
  });

  it("une tâche périodique non faite est reportée « en retard »", () => {
    const [item] = buildChecklist(data([monthly]), "2026-11-04");
    expect(item.late).toBe(true);
    expect(item.dueDate).toBe(MON);
  });

  it("une tâche quotidienne non faite n'est pas reportée", () => {
    const items = buildChecklist(data([daily]), "2026-11-04");
    expect(items).toHaveLength(1);
    expect(items[0].late).toBe(false);
  });

  it("le rattrapage reste visible le jour même puis disparaît", () => {
    const d = data([monthly], [done("vidange", MON, "2026-11-04")]);
    const [item] = buildChecklist(d, "2026-11-04");
    expect(item.complete).toBe(true);
    expect(buildChecklist(d, "2026-11-05")).toEqual([]);
  });

  it("une échéance tombée un jour fermé est reportée au jour ouvert suivant", () => {
    const d = data([monthly], [], [MON]);
    expect(buildChecklist(d, MON)).toEqual([]);
    expect(buildChecklist(d, "2026-11-03")[0].late).toBe(true);
  });

  it("une annulation par le responsable fait disparaître le retard", () => {
    const cancel: Completion = { ...done("vidange", MON), status: "cancelled", agentId: null };
    expect(buildChecklist(data([monthly], [cancel]), "2026-11-04")).toEqual([]);
  });

  it("tâche inactive ou hors période : absente", () => {
    expect(buildChecklist(data([{ ...daily, active: false }]), MON)).toEqual([]);
    expect(buildChecklist(data([{ ...daily, period: "vacances" }]), MON)).toEqual([]);
  });

  it("les validations d'un profil de test restent dans leur bac à sable", () => {
    const d = data([daily], [{ ...done("sols", MON), test: true }]);
    expect(buildChecklist(d, MON)[0].complete).toBe(false);
    expect(buildChecklist(d, MON, true)[0].complete).toBe(true);
  });

  it("plusieurs passages et progression hors bonus", () => {
    const twice = task("wc", { type: "daily" }, { passes: 2 });
    const bonus = task("toiles", { type: "daily" }, { momentId: "b" });
    const items = buildChecklist(data([twice, bonus], [done("wc", MON, MON, 1)]), MON);
    const wc = items.find((i) => i.task.id === "wc")!;
    expect(wc.passes.map(Boolean)).toEqual([false, true]);
    expect(wc.complete).toBe(false);
    expect(progressOf(items)).toMatchObject({ done: 1, total: 2 });
  });
});
