import { useEffect, useMemo, useState } from "react";
import logo from "../assets/logo.webp";
import {
  agentLabel,
  agentName,
  canEdit,
  loginAgent,
  logout,
  markNotDone,
  refreshAgents,
  REMOTE,
  sendSheet,
  setCompletionNote,
  undoCompletion,
  useData,
  useSession,
  useSync,
  validateTask,
} from "../data/store";
import { buildChecklist, isClosed, progressOf, teamStreak, type ChecklistItem } from "../domain/checklist";
import { formatDayLong, formatDayShort, formatTime, today, weekdayOf } from "../domain/dates";
import { describeRecurrence } from "../domain/recurrence";
import { NOT_DONE_REASONS, type AppData, type Completion, type Moment } from "../domain/types";
import { Btn, Empty, Field, Icon, Modal, PinPad, ProgressBar, Screen, SignaturePad, Toggle } from "../ui/components";
import { go } from "../ui/router";

// ───────── Accueil : choix du profil ─────────

export function Home() {
  const data = useData();
  const agents = data.agents.filter((a) => a.active);
  useEffect(() => {
    void refreshAgents();
  }, []);
  return (
    <div className="home">
      <img src={logo} alt="Aqua2Lacs, espace aquatique" className="home-logo" />
      <h1 className="home-title">Hygiène du centre</h1>
      <p className="home-sub">Qui prend son service ?</p>
      <div className="agent-grid">
        {agents.map((a) => (
          <button key={a.id} className="agent-tile" onClick={() => go(`/pin/${a.id}`)}>
            <span className="avatar">{a.firstName.trim()[0]?.toUpperCase()}</span>
            <span>{agentLabel(a)}</span>
          </button>
        ))}
      </div>
      {agents.length === 0 && <p className="home-sub">Aucun profil. Le responsable doit en créer un.</p>}
      <button className="home-admin" onClick={() => go("/admin")}>
        <Icon name="lock" size={18} /> Espace responsable
      </button>
    </div>
  );
}

export function PinScreen({ agentId }: { agentId: string }) {
  const data = useData();
  const agent = data.agents.find((a) => a.id === agentId && a.active);
  if (!agent) {
    return (
      <Screen title="Profil introuvable" onBack={() => go("/", true)}>
        <Empty>Ce profil n'existe plus.</Empty>
      </Screen>
    );
  }
  return (
    <Screen title={`Bonjour ${agent.firstName}`} subtitle="Tape ton code à 4 chiffres" onBack={() => go("/", true)}>
      <PinPad
        onComplete={async (pin) => {
          const error = await loginAgent(agent.id, pin);
          if (!error) go("/jour", true);
          return error;
        }}
      />
    </Screen>
  );
}

// ───────── Checklist du jour ─────────

function currentMomentId(moments: Moment[]): string | null {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const regular = moments.filter((m) => !m.bonus).sort((a, b) => a.startTime.localeCompare(b.startTime));
  let current: string | null = regular[0]?.id ?? null;
  for (const m of regular) if (m.startTime <= hhmm) current = m.id;
  return current;
}

function cheer(ratio: number, total: number): string {
  if (total === 0) return "Rien de prévu pour le moment.";
  if (ratio >= 1) return "Tout est fait. Bravo à l'équipe !";
  if (ratio >= 0.75) return "Presque fini, encore un petit effort !";
  if (ratio >= 0.5) return "La moitié est faite, beau travail !";
  if (ratio > 0) return "C'est bien parti !";
  return "C'est parti pour une belle journée !";
}

