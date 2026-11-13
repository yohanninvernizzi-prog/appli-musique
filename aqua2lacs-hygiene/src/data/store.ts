import { useSyncExternalStore } from "react";
import { buildChecklist, type ChecklistItem } from "../domain/checklist";
import { addDays, today } from "../domain/dates";
import { hashPin } from "../domain/pin";
import { seedData } from "../domain/seed";
import type {
  Agent,
  AppData,
  Completion,
  DeletionLog,
  Moment,
  Post,
  Settings,
  Sheet,
  Task,
  TeamMember,
  WorkMode,
  Zone,
} from "../domain/types";
import {
  agentFromRow,
  completionFromRow,
  completionToRow,
  deletionFromRow,
  fetchAll,
  momentFromRow,
  momentToRow,
  REMOTE,
  settingsFromRow,
  settingsToRow,
  sheetFromRow,
  sheetToRow,
  supabase,
  taskFromRow,
  taskToRow,
  teamFromRow,
  zoneFromRow,
  zoneToRow,
} from "./remote";

/**
 * Magasin de données de l'appli.
 *
 * Mode démo (pas de Supabase configuré) : tout est enregistré sur l'appareil.
 * Mode connecté : l'appareil garde une copie locale pour rester utilisable sans réseau.
 *   - Les actions d'un agent sont appliquées tout de suite, puis placées dans une file
 *     d'attente envoyée au serveur dès que possible.
 *   - Les modifications du responsable sont envoyées directement (réseau nécessaire).
 */

export { REMOTE };

const DATA_KEY = REMOTE ? "a2l-hygiene-cache-v1" : "a2l-hygiene-data-v2";
const SESSION_KEY = "a2l-hygiene-session-v1";
const OUTBOX_KEY = "a2l-hygiene-outbox-v1";
const PINS_KEY = "a2l-hygiene-pins-v1";
const ADMIN_HISTORY_DAYS = 70;

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

function emptyData(): AppData {
  return { ...seedData(), zones: [], moments: [], tasks: [], agents: [] };
}

/** Complète des données enregistrées par une version précédente de l'appli. */
function normalize(d: AppData): AppData {
  return {
    ...d,
    zones: d.zones.map((z) => ({ ...z, post: z.post ?? 0 })),
    tasks: d.tasks.map((t) => ({ ...t, essential: !!t.essential, draft: !!t.draft })),
    agents: d.agents.map((a) => ({ ...a, test: !!a.test })),
    sheets: d.sheets.map((x) => ({ ...x, mode: x.mode ?? null, post: x.post ?? 0, test: !!x.test })),
    completions: d.completions.map((c) => ({ ...c, test: !!c.test })),
    team: d.team ?? [],
    deletions: d.deletions ?? [],
  };
}

// ───────── État ─────────

type Row = Record<string, unknown>;
type Op =
  | { kind: "sheet"; row: Row }
  | { kind: "completion"; row: Row }
  | { kind: "delete_completion"; id: string }
  | { kind: "delete_sheet"; id: string };
interface Queued {
  agentId: string;
  pin: string;
  op: Op;
}

export interface Session {
  agentId: string | null;
  sheetId: string | null;
  admin: boolean;
}

export interface SyncStatus {
  /** Dernière tentative réussie ? */
  online: boolean;
  /** Nombre d'actions pas encore envoyées au serveur. */
  pending: number;
  syncing: boolean;
  /** Message à montrer à l'utilisateur (action refusée, enregistrement impossible…). */
  notice: string;
  /** Faux tant que l'on ne sait pas si le responsable est déjà connecté. */
  authReady: boolean;
}

