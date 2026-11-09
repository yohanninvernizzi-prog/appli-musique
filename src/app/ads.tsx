import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { engine } from '../audio/engine';
import type { Track } from '../core/types';
import { deleteTrack, listTracks, updateTrack } from '../db/repo';
import { getSource } from '../sources/registry';
import { Body, Button, Card, Chip, Divider, IconButton, Label, Muted, Notice, Row, Screen, Title } from '../ui/components';
import { formatTime, formatWhen, useEngine, useLoad } from '../ui/hooks';
import { colors, space } from '../ui/theme';

const INTERVALS = [5, 10, 15, 20, 30, 60];
const FADES = [0, 1, 2, 3, 5];
const VOLUMES = [50, 75, 100];

export default function Ads() {
  const s = useEngine();
  const [ads, reload] = useLoad<Track[]>(() => listTracks('jingle'), []);
  const [busy, setBusy] = useState(false);
  const active = ads.filter((a) => a.enabled).length;

  async function changed() {
    await reload();
    await engine.reload();
  }

  async function importAds() {
    setBusy(true);
    try {
      await getSource('local')!.importTracks({ kind: 'jingle' });
      await changed();
    } catch (e) {
      Alert.alert('Import impossible', String(e));
    } finally {
      setBusy(false);
    }
  }

  function remove(ad: Track) {
    Alert.alert('Supprimer cette publicité ?', ad.title, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await getSource(ad.source)?.remove(ad);
          await deleteTrack(ad.id);
          await changed();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Title subtitle="Vos messages audio passent à tour de rôle pendant les horaires d'ouverture. La musique baisse, la publicité passe, puis la musique reprend.">
        Publicités
      </Title>

      <Card>
        <Label>Une publicité toutes les</Label>
        <Row>
          {INTERVALS.map((m) => (
            <Chip key={m} label={m === 60 ? '1 h' : `${m} min`} active={s.intervalMin === m} onPress={() => engine.setAdSettings({ intervalMin: m })} />
          ))}
        </Row>
        <Muted>
          {s.nextAd
            ? `Prochaine : ${formatWhen(s.nextAd.at)} · ${s.nextAd.title}`
            : active === 0
              ? 'Aucune publicité active pour le moment.'
              : 'Aucune diffusion prévue : vérifiez les horaires et la diffusion automatique.'}
        </Muted>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>{ads.length === 0 ? 'Vos publicités' : `Vos publicités · ${active} active${active > 1 ? 's' : ''} sur ${ads.length}`}</Label>
        </Row>
        {ads.length === 0 && <Notice>Ajoutez vos fichiers audio (MP3, M4A, WAV…). Ils seront diffusés à tour de rôle.</Notice>}
        {ads.map((ad, i) => {
          const playingThis = s.announcement?.id === ad.id;
          return (
            <View key={ad.id} style={{ gap: space.md }}>
              {i > 0 && <Divider />}
              <Row style={{ flexWrap: 'nowrap', gap: space.md }}>
                <IconButton icon={playingThis ? 'stop' : 'play'} label={playingThis ? "Arrêter l'écoute" : `Écouter ${ad.title}`} onPress={() => (playingThis ? engine.stopPreview() : engine.preview(ad))} />
                <View style={{ flex: 1 }}>
                  <Body numberOfLines={1} style={{ fontWeight: '600', color: ad.enabled ? colors.text : colors.muted }}>{ad.title}</Body>
                  <Muted>{[ad.durationMs ? formatTime(ad.durationMs) : null, ad.enabled ? 'Dans la rotation' : 'En pause'].filter(Boolean).join(' · ')}</Muted>
                </View>
                <Switch
                  value={ad.enabled}
                  accessibilityLabel={`Diffuser ${ad.title}`}
                  onValueChange={async (enabled) => { await updateTrack(ad.id, { enabled }); await changed(); }}
                  trackColor={{ true: colors.accent }}
                />
                <IconButton icon="trash-outline" label={`Supprimer ${ad.title}`} kind="danger" onPress={() => remove(ad)} />
              </Row>
            </View>
          );
        })}
        <Button label={busy ? 'Import en cours…' : 'Ajouter une publicité'} icon="add" kind="primary" onPress={importAds} disabled={busy} />
      </Card>

      <Card>
        <Label>Durée du fondu</Label>
        <Row>
          {FADES.map((f) => (
            <Chip key={f} label={f === 0 ? 'Sans' : `${f} s`} active={s.fadeMs === f * 1000} onPress={() => engine.setAdSettings({ fadeMs: f * 1000 })} />
          ))}
        </Row>
        <Label>Volume des publicités</Label>
        <Row>
          {VOLUMES.map((v) => (
            <Chip key={v} label={`${v} %`} active={Math.round(s.adVolume * 100) === v} onPress={() => engine.setAdSettings({ adVolume: v / 100 })} />
          ))}
        </Row>
        <Muted>Utilisez le bouton d'écoute d'une publicité pendant que la radio joue pour entendre le fondu et le volume.</Muted>
      </Card>
    </Screen>
  );
}
