import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as RouterThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { FontSources } from '@/constants/theme';
import { ThemeProvider, useThemePreference } from '@/context/theme';

// Keep the native splash screen visible until the Outfit fonts AND the saved
// theme preference are ready — hiding earlier would flash the wrong palette.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts(FontSources);

  return (
    <ThemeProvider>
      <RootNavigator fontsLoaded={fontsLoaded} />
    </ThemeProvider>
  );
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { resolved, isLoaded: themeLoaded } = useThemePreference();

  useEffect(() => {
    if (fontsLoaded && themeLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, themeLoaded]);

  if (!fontsLoaded || !themeLoaded) {
    // The native splash screen is still covering the app.
    return null;
  }

  return (
    <RouterThemeProvider value={resolved === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </RouterThemeProvider>
  );
}
