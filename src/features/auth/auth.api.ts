import type { AxiosRequestConfig } from 'axios';

import { rawClient } from '@/src/lib/api/rawClient';

import type { MobileToken, UserCreate, UserRead } from './auth.types';

function toFormUrlEncoded(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export async function loginMobile(usernameOrEmail: string, password: string): Promise<MobileToken> {
  const body = toFormUrlEncoded({ username: usernameOrEmail, password });

  const response = await rawClient.post<MobileToken>('/login/mobile', body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
}

export async function refreshMobile(refreshToken: string): Promise<MobileToken> {
  const response = await rawClient.post<MobileToken>('/refresh/mobile', { refresh_token: refreshToken });
  return response.data;
}

export async function logoutMobile(refreshToken: string, accessToken?: string | null): Promise<void> {
  const config: AxiosRequestConfig = {};

  if (accessToken) {
    config.headers = { Authorization: `Bearer ${accessToken}` };
  }

  await rawClient.post('/logout/mobile', { refresh_token: refreshToken }, config);
}

export async function registerUser(input: UserCreate): Promise<UserRead> {
  const response = await rawClient.post<UserRead>('/user', input);
  return response.data;
}

export async function getMe(accessToken: string): Promise<UserRead> {
  const response = await rawClient.get<UserRead>('/user/me/', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

