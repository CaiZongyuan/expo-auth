import { SplashScreen } from 'expo-router';
import { useEffect } from 'react';

import { useAuthStore } from '@/src/features/auth/auth.store';

SplashScreen.preventAutoHideAsync().catch(() => null);

export function SplashScreenController() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== 'booting') {
      SplashScreen.hideAsync().catch(() => null);
    }
  }, [status]);

  return null;
}
