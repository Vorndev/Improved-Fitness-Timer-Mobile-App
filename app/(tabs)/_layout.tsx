import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        // Hide the tab bar to make this a single page app
        tabBarStyle: { display: 'none' },
      }}>
      {/* Commented out - hidden tabs */}
      {/* <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      /> */}

      {/* Timer Page - Default and only visible page */}
      <Tabs.Screen
        name="timerPage"
        options={{
          title: 'Timer Page',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />
        }}
      />
    </Tabs>
  );
}
