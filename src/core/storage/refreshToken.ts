import { deleteSecureItem, getSecureItem, setSecureItem } from './secureStorage';

const REFRESH_TOKEN_KEY = 'refresh_token';

export async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await setSecureItem(REFRESH_TOKEN_KEY, token);
}

export async function clearRefreshToken(): Promise<void> {
  await deleteSecureItem(REFRESH_TOKEN_KEY);
}

