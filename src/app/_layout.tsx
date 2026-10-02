import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../ui/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.panel },
          headerTintColor: colors.text,
          tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
          tabBarIconStyle: { display: 'none' },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Bibliothèque' }} />
        <Tabs.Screen name="playlists" options={{ title: 'Playlists' }} />
        <Tabs.Screen name="player" options={{ title: 'Lecteur' }} />
        <Tabs.Screen name="announcements" options={{ title: 'Annonces' }} />
        <Tabs.Screen name="radio" options={{ title: 'Mode radio' }} />
      </Tabs>
    </>
  );
}
