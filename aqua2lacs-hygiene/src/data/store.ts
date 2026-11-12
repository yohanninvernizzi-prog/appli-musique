import { useSyncExternalStore } from "react";
import { buildChecklist, type ChecklistItem } from "../domain/checklist";
import { today } from "../domain/dates";
import { hashPin } from "../domain/pin";
import { seedData } from "../domain/seed";
import type { Agent, AppData, Completion, Moment, Settings, Sheet, Task, Zone } from "../domain/types";

/**
 * Magasin de données de l'appli.
 * Étape 1 (mode démo) : tout est enregistré sur l'appareil (localStorage).
 * Étape 2 : la même interface sera branchée sur Supabase avec synchronisation.
 */

const DATA_KEY = "a2l-hygiene-data-v1";
const SESSION_KEY = "a2l-hygiene-session-v1";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée, quota…) : l'appli continue en mémoire.
  }
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ───────── Données ─────────

let data: AppData = read<AppData>(DATA_KEY) ?? seedData();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function mutate(fn: (d: AppData) => AppData) {
  data = fn(data);
  write(DATA_KEY, data);
  emit();
}

export function getData(): AppData {
  return data;
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, getData);
}

// ───────── Session (qui utilise l'appareil) ─────────

export interface Session {
  agentId: string | null;
  sheetId: string | null;
  admin: boolean;
}

let session: Session = { agentId: null, sheetId: null, admin: false, ...(read<Partial<Session>>(SESSION_KEY) ?? {}) };
session.admin = false; // l'accès responsable n'est jamais conservé après fermeture

function setSession(next: Session) {
  session = next;
  write(SESSION_KEY, { agentId: next.agentId, sheetId: next.sheetId });
  emit();
}

export function useSession(): Session {
  return useSyncExternalStore(subscribe, () => session);
}

export function agentLabel(a: Pick<Agent, "firstName" | "lastName"> | undefined | null): string {
  if (!a) return "Inconnu";
  const initial = a.lastName.trim() ? ` ${a.lastName.trim()[0].toUpperCase()}.` : "";
  return `${a.firstName.trim()}${initial}`;
}

export function agentName(d: AppData, id: string | null): string {
  if (!id) return "Responsable";
  return agentLabel(d.agents.find((a) => a.id === id));
}

// ───────── Connexion ─────────

export function checkAgentPin(agentId: string, pin: string): boolean {
  const a = data.agents.find((x) => x.id === agentId && x.active);
  return !!a && a.pinHash === hashPin(pin);
}