const stored = read<AppData>(DATA_KEY);
let data: AppData = stored ? normalize(stored) : REMOTE ? emptyData() : seedData();
/** Responsable : regarde-t-il les données réelles ou celles des profils de test ? */
let viewTests = false;
let outbox: Queued[] = REMOTE ? (read<Queued[]>(OUTBOX_KEY) ?? []) : [];
let session: Session = { agentId: null, sheetId: null, admin: false, ...(read<Partial<Session>>(SESSION_KEY) ?? {}) };
session.admin = false;
let sessionPin: string | null = read<{ pin?: string }>(SESSION_KEY)?.pin ?? null;
let status: SyncStatus = { online: true, pending: outbox.length, syncing: false, notice: "", authReady: !REMOTE };
let adminLoadedFrom = "";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function persist() {
  // Le responsable consulte tout l'historique : on ne le recopie pas sur l'appareil.
  write(DATA_KEY, REMOTE && session.admin ? { ...data, completions: [], sheets: [] } : data);
}

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch, pending: outbox.length };
  emit();
}

function setSession(next: Session, pin: string | null = sessionPin) {
  session = next;
  sessionPin = next.agentId ? pin : null;
  write(SESSION_KEY, { agentId: next.agentId, sheetId: next.sheetId, pin: sessionPin });
  emit();
}

/** Applique un changement local et, en mode connecté, met les actions de l'agent en file d'attente. */
function mutate(fn: (d: AppData) => AppData, ops: Op[] = []) {
  data = fn(data);
  persist();
  if (REMOTE && ops.length > 0 && session.agentId && sessionPin) {
    outbox = [...outbox, ...ops.map((op) => ({ agentId: session.agentId!, pin: sessionPin!, op }))];
    write(OUTBOX_KEY, outbox);
    status = { ...status, pending: outbox.length };
    scheduleSync(400);
  }
  emit();
}

export const getData = (): AppData => data;
export const useData = (): AppData => useSyncExternalStore(subscribe, getData);
export const useSession = (): Session => useSyncExternalStore(subscribe, () => session);
export const useSync = (): SyncStatus => useSyncExternalStore(subscribe, () => status);
export const dismissNotice = () => setStatus({ notice: "" });
export const useViewTests = (): boolean => useSyncExternalStore(subscribe, () => viewTests);
export function setViewTests(value: boolean): void {
  viewTests = value;
  emit();
}

/** Le profil connecté est-il un profil de test ? */
function sessionIsTest(): boolean {
  return !!data.agents.find((a) => a.id === session.agentId)?.test;
}

