import { Stack } from 'expo-router';

/** Auth flow screens — login today; signup / forgot-password next. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
