import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { engine } from '../audio/engine';
import { Button, Card, Chip, Muted, Row, Screen, Title } from '../ui/components';
import { formatTime, useEngine } from '../ui/hooks';
import { colors, space } from '../ui/theme';

export default function Player() {
  const s = useEngine();
  const progress = s.durationMs > 0 ? Math.min(1, s.positionMs / s.durationMs) : 0;
  const statusLabel = { idle: 'Arrêté', playing: 'Lecture', paused: 'Pause', announcing: 'Annonce en cours' }[s.status];

  return (
    <Screen>
      <Title>Lecteur</Title>
      <Card>
        <Muted>{s.queueLabel ? `${s.queueLabel} · ${statusLabel}` : statusLabel}</Muted>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>{s.current?.title ?? 'Aucun titre'}</Text>
        <Muted>{[s.current?.artist, s.current?.album].filter(Boolean).join(' · ')}</Muted>

        <SeekBar progress={progress} onSeek={(f) => engine.seek(f * s.durationMs)} disabled={!s.current || s.durationMs === 0} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Muted>{formatTime(s.positionMs)}</Muted>
          <Muted>{formatTime(s.durationMs)}</Muted>
        </Row>

        <Row style={{ justifyContent: 'center', gap: space.md }}>
          <Button label="⏮" onPress={() => engine.previous()} />
          <Button label={s.status === 'playing' ? 'Pause' : 'Lecture'} kind="primary" onPress={() => engine.toggle()} disabled={!s.current} style={{ minWidth: 120 }} />
          <Button label="⏭" onPress={() => engine.next()} />
        </Row>
        <Row style={{ justifyContent: 'center' }}>
          <Button label="−15 s" onPress={() => engine.seek(s.positionMs - 15000)} disabled={!s.current} />
          <Button label="+15 s" onPress={() => engine.seek(s.positionMs + 15000)} disabled={!s.current} />
        </Row>
      </Card>

      <Card>
        <Muted>Ordre de lecture</Muted>
        <Row>
          <Chip label="Linéaire" active={s.playMode === 'linear'} onPress={() => engine.setMode('linear', s.repeatMode)} />
          <Chip label="Aléatoire" active={s.playMode === 'shuffle'} onPress={() => engine.setMode('shuffle', s.repeatMode)} />
        </Row>
        <Muted>Répétition</Muted>
        <Row>
          <Chip label="Sans boucle" active={s.repeatMode === 'off'} onPress={() => engine.setMode(s.playMode, 'off')} />
          <Chip label="Boucle playlist" active={s.repeatMode === 'all'} onPress={() => engine.setMode(s.playMode, 'all')} />
          <Chip label="Boucle titre" active={s.repeatMode === 'one'} onPress={() => engine.setMode(s.playMode, 'one')} />
        </Row>
      </Card>
    </Screen>
  );
}

function SeekBar({ progress, onSeek, disabled }: { progress: number; onSeek: (fraction: number) => void; disabled?: boolean }) {
  const [width, setWidth] = useState(0);
  return (
    <Pressable
      accessibilityLabel="Barre de progression"
      disabled={disabled}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={(e) => width > 0 && onSeek(Math.min(1, Math.max(0, e.nativeEvent.locationX / width)))}
      style={{ height: 28, justifyContent: 'center' }}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.panelAlt }} pointerEvents="none">
        <View style={{ height: 6, borderRadius: 3, width: `${progress * 100}%`, backgroundColor: colors.accent }} />
      </View>
    </Pressable>
  );
}