/** Collègues en service en même temps que l'agent connecté. */
export function getTeam(d: AppData, s: Session): TeamMember[] {
  if (REMOTE) return d.team;
  const me = d.sheets.find((x) => x.id === s.sheetId);
  return d.sheets
    .filter((x) => x.date === today() && !x.sentAt && x.agentId !== s.agentId && x.test === !!me?.test)
    .map((x) => ({ agentId: x.agentId, agentName: x.agentName, mode: x.mode, post: x.post }));
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

// ───────── Synchronisation (mode connecté) ─────────

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

/** Rejoue sur les données reçues du serveur les actions locales pas encore envoyées. */
function withPending(d: AppData): AppData {
  let { sheets, completions } = d;
  for (const { op } of outbox) {
    if (op.kind === "sheet") sheets = upsert(sheets, sheetFromRow(op.row));
    else if (op.kind === "completion") completions = upsert(completions, completionFromRow(op.row));
    else if (op.kind === "delete_completion") completions = completions.filter((c) => c.id !== op.id);
    else sheets = sheets.filter((s) => s.id !== op.id);
  }
  return { ...d, sheets, completions };
}

function applyReference(payload: Record<string, Row[] | Row | null>, base: AppData): AppData {
  const list = (k: string) => (payload[k] as Row[] | null) ?? [];
  return {
    ...base,
    zones: list("zones").map(zoneFromRow),
    moments: list("moments").map(momentFromRow),
    tasks: list("tasks").map(taskFromRow),
    agents: list("agents").map(agentFromRow),
    settings: settingsFromRow(payload.settings as Row | null, base.settings),
  };
}

function rememberPin(agentId: string, pin: string) {
  write(PINS_KEY, { ...(read<Record<string, string>>(PINS_KEY) ?? {}), [agentId]: hashPin(pin) });
}

type PullResult = "ok" | "bad_pin" | "locked" | "offline";

async function agentPull(agentId: string, pin: string): Promise<PullResult> {
  if (!supabase) return "offline";
  try {
    const { data: payload, error } = await supabase.rpc("agent_pull", {
      p_agent: agentId,
      p_pin: pin,
      p_today: today(),
    });
    if (error) return "offline";
    if (payload?.error) return payload.error as PullResult;
    data = withPending({
      ...applyReference(payload, data),
      completions: (payload.completions as Row[]).map(completionFromRow),
      sheets: (payload.sheets as Row[]).map(sheetFromRow),
      team: ((payload.team as Row[] | null) ?? []).map(teamFromRow),
    });
    persist();
    emit();
    return "ok";
  } catch {
    return "offline";
  }
}

/** Envoie la file d'attente. Renvoie false si le réseau n'a pas répondu. */
async function flushOutbox(): Promise<boolean> {
  while (supabase && outbox.length > 0) {
    const { agentId, pin } = outbox[0];
    let count = 0;
    while (count < outbox.length && count < 200 && outbox[count].agentId === agentId && outbox[count].pin === pin) count++;
    const batch = outbox.slice(0, count);
    let payload: { error?: string; results?: { outcome: string }[] } | null = null;
    try {
      const res = await supabase.rpc("agent_sync", { p_agent: agentId, p_pin: pin, p_ops: batch.map((q) => q.op) });
      if (res.error) return false;
      payload = res.data;
    } catch {
      return false;
    }
    if (payload?.error === "locked") return false; // blocage temporaire : on réessaiera
    outbox = outbox.slice(count);
    write(OUTBOX_KEY, outbox);
    if (payload?.error) {
      // Code PIN changé entre-temps : ces actions ne peuvent plus être attribuées.
      setStatus({ notice: "Code modifié par le responsable : reconnecte-toi. Les dernières actions n'ont pas été envoyées." });
      if (session.agentId === agentId) setSession({ agentId: null, sheetId: null, admin: false });
      continue;
    }
    const refused = (payload?.results ?? []).filter((r) => r.outcome !== "ok").length;
    if (refused > 0) {
      setStatus({ notice: `${refused} action${refused > 1 ? "s" : ""} refusée${refused > 1 ? "s" : ""} par le serveur (fiche déjà envoyée ?).` });
    } else setStatus({});
  }
  return true;
}

async function adminPull(from = adminLoadedFrom || addDays(today(), -ADMIN_HISTORY_DAYS)): Promise<boolean> {
  if (!supabase) return false;
  try {
    const one = async (table: string) => {
      const { data: rows, error } = await supabase!.from(table).select("*");
      if (error) throw new Error(error.message);
      return rows as Row[];
    };
    const [zones, moments, tasks, agents, settings, deletions] = await Promise.all(
      ["zones", "moments", "tasks", "agents", "settings", "deletions"].map(one),
    );
    const sheets = await fetchAll((a, b) => supabase!.from("sheets").select("*").gte("day", from).order("id").range(a, b));
    const completions = await fetchAll((a, b) =>
      supabase!.from("completions").select("*").or(`done_date.gte.${from},due_date.gte.${from}`).order("id").range(a, b),
    );
    adminLoadedFrom = from;
    data = {
      ...applyReference({ zones, moments, tasks, agents, settings: settings[0] ?? null }, data),
      sheets: sheets.map(sheetFromRow),
      completions: completions.map(completionFromRow),
      deletions: deletions.map(deletionFromRow).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
      team: [],
    };
    persist();
    setStatus({ online: true });
    return true;
  } catch {
    setStatus({ online: false });
    return false;
  }
}

/** Historique : charge les fiches plus anciennes si la période demandée remonte plus loin. */
export function ensureHistory(from: string): void {
  if (REMOTE && session.admin && adminLoadedFrom && from < adminLoadedFrom) void adminPull(from);
}

let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export async function syncNow(): Promise<void> {
  if (!REMOTE) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  setStatus({ syncing: true });
  let ok = await flushOutbox();
  if (ok && session.agentId && sessionPin) {
    const agentId = session.agentId;
    const res = await agentPull(agentId, sessionPin);
    ok = res !== "offline";
    if (res === "bad_pin" && session.agentId === agentId) {
      setSession({ agentId: null, sheetId: null, admin: false });
      setStatus({ notice: "Ton code a été modifié par le responsable : reconnecte-toi." });
    } else if (res === "ok" && session.sheetId && !data.sheets.some((s) => s.id === session.sheetId)) {
      // La fiche en cours n'existe plus côté serveur : on repart de l'accueil.
      setSession({ agentId: null, sheetId: null, admin: false });
    }
  } else if (ok && session.admin) {
    ok = await adminPull();
  }
  running = false;
  setStatus({ syncing: false, online: ok });
  if (again) {
    again = false;
    scheduleSync(200);
  }
}

function scheduleSync(delay: number) {
  if (!REMOTE) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Écran d'accueil : met à jour la liste des profils. */
export async function refreshAgents(): Promise<void> {
  if (!supabase || session.admin) return;
  try {
    const { data: rows, error } = await supabase.rpc("list_agents");
    if (error || !Array.isArray(rows)) return;
    const active = (rows as Row[]).map(agentFromRow);
    const ids = new Set(active.map((a) => a.id));
    // Les profils absents de la liste restent connus (noms dans l'historique) mais inactifs.
    data = { ...data, agents: [...active, ...data.agents.filter((a) => !ids.has(a.id)).map((a) => ({ ...a, active: false }))] };
    persist();
    setStatus({ online: true });
  } catch {
    // Hors ligne : on garde la liste connue.
  }
}

if (REMOTE && typeof window !== "undefined") {
  window.addEventListener("online", () => scheduleSync(100));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleSync(100);
  });
  setInterval(() => {
    if (document.visibilityState === "visible" && (session.agentId || session.admin || outbox.length > 0)) void syncNow();
  }, 60_000);
  // Le responsable était-il déjà connecté sur cet appareil ?
  void (async () => {
    try {
      const { data: auth } = await supabase!.auth.getSession();
      if (auth.session && !session.agentId) {
        const { data: isAdmin } = await supabase!.rpc("is_admin");
        if (isAdmin === true) {
          session = { ...session, admin: true };
          await adminPull();
        }
      }
    } catch {
      // Hors ligne : le responsable se reconnectera.
    }
    setStatus({ authReady: true });
    scheduleSync(100);
  })();
}

