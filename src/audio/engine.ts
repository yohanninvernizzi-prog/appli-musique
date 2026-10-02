import {
  createAudioPlayer,
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { runFade } from '../core/fade';
import { PlayQueue } from '../core/queue';
import { AnnouncementScheduler, nextDue } from '../core/schedule';
import { silentWav } from '../core/wav';
import type { AnnouncementRule, PlayMode, RepeatMode, Track } from '../core/types';
import { getTracksByIds, listRules } from '../db/repo';
import { resolveUri } from '../sources/registry';

export type EngineState = {
  status: 'idle' | 'playing' | 'paused' | 'announcing';
  current: Track | null;
  positionMs: number;
  durationMs: number;
  playMode: PlayMode;
  repeatMode: RepeatMode;
  queueLabel: string;
  radio: boolean;
  nextAnnouncement: { name: string; at: number } | null;
  log: string[];
};

const INITIAL: EngineState = {
  status: 'idle',
  current: null,
  positionMs: 0,
  durationMs: 0,
  playMode: 'linear',
  repeatMode: 'all',
  queueLabel: '',
  radio: false,
  nextAnnouncement: null,
  log: [],
};

const MUSIC_VOLUME = 1;
const MAX_ANNOUNCEMENT_WAIT_MS = 10 * 60_000;

/**
 * Moteur de lecture : un lecteur pour la musique, un pour les annonces.
 * À l'échéance d'une annonce : fondu sortant -> pause -> annonce -> reprise avec fondu entrant.
 */
class AudioEngine {
  private state: EngineState = INITIAL;
  private listeners = new Set<() => void>();
  private music: AudioPlayer | null = null;
  private jingle: AudioPlayer | null = null;
  private keepAlive: AudioPlayer | null = null;
  private queue: PlayQueue | null = null;
  private tracks = new Map<string, Track>();
  private initialized = false;
  private loadToken = 0;
  private activeFade: { cancel: () => void } | null = null;
  private announcing = false;
  private pendingAdvance = false;
  private announcementChain: Promise<void> = Promise.resolve();
  private rules: AnnouncementRule[] = [];
  private scheduler: AnnouncementScheduler;
  private wantPlaying = false;

  constructor() {
    this.scheduler = new AnnouncementScheduler({
      getRules: () => this.rules,
      onDue: (rule, slot) => {
        this.log(`Annonce « ${rule.name} » (créneau ${fmt(slot)})`);
        this.announcementChain = this.announcementChain.then(() => this.playAnnouncement(rule)).catch((e) => this.log(`Erreur annonce : ${String(e)}`));
      },
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

  log(message: string): void {
    const line = `${fmt(new Date())}  ${message}`;
    this.set({ log: [line, ...this.state.log].slice(0, 60) });
  }

  // ---- initialisation ----
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // Requis par expo-audio pour les contrôles de l'écran verrouillé (et la lecture longue sur Android).
      interruptionMode: 'doNotMix',
    });
    try {
      await requestNotificationPermissionsAsync();
    } catch {
      // iOS ou refus : la lecture fonctionne, seule la notification peut manquer.
    }
    this.music = createAudioPlayer(null, { updateInterval: 500 });
    this.jingle = createAudioPlayer(null, { updateInterval: 250 });
    this.music.addListener('playbackStatusUpdate', (s) => this.onMusicStatus(s));
  }

  // ---- file d'attente ----
  async load(tracks: Track[], opts: { label: string; playMode: PlayMode; repeatMode: RepeatMode; startId?: string; autoplay?: boolean }): Promise<void> {
    await this.init();
    this.tracks = new Map(tracks.map((t) => [t.id, t]));
    this.queue = new PlayQueue(tracks.map((t) => t.id), opts.playMode, opts.repeatMode, Math.random, opts.startId);
    this.set({ playMode: opts.playMode, repeatMode: opts.repeatMode, queueLabel: opts.label });
    if (this.queue.current) {
      await this.startCurrent(opts.autoplay ?? true);
    } else {
      this.set({ status: 'idle', current: null, positionMs: 0, durationMs: 0 });
    }
  }

  setMode(playMode: PlayMode, repeatMode: RepeatMode): void {
    this.queue?.setMode(playMode, repeatMode);
    this.set({ playMode, repeatMode });
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
      this.music.setActiveForLockScreen(true, meta, { showSeekForward: true, showSeekBackward: true });
    } catch {
      // Non critique.
    }
  }

  private onMusicStatus(s: AudioStatus): void {
    if (this.announcing) {
      if (s.didJustFinish) this.pendingAdvance = true;
      return;
    }
    this.set({
      positionMs: Math.round(s.currentTime * 1000),
      durationMs: s.duration > 0 ? Math.round(s.duration * 1000) : this.state.durationMs,
      ...(this.state.status === 'playing' || this.state.status === 'paused' ? { status: s.playing ? 'playing' : this.wantPlaying && s.isBuffering ? 'playing' : 'paused' } : {}),
    });
    if (s.didJustFinish) void this.onTrackEnded();
  }

  private async onTrackEnded(): Promise<void> {
    const nextId = this.queue?.advance();
    if (!nextId) {
      this.wantPlaying = false;
      this.set({ status: 'idle', positionMs: 0 });
      if (this.state.radio) this.startKeepAlive();
      return;
    }
    await this.startCurrent(true);
  }

  // ---- commandes ----
  play(): void {
    if (!this.music || !this.queue?.current) return;
    this.wantPlaying = true;
    this.stopKeepAlive();
    this.music.play();
    this.set({ status: 'playing' });
  }

  pause(): void {
    if (!this.music) return;
    this.wantPlaying = false;
    this.music.pause();
    this.set({ status: 'paused' });
    if (this.state.radio) this.startKeepAlive();
  }

  toggle(): void {
    if (this.state.status === 'playing') this.pause();
    else this.play();
  }

  async next(): Promise<void> {
    if (!this.queue?.skipNext()) {
      return;
    }
    await this.startCurrent(this.wantPlaying || this.state.status === 'playing');
  }

  async previous(): Promise<void> {
    if (!this.queue) return;
    if (this.state.positionMs > 3000) {
      await this.seek(0);
      return;
    }
    if (!this.queue.skipPrevious()) return;
    await this.startCurrent(this.wantPlaying || this.state.status === 'playing');
  }

  async jumpTo(id: string): Promise<void> {
    if (!this.queue?.jumpTo(id)) return;
    await this.startCurrent(true);
  }

  async seek(ms: number): Promise<void> {
    await this.music?.seekTo(Math.max(0, ms) / 1000);
  }

  // ---- annonces ----
  /** Fondu sortant, annonce, puis reprise automatique de la musique avec fondu entrant. */
  async playAnnouncement(rule: AnnouncementRule): Promise<void> {
    await this.init();
    if (!this.music || !this.jingle) return;
    const [track] = await getTracksByIds([rule.trackId]);
    if (!track) {
      this.log(`Annonce « ${rule.name} » : audio introuvable`);
      return;
    }
    const musicWasPlaying = this.state.status === 'playing' || (this.music.playing && this.wantPlaying);
    if (!musicWasPlaying && !rule.playWhenIdle) {
      this.log(`Annonce « ${rule.name} » ignorée (aucune musique en cours)`);
      return;
    }

    this.announcing = true;
    this.pendingAdvance = false;
    const previousStatus = this.state.status;
    this.set({ status: 'announcing' });
    try {
      if (musicWasPlaying) {
        await this.fadeMusic(MUSIC_VOLUME, 0, rule.fadeMs);
        this.music.pause();
      }
      this.stopKeepAlive();
      await this.playJingleToEnd(track, rule.volume);
    } finally {
      this.announcing = false;
      if (musicWasPlaying) {
        if (this.pendingAdvance) {
          this.pendingAdvance = false;
          this.queue?.advance();
          await this.startCurrent(true);
        } else {
          this.music.volume = 0;
          this.music.play();
          await this.fadeMusic(0, MUSIC_VOLUME, rule.fadeMs);
        }
        this.set({ status: 'playing' });
        this.log('Musique reprise');
      } else {
        this.set({ status: previousStatus === 'announcing' ? 'paused' : previousStatus });
        if (this.state.radio) this.startKeepAlive();
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
        jingle.pause();
        resolve();
      };
      const limit = Math.min(MAX_ANNOUNCEMENT_WAIT_MS, (track.durationMs ?? 120_000) + 15_000);
      const timer = setTimeout(() => {
        this.log('Annonce interrompue (délai dépassé)');
        finish();
      }, limit);
      sub = jingle.addListener('playbackStatusUpdate', (s) => {
        if (s.didJustFinish) finish();
      });
      resolveUri(track)
        .then((uri) => {
          jingle.volume = Math.min(1, Math.max(0, volume));
          jingle.replace({ uri });
          jingle.play();
        })
        .catch(() => finish());
    });
  }

  // ---- mode radio ----
  async startRadio(): Promise<void> {
    await this.init();
    this.rules = await listRules();
    this.scheduler.start();
    this.set({ radio: true });
    this.refreshNext();
    this.log('Mode radio activé');
    if (!this.wantPlaying) this.startKeepAlive();
  }

  stopRadio(): void {
    this.scheduler.stop();
    this.stopKeepAlive();
    this.set({ radio: false, nextAnnouncement: null });
    this.log('Mode radio arrêté');
  }

  /** À appeler après modification des règles d'annonces. */
  async reloadRules(): Promise<void> {
    this.rules = await listRules();
    this.scheduler.refresh();
    this.refreshNext();
  }

  private refreshNext(): void {
    const due = nextDue(this.rules, new Date());
    this.set({ nextAnnouncement: due ? { name: due.rule.name, at: due.at.getTime() } : null });
  }

  /** Déclenche une annonce tout de suite (test). */
  async testAnnouncement(rule: AnnouncementRule): Promise<void> {
    this.announcementChain = this.announcementChain.then(() => this.playAnnouncement(rule)).catch((e) => this.log(`Erreur annonce : ${String(e)}`));
    await this.announcementChain;
  }

  // ---- maintien de la session audio (mode radio) ----
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

function fmt(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export const engine = new AudioEngine();