/** Ouvre le service de l'agent : reprend sa fiche non envoyée, sinon en crée une. */
export function loginAgent(agentId: string): void {
  const agent = data.agents.find((a) => a.id === agentId);
  if (!agent) return;
  const open = data.sheets
    .filter((s) => s.agentId === agentId && !s.sentAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
  if (open) {
    setSession({ agentId, sheetId: open.id, admin: false });
    return;
  }
  const sheet: Sheet = {
    id: uid(),
    agentId,
    agentName: agentLabel(agent),
    date: today(),
    startedAt: new Date().toISOString(),
    sentAt: null,
    signature: "",
    initials: "",
    comment: "",
    anomaly: false,
    remaining: [],
  };
  mutate((d) => ({ ...d, sheets: [...d.sheets, sheet] }));
  setSession({ agentId, sheetId: sheet.id, admin: false });
}

export function logout(): void {
  // Une fiche ouverte sans aucune action n'a pas d'intérêt : on ne la garde pas.
  const { sheetId } = session;
  if (sheetId) {
    const sheet = data.sheets.find((s) => s.id === sheetId);
    const used = data.completions.some((c) => c.sheetId === sheetId);
    if (sheet && !sheet.sentAt && !used) mutate((d) => ({ ...d, sheets: d.sheets.filter((s) => s.id !== sheetId) }));
  }
  setSession({ agentId: null, sheetId: null, admin: false });
}

export function loginAdmin(pin: string): boolean {
  if (data.settings.adminPinHash !== hashPin(pin)) return false;
  setSession({ agentId: null, sheetId: null, admin: true });
  return true;
}

// ───────── Validations ─────────

function sheetIsOpen(sheetId: string | null): boolean {
  if (!sheetId) return false;
  const s = data.sheets.find((x) => x.id === sheetId);
  return !!s && !s.sentAt;
}

function snapshotOf(item: ChecklistItem) {
  return {
    taskName: item.task.name,
    zoneName: item.zone?.name ?? "",
    momentName: item.moment?.name ?? "",
  };
}

function baseCompletion(item: ChecklistItem, passIndex: number): Completion {
  return {
    id: uid(),
    taskId: item.task.id,
    dueDate: item.dueDate,
    doneDate: today(),
    passIndex,
    status: "done",
    agentId: session.agentId,
    at: new Date().toISOString(),
    reason: "",
    comment: "",
    anomaly: false,
    photos: [],
    sheetId: session.sheetId,
    snapshot: snapshotOf(item),
  };
}

/** Valide le prochain passage libre d'une tâche. Renvoie la validation créée. */
export function validateTask(item: ChecklistItem): Completion | null {
  if (!session.agentId || !sheetIsOpen(session.sheetId)) return null;
  const passIndex = item.passes.findIndex((p) => p === null);
  if (passIndex === -1) return null;
  const c = baseCompletion(item, passIndex);
  // Un « non fait » déclaré plus tôt par le même agent pour ce passage devient caduc.
  mutate((d) => ({
    ...d,
    completions: [
      ...d.completions.filter(
        (x) =>
          !(
            x.taskId === c.taskId &&
            x.dueDate === c.dueDate &&
            x.status === "not_done" &&
            x.doneDate === c.doneDate &&
            x.sheetId === c.sheetId
          ),
      ),
      c,
    ],
  }));
  return c;
}

export function markNotDone(item: ChecklistItem, reason: string, comment: string, anomaly: boolean): void {
  if (!session.agentId || !sheetIsOpen(session.sheetId)) return;
  const c: Completion = { ...baseCompletion(item, 0), status: "not_done", reason, comment, anomaly };
  mutate((d) => ({
    ...d,
    completions: [
      ...d.completions.filter(
        (x) =>
          !(
            x.taskId === c.taskId &&
            x.dueDate === c.dueDate &&
            x.status === "not_done" &&
            x.sheetId === c.sheetId
          ),
      ),
      c,
    ],
  }));
}

/** L'agent connecté peut-il encore modifier cette validation ? */
export function canEdit(c: Completion): boolean {
  return c.agentId === session.agentId && c.sheetId === session.sheetId && sheetIsOpen(c.sheetId);
}

export function undoCompletion(id: string): void {
  const c = data.completions.find((x) => x.id === id);
  if (!c || !canEdit(c)) return;
  mutate((d) => ({ ...d, completions: d.completions.filter((x) => x.id !== id) }));
}

export function setCompletionNote(id: string, comment: string, anomaly: boolean): void {
  const c = data.completions.find((x) => x.id === id);
  if (!c || !canEdit(c)) return;
  mutate((d) => ({
    ...d,
    completions: d.completions.map((x) => (x.id === id ? { ...x, comment, anomaly } : x)),
  }));
}

/** Responsable : annule une échéance (elle ne sera plus réclamée « en retard »). */
export function cancelOccurrence(item: ChecklistItem): void {
  if (!session.admin) return;
  const c: Completion = { ...baseCompletion(item, 0), status: "cancelled", agentId: null, sheetId: null };
  mutate((d) => ({ ...d, completions: [...d.completions, c] }));
}

// ───────── Fiches ─────────

export function sendSheet(
  sheetId: string,
  input: { signature: string; initials: string; comment: string; anomaly: boolean },
): void {
  const sheet = data.sheets.find((s) => s.id === sheetId);
  if (!sheet || sheet.sentAt) return;
  const remaining = buildChecklist(data, sheet.date)
    .filter((i) => !i.bonus && !i.complete)
    .map((i) => ({
      taskName: i.task.name,
      zoneName: i.zone?.name ?? "",
      momentName: i.moment?.name ?? "",
      late: i.late,
      dueDate: i.dueDate,
    }));
  mutate((d) => ({
    ...d,
    sheets: d.sheets.map((s) =>
      s.id === sheetId ? { ...s, ...input, remaining, sentAt: new Date().toISOString() } : s,
    ),
  }));
}

// ───────── Référentiel (responsable) ─────────

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

export function saveTask(task: Task): void {
  mutate((d) => ({ ...d, tasks: upsert(d.tasks, task) }));
}

export function deleteTask(id: string): void {
  mutate((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
}

export function saveZone(zone: Zone): void {
  mutate((d) => ({ ...d, zones: upsert(d.zones, zone) }));
}

/** Supprime une zone si plus aucune tâche ne l'utilise. */
export function deleteZone(id: string): boolean {
  if (data.tasks.some((t) => t.zoneId === id)) return false;
  mutate((d) => ({ ...d, zones: d.zones.filter((z) => z.id !== id) }));
  return true;
}

export function moveZone(id: string, delta: -1 | 1): void {
  const sorted = [...data.zones].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((z) => z.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= sorted.length) return;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  mutate((d) => ({ ...d, zones: sorted.map((z, order) => ({ ...z, order })) }));
}

export function saveMoment(moment: Moment): void {
  mutate((d) => ({ ...d, moments: upsert(d.moments, moment) }));
}

export function updateSettings(patch: Partial<Settings>): void {
  mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
}

export function setAdminPin(pin: string): void {
  updateSettings({ adminPinHash: hashPin(pin) });
}

// ───────── Équipe (responsable) ─────────

export function addAgent(firstName: string, lastName: string, pin: string): void {
  const agent: Agent = { id: uid(), firstName, lastName, pinHash: hashPin(pin), active: true };
  mutate((d) => ({ ...d, agents: [...d.agents, agent] }));
}

export function updateAgent(id: string, patch: Partial<Pick<Agent, "firstName" | "lastName" | "active">>): void {
  mutate((d) => ({ ...d, agents: d.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
}

export function setAgentPin(id: string, pin: string): void {
  mutate((d) => ({ ...d, agents: d.agents.map((a) => (a.id === id ? { ...a, pinHash: hashPin(pin) } : a)) }));
}

/**
 * Supprime un profil. S'il a déjà validé des tâches, il est seulement retiré de l'écran
 * d'accueil : son nom reste lisible dans l'historique (traçabilité).
 */
export function removeAgent(id: string): void {
  const hasHistory = data.completions.some((c) => c.agentId === id) || data.sheets.some((s) => s.agentId === id);
  if (hasHistory) updateAgent(id, { active: false });
  else mutate((d) => ({ ...d, agents: d.agents.filter((a) => a.id !== id) }));
}

/** Remet l'appli dans son état de départ (mode démo uniquement). */
export function resetDemo(): void {
  data = seedData();
  write(DATA_KEY, data);
  setSession({ agentId: null, sheetId: null, admin: false });
}
