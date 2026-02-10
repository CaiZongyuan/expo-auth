function requiredEnv(name: string): string {
  // eslint-disable-next-line expo/no-dynamic-env-var
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] Missing ${name}. Set it in .env (Expo Go 真机请使用局域网 IP，而不是 localhost).`,
    );
  }
  return value;
}

function normalizeApiV1BaseUrl(rawBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawBaseUrl.trim());
  } catch {
    throw new Error(`[env] Invalid EXPO_PUBLIC_API_BASE_URL: ${rawBaseUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('[env] EXPO_PUBLIC_API_BASE_URL must start with http:// or https://');
  }

  const path = url.pathname.replace(/\/+$/, '');
  if (path && path !== '/api/v1') {
    throw new Error('[env] EXPO_PUBLIC_API_BASE_URL must be host only, or end with /api/v1');
  }

  const origin = url.origin.replace(/\/+$/, '');
  return path === '/api/v1' ? `${origin}/api/v1` : `${origin}/api/v1`;
}

export const API_V1_BASE_URL = normalizeApiV1BaseUrl(requiredEnv('EXPO_PUBLIC_API_BASE_URL'));

