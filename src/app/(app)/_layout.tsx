import { Stack } from 'expo-router';

/** Authenticated screens (post-login). The real home will live here too. */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