// ───────── Connexion ─────────

function openSheetFor(agentId: string, pin: string | null) {
  const agent = data.agents.find((a) => a.id === agentId);
  const open = data.sheets
    .filter((s) => s.agentId === agentId && !s.sentAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
  if (open) {
    setSession({ agentId, sheetId: open.id, admin: false }, pin);
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
    mode: null,
    post: 0,
    test: !!agent?.test,
  };
  setSession({ agentId, sheetId: sheet.id, admin: false }, pin);
  mutate((d) => ({ ...d, sheets: [...d.sheets, sheet] }), [{ kind: "sheet", row: sheetToRow(sheet) }]);
}

/**
 * Identifie l'agent et ouvre son service (reprend sa fiche non envoyée, sinon en crée une).
 * Renvoie null si tout va bien, sinon le message d'erreur à afficher.
 */
export async function loginAgent(agentId: string, pin: string): Promise<string | null> {
  if (!REMOTE) {
    const a = data.agents.find((x) => x.id === agentId && x.active);
    if (!a || a.pinHash !== hashPin(pin)) return "Code incorrect, réessaie.";
    openSheetFor(agentId, null);
    return null;
  }
  if (session.admin) {
    // Un agent prend l'appareil : le responsable est déconnecté.
    void supabase?.auth.signOut();
    session = { ...session, admin: false };
    adminLoadedFrom = "";
  }
  await flushOutbox();
  const res = await agentPull(agentId, pin);
  if (res === "bad_pin") return "Code incorrect, réessaie.";
  if (res === "locked") return "Trop d'essais. Réessaie dans 5 minutes.";
  if (res === "offline") {
    // Sans réseau : on accepte le code s'il a déjà servi sur cet appareil.
    const known = read<Record<string, string>>(PINS_KEY)?.[agentId];
    if (!known) return "Pas de réseau. Une première connexion en ligne est nécessaire sur cet appareil.";
    if (known !== hashPin(pin)) return "Code incorrect, réessaie.";
    setStatus({ online: false });
  } else {
    rememberPin(agentId, pin);
    setStatus({ online: true });
  }
  openSheetFor(agentId, pin);
  return null;
}

export function logout(): void {
  // Une fiche ouverte sans aucune action n'a pas d'intérêt : on ne la garde pas.
  const { sheetId } = session;
  if (sheetId && session.agentId) {
    const sheet = data.sheets.find((s) => s.id === sheetId);
    const used = data.completions.some((c) => c.sheetId === sheetId);
    if (sheet && !sheet.sentAt && !used) {
      mutate((d) => ({ ...d, sheets: d.sheets.filter((s) => s.id !== sheetId) }), [{ kind: "delete_sheet", id: sheetId }]);
    }
  }
  if (session.admin && supabase) {
    void supabase.auth.signOut();
    adminLoadedFrom = "";
    data = { ...data, completions: [], sheets: [] };
  }
  setSession({ agentId: null, sheetId: null, admin: false });
}

/** Mode démo : accès responsable par code. */
export function loginAdmin(pin: string): boolean {
  if (REMOTE || data.settings.adminPinHash !== hashPin(pin)) return false;
  setSession({ agentId: null, sheetId: null, admin: true });
  return true;
}

/** Mode connecté : accès responsable par e-mail et mot de passe. Renvoie null ou un message d'erreur. */
export async function loginAdminRemote(email: string, password: string): Promise<string | null> {
  if (!supabase) return "Connexion indisponible.";
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.status === 400 ? "E-mail ou mot de passe incorrect." : "Connexion impossible. Vérifiez le réseau.";
    const { data: isAdmin, error: claimError } = await supabase.rpc("claim_admin");
    if (claimError || isAdmin !== true) {
      await supabase.auth.signOut();
      return "Ce compte n'a pas accès à l'espace responsable.";
    }
    setSession({ agentId: null, sheetId: null, admin: true });
    await adminPull();
    await seedIfEmpty();
    return null;
  } catch {
    return "Connexion impossible. Vérifiez le réseau.";
  }
}

