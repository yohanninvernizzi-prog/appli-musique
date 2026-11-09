import {
  createAudioPlayer,
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { runFade } from '../core/fade';
import { adIndexFor, isOpen, nextBoundary, ProgramRunner, type OpeningSlot, type Override } from '../core/program';
import { PlayQueue } from '../core/queue';
import { silentWav } from '../core/wav';
import type { Track } from '../core/types';
import {
  appendLog, clearLog, getPlaylistTrackIds, getSetting, getTracksByIds, listLog, listPlaylists, listSlots, listTracks,
  setSetting, trimLog, updateTrack, type LogEntry,
} from '../db/repo';
import { resolveUri } from '../sources/registry';

export type EngineState = {
  /** Faux tant que les réglages ne sont pas chargés au lancement. */
  ready: boolean;
  status: 'idle' | 'playing' | 'paused' | 'announcing';
  current: Track | null;
  positionMs: number;
  durationMs: number;
  /** Diffusion automatique selon les horaires d'ouverture. */
  auto: boolean;
  onAir: boolean;
  override: Override;
  /** 'all' ou identifiant de playlist. */
  sourceId: string;
  sourceLabel: string;
  intervalMin: number;
  fadeMs: number;
  adVolume: number;
  slots: OpeningSlot[];
  /** Nombre de publicités actives dans la rotation. */
  adCount: number;
  nextAd: { title: string; at: number } | null;
  nextChange: { at: number; opens: boolean } | null;
  /** Audio en cours sur le lecteur d'annonces (publicité ou pré-écoute). */
  announcement: { id: string; title: string } | null;
  /** Problème à signaler sur l'accueil (ex. aucune musique à diffuser). */
  notice: string | null;
  log: LogEntry[];
};

const INITIAL: EngineState = {
  ready: false,
  status: 'idle',
  current: null,
  positionMs: 0,
  durationMs: 0,
  auto: false,
  onAir: false,
  override: null,
  sourceId: 'all',
  sourceLabel: 'Toute la musique',
  intervalMin: 15,
  fadeMs: 2000,
  adVolume: 1,
  slots: [],
  adCount: 0,
  nextAd: null,
  nextChange: null,
  announcement: null,
  notice: null,
  log: [],
};

const MUSIC_VOLUME = 1;
const CLOSING_FADE_MS = 1500;
const MAX_ANNOUNCEMENT_WAIT_MS = 10 * 60_000;
const LOG_IN_MEMORY = 300;

/**
 * Moteur de la radio : un lecteur pour la musique, un pour les publicités, un de maintien (silence).
 * Le ProgramRunner décide quand être à l'antenne et quand passer une publicité ; le moteur exécute.
 * Publicité : fondu sortant -> pause -> publicité -> reprise de la musique avec fondu entrant.
 */
class AudioEngine {
  private state: EngineState = INITIAL;
  private listeners = new Set<() => void>();
  private music: AudioPlayer | null = null;
  private jingle: AudioPlayer | null = null;
  private keepAlive: AudioPlayer | null = null;
  private queue: PlayQueue | null = null;
  private tracks = new Map<string, Track>();
  private ads: Track[] = [];
  private initPromise: Promise<void> | null = null;
  private restorePromise: Promise<void> | null = null;
  private loadToken = 0;
  private activeFade: { cancel: () => void } | null = null;
  private announcing = false;
  private pendingAdvance = false;
  private finishJingle: (() => void) | null = null;
  private announcementChain: Promise<void> = Promise.resolve();
  private airChain: Promise<void> = Promise.resolve();
  private wantPlaying = false;
  private lastAliveSaved = 0;
  private runner: ProgramRunner;

  constructor() {
    this.runner = new ProgramRunner({
      getConfig: () => ({ slots: this.state.slots, intervalMin: this.state.intervalMin, auto: this.state.auto }),
      onAirChange: (onAir) => {
        this.set({ onAir });
        this.airChain = this.airChain
          .then(() => (onAir ? this.goOnAir() : this.goOffAir()))
          .catch((e) => this.log(`Erreur de diffusion : ${String(e)}`));
      },
      onAd: (slot, lateMs) => this.onAdDue(slot, lateMs),
      onGap: (ms) => this.log(`Application suspendue pendant ${fmtDuration(ms)}`),
      onTick: (now) => this.onTick(now),
    });
  }

  // ---- abonnement React ----
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): EngineState => this.state;

  private set(patch: Partial<EngineState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Ajoute une ligne au journal, conservé en base pour survivre à une fermeture de l'application. */
  log(message: string): void {
    const entry: LogEntry = { at: Date.now(), message };
    this.set({ log: [entry, ...this.state.log].slice(0, LOG_IN_MEMORY) });
    appendLog(entry).catch(() => {});
  }

  async clearLog(): Promise<void> {
    await clearLog();
    this.set({ log: [] });
  }

  // ---- initialisation ----
  private init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          // Requis par expo-audio pour les contrôles de l'écran verrouillé (et la lecture longue sur Android).
          interruptionMode: 'doNotMix',
        });
        try {
          await requestNotificationPermissionsAsync();
        } catch {
          // Refus : la lecture fonctionne, seule la notification peut manquer.
        }
        this.music = createAudioPlayer(null, { updateInterval: 500 });
        this.jingle = createAudioPlayer(null, { updateInterval: 250 });
        this.music.addListener('playbackStatusUpdate', (s) => this.onMusicStatus(s));
      })();
    }
    return this.initPromise;
  }

  /** À appeler une fois au lancement : recharge les réglages et reprend la diffusion automatique. */
  restore(): Promise<void> {
    if (!this.restorePromise) {
      this.restorePromise = (async () => {
        await this.init();
        const [log, lastAlive] = await Promise.all([listLog(LOG_IN_MEMORY), getSetting('diag.lastAlive')]);
        this.set({ log });
        await this.loadConfig();
        const since = lastAlive ? ` (dernier signe de vie : ${fmtDateTime(Number(lastAlive))})` : '';
        this.log(`Application lancée${since}`);
        trimLog().catch(() => {});
        this.set({ ready: true });
        this.runner.start();
        this.refreshNext();
        this.syncKeepAlive();
      })().catch((e) => {
        this.restorePromise = null;
        this.set({ ready: true, notice: `Démarrage impossible : ${String(e)}` });
      });
    }
    return this.restorePromise;
  }

  private async loadConfig(): Promise<void> {
    const [slots, auto, sourceId, interval, fade, volume, jingles, playlists] = await Promise.all([
      listSlots(), getSetting('radio.auto'), getSetting('radio.source'), getSetting('ads.intervalMin'),
      getSetting('ads.fadeMs'), getSetting('ads.volume'), listTracks('jingle'), listPlaylists(),
    ]);
    this.ads = jingles.filter((t) => t.enabled);
    const playlist = playlists.find((p) => p.id === sourceId);
    this.set({
      slots,
      auto: auto === '1',
      sourceId: playlist ? playlist.id : 'all',
      sourceLabel: playlist ? playlist.name : 'Toute la musique',
      intervalMin: clampNumber(interval, 1, 720, 15),
      fadeMs: clampNumber(fade, 0, 30_000, 2000),
      adVolume: clampNumber(volume, 0, 1, 1),
      adCount: this.ads.length,
    });
  }

  /** À appeler après toute modification des horaires, des publicités, des playlists ou des musiques. */
  async reload(): Promise<void> {
    await this.restore();
    const previousSource = this.state.sourceId;
    await this.loadConfig();
    this.runner.refresh();
    this.refreshNext();
    if (this.state.onAir && (previousSource !== this.state.sourceId || !this.queue?.current)) {
      this.airChain = this.airChain.then(() => this.goOnAir()).catch((e) => this.log(`Erreur de diffusion : ${String(e)}`));
    }
  }

  // ---- réglages ----
  async setAuto(auto: boolean): Promise<void> {
    await setSetting('radio.auto', auto ? '1' : '0');
    this.set({ auto, override: null });
    this.log(auto ? 'Diffusion automatique activée' : 'Diffusion automatique désactivée');
    this.runner.setOverride(null);
    this.refreshNext();
    this.syncKeepAlive();
  }

  /** Bouton manuel : diffuser maintenant (même hors horaires) ou couper (même pendant les horaires). */
  setOnAir(want: boolean): void {
    const scheduled = this.state.auto && isOpen(this.state.slots, new Date());
    const override: Override = want === scheduled ? null : want ? 'on' : 'off';
    this.set({ override });
    this.log(want ? 'Diffusion lancée à la main' : 'Diffusion arrêtée à la main');
    this.runner.setOverride(override);
    this.refreshNext();
    this.syncKeepAlive();
  }

  async setSource(sourceId: string): Promise<void> {
    await setSetting('radio.source', sourceId);
    await this.reload();
  }

  async setAdSettings(patch: { intervalMin?: number; fadeMs?: number; adVolume?: number }): Promise<void> {
    if (patch.intervalMin !== undefined) await setSetting('ads.intervalMin', String(patch.intervalMin));
    if (patch.fadeMs !== undefined) await setSetting('ads.fadeMs', String(patch.fadeMs));
    if (patch.adVolume !== undefined) await setSetting('ads.volume', String(patch.adVolume));
    await this.reload();
  }

  // ---- antenne ----
  private async goOnAir(): Promise<void> {
    await this.init();
    if (!this.runner.isOnAir) return;
    const ids = this.state.sourceId === 'all' ? null : await getPlaylistTrackIds(this.state.sourceId);
    const tracks = (ids ? await getTracksByIds(ids) : await listTracks('music')).filter((t) => t.kind === 'music');
    if (tracks.length === 0) {
      this.queue = null;
      this.wantPlaying = false;
      const notice = ids ? `La playlist « ${this.state.sourceLabel} » est vide.` : 'Aucune musique : importez des titres dans l\'onglet Musique.';
      this.set({ status: 'idle', current: null, positionMs: 0, durationMs: 0, notice });
      this.log(`Diffusion impossible : ${notice}`);
      this.syncKeepAlive();
      return;
    }
    this.tracks = new Map(tracks.map((t) => [t.id, t]));
    this.queue = new PlayQueue(tracks.map((t) => t.id), 'shuffle', 'all');
    this.set({ notice: null });
    this.log(`À l'antenne : ${this.state.sourceLabel} (${tracks.length} titres, ordre aléatoire)`);
    await this.startCurrent(true);
  }

  private async goOffAir(): Promise<void> {
    if (this.runner.isOnAir) return;
    this.wantPlaying = false;
    this.finishJingle?.();
    if (this.music) {
      if (this.music.playing) await this.fadeMusic(this.music.volume, 0, CLOSING_FADE_MS);
      this.music.pause();
    }
    this.queue = null;
    this.set({ status: 'idle', current: null, positionMs: 0, durationMs: 0, notice: null });
    this.log('Antenne coupée');
    this.syncKeepAlive();
  }

  private async startCurrent(autoplay: boolean): Promise<void> {
    const id = this.queue?.current;
    const track = id ? this.tracks.get(id) : undefined;
    if (!track || !this.music) return;
    const token = ++this.loadToken;
    this.activeFade?.cancel();
    this.music.volume = MUSIC_VOLUME;
    this.music.replace({ uri: await resolveUri(track) });
    if (token !== this.loadToken) return;
    this.set({ current: track, positionMs: 0, durationMs: track.durationMs ?? 0 });
    this.updateLockScreen(track);
    if (autoplay) {
      this.wantPlaying = true;
      this.stopKeepAlive();
      this.music.play();
      this.set({ status: this.announcing ? 'announcing' : 'playing' });
    } else {
      this.set({ status: 'paused' });
    }
  }

  private updateLockScreen(track: Track): void {
    if (!this.music) return;
    const meta = { title: track.title, artist: track.artist ?? undefined, albumTitle: track.album ?? undefined };
    try {
      this.music.setActiveForLockScreen(true, meta, { showSeekForward: false, showSeekBackward: false });
    } catch {
      // Non critique.
    }
  }

  private onMusicStatus(s: AudioStatus): void {
    if (this.announcing) {
      if (s.didJustFinish) this.pendingAdvance = true;
      return;
    }
    if (!this.state.current) return;
    const durationMs = s.duration > 0 ? Math.round(s.duration * 1000) : this.state.durationMs;
    this.rememberDuration(this.state.current, durationMs);
    this.set({
      positionMs: Math.round(s.currentTime * 1000),
      durationMs,
      ...(this.state.status === 'playing' || this.state.status === 'paused'
        ? { status: s.playing || (this.wantPlaying && s.isBuffering) ? 'playing' : this.wantPlaying ? this.state.status : 'paused' }
        : {}),
    });
    if (s.didJustFinish) void this.onTrackEnded();
  }

  /** La durée n'est connue qu'à la lecture : on la garde pour l'afficher dans les listes. */
  private rememberDuration(track: Track, durationMs: number): void {
    if (track.durationMs || durationMs <= 0) return;
    track.durationMs = durationMs;
    updateTrack(track.id, { durationMs }).catch(() => {});
  }

  private async onTrackEnded(): Promise<void> {
    if (!this.queue?.advance()) {
      this.wantPlaying = false;
      this.set({ status: 'idle', positionMs: 0 });
      this.syncKeepAlive();
      return;
    }
    await this.startCurrent(true);
  }

  // ---- commandes ----
  play(): void {
    if (!this.music || !this.queue?.current || this.announcing) return;
    this.wantPlaying = true;
    this.stopKeepAlive();
    this.music.volume = MUSIC_VOLUME;
    this.music.play();
    this.set({ status: 'playing' });
  }

  pause(): void {
    if (!this.music) return;
    this.wantPlaying = false;
    this.finishJingle?.();
    this.activeFade?.cancel();
    this.music.pause();
    if (this.state.current) this.set({ status: 'paused' });
    this.syncKeepAlive();
  }

  toggle(): void {
    if (this.wantPlaying) this.pause();
    else this.play();
  }

  async next(): Promise<void> {
    if (this.announcing || !this.queue?.skipNext()) return;
    await this.startCurrent(this.wantPlaying);
  }

  // ---- publicités ----
  private onAdDue(slot: Date, lateMs: number): void {
    if (this.ads.length === 0) return;
    const ad = this.ads[adIndexFor(slot, this.state.intervalMin, this.ads.length)];
    if (!this.wantPlaying) {
      this.log(`Publicité « ${ad.title} » ignorée (musique en pause)`);
      return;
    }
    this.log(`Publicité « ${ad.title} » (prévue à ${fmtTime(slot.getTime())}, retard ${Math.round(lateMs / 1000)} s)`);
    this.enqueue(ad, this.state.adVolume);
    this.refreshNext();
  }

  /** Pré-écoute d'un audio (bouton « Écouter »). Si la radio joue : fondu, écoute, puis reprise. */
  async preview(track: Track): Promise<void> {
    await this.restore();
    this.finishJingle?.();
    this.enqueue(track, track.kind === 'jingle' ? this.state.adVolume : 1);
  }

  stopPreview(): void {
    this.finishJingle?.();
  }

  private enqueue(track: Track, volume: number): void {
    this.announcementChain = this.announcementChain
      .then(() => this.playAnnouncement(track, volume))
      .catch((e) => this.log(`Erreur de lecture : ${String(e)}`));
  }

  /** Fondu sortant, audio, puis reprise automatique de la musique avec fondu entrant. */
  private async playAnnouncement(track: Track, volume: number): Promise<void> {
    await this.init();
    if (!this.music || !this.jingle) return;
    const fadeMs = this.state.fadeMs;
    const musicWasPlaying = this.wantPlaying;

    this.announcing = true;
    this.pendingAdvance = false;
    this.set({ status: 'announcing', announcement: { id: track.id, title: track.title } });
    try {
      if (musicWasPlaying) {
        await this.fadeMusic(MUSIC_VOLUME, 0, fadeMs);
        this.music.pause();
      }
      this.stopKeepAlive();
      await this.playJingleToEnd(track, volume);
    } finally {
      this.announcing = false;
      this.set({ announcement: null });
      // La diffusion a pu être coupée (fermeture, pause) pendant l'annonce : on ne relance alors rien.
      if (musicWasPlaying && this.wantPlaying) {
        if (this.pendingAdvance) {
          this.pendingAdvance = false;
          this.queue?.advance();
          await this.startCurrent(true);
        } else {
          this.music.volume = 0;
          this.music.play();
          this.set({ status: 'playing' });
          await this.fadeMusic(0, MUSIC_VOLUME, fadeMs);
        }
        this.set({ status: 'playing' });
        this.log('Musique reprise');
      } else {
        this.set({ status: this.state.current ? 'paused' : 'idle' });
        this.syncKeepAlive();
      }
    }
  }

  private async fadeMusic(from: number, to: number, ms: number): Promise<void> {
    const player = this.music;
    if (!player) return;
    this.activeFade?.cancel();
    const f = runFade({ from, to, durationMs: ms, setVolume: (v) => (player.volume = v) });
    this.activeFade = f;
    await f.done;
    if (this.activeFade === f) this.activeFade = null;
  }

  private playJingleToEnd(track: Track, volume: number): Promise<void> {
    const jingle = this.jingle!;
    return new Promise<void>((resolve) => {
      let settled = false;
      let sub: { remove: () => void } | null = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        sub?.remove();
        if (this.finishJingle === finish) this.finishJingle = null;
        jingle.pause();
        resolve();
      };
      this.finishJingle = finish;
      const limit = Math.min(MAX_ANNOUNCEMENT_WAIT_MS, (track.durationMs ?? 120_000) + 15_000);
      const timer = setTimeout(() => {
        this.log(`« ${track.title} » interrompu (délai dépassé)`);
        finish();
      }, limit);
      sub = jingle.addListener('playbackStatusUpdate', (s) => {
        if (s.duration > 0) this.rememberDuration(track, Math.round(s.duration * 1000));
        if (s.didJustFinish) finish();
      });
      resolveUri(track)
        .then((uri) => {
          if (settled) return;
          jingle.volume = Math.min(1, Math.max(0, volume));
          jingle.replace({ uri });
          jingle.play();
        })
        .catch(() => finish());
    });
  }

  // ---- suivi ----
  private onTick(now: Date): void {
    // Un forçage manuel peut avoir pris fin tout seul au changement d'horaire.
    if (this.state.override !== this.runner.currentOverride) this.set({ override: this.runner.currentOverride });
    this.refreshNext();
    if (now.getTime() - this.lastAliveSaved > 60_000) {
      this.lastAliveSaved = now.getTime();
      setSetting('diag.lastAlive', String(now.getTime())).catch(() => {});
    }
  }

  private refreshNext(): void {
    const { slots, intervalMin, auto } = this.state;
    const at = this.ads.length > 0 ? this.runner.nextAd() : null;
    const nextAd = at ? { title: this.ads[adIndexFor(at, intervalMin, this.ads.length)].title, at: at.getTime() } : null;
    const b = auto ? nextBoundary(slots, new Date()) : null;
    const nextChange = b ? { at: b.at.getTime(), opens: b.opens } : null;
    const cur = this.state;
    if (cur.nextAd?.at === nextAd?.at && cur.nextAd?.title === nextAd?.title && cur.nextChange?.at === nextChange?.at && cur.nextChange?.opens === nextChange?.opens) return;
    this.set({ nextAd, nextChange });
  }

  // ---- maintien de la session audio ----
  /**
   * Hors diffusion, une piste silencieuse en boucle garde la session audio ouverte, pour que
   * l'application reste active jusqu'à la prochaine ouverture. Efficacité écran éteint : à vérifier sur l'appareil.
   */
  private syncKeepAlive(): void {
    const armed = this.state.auto || this.state.override === 'on';
    if (armed && !this.wantPlaying && !this.announcing) this.startKeepAlive();
    else this.stopKeepAlive();
  }

  private startKeepAlive(): void {
    try {
      if (!this.keepAlive) {
        const dir = new Directory(Paths.document, 'system');
        if (!dir.exists) dir.create({ intermediates: true });
        const file = new File(dir, 'silence.wav');
        if (!file.exists) {
          file.create();
          file.write(silentWav(1));
        }
        this.keepAlive = createAudioPlayer({ uri: file.uri }, { updateInterval: 5000 });
        this.keepAlive.loop = true;
        this.keepAlive.volume = 1;
      }
      this.keepAlive.play();
    } catch (e) {
      this.log(`Maintien de session indisponible : ${String(e)}`);
    }
  }

  private stopKeepAlive(): void {
    try {
      this.keepAlive?.pause();
    } catch {
      // Ignoré.
    }
  }
}

function clampNumber(text: string | null, min: number, max: number, fallback: number): number {
  const n = text === null ? NaN : Number(text);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${fmtTime(ts)}`;
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`;
}

export const engine = new AudioEngine();
