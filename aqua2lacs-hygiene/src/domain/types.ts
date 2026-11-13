/** Modèle de données de l'application. Les dates « jour » sont au format AAAA-MM-JJ (heure locale). */

export type ID = string;
/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Zone {
  id: ID;
  name: string;
  order: number;
  /** Répartition à deux : 1 ou 2 = poste concerné, 0 = zone commune aux deux postes. */
  post: Post;
}

/** Poste de travail quand les agents sont deux (0 = aucun / commun). */
export type Post = 0 | 1 | 2;

export interface Moment {
  id: ID;
  name: string;
  /** Heure indicative de début, "HH:MM" (sert à ouvrir le bon bloc et à trier). */
  startTime: string;
  order: number;
  /** Bloc facultatif (« Temps creux ») : jamais en retard, hors progression. */
  bonus: boolean;
}

export type Recurrence =
  | { type: "daily" }
  /** Certains jours de la semaine. Un seul jour = hebdomadaire. */
  | { type: "weekdays"; days: Weekday[] }
  /** Le X de chaque mois (ramené au dernier jour si le mois est plus court). */
  | { type: "monthly_day"; day: number }
  /** Le n-ième jour de semaine du mois (ex. 1er lundi). nth = -1 pour « dernier ». */
  | { type: "monthly_nth"; nth: 1 | 2 | 3 | 4 | -1; weekday: Weekday }
  | { type: "every_x_days"; interval: number; startDate: string }
  /** Tâche ponctuelle. */
  | { type: "once"; date: string };

export type Period = "all" | "scolaire" | "vacances";

export interface Task {
  id: ID;
  name: string;
  zoneId: ID;
  momentId: ID;
  description: string;
  material: string;
  product: string;
  /** Durée indicative en minutes (0 = non renseignée). */
  durationMin: number;
  photoRequired: boolean;
  /** Nombre de passages attendus dans la journée (1 par défaut). */
  passes: number;
  recurrence: Recurrence;
  period: Period;
  /** Visible par les agents. Faux pour un brouillon ou une tâche désactivée. */
  active: boolean;
  /** Brouillon : tâche en préparation, jamais encore publiée. */
  draft: boolean;
  /** Essentielle : à faire même quand l'agent travaille seul. */
  essential: boolean;
  order: number;
  /** « Active à partir du » : aucune occurrence n'est due avant ce jour. */
  createdOn: string;
}

export interface Agent {
  id: ID;
  firstName: string;
  lastName: string;
  /** Empreinte du code PIN (jamais le code en clair). */
  pinHash: string;
  active: boolean;
  /** Profil de test ou de démonstration : ses fiches restent à part et ne comptent pas. */
  test: boolean;
}

export type CompletionStatus = "done" | "not_done" | "cancelled";

export const NOT_DONE_REASONS = [
  "Pas le temps",
  "Zone fermée",
  "Matériel manquant ou cassé",
  "Produit manquant",
  "Autre",
] as const;

/** Une validation (ou un « non fait ») d'un passage d'une tâche. */
export interface Completion {
  id: ID;
  taskId: ID;
  /** Jour où la tâche était prévue. */
  dueDate: string;
  /** Jour où l'agent a agi (différent de dueDate si la tâche était en retard). */
  doneDate: string;
  passIndex: number;
  status: CompletionStatus;
  /** Agent auteur ; null si annulation par le responsable. */
  agentId: ID | null;
  /** Horodatage ISO complet. */
  at: string;
  reason: string;
  comment: string;
  anomaly: boolean;
  photos: string[];
  /** Fiche à laquelle la validation est rattachée. */
  sheetId: ID | null;
  /** Validation faite par un profil de test (bac à sable). */
  test: boolean;
  /** Copie des libellés au moment de la validation (traçabilité si le référentiel change). */
  snapshot: { taskName: string; zoneName: string; momentName: string };
}

export interface SheetRemainingItem {
  taskName: string;
  zoneName: string;
  momentName: string;
  late: boolean;
  dueDate: string;
}

/** Fiche d'un agent pour un service. Verrouillée dès que sentAt est renseigné. */
export interface Sheet {
  id: ID;
  agentId: ID;
  agentName: string;
  date: string;
  startedAt: string;
  sentAt: string | null;
  /** Signature dessinée (image PNG en data URL) ou vide. */
  signature: string;
  initials: string;
  comment: string;
  /** Signalement général (hors tâche) déclaré à l'envoi. */
  anomaly: boolean;
  /** Tâches de l'équipe encore à faire au moment de l'envoi. */
  remaining: SheetRemainingItem[];
  /** Organisation choisie par l'agent : seul ou à deux (null tant qu'il n'a pas choisi). */
  mode: WorkMode | null;
  /** Poste tenu quand les agents sont deux. */
  post: Post;
  /** Fiche d'un profil de test. */
  test: boolean;
}

export type WorkMode = "solo" | "duo";

/** Collègue actuellement en service (fiche du jour non envoyée). */
export interface TeamMember {
  agentId: ID;
  agentName: string;
  mode: WorkMode | null;
  post: Post;
}

/** Trace d'une suppression de fiche(s) par le responsable. */
export interface DeletionLog {
  id: ID;
  deletedAt: string;
  scope: "sheet" | "tests" | "all";
  agentName: string;
  day: string;
  reason: string;
  /** Nombre de fiches supprimées. */
  sheetCount: number;
  /** Nombre de validations supprimées avec. */
  completionCount: number;
  test: boolean;
}

export interface Settings {
  /** Produit du jour, indexé du lundi (0) au dimanche (6). */
  productByWeekday: string[];
  closedDays: string[];
  activePeriod: Exclude<Period, "all">;
  adminPinHash: string;
  notifyEmail: string;
}

export interface AppData {
  version: number;
  zones: Zone[];
  moments: Moment[];
  tasks: Task[];
  agents: Agent[];
  completions: Completion[];
  sheets: Sheet[];
  settings: Settings;
  /** Collègues en service, vus par l'agent connecté (mode connecté). */
  team: TeamMember[];
  /** Journal des suppressions (responsable). */
  deletions: DeletionLog[];
}
