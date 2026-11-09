import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import { engine } from '../audio/engine';
import { Icon, type IconName } from '../ui/components';
import { colors } from '../ui/theme';

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ focused, color }: { focused: boolean; color: ColorValue }) => <Icon name={focused ? iconActive : icon} size={24} color={color} />,
});

export default function RootLayout() {
  // Au lancement : recharge les réglages et reprend la diffusion automatique si elle était activée.
  useEffect(() => {
    void engine.restore();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.border, height: 68, paddingTop: 6, paddingBottom: 8 },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={tab('Radio', 'radio-outline', 'radio')} />
        <Tabs.Screen name="hours" options={tab('Horaires', 'time-outline', 'time')} />
        <Tabs.Screen name="music" options={tab('Musique', 'musical-notes-outline', 'musical-notes')} />
        <Tabs.Screen name="ads" options={tab('Publicités', 'megaphone-outline', 'megaphone')} />
        <Tabs.Screen name="diagnostic" options={{ href: null }} />
      </Tabs>
    </>
  );
}
