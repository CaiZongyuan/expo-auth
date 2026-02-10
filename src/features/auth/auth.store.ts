import { create } from 'zustand';

import { clearRefreshToken, getRefreshToken, setRefreshToken } from '@/src/core/storage/refreshToken';

import { getMe, loginMobile, logoutMobile, refreshMobile, registerUser } from './auth.api';
import type { UserCreate, UserRead } from './auth.types';

export type SessionStatus = 'booting' | 'guest' | 'authed';

type AuthState = {
  status: SessionStatus;
  accessToken: string | null;
  user: UserRead | null;

  bootstrap: () => Promise<void>;
  signIn: (usernameOrEmail: string, password: string) => Promise<void>;
  signUp: (input: UserCreate) => Promise<void>;
  signOut: () => Promise<void>;

  refreshAccessToken: () => Promise<string>;
  clearSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'booting',
  accessToken: null,
  user: null,

  clearSession: async () => {
    try {
      await clearRefreshToken();
    } finally {
      set({ status: 'guest', accessToken: null, user: null });
    }
  },

  refreshAccessToken: async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokens = await refreshMobile(refreshToken);
    await setRefreshToken(tokens.refresh_token);
    set({ accessToken: tokens.access_token });

    return tokens.access_token;
  },

  bootstrap: async () => {
    set({ status: 'booting' });

    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      set({ status: 'guest', accessToken: null, user: null });
      return;
    }

    try {
      const accessToken = await get().refreshAccessToken();
      const user = await getMe(accessToken);
      set({ status: 'authed', user });
    } catch {
      await get().clearSession();
    }
  },

  signIn: async (usernameOrEmail, password) => {
    try {
      const tokens = await loginMobile(usernameOrEmail, password);
      await setRefreshToken(tokens.refresh_token);
      set({ accessToken: tokens.access_token });

      const user = await getMe(tokens.access_token);
      set({ status: 'authed', user });
    } catch (error) {
      await get().clearSession();
      throw error;
    }
  },

  signUp: async (input) => {
    await registerUser(input);
    await get().signIn(input.username, input.password);
  },

  signOut: async () => {
    const accessToken = get().accessToken;
    const refreshToken = await getRefreshToken();

    try {
      if (refreshToken) {
        await logoutMobile(refreshToken, accessToken);
      }
    } catch {
      // Best-effort; local session still must be cleared.
    }

    await get().clearSession();
  },
}));