/** Première connexion du responsable : la base est vide, on y charge le protocole Aqua2Lacs. */
async function seedIfEmpty(): Promise<void> {
  if (!supabase || data.zones.length > 0 || data.tasks.length > 0) return;
  const seed = seedData();
  const steps = [
    supabase.from("zones").upsert(seed.zones.map(zoneToRow)),
    supabase.from("moments").upsert(seed.moments.map(momentToRow)),
    supabase.from("tasks").upsert(seed.tasks.map((t) => taskToRow({ ...t, createdOn: today() }))),
    supabase.from("settings").upsert(settingsToRow({ ...seed.settings, notifyEmail: "" })),
  ];
  const results = await Promise.all(steps);
  if (results.some((r) => r.error)) setStatus({ notice: "Le chargement initial du protocole a échoué. Réessayez." });
  await adminPull();
}

export async function changeAdminPassword(password: string): Promise<string | null> {
  if (!supabase) return "Indisponible.";
  const { error } = await supabase.auth.updateUser({ password });
  return error ? "Le mot de passe n'a pas pu être changé." : null;
}

// ───────── Écritures du responsable (mode connecté) ─────────

type WriteResult = PromiseLike<{ error: { message: string } | null }>;
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();

/** Envoie une modification du responsable. Les frappes rapprochées sur un même champ sont regroupées. */
function adminWrite(key: string, run: () => WriteResult, delay = 0) {
  if (!REMOTE || !supabase) return;
  const previous = pendingWrites.get(key);
  if (previous) clearTimeout(previous);
  pendingWrites.set(
    key,
    setTimeout(async () => {
      pendingWrites.delete(key);
      let failed = false;
      try {
        failed = !!(await run()).error;
      } catch {
        failed = true;
      }
      if (failed) {
        setStatus({ notice: "Modification non enregistrée. Vérifiez le réseau puis recommencez." });
        void adminPull();
      }
    }, delay),
  );
}

