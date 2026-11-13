import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  agentLabel,
  agentName,
  cancelOccurrence,
  deleteSheet,
  ensureHistory,
  loginAdmin,
  loginAdminRemote,
  logout,
  REMOTE,
  setViewTests,
  useData,
  useSync,
  useViewTests,
} from "../data/store";
import { buildChecklist, isClosed, progressOf } from "../domain/checklist";
import { addDays, formatDayLong, formatDayNumeric, formatDayShort, formatTime, toDay, today } from "../domain/dates";
import type { AppData, Sheet } from "../domain/types";
import { Btn, ConfirmBtn, Empty, Field, Icon, Modal, PinPad, ProgressBar, Screen, Toggle } from "../ui/components";
import { back, go } from "../ui/router";

export function AdminLogin() {
  const sync = useSync();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!REMOTE) {
    return (
      <Screen title="Espace responsable" subtitle="Code d'accès" onBack={() => go("/", true)}>
        <PinPad
          onComplete={(pin) => {
            if (!loginAdmin(pin)) return "Code incorrect, réessaie.";
            go("/admin/jour", true);
            return null;
          }}
        />
      </Screen>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError("");
    const message = await loginAdminRemote(email.trim(), password);
    setBusy(false);
    if (message) setError(message);
    else go("/admin/jour", true);
  };

  return (
    <Screen title="Espace responsable" subtitle="Connexion" onBack={() => go("/", true)}>
      {!sync.authReady ? (
        <Empty>Chargement…</Empty>
      ) : (
        <form
          className="card form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="E-mail">
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Mot de passe">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <p className="banner-warn" role="alert">
              {error}
            </p>
          )}
          <Btn block submit disabled={busy || !email.trim() || !password}>
            {busy ? "Connexion…" : "Se connecter"}
          </Btn>
        </form>
      )}
    </Screen>
  );
}

const TABS: [path: string, label: string][] = [
  ["jour", "Jour"],
  ["historique", "Historique"],
  ["taches", "Tâches"],
  ["equipe", "Équipe"],
  ["reglages", "Réglages"],
];

export function AdminShell(props: { tab: string; title: string; subtitle?: ReactNode; children: ReactNode }) {
  const sync = useSync();
  return (
    <Screen
      title={props.title}
      subtitle={props.subtitle}
      right={
        <button
          className="iconbtn"
          aria-label="Quitter l'espace responsable"
          onClick={() => {
            logout();
            go("/", true);
          }}
        >
          <Icon name="logout" />
        </button>
      }
      footer={
        <nav className="tabs">
          {TABS.map(([path, label]) => (
            <button key={path} className={props.tab === path ? "on" : ""} onClick={() => go(`/admin/${path}`, true)}>
              {label}
            </button>
          ))}
        </nav>
      }
    >
      {REMOTE && !sync.online && (
        <p className="banner-warn" role="status">
          Pas de réseau : les informations affichées ne sont peut-être pas à jour.
        </p>
      )}
      {props.children}
    </Screen>
  );
}

/** Bascule entre les données réelles et celles des profils de test. */
function TestSwitch() {
  const viewTests = useViewTests();
  return (
    <div className={viewTests ? "banner-test" : "test-switch"}>
      <Toggle checked={viewTests} onChange={setViewTests} label="Voir les données de test" />
    </div>
  );
}

const modeLabel = (sheet: Sheet) =>
  sheet.mode === "duo" ? `à deux · poste ${sheet.post}` : sheet.mode === "solo" ? "seul" : "";

function sheetCounts(data: AppData, sheet: Sheet) {
  const comps = data.completions.filter((c) => c.sheetId === sheet.id);
  return {
    done: comps.filter((c) => c.status === "done").length,
    notDone: comps.filter((c) => c.status === "not_done").length,
    anomalies: comps.filter((c) => c.anomaly).length + (sheet.anomaly ? 1 : 0),
  };
}