export function Today() {
  const data = useData();
  const session = useSession();
  const sync = useSync();
  const day = today();
  const sheet = data.sheets.find((s) => s.id === session.sheetId);
  const staleSheet = !!sheet && sheet.date < day;

  useEffect(() => {
    if (!session.agentId || !sheet || sheet.sentAt) go("/", true);
    else if (staleSheet) go("/recap", true);
  }, [session.agentId, sheet, staleSheet]);

  const items = useMemo(() => buildChecklist(data, day), [data, day]);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const id = currentMomentId(data.moments);
    return id ? { [id]: true } : {};
  });
  const [detailKey, setDetailKey] = useState<string | null>(null);
  // Tâches validées à l'instant : elles restent affichées un court moment, le temps de voir l'animation.
  const [popped, setPopped] = useState<string[]>([]);

  if (!session.agentId || !sheet || sheet.sentAt || staleSheet) return null;

  const keyOf = (i: ChecklistItem) => `${i.task.id}@${i.dueDate}`;
  const progress = progressOf(items);
  // En mode connecté, l'appareil ne connaît qu'une partie de l'historique : la série viendra du serveur.
  const streak = REMOTE ? 0 : teamStreak(data, day);
  const product = data.settings.productByWeekday[weekdayOf(day) - 1];
  const late = items.filter((i) => i.late);
  const detail = items.find((i) => keyOf(i) === detailKey) ?? null;
  const visible = (i: ChecklistItem) => showAll || !i.complete || popped.includes(keyOf(i));
  const moments = [...data.moments].sort((a, b) => a.order - b.order);
  const me = data.agents.find((a) => a.id === session.agentId);

  const tap = (item: ChecklistItem) => {
    if (validateTask(item)) {
      const key = keyOf(item);
      setPopped((list) => [...list, key]);
      setTimeout(() => setPopped((list) => list.filter((k) => k !== key)), 1600);
      if (navigator.vibrate) navigator.vibrate(30);
    }
  };

  const card = (item: ChecklistItem) => (
    <TaskCard
      key={keyOf(item)}
      item={item}
      data={data}
      popped={popped.includes(keyOf(item))}
      onTap={() => tap(item)}
      onOpen={() => setDetailKey(keyOf(item))}
    />
  );

  return (
    <Screen
      title={`Bonjour ${me?.firstName ?? ""}`}
      subtitle={formatDayLong(day)}
      right={
        <button
          className="iconbtn"
          aria-label="Changer d'agent"
          onClick={() => {
            logout();
            go("/", true);
          }}
        >
          <Icon name="logout" />
        </button>
      }
      footer={
        <Btn block onClick={() => go("/recap")}>
          Terminer mon service
        </Btn>
      }
    >
      <section className="hero">
        <div className="hero-row">
          <strong className="hero-count">
            {progress.done}/{progress.total}
          </strong>
          <span className="hero-cheer">{cheer(progress.ratio, progress.total)}</span>
        </div>
        <ProgressBar ratio={progress.ratio} />
        <div className="hero-chips">
          {product && (
            <span className="chip chip-product">
              Produit du jour : <strong>{product}</strong>
            </span>
          )}
          {streak >= 2 && <span className="chip chip-streak">🔥 {streak} jours complets d'affilée</span>}
          {REMOTE && (
            <span className={`chip ${sync.online && sync.pending === 0 ? "chip-sync" : "chip-offline"}`}>
              {sync.pending > 0
                ? `${sync.online ? "Envoi en cours" : "Hors ligne"} · ${sync.pending} en attente`
                : sync.online
                  ? "✓ À jour"
                  : "Hors ligne"}
            </span>
          )}
        </div>
      </section>

      {isClosed(data, day) && <Empty>Centre fermé aujourd'hui : aucune tâche prévue.</Empty>}

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={!showAll} className={!showAll ? "on" : ""} onClick={() => setShowAll(false)}>
          À faire
        </button>
        <button role="tab" aria-selected={showAll} className={showAll ? "on" : ""} onClick={() => setShowAll(true)}>
          Tout voir
        </button>
      </div>

      {late.filter(visible).length > 0 && (
        <section className="group group-late">
          <h2 className="group-title static">
            <Icon name="alert" size={20} /> En retard
          </h2>
          {late.filter(visible).map(card)}
        </section>
      )}

      {moments.map((m) => {
        const all = items.filter((i) => !i.late && i.task.momentId === m.id);
        if (all.length === 0) return null;
        const shown = all.filter(visible);
        const done = all.filter((i) => i.complete).length;
        const isOpen = !!open[m.id];
        let lastZone = "";
        return (
          <section key={m.id} className={`group${m.bonus ? " group-bonus" : ""}`}>
            <button className="group-title" onClick={() => setOpen({ ...open, [m.id]: !isOpen })} aria-expanded={isOpen}>
              <span className="group-name">
                {m.name}
                {m.bonus && <small> · facultatif</small>}
              </span>
              <span className={`group-count${done === all.length ? " full" : ""}`}>
                {done}/{all.length}
              </span>
              <Icon name={isOpen ? "up" : "down"} size={20} />
            </button>
            {isOpen &&
              (shown.length === 0 ? (
                <p className="group-done">✓ Tout est fait ici.</p>
              ) : (
                shown.map((item) => {
                  const zoneName = item.zone?.name ?? "Autre";
                  const header = zoneName !== lastZone ? <h3 className="zone-title">{zoneName}</h3> : null;
                  lastZone = zoneName;
                  return (
                    <div key={keyOf(item)}>
                      {header}
                      {card(item)}
                    </div>
                  );
                })
              ))}
          </section>
        );
      })}

      {detail && <TaskDetail item={detail} data={data} onClose={() => setDetailKey(null)} />}
    </Screen>
  );
}

function TaskCard(props: {
  item: ChecklistItem;
  data: AppData;
  popped: boolean;
  onTap: () => void;
  onOpen: () => void;
}) {
  const { item, data } = props;
  const multi = item.passes.length > 1;
  const lastDone = [...item.passes].reverse().find(Boolean) ?? null;
  const cls = ["task", item.complete && "done", item.late && "late", props.popped && "pop"].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <button
        className="task-check"
        onClick={props.onTap}
        disabled={item.complete}
        aria-label={item.complete ? `${item.task.name} : fait` : `Valider ${item.task.name}`}
      >
        {item.complete ? (
          <Icon name="check" size={34} />
        ) : multi ? (
          <span className="task-pass">
            {item.doneCount}/{item.passes.length}
          </span>
        ) : null}
      </button>
      <button className="task-body" onClick={props.onOpen}>
        <span className="task-name">{item.task.name}</span>
        {item.late && <span className="task-meta warn">Prévu le {formatDayShort(item.dueDate)}</span>}
        {lastDone && (
          <span className="task-meta ok">
            ✓ {agentName(data, lastDone.agentId)} à {formatTime(lastDone.at)}
            {multi && !item.complete ? ` · encore ${item.passes.length - item.doneCount} passage` : ""}
          </span>
        )}
        {!item.complete && item.notDone && (
          <span className="task-meta warn">
            Non fait : {item.notDone.reason} ({agentName(data, item.notDone.agentId)})
          </span>
        )}
        {!lastDone && !item.notDone && item.task.product && <span className="task-meta">{item.task.product}</span>}
        {(lastDone?.anomaly || item.notDone?.anomaly) && <span className="task-meta warn">⚠ Anomalie signalée</span>}
      </button>
      <span className="task-chevron" aria-hidden="true">
        <Icon name="chevron" size={18} />
      </span>
    </div>
  );
}

