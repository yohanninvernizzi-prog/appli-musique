import { useState } from "react";
import {
  addAgent,
  agentLabel,
  deleteTask,
  deleteZone,
  moveZone,
  removeAgent,
  resetDemo,
  saveMoment,
  saveTask,
  saveZone,
  setAdminPin,
  setAgentPin,
  uid,
  updateAgent,
  updateSettings,
  useData,
} from "../data/store";
import { formatDayLong, today, WEEKDAY_NAMES, WEEKDAY_SHORT } from "../domain/dates";
import { describeRecurrence } from "../domain/recurrence";
import type { Period, Recurrence, Task, Weekday } from "../domain/types";
import { Btn, ConfirmBtn, Empty, Field, Icon, Modal, Screen, Toggle } from "../ui/components";
import { back, go } from "../ui/router";
import { AdminShell } from "./admin";

// ───────── Liste des tâches ─────────

export function AdminTasks() {
  const data = useData();
  const [zoneId, setZoneId] = useState("");
  const [query, setQuery] = useState("");
  const zones = [...data.zones].sort((a, b) => a.order - b.order);
  const q = query.trim().toLowerCase();
  const tasks = data.tasks
    .filter((t) => !zoneId || t.zoneId === zoneId)
    .filter((t) => !q || t.name.toLowerCase().includes(q))
    .sort((a, b) => a.order - b.order);
  const momentName = (id: string) => data.moments.find((m) => m.id === id)?.name ?? "";

  return (
    <AdminShell tab="taches" title="Tâches" subtitle={`${data.tasks.filter((t) => t.active).length} actives`}>
      <div className="btn-row">
        <Btn onClick={() => go("/admin/tache/nouvelle")}>
          <Icon name="plus" /> Nouvelle tâche
        </Btn>
        <Btn kind="secondary" onClick={() => go("/admin/tache/ponctuelle")}>
          <Icon name="plus" /> Ponctuelle
        </Btn>
      </div>
      <section className="card filters">
        <Field label="Zone">
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Toutes les zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Recherche">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom de la tâche" />
        </Field>
      </section>
      <button className="linkbtn" onClick={() => go("/admin/zones")}>
        Gérer les zones et les moments de la journée
      </button>

      {zones.map((z) => {
        const list = tasks.filter((t) => t.zoneId === z.id);
        if (list.length === 0) return null;
        return (
          <section key={z.id} className="card">
            <h2>{z.name}</h2>
            {list.map((t) => (
              <button key={t.id} className={`row${t.active ? "" : " off"}`} onClick={() => go(`/admin/tache/${t.id}`)}>
                <span className="row-main">
                  <strong>{t.name}</strong>
                  <small>
                    {momentName(t.momentId)} · {describeRecurrence(t.recurrence)}
                    {t.passes > 1 ? ` · ${t.passes} passages` : ""}
                    {t.active ? "" : " · désactivée"}
                  </small>
                </span>
                <Icon name="chevron" size={18} />
              </button>
            ))}
          </section>
        );
      })}
      {tasks.length === 0 && <Empty>Aucune tâche ne correspond.</Empty>}
    </AdminShell>
  );
}

// ───────── Édition d'une tâche ─────────

const REC_TYPES: [Recurrence["type"], string][] = [
  ["daily", "Tous les jours"],
  ["weekdays", "Certains jours de la semaine"],
  ["monthly_nth", "Mensuelle : ex. 1er lundi du mois"],
  ["monthly_day", "Mensuelle : le X du mois"],
  ["every_x_days", "Tous les X jours"],
  ["once", "Ponctuelle (une seule date)"],
];

function defaultRecurrence(type: Recurrence["type"]): Recurrence {
  switch (type) {
    case "daily":
      return { type };
    case "weekdays":
      return { type, days: [1] };
    case "monthly_nth":
      return { type, nth: 1, weekday: 1 };
    case "monthly_day":
      return { type, day: 1 };
    case "every_x_days":
      return { type, interval: 3, startDate: today() };
    case "once":
      return { type, date: today() };
  }
}