// ───────── Validations (agent) ─────────

function sheetIsOpen(sheetId: string | null): boolean {
  if (!sheetId) return false;
  const s = data.sheets.find((x) => x.id === sheetId);
  return !!s && !s.sentAt;
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
    test: session.admin ? viewTests : sessionIsTest(),
    snapshot: {
      taskName: item.task.name,
      zoneName: item.zone?.name ?? "",
      momentName: item.moment?.name ?? "",
    },
  };
}

/** Ajoute une validation en remplaçant les « non fait » devenus caducs. */
function addCompletion(c: Completion, obsolete: (x: Completion) => boolean) {
  const removed = data.completions.filter(obsolete);
  mutate(
    (d) => ({ ...d, completions: [...d.completions.filter((x) => !removed.includes(x)), c] }),
    [...removed.map((x): Op => ({ kind: "delete_completion", id: x.id })), { kind: "completion", row: completionToRow(c) }],
  );
}

/** Valide le prochain passage libre d'une tâche. Renvoie la validation créée. */
export function validateTask(item: ChecklistItem): Completion | null {
  if (!session.agentId || !sheetIsOpen(session.sheetId)) return null;
  const passIndex = item.passes.findIndex((p) => p === null);
  if (passIndex === -1) return null;
  const c = baseCompletion(item, passIndex);
  addCompletion(
    c,
    (x) =>
      x.taskId === c.taskId &&
      x.dueDate === c.dueDate &&
      x.status === "not_done" &&
      x.doneDate === c.doneDate &&
      x.sheetId === c.sheetId,
  );
  return c;
}

export function markNotDone(item: ChecklistItem, reason: string, comment: string, anomaly: boolean): void {
  if (!session.agentId || !sheetIsOpen(session.sheetId)) return;
  const c: Completion = { ...baseCompletion(item, 0), status: "not_done", reason, comment, anomaly };
  addCompletion(
    c,
    (x) => x.taskId === c.taskId && x.dueDate === c.dueDate && x.status === "not_done" && x.sheetId === c.sheetId,
  );
}

/** L'agent connecté peut-il encore modifier cette validation ? */
export function canEdit(c: Completion): boolean {
  return c.agentId === session.agentId && c.sheetId === session.sheetId && sheetIsOpen(c.sheetId);
}

export function undoCompletion(id: string): void {
  const c = data.completions.find((x) => x.id === id);
  if (!c || !canEdit(c)) return;
  mutate((d) => ({ ...d, completions: d.completions.filter((x) => x.id !== id) }), [{ kind: "delete_completion", id }]);
}

export function setCompletionNote(id: string, comment: string, anomaly: boolean): void {
  const c = data.completions.find((x) => x.id === id);
  if (!c || !canEdit(c)) return;
  const next = { ...c, comment, anomaly };
  mutate((d) => ({ ...d, completions: upsert(d.completions, next) }), [{ kind: "completion", row: completionToRow(next) }]);
}

/** Responsable : annule une échéance (elle ne sera plus réclamée « en retard »). */
export function cancelOccurrence(item: ChecklistItem): void {
  if (!session.admin) return;
  const c: Completion = { ...baseCompletion(item, 0), status: "cancelled", agentId: null, sheetId: null };
  mutate((d) => ({ ...d, completions: [...d.completions, c] }));
  adminWrite(`completion:${c.id}`, () => supabase!.from("completions").insert(completionToRow(c)));
}

