import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { API_V1_BASE_URL } from '@/src/core/config/env';
import { useAuthStore } from '@/src/features/auth/auth.store';

import { runRefreshSingleFlight } from './refreshGate';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const apiClient = axios.create({
  baseURL: API_V1_BASE_URL,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (!originalRequest || originalRequest._retry || status !== 401) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const nextAccessToken = await runRefreshSingleFlight(() =>
        useAuthStore.getState().refreshAccessToken(),
      );

      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      await useAuthStore.getState().clearSession();
      return Promise.reject(refreshError);
    }
  },
);

