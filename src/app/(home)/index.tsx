import { useQuery } from '@tanstack/react-query';
import { ScrollView, Pressable, StyleSheet, Text } from 'react-native';

import type { UserRead } from '@/src/features/auth/auth.types';
import { useAuthStore } from '@/src/features/auth/auth.store';
import { apiClient } from '@/src/lib/api/apiClient';
import { getApiErrorMessage } from '@/src/lib/api/errors';

async function fetchMe(): Promise<UserRead> {
  const response = await apiClient.get<UserRead>('/user/me/');
  return response.data;
}

export default function Index() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const meQuery = useQuery({
    queryKey: ['user', 'me'],
    queryFn: fetchMe,
    enabled: status === 'authed',
    initialData: user ?? undefined,
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Authenticated</Text>

      <Text style={styles.label}>User</Text>
      <Text style={styles.mono}>{JSON.stringify(meQuery.data ?? null, null, 2)}</Text>

      {meQuery.isError ? <Text style={styles.error}>{getApiErrorMessage(meQuery.error)}</Text> : null}

      <Pressable style={styles.button} onPress={() => meQuery.refetch()}>
        <Text style={styles.buttonText}>Reload /user/me</Text>
      </Pressable>

      <Pressable style={[styles.button, styles.danger]} onPress={() => void signOut()}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#111827',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 10,
  },
  button: {
    marginTop: 14,
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  danger: {
    backgroundColor: '#b91c1c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    marginTop: 12,
  },
});