function TaskDetail({ item, data, onClose }: { item: ChecklistItem; data: AppData; onClose: () => void }) {
  const mine: Completion | null =
    [...item.passes].reverse().find((p): p is Completion => !!p && canEdit(p)) ??
    (item.notDone && canEdit(item.notDone) ? item.notDone : null);
  const [mode, setMode] = useState<"view" | "notdone">("view");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [anomaly, setAnomaly] = useState(mine?.anomaly ?? false);
  const { task } = item;

  if (mode === "notdone") {
    return (
      <Modal title="Pourquoi pas fait ?" onClose={onClose}>
        <div className="reasons">
          {NOT_DONE_REASONS.map((r) => (
            <button
              key={r}
              className={`reason${reason === r ? " on" : ""}`}
              onClick={() => {
                setReason(r);
                if (r.includes("manquant")) setAnomaly(true);
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <Field label="Commentaire (facultatif)">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </Field>
        <Toggle checked={anomaly} onChange={setAnomaly} label="Signaler une anomalie au responsable" />
        <Btn
          block
          disabled={!reason}
          onClick={() => {
            markNotDone(item, reason, comment.trim(), anomaly);
            onClose();
          }}
        >
          Enregistrer
        </Btn>
      </Modal>
    );
  }

  return (
    <Modal title={task.name} onClose={onClose}>
      <p className="detail-zone">
        {item.zone?.name} · {item.moment?.name} · {describeRecurrence(task.recurrence)}
      </p>
      {item.late && <p className="detail-late">En retard : prévu le {formatDayLong(item.dueDate)}</p>}
      {task.description && <p className="detail-text">{task.description}</p>}
      <dl className="detail-list">
        {task.material && (
          <>
            <dt>Matériel</dt>
            <dd>{task.material}</dd>
          </>
        )}
        {task.product && (
          <>
            <dt>Produit</dt>
            <dd>{task.product}</dd>
          </>
        )}
        {task.durationMin > 0 && (
          <>
            <dt>Durée</dt>
            <dd>{task.durationMin} min</dd>
          </>
        )}
      </dl>

      {item.passes.some(Boolean) && (
        <ul className="pass-list">
          {item.passes.map((p, i) =>
            p ? (
              <li key={p.id}>
                <span>
                  ✓ {item.passes.length > 1 ? `Passage ${i + 1} : ` : ""}
                  {agentName(data, p.agentId)} à {formatTime(p.at)}
                </span>
                {canEdit(p) && (
                  <Btn kind="ghost" small onClick={() => undoCompletion(p.id)}>
                    Annuler
                  </Btn>
                )}
              </li>
            ) : null,
          )}
        </ul>
      )}
      {item.notDone && !item.complete && (
        <p className="detail-late">
          Non fait : {item.notDone.reason} ({agentName(data, item.notDone.agentId)})
          {item.notDone.comment ? ` — ${item.notDone.comment}` : ""}
        </p>
      )}

      {mine && (
        <div className="note-box">
          <Field label="Commentaire">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Ex. : distributeur de savon cassé"
            />
          </Field>
          <Toggle checked={anomaly} onChange={setAnomaly} label="Signaler une anomalie au responsable" />
          <Btn
            kind="secondary"
            block
            disabled={comment.trim() === mine.comment && anomaly === mine.anomaly}
            onClick={() => {
              setCompletionNote(mine.id, comment.trim(), anomaly);
              onClose();
            }}
          >
            Enregistrer le commentaire
          </Btn>
        </div>
      )}

      {!item.complete && (
        <div className="detail-actions">
          <Btn
            kind="success"
            block
            onClick={() => {
              validateTask(item);
              onClose();
            }}
          >
            <Icon name="check" /> C'est fait
          </Btn>
          <Btn kind="secondary" block onClick={() => setMode("notdone")}>
            Pas fait…
          </Btn>
        </div>
      )}
    </Modal>
  );
}

// ───────── Récapitulatif et signature ─────────

export function Recap() {
  const data = useData();
  const session = useSession();
  const sheet = data.sheets.find((s) => s.id === session.sheetId);
  const [signature, setSignature] = useState("");
  const [initials, setInitials] = useState("");
  const [useInitials, setUseInitials] = useState(false);
  const [comment, setComment] = useState("");
  const [anomaly, setAnomaly] = useState(false);

  useEffect(() => {
    if (!session.agentId || !sheet || sheet.sentAt) go("/", true);
  }, [session.agentId, sheet]);
  if (!session.agentId || !sheet || sheet.sentAt) return null;

  const mine = data.completions.filter((c) => c.sheetId === sheet.id).sort((a, b) => a.at.localeCompare(b.at));
  const done = mine.filter((c) => c.status === "done");
  const notDone = mine.filter((c) => c.status === "not_done");
  const caughtUp = done.filter((c) => c.dueDate < c.doneDate);
  const anomalies = mine.filter((c) => c.anomaly);
  const remaining = buildChecklist(data, sheet.date).filter((i) => !i.bonus && !i.complete);
  const stale = sheet.date < today();
  const ready = useInitials ? initials.trim().length >= 2 : signature !== "";

  return (
    <Screen
      title="Ma fiche"
      subtitle={`${sheet.agentName} · ${formatDayLong(sheet.date)}`}
      onBack={stale ? undefined : () => go("/jour", true)}
      footer={
        <Btn
          block
          kind="success"
          disabled={!ready}
          onClick={() => {
            sendSheet(sheet.id, {
              signature: useInitials ? "" : signature,
              initials: useInitials ? initials.trim().toUpperCase() : "",
              comment: comment.trim(),
              anomaly,
            });
            go("/merci", true);
          }}
        >
          Signer et envoyer ma fiche
        </Btn>
      }
    >
      {stale && (
        <p className="banner-warn">
          Ta fiche du {formatDayLong(sheet.date)} n'a pas été envoyée. Signe-la pour commencer un nouveau service.
        </p>
      )}

      <div className="stats">
        <div className="stat ok">
          <strong>{done.length}</strong>
          <span>faites</span>
        </div>
        <div className="stat warn">
          <strong>{notDone.length}</strong>
          <span>non faites</span>
        </div>
        <div className="stat">
          <strong>{caughtUp.length}</strong>
          <span>retards rattrapés</span>
        </div>
      </div>

      {done.length > 0 && (
        <section className="card">
          <h2>Mes tâches faites</h2>
          <ul className="recap-list">
            {done.map((c) => (
              <li key={c.id}>
                <span className="recap-time">{formatTime(c.at)}</span>
                <span>
                  {c.snapshot.taskName}
                  {c.dueDate < c.doneDate && <em className="tag warn">retard rattrapé</em>}
                  {c.comment && <small>« {c.comment} »</small>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notDone.length > 0 && (
        <section className="card">
          <h2>Non faites</h2>
          <ul className="recap-list">
            {notDone.map((c) => (
              <li key={c.id}>
                <span className="recap-time">{formatTime(c.at)}</span>
                <span>
                  {c.snapshot.taskName}
                  <small>
                    {c.reason}
                    {c.comment ? ` — ${c.comment}` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {anomalies.length > 0 && (
        <p className="banner-warn">
          ⚠ {anomalies.length} anomalie{anomalies.length > 1 ? "s" : ""} signalée{anomalies.length > 1 ? "s" : ""} au
          responsable.
        </p>
      )}

      {mine.length === 0 && <Empty>Tu n'as validé aucune tâche pendant ce service.</Empty>}

      <p className="recap-remaining">
        {remaining.length === 0
          ? "Toute la checklist du jour est faite. Bravo !"
          : `Il reste ${remaining.length} tâche${remaining.length > 1 ? "s" : ""} pour l'équipe aujourd'hui.`}
      </p>

      <section className="card">
        <h2>Un mot pour le responsable ?</h2>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Facultatif"
          aria-label="Commentaire général"
        />
        <Toggle checked={anomaly} onChange={setAnomaly} label="C'est une anomalie à signaler" />
      </section>

      <section className="card">
        <h2>Ma signature</h2>
        {useInitials ? (
          <Field label="Mes initiales">
            <input
              className="initials-input"
              value={initials}
              maxLength={4}
              onChange={(e) => setInitials(e.target.value.replace(/[^a-zA-ZÀ-ÿ]/g, ""))}
              autoCapitalize="characters"
              placeholder="Ex. : CD"
            />
          </Field>
        ) : (
          <SignaturePad onChange={setSignature} />
        )}
        <button className="linkbtn" onClick={() => setUseInitials(!useInitials)}>
          {useInitials ? "Signer au doigt à la place" : "Mettre mes initiales à la place"}
        </button>
      </section>
    </Screen>
  );
}

export function Thanks() {
  const session = useSession();
  const data = useData();
  const sync = useSync();
  const sheet = data.sheets.find((s) => s.id === session.sheetId);
  const count = data.completions.filter((c) => c.sheetId === sheet?.id && c.status === "done").length;
  const finish = () => {
    logout();
    go("/", true);
  };
  return (
    <div className="thanks">
      <div className="thanks-check">
        <Icon name="check" size={72} />
      </div>
      <h1>{sync.pending > 0 ? "Fiche enregistrée !" : "Fiche envoyée !"}</h1>
      {sync.pending > 0 && <p>Pas de réseau pour le moment : elle partira toute seule dès qu'il reviendra.</p>}
      <p>
        {count > 0
          ? `${count} tâche${count > 1 ? "s" : ""} validée${count > 1 ? "s" : ""}. Merci pour ton travail${sheet ? `, ${sheet.agentName.split(" ")[0]}` : ""} !`
          : "Merci, bonne fin de journée !"}
      </p>
      <Btn onClick={finish}>Terminer</Btn>
    </div>
  );
}