function RecurrenceEditor({ value, onChange }: { value: Recurrence; onChange: (r: Recurrence) => void }) {
  return (
    <>
      <Field label="Récurrence">
        <select
          value={value.type}
          onChange={(e) => onChange(defaultRecurrence(e.target.value as Recurrence["type"]))}
        >
          {REC_TYPES.map(([t, label]) => (
            <option key={t} value={t}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {value.type === "weekdays" && (
        <div className="daypick" role="group" aria-label="Jours de la semaine">
          {WEEKDAY_SHORT.map((label, i) => {
            const d = (i + 1) as Weekday;
            const on = value.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                className={on ? "on" : ""}
                aria-pressed={on}
                onClick={() => {
                  const days = on ? value.days.filter((x) => x !== d) : [...value.days, d].sort();
                  if (days.length > 0) onChange({ ...value, days });
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {value.type === "monthly_nth" && (
        <div className="two">
          <Field label="Rang">
            <select
              value={value.nth}
              onChange={(e) => onChange({ ...value, nth: Number(e.target.value) as 1 | 2 | 3 | 4 | -1 })}
            >
              <option value={1}>1er</option>
              <option value={2}>2e</option>
              <option value={3}>3e</option>
              <option value={4}>4e</option>
              <option value={-1}>Dernier</option>
            </select>
          </Field>
          <Field label="Jour">
            <select
              value={value.weekday}
              onChange={(e) => onChange({ ...value, weekday: Number(e.target.value) as Weekday })}
            >
              {WEEKDAY_NAMES.map((n, i) => (
                <option key={n} value={i + 1}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {value.type === "monthly_day" && (
        <Field label="Jour du mois" hint="Si le mois est plus court, la tâche tombe le dernier jour.">
          <input
            type="number"
            min={1}
            max={31}
            value={value.day}
            onChange={(e) => onChange({ ...value, day: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </Field>
      )}
      {value.type === "every_x_days" && (
        <div className="two">
          <Field label="Tous les … jours">
            <input
              type="number"
              min={2}
              max={365}
              value={value.interval}
              onChange={(e) => onChange({ ...value, interval: Math.max(2, Number(e.target.value) || 2) })}
            />
          </Field>
          <Field label="À partir du">
            <input
              type="date"
              value={value.startDate}
              onChange={(e) => e.target.value && onChange({ ...value, startDate: e.target.value })}
            />
          </Field>
        </div>
      )}
      {value.type === "once" && (
        <Field label="Date">
          <input
            type="date"
            value={value.date}
            onChange={(e) => e.target.value && onChange({ ...value, date: e.target.value })}
          />
        </Field>
      )}
    </>
  );
}

export function AdminTaskEdit({ id }: { id: string }) {
  const data = useData();
  const isNew = id === "nouvelle" || id === "ponctuelle";
  const existing = data.tasks.find((t) => t.id === id);
  const zones = [...data.zones].sort((a, b) => a.order - b.order);
  const moments = [...data.moments].sort((a, b) => a.order - b.order);
  const [task, setTask] = useState<Task | null>(() => {
    if (existing) return existing;
    if (!isNew) return null;
    return {
      id: uid(),
      name: "",
      zoneId: zones[0]?.id ?? "",
      momentId: moments[0]?.id ?? "",
      description: "",
      material: "",
      product: "",
      durationMin: 0,
      photoRequired: false,
      passes: 1,
      recurrence: defaultRecurrence(id === "ponctuelle" ? "once" : "daily"),
      period: "all",
      active: true,
      order: Math.max(0, ...data.tasks.map((t) => t.order)) + 1,
      createdOn: today(),
    };
  });

  if (!task) {
    return (
      <Screen title="Tâche introuvable" onBack={() => back("/admin/taches")}>
        <Empty>Cette tâche n'existe plus.</Empty>
      </Screen>
    );
  }
  const set = (patch: Partial<Task>) => setTask({ ...task, ...patch });
  const valid = task.name.trim() !== "" && task.zoneId !== "" && task.momentId !== "";

  return (
    <Screen
      title={isNew ? (id === "ponctuelle" ? "Tâche ponctuelle" : "Nouvelle tâche") : "Modifier la tâche"}
      onBack={() => back("/admin/taches")}
      footer={
        <Btn
          block
          disabled={!valid}
          onClick={() => {
            saveTask({ ...task, name: task.name.trim() });
            back("/admin/taches");
          }}
        >
          Enregistrer
        </Btn>
      }
    >
      <section className="card form">
        <Field label="Nom de la tâche">
          <input value={task.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex. : Désincrustant douches wellness" />
        </Field>
        <div className="two">
          <Field label="Zone">
            <select value={task.zoneId} onChange={(e) => set({ zoneId: e.target.value })}>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Moment">
            <select value={task.momentId} onChange={(e) => set({ momentId: e.target.value })}>
              {moments.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Consigne">
          <textarea rows={4} value={task.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="two">
          <Field label="Matériel">
            <input value={task.material} onChange={(e) => set({ material: e.target.value })} />
          </Field>
          <Field label="Produit">
            <input value={task.product} onChange={(e) => set({ product: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="card form">
        <RecurrenceEditor value={task.recurrence} onChange={(recurrence) => set({ recurrence })} />
        <div className="two">
          <Field label="Passages par jour">
            <input
              type="number"
              min={1}
              max={10}
              value={task.passes}
              onChange={(e) => set({ passes: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </Field>
          <Field label="Durée (minutes)">
            <input
              type="number"
              min={0}
              max={600}
              value={task.durationMin || ""}
              placeholder="Non renseignée"
              onChange={(e) => set({ durationMin: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
        </div>
        <Field label="Période">
          <select value={task.period} onChange={(e) => set({ period: e.target.value as Period })}>
            <option value="all">Toute l'année</option>
            <option value="scolaire">Période scolaire uniquement</option>
            <option value="vacances">Vacances uniquement</option>
          </select>
        </Field>
        <Toggle checked={task.photoRequired} onChange={(photoRequired) => set({ photoRequired })} label="Photo obligatoire" />
        <Toggle checked={task.active} onChange={(active) => set({ active })} label="Tâche active" />
      </section>

      {!isNew && (
        <ConfirmBtn
          confirm="Confirmer la suppression"
          onConfirm={() => {
            deleteTask(task.id);
            back("/admin/taches");
          }}
        >
          Supprimer cette tâche
        </ConfirmBtn>
      )}
    </Screen>
  );
}

// ───────── Zones et moments ─────────

export function AdminZones() {
  const data = useData();
  const zones = [...data.zones].sort((a, b) => a.order - b.order);
  const moments = [...data.moments].sort((a, b) => a.order - b.order);
  const [newZone, setNewZone] = useState("");
  const [blocked, setBlocked] = useState("");

  return (
    <Screen title="Zones et moments" onBack={() => back("/admin/taches")}>
      <section className="card form">
        <h2>Zones</h2>
        {zones.map((z, i) => (
          <div key={z.id} className="edit-row">
            <input value={z.name} onChange={(e) => saveZone({ ...z, name: e.target.value })} aria-label="Nom de la zone" />
            <button className="iconbtn dark" disabled={i === 0} onClick={() => moveZone(z.id, -1)} aria-label="Monter">
              <Icon name="up" />
            </button>
            <button
              className="iconbtn dark"
              disabled={i === zones.length - 1}
              onClick={() => moveZone(z.id, 1)}
              aria-label="Descendre"
            >
              <Icon name="down" />
            </button>
            <button
              className="iconbtn dark"
              aria-label={`Supprimer ${z.name}`}
              onClick={() => setBlocked(deleteZone(z.id) ? "" : z.name)}
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
        {blocked && (
          <p className="banner-warn">
            « {blocked} » contient encore des tâches. Déplacez-les ou supprimez-les d'abord.
          </p>
        )}
        <div className="edit-row">
          <input value={newZone} onChange={(e) => setNewZone(e.target.value)} placeholder="Nouvelle zone" />
          <Btn
            small
            disabled={!newZone.trim()}
            onClick={() => {
              saveZone({ id: uid(), name: newZone.trim(), order: zones.length });
              setNewZone("");
            }}
          >
            Ajouter
          </Btn>
        </div>
      </section>

      <section className="card form">
        <h2>Moments de la journée</h2>
        <p className="detail-zone">L'heure sert à ouvrir automatiquement le bon bloc pour l'agent.</p>
        {moments.map((m) => (
          <div key={m.id} className="edit-row">
            <input value={m.name} onChange={(e) => saveMoment({ ...m, name: e.target.value })} aria-label="Nom du moment" />
            {!m.bonus && (
              <input
                type="time"
                className="time-input"
                value={m.startTime}
                onChange={(e) => e.target.value && saveMoment({ ...m, startTime: e.target.value })}
                aria-label={`Heure de début de ${m.name}`}
              />
            )}
          </div>
        ))}
      </section>
    </Screen>
  );
}

// ───────── Équipe ─────────

const isPin = (s: string) => /^\d{4}$/.test(s);

export function AdminTeam() {
  const data = useData();
  const active = data.agents.filter((a) => a.active);
  const removed = data.agents.filter((a) => !a.active);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [pin, setPin] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const editing = data.agents.find((a) => a.id === editId);
  const [newPin, setNewPin] = useState("");

  return (
    <AdminShell tab="equipe" title="Équipe" subtitle={`${active.length} profil${active.length > 1 ? "s" : ""}`}>
      <section className="card">
        {active.length === 0 && <Empty>Aucun profil.</Empty>}
        {active.map((a) => (
          <button
            key={a.id}
            className="row"
            onClick={() => {
              setEditId(a.id);
              setNewPin("");
            }}
          >
            <span className="avatar small">{a.firstName.trim()[0]?.toUpperCase()}</span>
            <span className="row-main">
              <strong>
                {a.firstName} {a.lastName}
              </strong>
              <small>Affiché « {agentLabel(a)} »</small>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        ))}
      </section>

      <section className="card form">
        <h2>Créer un profil</h2>
        <div className="two">
          <Field label="Prénom">
            <input value={first} onChange={(e) => setFirst(e.target.value)} />
          </Field>
          <Field label="Nom">
            <input value={last} onChange={(e) => setLast(e.target.value)} />
          </Field>
        </div>
        <Field label="Code PIN (4 chiffres)">
          <input
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Btn
          block
          disabled={!first.trim() || !isPin(pin)}
          onClick={() => {
            addAgent(first.trim(), last.trim(), pin);
            setFirst("");
            setLast("");
            setPin("");
          }}
        >
          Créer le profil
        </Btn>
      </section>

      {removed.length > 0 && (
        <section className="card">
          <h2>Profils supprimés</h2>
          <p className="detail-zone">Conservés pour que leur nom reste lisible dans l'historique.</p>
          {removed.map((a) => (
            <div key={a.id} className="edit-row">
              <span className="grow">
                {a.firstName} {a.lastName}
              </span>
              <Btn small kind="secondary" onClick={() => updateAgent(a.id, { active: true })}>
                Rétablir
              </Btn>
            </div>
          ))}
        </section>
      )}

      {editing && (
        <Modal title={`${editing.firstName} ${editing.lastName}`} onClose={() => setEditId(null)}>
          <div className="two">
            <Field label="Prénom">
              <input value={editing.firstName} onChange={(e) => updateAgent(editing.id, { firstName: e.target.value })} />
            </Field>
            <Field label="Nom">
              <input value={editing.lastName} onChange={(e) => updateAgent(editing.id, { lastName: e.target.value })} />
            </Field>
          </div>
          <Field label="Nouveau code PIN (4 chiffres)">
            <input
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Btn
            block
            kind="secondary"
            disabled={!isPin(newPin)}
            onClick={() => {
              setAgentPin(editing.id, newPin);
              setNewPin("");
              setEditId(null);
            }}
          >
            Changer le code
          </Btn>
          <ConfirmBtn
            confirm="Confirmer la suppression"
            onConfirm={() => {
              removeAgent(editing.id);
              setEditId(null);
            }}
          >
            Supprimer ce profil
          </ConfirmBtn>
        </Modal>
      )}
    </AdminShell>
  );
}

// ───────── Réglages ─────────

export function AdminSettings() {
  const data = useData();
  const { settings } = data;
  const [closedDay, setClosedDay] = useState("");
  const [pin, setPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);

  return (
    <AdminShell tab="reglages" title="Réglages">
      <section className="card form">
        <h2>Produit du jour</h2>
        {WEEKDAY_NAMES.map((name, i) => (
          <div key={name} className="edit-row">
            <span className="day-label">{name}</span>
            <input
              value={settings.productByWeekday[i] ?? ""}
              aria-label={`Produit du ${name.toLowerCase()}`}
              onChange={(e) => {
                const productByWeekday = [...settings.productByWeekday];
                productByWeekday[i] = e.target.value;
                updateSettings({ productByWeekday });
              }}
            />
          </div>
        ))}
      </section>

      <section className="card form">
        <h2>Jours de fermeture</h2>
        <p className="detail-zone">Aucune tâche n'est demandée ces jours-là.</p>
        {[...settings.closedDays].sort().map((d) => (
          <div key={d} className="edit-row">
            <span className="grow">{formatDayLong(d)}</span>
            <button
              className="iconbtn dark"
              aria-label="Retirer"
              onClick={() => updateSettings({ closedDays: settings.closedDays.filter((x) => x !== d) })}
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
        <div className="edit-row">
          <input type="date" value={closedDay} onChange={(e) => setClosedDay(e.target.value)} aria-label="Jour fermé" />
          <Btn
            small
            disabled={!closedDay || settings.closedDays.includes(closedDay)}
            onClick={() => {
              updateSettings({ closedDays: [...settings.closedDays, closedDay] });
              setClosedDay("");
            }}
          >
            Ajouter
          </Btn>
        </div>
      </section>

      <section className="card form">
        <h2>Période en cours</h2>
        <Field label="Période" hint="Les tâches marquées « scolaire » ou « vacances » suivent ce réglage.">
          <select
            value={settings.activePeriod}
            onChange={(e) => updateSettings({ activePeriod: e.target.value as "scolaire" | "vacances" })}
          >
            <option value="scolaire">Période scolaire</option>
            <option value="vacances">Vacances</option>
          </select>
        </Field>
      </section>

      <section className="card form">
        <h2>Code d'accès responsable</h2>
        <Field label="Nouveau code (4 chiffres)">
          <input
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setPinSaved(false);
            }}
          />
        </Field>
        <Btn
          block
          kind="secondary"
          disabled={!isPin(pin)}
          onClick={() => {
            setAdminPin(pin);
            setPin("");
            setPinSaved(true);
          }}
        >
          Changer le code
        </Btn>
        {pinSaved && <p className="group-done">✓ Code modifié.</p>}
      </section>

      <section className="card form">
        <h2>Mode démonstration</h2>
        <p className="detail-zone">
          Les données sont enregistrées uniquement sur cet appareil. Elles seront partagées entre les téléphones à
          l'étape suivante.
        </p>
        <ConfirmBtn
          confirm="Confirmer : tout effacer"
          onConfirm={() => {
            resetDemo();
            go("/", true);
          }}
        >
          Réinitialiser la démonstration
        </ConfirmBtn>
      </section>
    </AdminShell>
  );
}
