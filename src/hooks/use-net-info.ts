import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Live connectivity flag. True until NetInfo proves otherwise, so the UI
 * never flashes an offline banner during startup.
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const update = (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    };

    const unsubscribe = NetInfo.addEventListener(update);
    NetInfo.fetch().then(update);

    return () => unsubscribe();
  }, []);

  return isOnline;
}
