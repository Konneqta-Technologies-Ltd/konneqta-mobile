import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 *
 * `useSyncExternalStore` gives a hydration-safe read: the server snapshot is
 * always 'light' (matching the static markup), and after hydration the real
 * device scheme is returned — without calling setState inside an effect.
 */

const emptySubscribe = () => () => {};
const getServerSnapshot = () => 'light' as const;

export function useColorScheme() {
  const rnScheme = useRNColorScheme();

  return useSyncExternalStore(
    emptySubscribe,
    () => rnScheme ?? 'light',
    getServerSnapshot
  );
}
