import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Agent, Completion, DeletionLog, Moment, Post, Settings, Sheet, Task, TeamMember, Zone } from "../domain/types";

/**
 * Connexion à Supabase et conversion entre les objets de l'appli et les lignes de la base.
 * Sans configuration (fichier .env absent), l'appli reste en « mode démo » : tout est local.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const REMOTE = !!url && !!key;

export const supabase: SupabaseClient | null = REMOTE
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

type Row = Record<string, unknown>;

const post = (v: unknown): Post => (v === 1 || v === 2 ? v : 0);

export const zoneToRow = (z: Zone): Row => ({ id: z.id, name: z.name, sort: z.order, post: z.post });
export const zoneFromRow = (r: Row): Zone => ({
  id: String(r.id),
  name: String(r.name),
  order: Number(r.sort),
  post: post(r.post),
});

export const momentToRow = (m: Moment): Row => ({
  id: m.id,
  name: m.name,
  start_time: m.startTime,
  sort: m.order,
  bonus: m.bonus,
});
export const momentFromRow = (r: Row): Moment => ({
  id: String(r.id),
  name: String(r.name),
  startTime: String(r.start_time),
  order: Number(r.sort),
  bonus: !!r.bonus,
});

export const taskToRow = (t: Task): Row => ({
  id: t.id,
  name: t.name,
  zone_id: t.zoneId,
  moment_id: t.momentId,
  description: t.description,
  material: t.material,
  product: t.product,
  duration_min: t.durationMin,
  photo_required: t.photoRequired,
  passes: t.passes,
  recurrence: t.recurrence,
  period: t.period,
  active: t.active,
  draft: t.draft,
  essential: t.essential,
  sort: t.order,
  created_on: t.createdOn,
});
export const taskFromRow = (r: Row): Task => ({
  id: String(r.id),
  name: String(r.name),
  zoneId: String(r.zone_id),
  momentId: String(r.moment_id),
  description: String(r.description ?? ""),
  material: String(r.material ?? ""),
  product: String(r.product ?? ""),
  durationMin: Number(r.duration_min ?? 0),
  photoRequired: !!r.photo_required,
  passes: Number(r.passes ?? 1),
  recurrence: r.recurrence as Task["recurrence"],
  period: r.period as Task["period"],
  active: !!r.active,
  draft: !!r.draft,
  essential: !!r.essential,
  order: Number(r.sort ?? 0),
  createdOn: String(r.created_on),
});

export const agentFromRow = (r: Row): Agent => ({
  id: String(r.id),
  firstName: String(r.first_name),
  lastName: String(r.last_name ?? ""),
  pinHash: "",
  active: !!r.active,
  test: !!r.is_test,
});

export const settingsToRow = (s: Settings): Row => ({
  id: 1,
  product_by_weekday: s.productByWeekday,
  closed_days: s.closedDays,
  active_period: s.activePeriod,
  notify_email: s.notifyEmail,
});
export const settingsFromRow = (r: Row | null | undefined, previous: Settings): Settings => ({
  ...previous,
  productByWeekday: (r?.product_by_weekday as string[]) ?? previous.productByWeekday,
  closedDays: (r?.closed_days as string[]) ?? previous.closedDays,
  activePeriod: (r?.active_period as Settings["activePeriod"]) ?? previous.activePeriod,
  notifyEmail: r?.notify_email === undefined ? previous.notifyEmail : String(r.notify_email),
});

export const sheetToRow = (s: Sheet): Row => ({
  id: s.id,
  agent_id: s.agentId,
  agent_name: s.agentName,
  day: s.date,
  started_at: s.startedAt,
  sent_at: s.sentAt,
  signature: s.signature,
  initials: s.initials,
  comment: s.comment,
  anomaly: s.anomaly,
  remaining: s.remaining,
  mode: s.mode,
  post: s.post,
  test: s.test,
});
export const sheetFromRow = (r: Row): Sheet => ({
  id: String(r.id),
  agentId: String(r.agent_id),
  agentName: String(r.agent_name),
  date: String(r.day),
  startedAt: String(r.started_at),
  sentAt: r.sent_at ? String(r.sent_at) : null,
  signature: String(r.signature ?? ""),
  initials: String(r.initials ?? ""),
  comment: String(r.comment ?? ""),
  anomaly: !!r.anomaly,
  remaining: (r.remaining as Sheet["remaining"]) ?? [],
  mode: r.mode === "solo" || r.mode === "duo" ? r.mode : null,
  post: post(r.post),
  test: !!r.test,
});

export const teamFromRow = (r: Row): TeamMember => ({
  agentId: String(r.agent_id),
  agentName: String(r.agent_name),
  mode: r.mode === "solo" || r.mode === "duo" ? r.mode : null,
  post: post(r.post),
});

export const deletionFromRow = (r: Row): DeletionLog => ({
  id: String(r.id),
  deletedAt: String(r.deleted_at),
  scope: r.scope as DeletionLog["scope"],
  agentName: String(r.agent_name ?? ""),
  day: r.day ? String(r.day) : "",
  reason: String(r.reason ?? ""),
  sheetCount: Number(r.sheet_count ?? 0),
  completionCount: Number(r.completion_count ?? 0),
  test: !!r.test,
});

export const completionToRow = (c: Completion): Row => ({
  id: c.id,
  task_id: c.taskId,
  due_date: c.dueDate,
  done_date: c.doneDate,
  pass_index: c.passIndex,
  status: c.status,
  agent_id: c.agentId,
  at: c.at,
  reason: c.reason,
  comment: c.comment,
  anomaly: c.anomaly,
  photos: c.photos,
  sheet_id: c.sheetId,
  snapshot: c.snapshot,
  test: c.test,
});
export const completionFromRow = (r: Row): Completion => {
  const snap = (r.snapshot ?? {}) as Partial<Completion["snapshot"]>;
  return {
    id: String(r.id),
    taskId: String(r.task_id),
    dueDate: String(r.due_date),
    doneDate: String(r.done_date),
    passIndex: Number(r.pass_index ?? 0),
    status: r.status as Completion["status"],
    agentId: r.agent_id ? String(r.agent_id) : null,
    at: String(r.at),
    reason: String(r.reason ?? ""),
    comment: String(r.comment ?? ""),
    anomaly: !!r.anomaly,
    photos: (r.photos as string[]) ?? [],
    sheetId: r.sheet_id ? String(r.sheet_id) : null,
    test: !!r.test,
    snapshot: {
      taskName: snap.taskName ?? "",
      zoneName: snap.zoneName ?? "",
      momentName: snap.momentName ?? "",
    },
  };
};

/** Lit toutes les lignes d'une requête, par paquets de 1000 (limite de Supabase). */
export async function fetchAll(
  query: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<Row[]> {
  const size = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await query(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}