// ───────── Fiches ─────────

export function sendSheet(
  sheetId: string,
  input: { signature: string; initials: string; comment: string; anomaly: boolean },
): void {
  const sheet = data.sheets.find((s) => s.id === sheetId);
  if (!sheet || sheet.sentAt) return;
  const remaining = buildChecklist(data, sheet.date, sheet.test)
    .filter((i) => !i.bonus && !i.complete)
    .map((i) => ({
      taskName: i.task.name,
      zoneName: i.zone?.name ?? "",
      momentName: i.moment?.name ?? "",
      late: i.late,
      dueDate: i.dueDate,
    }));
  const sent: Sheet = { ...sheet, ...input, remaining, sentAt: new Date().toISOString() };
  mutate((d) => ({ ...d, sheets: upsert(d.sheets, sent) }), [{ kind: "sheet", row: sheetToRow(sent) }]);
}

/** L'agent indique s'il travaille seul ou à deux, et quel poste il tient. */
export function setSheetMode(mode: WorkMode, post: Post): void {
  const sheet = data.sheets.find((s) => s.id === session.sheetId);
  if (!sheet || sheet.sentAt) return;
  const next: Sheet = { ...sheet, mode, post: mode === "duo" ? post : 0 };
  mutate((d) => ({ ...d, sheets: upsert(d.sheets, next) }), [{ kind: "sheet", row: sheetToRow(next) }]);
}

function logDeletion(entry: Omit<DeletionLog, "id" | "deletedAt">): DeletionLog {
  return { ...entry, id: uid(), deletedAt: new Date().toISOString() };
}

/** Responsable : supprime une fiche et ses validations. Le motif est conservé dans le journal. */
export function deleteSheet(id: string, reason: string): void {
  const sheet = data.sheets.find((s) => s.id === id);
  if (!session.admin || !sheet) return;
  const removed = data.completions.filter((c) => c.sheetId === id).length;
  mutate((d) => ({
    ...d,
    sheets: d.sheets.filter((s) => s.id !== id),
    completions: d.completions.filter((c) => c.sheetId !== id),
    deletions: [
      logDeletion({
        scope: "sheet",
        agentName: sheet.agentName,
        day: sheet.date,
        reason,
        sheetCount: 1,
        completionCount: removed,
        test: sheet.test,
      }),
      ...d.deletions,
    ],
  }));
  adminWrite(`sheet:${id}`, () => supabase!.rpc("admin_delete_sheet", { p_id: id, p_reason: reason }));
}

/** Responsable : efface toutes les fiches de test, ou toutes les fiches. */
export function wipeSheets(scope: "tests" | "all", reason: string): void {
  if (!session.admin) return;
  const gone = (test: boolean) => scope === "all" || test;
  mutate((d) => ({
    ...d,
    sheets: d.sheets.filter((s) => !gone(s.test)),
    completions: d.completions.filter((c) => !gone(c.test)),
    deletions: [
      logDeletion({
        scope,
        agentName: "",
        day: "",
        reason,
        sheetCount: d.sheets.filter((s) => gone(s.test)).length,
        completionCount: d.completions.filter((c) => gone(c.test)).length,
        test: scope === "tests",
      }),
      ...d.deletions,
    ],
  }));
  if (REMOTE && supabase) {
    void (async () => {
      const { error } = await supabase.rpc("admin_wipe", { p_scope: scope, p_reason: reason });
      if (error) setStatus({ notice: "La suppression n'a pas pu être enregistrée. Vérifiez le réseau." });
      await adminPull();
    })();
  }
}

// ───────── Référentiel (responsable) ─────────

export function saveTask(task: Task): void {
  mutate((d) => ({ ...d, tasks: upsert(d.tasks, task) }));
  adminWrite(`task:${task.id}`, () => supabase!.from("tasks").upsert(taskToRow(task)));
}

