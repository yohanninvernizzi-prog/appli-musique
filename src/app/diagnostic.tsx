import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Alert, Platform, Share, Text, View } from 'react-native';
import { engine, fmtDateTime } from '../audio/engine';
import { Body, Button, Card, IconButton, Label, Muted, Row, Screen, Title } from '../ui/components';
import { useEngine } from '../ui/hooks';
import { colors } from '../ui/theme';

/** Écran technique : journal des événements, à partager pour vérifier le comportement écran éteint. */
export default function Diagnostic() {
  const s = useEngine();
  const router = useRouter();

  function openBatterySettings() {
    if (Platform.OS !== 'android') return;
    Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() =>
      Linking.openSettings().catch(() => Alert.alert('Réglages indisponibles', 'Ouvrez Paramètres > Applications > Appli Musique > Batterie.')),
    );
  }

  function share() {
    const lines = [...s.log].reverse().map((l) => `${fmtDateTime(l.at)}  ${l.message}`);
    const header = `Journal Appli Musique — automatique : ${s.auto ? 'oui' : 'non'}, intervalle : ${s.intervalMin} min, publicités actives : ${s.adCount}`;
    void Share.share({ message: [header, ...lines].join('\n') });
  }

  function clear() {
    Alert.alert('Effacer le journal ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: () => engine.clearLog() },
    ]);
  }

  return (
    <Screen>
      <Row style={{ flexWrap: 'nowrap' }}>
        <IconButton icon="arrow-back" label="Retour à la radio" onPress={() => router.navigate('/')} />
        <View style={{ flex: 1 }}>
          <Title>Journal et diagnostic</Title>
        </View>
      </Row>

      <Card>
        <Label>Tester la diffusion écran éteint</Label>
        <Body>
          1. Lancez la diffusion, éteignez l'écran et laissez tourner une heure.{'\n'}
          2. Revenez ici : chaque publicité doit apparaître avec son retard en secondes.{'\n'}
          3. Une ligne « Application suspendue » signifie qu'Android a mis l'application en sommeil.
        </Body>
        <Muted>Si des publicités manquent ou si l'application est suspendue, retirez-la de l'optimisation de la batterie, puis refaites le test.</Muted>
        <Row>
          <Button label="Réglages de batterie" icon="battery-charging-outline" onPress={openBatterySettings} />
        </Row>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Journal · {s.log.length} ligne{s.log.length > 1 ? 's' : ''}</Label>
          <Row>
            <Button label="Partager" icon="share-outline" kind="primary" onPress={share} disabled={s.log.length === 0} />
            <Button label="Effacer" kind="ghost" onPress={clear} disabled={s.log.length === 0} />
          </Row>
        </Row>
        {s.log.length === 0 && <Muted>Aucun événement.</Muted>}
        {s.log.map((l, i) => (
          <Text key={`${l.at}-${i}`} style={{ color: colors.text, fontFamily: Platform.select({ android: 'monospace', default: 'Courier' }), fontSize: 12, lineHeight: 18 }}>
            <Text style={{ color: colors.muted }}>{fmtDateTime(l.at)}  </Text>
            {l.message}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}
