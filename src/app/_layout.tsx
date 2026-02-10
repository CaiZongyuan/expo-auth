import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { SplashScreenController } from '@/src/components/splash';
import { useAuthStore } from '@/src/features/auth/auth.store';
import { QueryProvider } from '@/src/providers/queryClient';

export default function Root() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <QueryProvider>
      <SplashScreenController />
      <RootNavigator />
    </QueryProvider>
  );
}

function RootNavigator() {
  const status = useAuthStore((s) => s.status);

  return (
    <Stack>
      <Stack.Protected guard={status === 'authed'}>
        <Stack.Screen name="(home)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={status !== 'authed'}>
        <Stack.Screen name="sign-in" options={{ title: 'Sign In' }} />
        <Stack.Screen name="sign-up" options={{ title: 'Sign Up' }} />
      </Stack.Protected>
    </Stack>
  );
}