export function deleteTask(id: string): void {
  mutate((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  adminWrite(`task:${id}`, () => supabase!.from("tasks").delete().eq("id", id));
}

export function saveZone(zone: Zone): void {
  mutate((d) => ({ ...d, zones: upsert(d.zones, zone) }));
  adminWrite(`zone:${zone.id}`, () => supabase!.from("zones").upsert(zoneToRow(zone)), 600);
}

/** Supprime une zone si plus aucune tâche ne l'utilise. */
export function deleteZone(id: string): boolean {
  if (data.tasks.some((t) => t.zoneId === id)) return false;
  mutate((d) => ({ ...d, zones: d.zones.filter((z) => z.id !== id) }));
  adminWrite(`zone:${id}`, () => supabase!.from("zones").delete().eq("id", id));
  return true;
}

export function moveZone(id: string, delta: -1 | 1): void {
  const sorted = [...data.zones].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((z) => z.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= sorted.length) return;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  const zones = sorted.map((z, order) => ({ ...z, order }));
  mutate((d) => ({ ...d, zones }));
  adminWrite("zones:order", () => supabase!.from("zones").upsert(zones.map(zoneToRow)), 600);
}

export function saveMoment(moment: Moment): void {
  mutate((d) => ({ ...d, moments: upsert(d.moments, moment) }));
  adminWrite(`moment:${moment.id}`, () => supabase!.from("moments").upsert(momentToRow(moment)), 600);
}

export function updateSettings(patch: Partial<Settings>): void {
  mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  adminWrite("settings", () => supabase!.from("settings").upsert(settingsToRow(data.settings)), 600);
}

/** Mode démo uniquement. */
export function setAdminPin(pin: string): void {
  updateSettings({ adminPinHash: hashPin(pin) });
}

// ───────── Équipe (responsable) ─────────

function pushAgent(agent: Agent, pin: string | null, delay = 0) {
  adminWrite(
    `agent:${agent.id}${pin ? ":pin" : ""}`,
    () =>
      supabase!.rpc("admin_save_agent", {
        p_id: agent.id,
        p_first: agent.firstName,
        p_last: agent.lastName,
        p_active: agent.active,
        p_pin: pin,
        p_test: agent.test,
      }),
    delay,
  );
}

export function addAgent(firstName: string, lastName: string, pin: string, test = false): void {
  const agent: Agent = { id: uid(), firstName, lastName, pinHash: REMOTE ? "" : hashPin(pin), active: true, test };
  mutate((d) => ({ ...d, agents: [...d.agents, agent] }));
  pushAgent(agent, pin);
}

export function updateAgent(id: string, patch: Partial<Pick<Agent, "firstName" | "lastName" | "active" | "test">>): void {
  mutate((d) => ({ ...d, agents: d.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const agent = data.agents.find((a) => a.id === id);
  if (agent) pushAgent(agent, null, 600);
}

export function setAgentPin(id: string, pin: string): void {
  if (!REMOTE) {
    mutate((d) => ({ ...d, agents: d.agents.map((a) => (a.id === id ? { ...a, pinHash: hashPin(pin) } : a)) }));
    return;
  }
  const agent = data.agents.find((a) => a.id === id);
  if (agent) pushAgent(agent, pin);
}

/**
 * Supprime un profil. S'il a déjà validé des tâches, il est seulement retiré de l'écran
 * d'accueil : son nom reste lisible dans l'historique (traçabilité).
 */
export function removeAgent(id: string): void {
  const hasHistory = data.completions.some((c) => c.agentId === id) || data.sheets.some((s) => s.agentId === id);
  // En mode connecté, l'historique chargé est partiel : on désactive toujours, sans jamais effacer.
  if (hasHistory || REMOTE) updateAgent(id, { active: false });
  else mutate((d) => ({ ...d, agents: d.agents.filter((a) => a.id !== id) }));
}

/** Remet l'appli dans son état de départ (mode démo uniquement). */
export function resetDemo(): void {
  if (REMOTE) return;
  data = seedData();
  persist();
  setSession({ agentId: null, sheetId: null, admin: false });
}