function SheetRow({ data, sheet, showDate }: { data: AppData; sheet: Sheet; showDate?: boolean }) {
  const n = sheetCounts(data, sheet);
  return (
    <button className="row" onClick={() => go(`/admin/fiche/${sheet.id}`)}>
      <span className="row-main">
        <strong>{sheet.agentName}</strong>
        <small>
          {showDate ? `${formatDayNumeric(sheet.date)} · ` : ""}
          {sheet.sentAt ? `Envoyée à ${formatTime(sheet.sentAt)}` : `En cours depuis ${formatTime(sheet.startedAt)}`}
        </small>
      </span>
      <span className="row-tags">
        {sheet.test && <em className="tag warn">test</em>}
        {sheet.mode && <em className="tag">{modeLabel(sheet)}</em>}
        <em className="tag ok">{n.done} faites</em>
        {n.notDone > 0 && <em className="tag warn">{n.notDone} non faites</em>}
        {n.anomalies > 0 && <em className="tag danger">⚠ {n.anomalies}</em>}
        {!sheet.sentAt && <em className="tag">non envoyée</em>}
      </span>
      <Icon name="chevron" size={18} />
    </button>
  );
}

// ───────── Vue du jour ─────────

export function AdminDay() {
  const data = useData();
  const [day, setDay] = useState(today());
  const viewTests = useViewTests();
  const items = useMemo(() => buildChecklist(data, day, viewTests), [data, day, viewTests]);
  const progress = progressOf(items);
  const sheets = data.sheets
    .filter((s) => s.date === day && s.test === viewTests)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const taskAnomalies = data.completions.filter((c) => c.doneDate === day && c.anomaly && c.test === viewTests);
  const sheetAnomalies = sheets.filter((s) => s.anomaly && s.sentAt);
  // Les tâches essentielles manquantes d'abord : ce sont elles qui comptent même en effectif réduit.
  const missing = items
    .filter((i) => !i.bonus && !i.complete)
    .sort((a, b) => Number(b.task.essential) - Number(a.task.essential));
  const missingEssential = missing.filter((i) => i.task.essential).length;
  const isToday = day === today();

  return (
    <AdminShell tab="jour" title="Vue du jour" subtitle={formatDayLong(day)}>
      <TestSwitch />
      <div className="daynav">
        <button className="iconbtn dark" onClick={() => setDay(addDays(day, -1))} aria-label="Jour précédent">
          <Icon name="back" />
        </button>
        <input type="date" value={day} max={today()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <button
          className="iconbtn dark"
          onClick={() => setDay(addDays(day, 1))}
          disabled={isToday}
          aria-label="Jour suivant"
        >
          <Icon name="chevron" />
        </button>
      </div>

      {isClosed(data, day) ? (
        <Empty>Centre déclaré fermé ce jour-là.</Empty>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <strong>{Math.round(progress.ratio * 100)} %</strong>
              <span>réalisé</span>
            </div>
            <div className="stat ok">
              <strong>{sheets.filter((s) => s.sentAt).length}</strong>
              <span>fiches reçues</span>
            </div>
            <div className={`stat${missing.length ? " warn" : ""}`}>
              <strong>{missing.length}</strong>
              <span>{isToday ? "restantes" : "non réalisées"}</span>
            </div>
            <div className={`stat${taskAnomalies.length + sheetAnomalies.length ? " danger" : ""}`}>
              <strong>{taskAnomalies.length + sheetAnomalies.length}</strong>
              <span>anomalies</span>
            </div>
          </div>
          <ProgressBar ratio={progress.ratio} />

          {(taskAnomalies.length > 0 || sheetAnomalies.length > 0) && (
            <section className="card card-danger">
              <h2>⚠ Anomalies signalées</h2>
              <ul className="recap-list">
                {taskAnomalies.map((c) => (
                  <li key={c.id}>
                    <span className="recap-time">{formatTime(c.at)}</span>
                    <span>
                      {c.snapshot.taskName}
                      <small>
                        {agentName(data, c.agentId)} · {c.snapshot.zoneName}
                        {c.reason ? ` · ${c.reason}` : ""}
                      </small>
                      {c.comment && <small>« {c.comment} »</small>}
                    </span>
                  </li>
                ))}
                {sheetAnomalies.map((s) => (
                  <li key={s.id}>
                    <span className="recap-time">{s.sentAt ? formatTime(s.sentAt) : ""}</span>
                    <span>
                      Signalement général
                      <small>{s.agentName}</small>
                      {s.comment && <small>« {s.comment} »</small>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2>Fiches</h2>
            {sheets.length === 0 && <Empty>Aucune fiche pour ce jour.</Empty>}
            {sheets.map((s) => (
              <SheetRow key={s.id} data={data} sheet={s} />
            ))}
          </section>

          <section className="card">
            <h2>{isToday ? "Tâches restantes" : "Tâches non réalisées"}</h2>
            {missing.length === 0 && <Empty>Tout a été fait.</Empty>}
            {missing.length > 0 && (
              <p className="detail-zone">
                Dont {missingEssential} essentielle{missingEssential > 1 ? "s" : ""}. Les autres ne sont pas demandées à
                un agent seul.
              </p>
            )}
            <ul className="recap-list">
              {missing.map((i) => (
                <li key={`${i.task.id}@${i.dueDate}`}>
                  <span>
                    {i.task.name}
                    {i.task.essential && <em className="tag danger">essentielle</em>}
                    {i.late && <em className="tag warn">en retard depuis le {formatDayShort(i.dueDate)}</em>}
                    <small>
                      {i.zone?.name} · {i.moment?.name}
                      {i.passes.length > 1 ? ` · ${i.doneCount}/${i.passes.length} passages` : ""}
                    </small>
                    {i.notDone && (
                      <small>
                        Non fait : {i.notDone.reason} ({agentName(data, i.notDone.agentId)})
                        {i.notDone.comment ? ` — ${i.notDone.comment}` : ""}
                      </small>
                    )}
                    {i.late && isToday && (
                      <ConfirmBtn small confirm="Confirmer l'annulation" onConfirm={() => cancelOccurrence(i)}>
                        Annuler cette échéance
                      </ConfirmBtn>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </AdminShell>
  );
}

// ───────── Historique ─────────

export function AdminHistory() {
  const data = useData();
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [agentId, setAgentId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const zoneName = data.zones.find((z) => z.id === zoneId)?.name;
  const viewTests = useViewTests();
  useEffect(() => ensureHistory(from), [from]);

  const sheets = data.sheets
    .filter((s) => s.date >= from && s.date <= to && s.test === viewTests)
    .filter((s) => !agentId || s.agentId === agentId)
    .filter(
      (s) => !zoneName || data.completions.some((c) => c.sheetId === s.id && c.snapshot.zoneName === zoneName),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <AdminShell tab="historique" title="Historique" subtitle={`${sheets.length} fiche${sheets.length > 1 ? "s" : ""}`}>
      <TestSwitch />
      <section className="card filters">
        <Field label="Du">
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </Field>
        <Field label="Au">
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </Field>
        <Field label="Agent">
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Tous</option>
            {data.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {agentLabel(a)}
                {a.active ? "" : " (supprimé)"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Zone">
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Toutes</option>
            {[...data.zones]
              .sort((a, b) => a.order - b.order)
              .map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
          </select>
        </Field>
      </section>
      <section className="card">
        {sheets.length === 0 && <Empty>Aucune fiche sur cette période.</Empty>}
        {sheets.map((s) => (
          <SheetRow key={s.id} data={data} sheet={s} showDate />
        ))}
      </section>
    </AdminShell>
  );
}

// ───────── Détail d'une fiche ─────────

export function AdminSheet({ id }: { id: string }) {
  const data = useData();
  const sheet = data.sheets.find((s) => s.id === id);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");
  if (!sheet) {
    return (
      <Screen title="Fiche introuvable" onBack={() => back("/admin/jour")}>
        <Empty>Cette fiche n'existe pas.</Empty>
      </Screen>
    );
  }
  const comps = data.completions.filter((c) => c.sheetId === sheet.id).sort((a, b) => a.at.localeCompare(b.at));
  const done = comps.filter((c) => c.status === "done");
  const notDone = comps.filter((c) => c.status === "not_done");

  return (
    <Screen title={`Fiche de ${sheet.agentName}`} subtitle={formatDayLong(sheet.date)} onBack={() => back("/admin/jour")}>
      <section className="card">
        <dl className="detail-list">
          <dt>Début du service</dt>
          <dd>{formatTime(sheet.startedAt)}</dd>
          <dt>Envoi</dt>
          <dd>
            {sheet.sentAt
              ? `${formatDayNumeric(toDay(new Date(sheet.sentAt)))} à ${formatTime(sheet.sentAt)}`
              : "Pas encore envoyée"}
          </dd>
          <dt>État</dt>
          <dd>{sheet.sentAt ? "🔒 Verrouillée" : "En cours"}</dd>
          {sheet.mode && (
            <>
              <dt>Organisation</dt>
              <dd>{sheet.mode === "duo" ? `À deux · poste ${sheet.post}` : "Seul (tâches essentielles)"}</dd>
            </>
          )}
        </dl>
        {sheet.test && <p className="banner-test">Fiche de test : elle ne compte pas dans le suivi.</p>}
        {sheet.comment && (
          <p className={sheet.anomaly ? "banner-warn" : "detail-text"}>
            {sheet.anomaly ? "⚠ Anomalie : " : "Commentaire : "}« {sheet.comment} »
          </p>
        )}
        {sheet.anomaly && !sheet.comment && <p className="banner-warn">⚠ Anomalie signalée sans commentaire.</p>}
      </section>

      <section className="card">
        <h2>Tâches faites ({done.length})</h2>
        {done.length === 0 && <Empty>Aucune.</Empty>}
        <ul className="recap-list">
          {done.map((c) => (
            <li key={c.id}>
              <span className="recap-time">{formatTime(c.at)}</span>
              <span>
                {c.snapshot.taskName}
                {c.dueDate < c.doneDate && <em className="tag warn">prévue le {formatDayShort(c.dueDate)}</em>}
                {c.anomaly && <em className="tag danger">⚠ anomalie</em>}
                <small>
                  {c.snapshot.zoneName} · {c.snapshot.momentName}
                </small>
                {c.comment && <small>« {c.comment} »</small>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {notDone.length > 0 && (
        <section className="card">
          <h2>Déclarées non faites ({notDone.length})</h2>
          <ul className="recap-list">
            {notDone.map((c) => (
              <li key={c.id}>
                <span className="recap-time">{formatTime(c.at)}</span>
                <span>
                  {c.snapshot.taskName}
                  {c.anomaly && <em className="tag danger">⚠ anomalie</em>}
                  <small>
                    {c.snapshot.zoneName} · {c.reason}
                  </small>
                  {c.comment && <small>« {c.comment} »</small>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet.sentAt && (
        <section className="card">
          <h2>Restait à faire pour l'équipe à l'envoi ({sheet.remaining.length})</h2>
          {sheet.remaining.length === 0 && <Empty>Rien : la checklist était complète.</Empty>}
          <ul className="recap-list">
            {sheet.remaining.map((r, i) => (
              <li key={i}>
                <span>
                  {r.taskName}
                  {r.late && <em className="tag warn">en retard depuis le {formatDayShort(r.dueDate)}</em>}
                  <small>
                    {r.zoneName} · {r.momentName}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet.sentAt && (
        <section className="card">
          <h2>Signature</h2>
          {sheet.signature ? (
            <img src={sheet.signature} alt={`Signature de ${sheet.agentName}`} className="signature-img" />
          ) : (
            <p className="initials-shown">{sheet.initials}</p>
          )}
          <p className="detail-zone">
            {sheet.agentName} · {formatTime(sheet.sentAt)}
          </p>
        </section>
      )}
      <ConfirmBtn confirm="Oui, supprimer cette fiche…" onConfirm={() => setDeleting(true)}>
        Supprimer cette fiche
      </ConfirmBtn>

      {deleting && (
        <Modal title="Supprimer la fiche" onClose={() => setDeleting(false)}>
          <p className="detail-text">
            La fiche de {sheet.agentName} et ses {comps.length} validation{comps.length > 1 ? "s" : ""} seront effacées.
            Les tâches concernées redeviendront « non faites ». La suppression sera notée dans le journal.
          </p>
          <Field label="Motif (obligatoire)">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : fiche d'essai" />
          </Field>
          <Btn
            block
            kind="danger"
            disabled={reason.trim().length < 3}
            onClick={() => {
              deleteSheet(sheet.id, reason.trim());
              back("/admin/jour");
            }}
          >
            Supprimer définitivement
          </Btn>
        </Modal>
      )}
    </Screen>
  );
}
