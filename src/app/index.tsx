import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Switch, Text, View } from 'react-native';
import { engine, type EngineState } from '../audio/engine';
import type { Playlist } from '../core/types';
import { listPlaylists } from '../db/repo';
import { Body, Button, Card, Chip, Divider, Icon, IconButton, Label, Muted, Notice, Row, Screen } from '../ui/components';
import { formatClock, formatWhen, useEngine, useLoad, useNow } from '../ui/hooks';
import { colors, radius, space } from '../ui/theme';

function KeepAwake() {
  useKeepAwake();
  return null;
}

/** Phrase d'état sous le grand titre : dit ce qui se passe et ce qui vient ensuite. */
function describe(s: EngineState, now: Date): string {
  if (s.onAir) {
    if (s.override === 'on') return s.auto && s.nextChange ? `Lancée à la main · les horaires reprennent ${formatWhen(s.nextChange.at, now)}` : 'Lancée à la main';
    return s.nextChange ? `Jusqu'à ${formatClock(s.nextChange.at)}` : 'Diffusion en cours';
  }
  if (s.override === 'off') return s.nextChange ? `Arrêtée à la main · reprise ${formatWhen(s.nextChange.at, now)}` : 'Arrêtée à la main';
  if (!s.auto) return 'Diffusion automatique désactivée';
  if (s.slots.length === 0) return "Aucun horaire d'ouverture enregistré";
  return s.nextChange ? `Reprise ${formatWhen(s.nextChange.at, now)}` : 'Aucune ouverture prévue';
}

export default function Home() {
  const s = useEngine();
  const now = useNow();
  const router = useRouter();
  const [playlists] = useLoad<Playlist[]>(listPlaylists, []);
  const [stayAwake, setStayAwake] = useState(true);
  const [dimmed, setDimmed] = useState(false);

  const playing = s.status === 'playing';
  const progress = s.durationMs > 0 ? Math.min(1, s.positionMs / s.durationMs) : 0;
  const tone = s.onAir ? colors.success : colors.muted;

  return (
    <Screen>
      {stayAwake && <KeepAwake />}
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 2.4 }}>AQUA2LACS</Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.3 }}>Radio</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatClock(now.getTime())}</Text>
      </Row>

      <Card style={{ padding: space.xl, gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Row>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tone }} />
            <Text style={{ color: tone, fontSize: 13, fontWeight: '800', letterSpacing: 1.2 }}>{s.onAir ? "À L'ANTENNE" : 'HORS ANTENNE'}</Text>
          </Row>
          <Muted>{s.ready ? describe(s, now) : 'Chargement…'}</Muted>
        </View>

        {s.onAir && (
          <>
            <View style={{ gap: space.xs }}>
              <Label>{s.announcement ? 'Publicité en cours' : s.sourceLabel}</Label>
              <Text numberOfLines={2} style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
                {s.announcement?.title ?? s.current?.title ?? '—'}
              </Text>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.panelAlt }}>
              <View style={{ height: 4, borderRadius: 2, width: `${(s.announcement ? 0 : progress) * 100}%`, backgroundColor: colors.accent }} />
            </View>
            <Row style={{ justifyContent: 'center', gap: space.xl }}>
              <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Mettre en pause' : 'Reprendre la lecture'} kind="primary" size={64} onPress={() => engine.toggle()} disabled={!s.current || !!s.announcement} />
              <IconButton icon="play-skip-forward" label="Titre suivant" size={52} onPress={() => engine.next()} disabled={!s.current || !!s.announcement} />
            </Row>
          </>
        )}

        {s.notice && <Notice tone="warn">{s.notice}</Notice>}

        <Button
          label={s.onAir ? 'Arrêter la diffusion' : 'Diffuser maintenant'}
          icon={s.onAir ? 'stop' : 'play'}
          kind={s.onAir ? 'default' : 'primary'}
          onPress={() => engine.setOnAir(!s.onAir)}
          disabled={!s.ready}
        />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Body style={{ fontWeight: '600' }}>Diffusion automatique</Body>
            <Muted>Démarre et s'arrête toute seule selon les horaires d'ouverture.</Muted>
          </View>
          <Switch value={s.auto} onValueChange={(v) => engine.setAuto(v)} disabled={!s.ready} trackColor={{ true: colors.accent }} />
        </Row>
        {s.auto && s.slots.length === 0 && (
          <Notice tone="warn">Aucun horaire n'est enregistré : la radio ne démarrera pas toute seule. Ajoutez vos horaires dans l'onglet Horaires.</Notice>
        )}
        <Divider />
        <InfoLine icon="megaphone-outline" label="Prochaine publicité" value={s.nextAd ? `${formatWhen(s.nextAd.at, now)} · ${s.nextAd.title}` : s.adCount === 0 ? 'Aucune publicité active' : '—'} />
        <InfoLine icon="time-outline" label={s.nextChange?.opens === false ? 'Fermeture' : 'Prochaine ouverture'} value={s.nextChange ? formatWhen(s.nextChange.at, now) : '—'} />
      </Card>

      <Card>
        <Label>Musique diffusée</Label>
        <Row>
          <Chip label="Toute la musique" active={s.sourceId === 'all'} onPress={() => engine.setSource('all')} />
          {playlists.map((p) => (
            <Chip key={p.id} label={p.name} active={s.sourceId === p.id} onPress={() => engine.setSource(p.id)} />
          ))}
        </Row>
        <Muted>Les titres passent dans un ordre aléatoire, en boucle.</Muted>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Body style={{ fontWeight: '600' }}>Garder l'écran allumé</Body>
            <Muted>Conseillé tant que la diffusion écran éteint n'a pas été vérifiée sur cette tablette. Laissez-la branchée.</Muted>
          </View>
          <Switch value={stayAwake} onValueChange={setStayAwake} trackColor={{ true: colors.accent }} />
        </Row>
        <Row>
          <Button label="Écran de veille" icon="moon-outline" onPress={() => setDimmed(true)} />
          <Button label="Journal et diagnostic" icon="pulse-outline" kind="ghost" onPress={() => router.push('/diagnostic')} />
        </Row>
      </Card>

      <Modal visible={dimmed} animationType="fade" statusBarTranslucent onRequestClose={() => setDimmed(false)}>
        <Pressable accessibilityLabel="Quitter l'écran de veille" onPress={() => setDimmed(false)} style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
          <Text style={{ color: '#3a4257', fontSize: 64, fontWeight: '200', fontVariant: ['tabular-nums'] }}>{formatClock(now.getTime())}</Text>
          <Text style={{ color: '#3a4257', fontSize: 15 }}>{s.onAir ? `À l'antenne · ${s.announcement?.title ?? s.current?.title ?? ''}` : 'Hors antenne'}</Text>
          <Text style={{ color: '#262c3b', fontSize: 13, marginTop: space.xl }}>Touchez l'écran pour revenir</Text>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function InfoLine({ icon, label, value }: { icon: 'megaphone-outline' | 'time-outline'; label: string; value: string }) {
  return (
    <Row style={{ flexWrap: 'nowrap', gap: space.md }}>
      <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Muted style={{ fontSize: 12 }}>{label}</Muted>
        <Body numberOfLines={1} style={{ fontWeight: '600' }}>{value}</Body>
      </View>
    </Row>
  );
}
